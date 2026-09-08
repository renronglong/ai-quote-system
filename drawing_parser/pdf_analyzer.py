"""
drawing_parser.pdf_analyzer
===========================
PDF 图纸分析器

使用 pdfplumber 提取文字，正则匹配材料、重量、表面处理等技术参数。
"""

import os
import re
from typing import Dict, List, Optional


# ===================== PDF 文字提取 =====================

def extract_text(pdf_path: str) -> Dict:
    """
    从 PDF 中提取所有页面的文字内容。
    
    Returns:
        dict: {
            'page_count': int,
            'pages': [{'page': int, 'text': str}],
            'full_text': str,
        }
    """
    try:
        import pdfplumber
    except ImportError:
        raise RuntimeError("需要安装 pdfplumber: pip install pdfplumber")
    
    pages_data = []
    full_text = ""
    
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            pages_data.append({
                'page': i + 1,
                'text': text,
                'width': float(page.width),
                'height': float(page.height),
            })
            full_text += text + "\n"
    
    return {
        'page_count': len(pages_data),
        'pages': pages_data,
        'full_text': full_text,
    }


# ===================== 正则提取器 =====================

def extract_material(text: str) -> Optional[str]:
    """提取材料牌号"""
    patterns = [
        r'(?:AL|Al|al)\s*(\d{4})\s*[-–]?\s*([TtHh]\d+)?',
        r'(?:材料|材质|材质牌号|MATERIAL)[:\s：]*([A-Za-z0-9\-]+)',
        r'(6063|5052|6061|5083|3003)\s*[-–]?\s*([TtHh]\d+)?',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            groups = m.groups()
            if len(groups) == 2:
                alloy = groups[0]
                temper = groups[1] or ''
                return f"AL{alloy}-{temper.upper()}" if temper else f"AL{alloy}"
            elif len(groups) == 1:
                return m.group(1)
    return None


def extract_weight(text: str) -> Optional[float]:
    """提取重量（单位：g 或 kg）"""
    patterns = [
        r'(?:重量|Weight|wt)[:\s：]*([\d.]+)\s*(?:g|克|克重)',
        r'([\d.]+)\s*(?:g|克)\s*(?:/件|/个|/pcs)?',
        r'(?:重量|Weight|wt)[:\s：]*([\d.]+)\s*(?:kg|千克)',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            val = float(m.group(1))
            if 'kg' in text[m.start():m.end() + 5].lower():
                return val * 1000  # 转为 g
            return val
    return None


def extract_surface_treatment(text: str) -> Optional[str]:
    """提取表面处理信息"""
    patterns = [
        r'(?:表面处理|Surface|表面)[:\s：]*(.*?)(?:\n|$)',
        r'(阳极氧化|Anodiz|粉末涂装|喷涂|电泳|电镀|抛光|喷砂)',
        r'RAL\s*[-–]?\s*(\d{4})',
    ]
    results = []
    for p in patterns:
        matches = re.findall(p, text, re.IGNORECASE)
        for m in matches:
            if isinstance(m, tuple):
                results.append(m[0].strip())
            elif m.strip():
                results.append(m.strip())
    return '; '.join(results) if results else None


def extract_salt_fog_test(text: str) -> Optional[str]:
    """提取盐雾测试要求"""
    patterns = [
        r'(?:盐雾|Salt\s*(?:spray|fog))[:\s：]*(.*?)(?:\n|$)',
        r'(\d+)\s*(?:h|小时|hrs?)\s*(?:盐雾|Salt)',
        r'(?:盐雾|Salt)[:\s：]*(\d+)\s*(?:h|小时)',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(0).strip()
    return None


def extract_rohs(text: str) -> Optional[bool]:
    """检测 RoHS 合规性"""
    if re.search(r'RoHS|REACH|环保', text, re.IGNORECASE):
        return True
    return None


def extract_product_code(text: str) -> Optional[str]:
    """提取产品编号"""
    patterns = [
        r'(?:产品编号|图号|DRAWING\s*#|PART\s*NO)[:\s：]*([A-Z0-9\-]+)',
        r'(HTA[A-Z0-9\-]+)',
        r'([A-Z]{2,5}-[A-Z0-9]{3,6})',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def extract_product_name(text: str) -> Optional[str]:
    """提取产品名称"""
    patterns = [
        r'(?:产品名称|零件名|PART[-\s]*NAME)[:\s：]*(.*?)(?:\n|$)',
        r'(IGUASSU\s*[\d.]+[^\n]*)',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1).strip()[:100]
    return None


def extract_version(text: str) -> Optional[str]:
    """提取版本号"""
    patterns = [
        r'(?:版本|Version|Rev)[:\s：]*([A-Z0-9]+)',
        r'(D\d{2,3})',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1)
    return None


def extract_designer(text: str) -> Optional[str]:
    """提取设计师"""
    patterns = [
        r'(?:设计|设计师|Designer|Drawn)[:\s：]*(.*?)(?:\n|$)',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            name = m.group(1).strip()
            # 过滤掉太长的内容
            if 2 < len(name) < 20:
                return name
    return None


# ===================== 综合分析入口 =====================

def analyze_pdf(pdf_path: str) -> Dict:
    """
    PDF 图纸综合分析入口。
    
    Returns:
        dict: 完整的 PDF 分析结果
    """
    if not os.path.exists(pdf_path):
        raise FileNotFoundError(f"文件不存在: {pdf_path}")
    
    # 1. 提取文字
    text_data = extract_text(pdf_path)
    full_text = text_data['full_text']
    
    # 2. 正则提取各项信息
    material = extract_material(full_text)
    weight = extract_weight(full_text)
    surface = extract_surface_treatment(full_text)
    salt_fog = extract_salt_fog_test(full_text)
    rohs = extract_rohs(full_text)
    product_code = extract_product_code(full_text)
    product_name = extract_product_name(full_text)
    version = extract_version(full_text)
    designer = extract_designer(full_text)
    
    return {
        'file_name': os.path.basename(pdf_path),
        'page_count': text_data['page_count'],
        'material': material,
        'weight_g': weight,
        'surface_treatment': surface,
        'salt_fog_test': salt_fog,
        'rohs_compliant': rohs,
        'product_code': product_code,
        'product_name': product_name,
        'version': version,
        'designer': designer,
        'full_text_preview': full_text[:2000] if full_text else '',
        'parse_success': True,
        'parse_errors': None,
    }
