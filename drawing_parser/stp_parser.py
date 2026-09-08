"""
drawing_parser.stp_parser
=========================
STP/STEP 铝型材截面解析器

策略：
1. 主方法：FreeCAD Part.open() + Volume/Length 法计算截面积
   （section() 的 wires 可能为空，但 Volume/Length 始终有效）
2. Fallback：纯文本 VERTEX_POINT 解析（无需 FreeCAD）

米重公式：截面积(mm²) × 0.0027 = kg/m（铝合金 6063）
"""

import os
import re
import math
import json
import tempfile
import subprocess
from collections import defaultdict
from typing import Dict, Optional

from .config import (
    FREECAD_CMD, FREECAD_USER_HOME, AL_DENSITY,
    WEIGHT_FACTOR, AREA_PRECISION, WEIGHT_PRECISION, LENGTH_PRECISION, WORK_DIR,
)


# ===================== FreeCAD 解析（主方法） =====================

def parse_stp_freecad(stp_path: str, freecad_cmd: str = None) -> Dict:
    """
    使用 FreeCAD 解析 STP 文件。
    
    核心算法：
    1. Part.open() 加载文档
    2. 获取形状 BoundBox → 挤出方向（最长轴）
    3. 截面积 = Volume / Length（Volume/Length 法，比 section wire 更可靠）
    4. 外周长 = section().Edges 总长度
    5. 米重 = 截面积 × WEIGHT_FACTOR
    
    Returns:
        dict: 截面参数
    """
    freecad_cmd = freecad_cmd or FREECAD_CMD
    
    # 准备临时路径（避免中文路径问题）
    tmp_dir = tempfile.mkdtemp(prefix="stp_parse_", dir=WORK_DIR)
    tmp_stp = os.path.join(tmp_dir, "input.stp")
    tmp_result = os.path.join(tmp_dir, "result.json")
    
    # 复制文件到临时目录
    import shutil
    shutil.copy2(stp_path, tmp_stp)
    
    # 生成 FreeCAD 解析脚本
    script = _generate_freecad_script(tmp_stp, tmp_result)
    script_path = os.path.join(tmp_dir, "parse.py")
    with open(script_path, 'w', encoding='utf-8') as f:
        f.write(script)
    
    # 执行 FreeCAD
    env = os.environ.copy()
    env['FREECAD_USER_HOME'] = FREECAD_USER_HOME
    
    try:
        proc = subprocess.run(
            [freecad_cmd, "-c", f"exec(open('{script_path}').read())"],
            capture_output=True, text=True, timeout=120, env=env
        )
        
        if proc.returncode != 0:
            raise RuntimeError(f"FreeCAD 解析失败:\n{proc.stderr[-1000:]}")
        
        # 读取结果
        if os.path.exists(tmp_result):
            with open(tmp_result, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            # 尝试从 stdout 解析
            return _parse_stdout(proc.stdout)
    
    except FileNotFoundError:
        raise RuntimeError(f"FreeCAD 命令未找到: {freecad_cmd}")
    finally:
        # 清理临时文件
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass


def _generate_freecad_script(stp_path: str, result_path: str) -> str:
    """生成 FreeCAD Python 脚本"""
    return f'''
import os, sys, json, math
os.environ["FREECAD_USER_HOME"] = "/tmp"
import FreeCAD
FreeCAD.ConfigSet("NoSplash", "1")
import Part

# ====== 加载 STP ======
filepath = r"{stp_path}"

# 方法1：Part.open() 获取文档
try:
    doc = Part.open(filepath)
    # Part.open 返回文档对象
    shapes = []
    for obj in doc.Objects:
        if hasattr(obj, "Shape") and not obj.Shape.isNull():
            shapes.append(obj.Shape)
except Exception as e1:
    # 方法2：Part.Shape().read()
    try:
        shape = Part.Shape()
        shape.read(filepath)
        shapes = [shape]
    except Exception as e2:
        print(f"ERROR: load failed: {{e1}} / {{e2}}")
        sys.exit(1)

if not shapes:
    print("ERROR: No shapes found")
    sys.exit(1)

# 合并所有形状
if len(shapes) == 1:
    full_shape = shapes[0]
else:
    full_shape = shapes[0]
    for s in shapes[1:]:
        full_shape = full_shape.fuse(s)

# ====== 包围盒 & 挤出方向 ======
bb = full_shape.BoundBox
dx = bb.XMax - bb.XMin
dy = bb.YMax - bb.YMin
dz = bb.ZMax - bb.ZMin
dims = {{"X": dx, "Y": dy, "Z": dz}}
ext_axis = max(dims, key=dims.get)
ext_len = dims[ext_axis]

# 截面轴
sec_axes = [a for a in ["X", "Y", "Z"] if a != ext_axis]
sec_w = dims[sec_axes[0]]
sec_h = dims[sec_axes[1]]

# ====== 截面积：Volume/Length 法 ======
# 核心原理：对于挤出体，Volume = Area × Length → Area = Volume / Length
volume = full_shape.Volume  # mm³
if ext_len > 0 and volume > 0:
    section_area = volume / ext_len  # mm²
    area_method = "volume_length"
else:
    section_area = 0
    area_method = "none"

# ====== 外周长：section() 边长 ======
# 切割面在挤出方向中间
cut_pos = (dims[ext_axis] if ext_axis == "X" else bb.XMin)
if ext_axis == "Z":
    cut_z = bb.ZMin + ext_len / 2
    plane = Part.makePlane(
        dx + 200, dy + 200,
        FreeCAD.Vector(bb.XMin - 100, bb.YMin - 100, cut_z),
        FreeCAD.Vector(0, 0, 1)
    )
elif ext_axis == "X":
    cut_x = bb.XMin + ext_len / 2
    plane = Part.makePlane(
        dy + 200, dz + 200,
        FreeCAD.Vector(cut_x, bb.YMin - 100, bb.ZMin - 100),
        FreeCAD.Vector(1, 0, 0)
    )
else:  # Y
    cut_y = bb.YMin + ext_len / 2
    plane = Part.makePlane(
        dx + 200, dz + 200,
        FreeCAD.Vector(bb.XMin - 100, cut_y, bb.ZMin - 100),
        FreeCAD.Vector(0, 1, 0)
    )

section = full_shape.section(plane)
edges = section.Edges
outer_perimeter = sum(e.Length for e in edges)

# ====== 孔检测（截面中的完整圆） ======
circles = []
for e in edges:
    c = e.Curve
    if hasattr(c, "Radius"):
        pr = e.ParameterRange
        ang = abs(pr[1] - pr[0])
        if ang >= 2 * math.pi - 0.01:
            circles.append({{
                "center": [round(c.Center.x, 2), round(c.Center.y, 2)],
                "diameter_mm": round(c.Radius * 2, 2)
            }})

# ====== 米重 ======
weight = section_area * {WEIGHT_FACTOR}

# ====== 输出 ======
result = {{
    "file_name": os.path.basename(filepath),
    "section_width_mm": round(sec_w, {LENGTH_PRECISION}),
    "section_height_mm": round(sec_h, {LENGTH_PRECISION}),
    "section_size": "{{:.1f}} x {{:.1f}}".format(sec_w, sec_h),
    "section_area_mm2": round(section_area, {AREA_PRECISION}),
    "area_method": area_method,
    "outer_perimeter_mm": round(outer_perimeter, {LENGTH_PRECISION}),
    "weight_kg_per_m": round(weight, {WEIGHT_PRECISION}),
    "extrusion_length_mm": round(ext_len, {LENGTH_PRECISION}),
    "extrusion_axis": ext_axis,
    "section_circles": circles,
    "volume_mm3": round(volume, 2),
    "bbox": {{
        "x": [round(bb.XMin, 2), round(bb.XMax, 2)],
        "y": [round(bb.YMin, 2), round(bb.YMax, 2)],
        "z": [round(bb.ZMin, 2), round(bb.ZMax, 2)],
    }}
}}

with open(r"{result_path}", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

print(json.dumps(result, ensure_ascii=False))
'''


def _parse_stdout(stdout: str) -> Dict:
    """尝试从 FreeCAD stdout 中解析 JSON 结果"""
    # 查找 JSON 块
    for line in stdout.split('\n'):
        line = line.strip()
        if line.startswith('{') and line.endswith('}'):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                pass
    raise RuntimeError(f"无法从 FreeCAD 输出解析结果: {stdout[-500:]}")


# ===================== 纯文本 Fallback =====================

def parse_stp_text(stp_path: str) -> Dict:
    """
    纯文本 STP 解析（无需 FreeCAD）。
    
    解析 VERTEX_POINT 坐标，计算包围盒和截面尺寸。
    注意：此方法无法计算截面积和米重，仅提供尺寸估算。
    """
    if not os.path.exists(stp_path):
        raise FileNotFoundError(f"文件不存在: {stp_path}")
    
    with open(stp_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    # 解析 VERTEX_POINT
    pattern = r"VERTEX_POINT\s*\(\s*'[^']*'\s*,\s*\(\s*([-\d.Ee+]+)\s*,\s*([-\d.Ee+]+)\s*,\s*([-\d.Ee+]+)\s*\)\s*\)"
    vertices = []
    for m in re.finditer(pattern, content, re.IGNORECASE):
        vertices.append((float(m.group(1)), float(m.group(2)), float(m.group(3))))
    
    if not vertices:
        raise ValueError("未找到 VERTEX_POINT，可能不是有效的 STEP 文件")
    
    xs = [v[0] for v in vertices]
    ys = [v[1] for v in vertices]
    zs = [v[2] for v in vertices]
    
    x_range = max(xs) - min(xs)
    y_range = max(ys) - min(ys)
    z_range = max(zs) - min(zs)
    
    dims = {'X': x_range, 'Y': y_range, 'Z': z_range}
    ext_axis = max(dims, key=dims.get)
    ext_len = dims[ext_axis]
    
    sec_axes = [a for a in ['X', 'Y', 'Z'] if a != ext_axis]
    sec_w = dims[sec_axes[0]]
    sec_h = dims[sec_axes[1]]
    
    return {
        'file_name': os.path.basename(stp_path),
        'section_width_mm': round(sec_w, LENGTH_PRECISION),
        'section_height_mm': round(sec_h, LENGTH_PRECISION),
        'section_size': f"{round(sec_w, 1)} x {round(sec_h, 1)}",
        'section_area_mm2': 0,  # 纯文本无法计算
        'area_method': 'text_fallback',
        'outer_perimeter_mm': 0,
        'weight_kg_per_m': 0,
        'extrusion_length_mm': round(ext_len, LENGTH_PRECISION),
        'extrusion_axis': ext_axis,
        'section_circles': [],
        'volume_mm3': 0,
        'bbox': {
            'x': [round(min(xs), 2), round(max(xs), 2)],
            'y': [round(min(ys), 2), round(max(ys), 2)],
            'z': [round(min(zs), 2), round(max(zs), 2)],
        },
        'vertex_count': len(vertices),
    }


# ===================== CNC 加工特征分析 =====================

def analyze_cnc_features(stp_path: str, freecad_cmd: str = None) -> Dict:
    """
    分析 STP 文件中的 CNC 加工特征（侧面孔等）。
    
    检测垂直于挤出方向的圆柱面 → 判定为 CNC 钻孔。
    """
    freecad_cmd = freecad_cmd or FREECAD_CMD
    
    tmp_dir = tempfile.mkdtemp(prefix="stp_cnc_", dir=WORK_DIR)
    tmp_stp = os.path.join(tmp_dir, "input.stp")
    tmp_result = os.path.join(tmp_dir, "cnc_result.json")
    
    import shutil
    shutil.copy2(stp_path, tmp_stp)
    
    script = _generate_cnc_script(tmp_stp, tmp_result)
    script_path = os.path.join(tmp_dir, "cnc_parse.py")
    with open(script_path, 'w', encoding='utf-8') as f:
        f.write(script)
    
    env = os.environ.copy()
    env['FREECAD_USER_HOME'] = FREECAD_USER_HOME
    
    try:
        proc = subprocess.run(
            [freecad_cmd, "-c", f"exec(open('{script_path}').read())"],
            capture_output=True, text=True, timeout=120, env=env
        )
        
        if os.path.exists(tmp_result):
            with open(tmp_result, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {'cnc_holes': [], 'cnc_total_holes': 0, 'machining_time_min': 0}
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _generate_cnc_script(stp_path: str, result_path: str) -> str:
    """生成 CNC 特征解析 FreeCAD 脚本"""
    return f'''
import os, sys, json, math
from collections import defaultdict
os.environ["FREECAD_USER_HOME"] = "/tmp"
import FreeCAD
FreeCAD.ConfigSet("NoSplash", "1")
import Part

filepath = r"{stp_path}"
shape = Part.Shape()
shape.read(filepath)
bb = shape.BoundBox

dx = bb.XMax - bb.XMin
dy = bb.YMax - bb.YMin
dz = bb.ZMax - bb.ZMin
dims = {{"X": dx, "Y": dy, "Z": dz}}
ext_axis = max(dims, key=dims.get)

ext_holes = []
machine_holes = []

for face in shape.Faces:
    s = face.Surface
    if not (hasattr(s, "Radius") and hasattr(s, "Axis")):
        continue
    axis = s.Axis
    r = s.Radius
    d = r * 2
    area = face.Area
    depth = area / (math.pi * d) if d > 0 else 0
    
    ax_abs = [abs(axis.x), abs(axis.y), abs(axis.z)]
    if ext_axis == "Z":
        is_ext = ax_abs[2] > 0.9
    elif ext_axis == "Y":
        is_ext = ax_abs[1] > 0.9
    else:
        is_ext = ax_abs[0] > 0.9
    
    direction = "X" if ax_abs[0] > ax_abs[1] else "Y"
    info = {{"diameter": round(d, 2), "depth": round(depth, 2), "direction": direction, "face_area": round(area, 2)}}
    
    if is_ext:
        ext_holes.append(info)
    else:
        machine_holes.append(info)

# 合并半圆柱面
def merge_holes(faces):
    groups = defaultdict(list)
    for h in faces:
        key = (h["diameter"], round(h["depth"], 1))
        groups[key].append(h)
    merged = []
    for (d, dp), group in groups.items():
        total_area = sum(g["face_area"] for g in group)
        actual_depth = total_area / (math.pi * d) if d > 0 else 0
        count = len(group) // 2 if len(group) >= 2 else len(group)
        merged.append({{"diameter": d, "depth": round(actual_depth, 2), "count": count, "direction": group[0]["direction"]}})
    return merged

machine_merged = merge_holes(machine_holes)
total_holes = sum(h["count"] for h in machine_merged)

# 加工时间估算
total_time = 30  # 装夹
for h in machine_merged:
    d = h["diameter"]
    depth = h["depth"]
    count = h["count"]
    if d <= 5:
        vc, f = 200, 0.06
    elif d <= 10:
        vc, f = 180, 0.10
    else:
        vc, f = 150, 0.15
    rpm = round((1000 * vc) / (math.pi * d))
    feed_rate = round(rpm * f, 1)
    drill_len = depth + 4
    time_per_hole = (drill_len / feed_rate) * 60
    total_time += (time_per_hole + 3 + 5) * count

result = {{
    "cnc_holes": machine_merged,
    "cnc_total_holes": total_holes,
    "machining_time_min": round(total_time / 60, 1),
    "extrusion_features": len(merge_holes(ext_holes)),
}}

with open(r"{result_path}", "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=2)
print(json.dumps(result, ensure_ascii=False))
'''


# ===================== 统一入口 =====================

def parse_stp(stp_path: str, freecad_cmd: str = None, include_cnc: bool = False) -> Dict:
    """
    解析 STP 文件的统一入口。
    
    策略：
    1. 优先使用 FreeCAD（Volume/Length 法）
    2. FreeCAD 不可用时 fallback 到纯文本解析
    
    Args:
        stp_path: STP 文件路径
        freecad_cmd: FreeCAD 命令（可选）
        include_cnc: 是否同时分析 CNC 加工特征
    
    Returns:
        dict: 截面参数
    """
    result = {}
    errors = []
    
    # 尝试 FreeCAD
    try:
        result = parse_stp_freecad(stp_path, freecad_cmd)
    except Exception as e:
        errors.append(f"FreeCAD 解析失败: {str(e)}")
        # Fallback 到纯文本
        try:
            result = parse_stp_text(stp_path)
            errors.append("已使用纯文本 fallback（无截面积/米重）")
        except Exception as e2:
            errors.append(f"纯文本解析也失败: {str(e2)}")
            raise RuntimeError(f"STP 解析全部失败: {'; '.join(errors)}")
    
    # CNC 加工特征
    if include_cnc:
        try:
            cnc = analyze_cnc_features(stp_path, freecad_cmd)
            result.update(cnc)
        except Exception as e:
            result['cnc_holes'] = []
            result['cnc_total_holes'] = 0
            result['machining_time_min'] = 0
            errors.append(f"CNC 分析失败: {str(e)}")
    
    result['parse_errors'] = errors if errors else None
    result['parse_success'] = True
    return result
