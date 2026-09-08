"""
drawing_parser.dwg_converter
=============================
DWG → DXF 转换器 + 批量转换

依赖: ODA File Converter + Xvfb（虚拟显示）
"""

import os
import subprocess
import tempfile
from typing import Optional, List, Dict

from .config import ODA_PATH, XVFB_DISPLAY, WORK_DIR


def convert_dwg_to_dxf(dwg_path: str, output_dir: Optional[str] = None) -> str:
    """
    使用 ODA File Converter 将 DWG 转换为 DXF (ASCII R2018)。
    
    Args:
        dwg_path: DWG 文件路径
        output_dir: DXF 输出目录（可选）
    
    Returns:
        str: DXF 文件路径
    """
    dwg_path = os.path.abspath(dwg_path)
    if not os.path.exists(dwg_path):
        raise FileNotFoundError(f"文件不存在: {dwg_path}")
    
    src_dir = os.path.dirname(dwg_path)
    src_file = os.path.basename(dwg_path)
    
    if output_dir is None:
        output_dir = tempfile.mkdtemp(prefix="dwg_convert_", dir=WORK_DIR)
    os.makedirs(output_dir, exist_ok=True)
    
    # 启动 Xvfb 虚拟显示
    xvfb = _start_xvfb()
    
    try:
        env = os.environ.copy()
        env["DISPLAY"] = XVFB_DISPLAY
        
        result = subprocess.run(
            [ODA_PATH, src_dir, output_dir, "ACAD2018", "DXF", "0", "1", src_file],
            env=env, capture_output=True, text=True, timeout=30
        )
        
        # 查找输出 DXF
        dxf_name = os.path.splitext(src_file)[0] + ".dxf"
        dxf_path = os.path.join(output_dir, dxf_name)
        
        if os.path.exists(dxf_path):
            return dxf_path
        else:
            # 有时 ODA 输出大小写不同
            for f in os.listdir(output_dir):
                if f.lower().endswith('.dxf'):
                    return os.path.join(output_dir, f)
            raise RuntimeError(f"DXF 转换失败，ODA 输出: {result.stderr[-500:]}")
    finally:
        if xvfb:
            xvfb.terminate()


def convert_batch(dwg_files: List[str], output_dir: Optional[str] = None) -> List[Dict]:
    """
    批量转换 DWG → DXF。
    
    Args:
        dwg_files: DWG 文件路径列表
        output_dir: 输出目录
    
    Returns:
        list: [{'dwg': 原文件, 'dxf': DXF路径, 'success': bool, 'error': str}]
    """
    if output_dir is None:
        output_dir = tempfile.mkdtemp(prefix="dwg_batch_", dir=WORK_DIR)
    os.makedirs(output_dir, exist_ok=True)
    
    results = []
    for dwg in dwg_files:
        item = {'dwg': dwg, 'dxf': None, 'success': False, 'error': ''}
        try:
            dxf = convert_dwg_to_dxf(dwg, output_dir)
            item['dxf'] = dxf
            item['success'] = True
        except Exception as e:
            item['error'] = str(e)
        results.append(item)
    
    return results


def _start_xvfb():
    """启动 Xvfb 虚拟显示"""
    try:
        xvfb = subprocess.Popen(
            ["Xvfb", XVFB_DISPLAY, "-screen", "0", "1024x768x24"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
        import time
        time.sleep(0.5)  # 等待 Xvfb 就绪
        return xvfb
    except FileNotFoundError:
        # Xvfb 不可用，可能不需要（如 macOS）
        return None
    except Exception:
        return None


def check_oda_available() -> bool:
    """检查 ODA File Converter 是否可用"""
    return os.path.exists(ODA_PATH) or os.system(f"which {ODA_PATH}") == 0
