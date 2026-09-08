"""
drawing_parser.dxf_analyzer
===========================
DXF 综合分析器：标题栏、孔位、技术要求、标注语义、中文解码

核心功能：
1. 标题栏提取（从 INSERT/ATTRIB 中读取）
2. 中文解码（\\M+5xxxx GBK 编码）
3. 孔位分组统计（CIRCLE 按直径分组）
4. 技术要求文本（MTEXT plain_text 解码）
5. 标注语义分析（DIMENSION 特征分类）
6. 单位自动检测与修正
"""

import os
import re
import math
from collections import defaultdict, Counter
from typing import Dict, List, Optional

from .config import UNIT_MAP, TO_MM_FACTOR, LENGTH_PRECISION


# ===================== 中文解码 =====================

def decode_m5_gbk(text: str) -> str:
    """
    解码 DXF MTEXT 中的 \\M+5xxxx GBK 编码。
    
    规则：\\M+5 后跟 4 位十六进制，每 4 位 = 2 个 GBK 字节 = 1 个中文字符。
    
    示例：\\M+5BFA1 → "主"（GBK 0xBFA1）
    """
    def repl(m):
        h = m.group(1)
        b1, b2 = int(h[:2], 16), int(h[2:], 16)
        try:
            return bytes([b1, b2]).decode('gbk')
        except (UnicodeDecodeError, ValueError):
            return f"[GBK:{h}]"
    return re.sub(r'\\M\+5([0-9A-Fa-f]{4})', repl, text)


def clean_mtext(text: str) -> str:
    """清理 MTEXT 格式控制符，保留纯文本"""
    if not text:
        return ""
    # 移除常见格式符
    text = re.sub(r'\\[AaLlOoKkPpSsQqWwTt][^;]*;', '', text)
    text = re.sub(r'\\[Hh][^;]*;', '', text)
    text = re.sub(r'\\~', ' ', text)
    text = re.sub(r'\{([^}]*)\}', r'\1', text)
    # 解码 GBK
    text = decode_m5_gbk(text)
    return text.strip()


# ===================== 标题栏提取 =====================

def extract_titleblock(dxf_path: str) -> Dict:
    """
    从 DXF 的 INSERT 实体 ATTRIB 中提取标题栏信息。
    
    提取字段：
    - DRAWING# (图号)
    - PART-NAME (零件名)
    - PRODUCT (产品)
    - MATERIAL (材料)
    - VERSION (版本)
    - DATE (日期)
    - DESIGNER (设计师)
    """
    import ezdxf
    
    result = {
        'drawing_number': '',
        'part_name': '',
        'product': '',
        'material': '',
        'version': '',
        'date': '',
        'designer': '',
        'raw_attribs': {},
    }
    
    try:
        doc = ezdxf.readfile(dxf_path)
        msp = doc.modelspace()
        
        # 方法1：从 INSERT 的 ATTRIB 提取
        for insert in msp.query('INSERT'):
            if not hasattr(insert, 'attribs'):
                continue
            for attrib in insert.attribs:
                tag = attrib.dxf.tag.upper()
                raw_text = attrib.dxf.text if hasattr(attrib.dxf, 'text') else ''
                text = clean_mtext(raw_text)
                
                result['raw_attribs'][tag] = text
                
                # 映射到标准字段
                if tag in ('DRAWING#', 'DRAWING', '图号', 'DWG_NO', 'DWGNO'):
                    result['drawing_number'] = text
                elif tag in ('PART-NAME', 'PART_NAME', 'PARTNAME', '零件名', '名称'):
                    result['part_name'] = text
                elif tag in ('PRODUCT', '产品', '项目'):
                    result['product'] = text
                elif tag in ('MATERIAL', '材料', '材质'):
                    result['material'] = text
                elif tag in ('VERSION', '版本', 'REV', 'REVISION'):
                    result['version'] = text
                elif tag in ('DATE', '日期'):
                    result['date'] = text
                elif tag in ('DESIGNER', '设计', '设计师', 'DRAWN', 'DRAWN_BY'):
                    result['designer'] = text
        
        # 方法2：从 TEXT/MTEXT 中搜索（标题栏在固定位置）
        if not result['drawing_number']:
            # 搜索可能的图号模式
            for text_ent in msp.query('TEXT'):
                try:
                    content = text_ent.dxf.text
                    text = clean_mtext(content)
                    # 匹配 HTA-JS342 这样的编号
                    if re.match(r'^[A-Z]{2,5}-[A-Z0-9]{3,6}', text):
                        result['drawing_number'] = text
                    elif re.match(r'^[A-Z0-9]+-\w+', text):
                        result['drawing_number'] = text
                except Exception:
                    pass
        
        if not result['drawing_number']:
            for mtext in msp.query('MTEXT'):
                try:
                    raw = mtext.dxf.get('text', '') or mtext.text
                    text = clean_mtext(raw)
                    if re.match(r'^[A-Z]{2,5}-[A-Z0-9]{3,6}', text):
                        result['drawing_number'] = text
                except Exception:
                    pass
        
    except Exception as e:
        result['error'] = str(e)
    
    # 清理空字段
    result['raw_attribs'] = {k: v for k, v in result['raw_attribs'].items() if v}
    
    return result


# ===================== 孔位提取 =====================

def extract_holes(dxf_path: str, unit_factor: float = 1.0) -> Dict:
    """
    提取 CIRCLE 实体，按直径分组统计。
    
    Returns:
        dict: {
            'total_count': int,
            'groups': [{'diameter_mm': float, 'count': int, 'positions': [...]}],
            'diameter_summary': {diameter: count},
        }
    """
    import ezdxf
    
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()
    
    circles = list(msp.query('CIRCLE'))
    
    # 按直径分组
    by_diameter = defaultdict(list)
    for c in circles:
        try:
            d = round(c.dxf.radius * 2 * unit_factor, 2)
            cx = round(c.dxf.center.x * unit_factor, 2)
            cy = round(c.dxf.center.y * unit_factor, 2)
            by_diameter[d].append({'center': [cx, cy]})
        except Exception:
            pass
    
    groups = []
    diameter_summary = {}
    for diameter in sorted(by_diameter.keys()):
        positions = by_diameter[diameter]
        count = len(positions)
        diameter_summary[diameter] = count
        
        # 分类
        if diameter < 5:
            hole_type = "销钉/通气孔"
        elif diameter < 15:
            hole_type = "螺丝孔"
        elif diameter < 50:
            hole_type = "定位孔"
        else:
            hole_type = "大孔"
        
        groups.append({
            'diameter_mm': diameter,
            'count': count,
            'type': hole_type,
            'positions': positions,
        })
    
    return {
        'total_count': len(circles),
        'groups': groups,
        'diameter_summary': diameter_summary,
    }


# ===================== 技术要求提取 =====================

def extract_technical_requirements(dxf_path: str) -> List[str]:
    """
    从 MTEXT/TEXT 中提取技术要求文本。
    
    使用 ezdxf 的 plain_text() 解码 MTEXT 格式控制符。
    """
    import ezdxf
    
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()
    
    texts = []
    
    # MTEXT（多行文字，常用于技术要求）
    for mtext in msp.query('MTEXT'):
        try:
            # ezdxf 的 plain_text() 方法解码格式符
            plain = mtext.plain_text()
            plain = decode_m5_gbk(plain)
            if plain.strip():
                texts.append(plain.strip())
        except Exception:
            try:
                raw = mtext.dxf.get('text', '')
                if raw:
                    text = clean_mtext(raw)
                    if text:
                        texts.append(text)
            except Exception:
                pass
    
    # TEXT（单行文字）
    for text_ent in msp.query('TEXT'):
        try:
            content = text_ent.dxf.text
            text = decode_m5_gbk(content)
            if text.strip():
                texts.append(text.strip())
        except Exception:
            pass
    
    # 过滤：技术要求通常包含关键词
    keywords = [
        '表面', '处理', '氧化', '阳极', 'RAL', '盐雾', '测试',
        'RoHS', 'REACH', '公差', '配合', '精度', '粗糙',
        '材料', '材质', '铝合金', 'AL', '6063', '5052',
        '去毛刺', '倒角', '热处理', '硬度', '涂装',
        '密封', '防水', '防护', '等级', 'IP',
    ]
    
    requirements = []
    all_texts = []
    for t in texts:
        all_texts.append(t)
        # 检查是否包含技术关键词
        if any(kw in t for kw in keywords):
            requirements.append(t)
    
    return {
        'all_texts': all_texts,
        'technical_requirements': requirements if requirements else all_texts[:10],
    }


# ===================== 标注提取 =====================

def extract_dimensions(dxf_path: str, unit_factor: float = 1.0) -> List[Dict]:
    """提取 DIMENSION 实体的标注值"""
    import ezdxf
    
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()
    
    dimensions = []
    for dim in msp.query('DIMENSION'):
        try:
            actual = dim.dxf.actual_measurement * unit_factor
            text = ''
            try:
                text = dim.dxf.text
            except Exception:
                pass
            
            # 方向判断
            direction = "未知"
            try:
                p2 = dim.dxf.defpoint2
                p3 = dim.dxf.defpoint3
                dx_val = abs(p3.x - p2.x)
                dy_val = abs(p3.y - p2.y)
                if dx_val > dy_val * 2:
                    direction = "水平"
                elif dy_val > dx_val * 2:
                    direction = "垂直"
                else:
                    direction = "对齐"
            except Exception:
                pass
            
            # 公差检测
            has_tolerance = False
            tolerance_val = None
            if '%%P' in text or '±' in text:
                has_tolerance = True
                m = re.search(r'%%P([0-9.]+)', text) or re.search(r'±([0-9.]+)', text)
                if m:
                    tolerance_val = float(m.group(1))
            
            dimensions.append({
                'measurement_mm': round(actual, 2),
                'text': clean_mtext(text),
                'direction': direction,
                'has_tolerance': has_tolerance,
                'tolerance': tolerance_val,
            })
        except Exception:
            pass
    
    return dimensions


# ===================== 单位检测 =====================

def detect_unit(dxf_path: str) -> Dict:
    """
    自动检测 DXF 单位，智能判断声明单位与实际单位是否一致。
    
    Returns:
        dict: {
            'declared_unit': str,
            'insunits': int,
            'actual_unit': str,
            'correction_factor': float,
        }
    """
    import ezdxf
    from ezdxf.bbox import extents
    
    doc = ezdxf.readfile(dxf_path)
    header = doc.header
    msp = doc.modelspace()
    
    insunits = header.get('$INSUNITS', 0)
    measurement = header.get('$MEASUREMENT', 0)
    declared = UNIT_MAP.get(insunits, f"未知({insunits})")
    
    # 收集标注数据
    all_dims = []
    for dim in msp.query('DIMENSION'):
        try:
            v = dim.dxf.actual_measurement
            if v > 0:
                all_dims.append(v)
        except Exception:
            pass
    
    # 收集圆半径
    all_radii = []
    for c in msp.query('CIRCLE'):
        try:
            r = c.dxf.radius
            if r > 0:
                all_radii.append(r)
        except Exception:
            pass
    
    # 边界框
    bbox_w, bbox_h = 0, 0
    try:
        box = extents(list(msp))
        bbox_w = box.extmax.x - box.extmin.x
        bbox_h = box.extmax.y - box.extmin.y
    except Exception:
        pass
    
    # 智能判断
    correction = TO_MM_FACTOR.get(insunits, 1.0)
    actual_unit = declared
    
    if insunits == 1:  # 声称英寸
        likely_mm = False
        if bbox_w > 200 or bbox_h > 200:
            likely_mm = True
        if all_radii and max(all_radii) > 3:
            likely_mm = True
        if all_dims:
            typical_mm = sum(1 for d in all_dims if 10 < d < 2000)
            if typical_mm > len(all_dims) * 0.5:
                likely_mm = True
        
        if likely_mm:
            actual_unit = "毫米 (设置错误-声明英寸)"
            correction = 1.0
        else:
            actual_unit = "英寸"
            correction = 25.4
    
    return {
        'declared_unit': declared,
        'insunits': insunits,
        'measurement': measurement,
        'actual_unit': actual_unit,
        'correction_factor': correction,
        'bbox_raw': [round(bbox_w, 1), round(bbox_h, 1)] if bbox_w > 0 else None,
        'bbox_mm': [round(bbox_w * correction, 1), round(bbox_h * correction, 1)] if bbox_w > 0 else None,
    }


# ===================== 图层信息 =====================

def extract_layers(dxf_path: str) -> List[Dict]:
    """提取图层信息"""
    import ezdxf
    
    doc = ezdxf.readfile(dxf_path)
    layers = []
    for layer in doc.layers:
        layers.append({
            'name': layer.dxf.name,
            'color': layer.dxf.color if hasattr(layer.dxf, 'color') else None,
        })
    return layers


# ===================== 实体统计 =====================

def entity_stats(dxf_path: str) -> Dict:
    """统计 DXF 中的实体类型"""
    import ezdxf
    
    doc = ezdxf.readfile(dxf_path)
    msp = doc.modelspace()
    types = Counter(e.dxftype() for e in msp)
    return dict(types)


# ===================== 综合分析入口 =====================

def analyze_dxf(dxf_path: str) -> Dict:
    """
    DXF 综合分析入口。
    
    Returns:
        dict: 完整的 DXF 分析结果
    """
    if not os.path.exists(dxf_path):
        raise FileNotFoundError(f"文件不存在: {dxf_path}")
    
    # 1. 单位检测
    unit_info = detect_unit(dxf_path)
    factor = unit_info['correction_factor']
    
    # 2. 标题栏
    titleblock = extract_titleblock(dxf_path)
    
    # 3. 孔位
    holes = extract_holes(dxf_path, factor)
    
    # 4. 技术要求
    tech_req = extract_technical_requirements(dxf_path)
    
    # 5. 标注
    dimensions = extract_dimensions(dxf_path, factor)
    
    # 6. 图层
    layers = extract_layers(dxf_path)
    
    # 7. 实体统计
    stats = entity_stats(dxf_path)
    
    return {
        'file_name': os.path.basename(dxf_path),
        'unit': unit_info,
        'titleblock': titleblock,
        'holes': holes,
        'technical_requirements': tech_req,
        'dimensions': dimensions,
        'dimension_count': len(dimensions),
        'layers': layers,
        'layer_count': len(layers),
        'entity_stats': stats,
        'parse_success': True,
        'parse_errors': None,
    }
