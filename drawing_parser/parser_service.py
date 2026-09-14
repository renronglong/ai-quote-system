"""
drawing_parser.parser_service
=============================
统一服务入口：组合所有解析模块，提供标准化输出

方法：
- parse_archive(zip_path) → 完整解析压缩包
- parse_stp(stp_path) → 解析 STP
- parse_dwg(dwg_path) → DWG → DXF + 解析
- parse_pdf(pdf_path) → 解析 PDF
- parse_single(file_path) → 自动识别类型并解析
"""

import os
import json
import tempfile
from pathlib import Path
from typing import Dict, List, Optional

from .config import VERSION, WORK_DIR
from .archive_parser import extract_archive, group_by_component, detect_file_type
from .stp_parser import parse_stp as _parse_stp, parse_stp_text
from .dwg_converter import convert_dwg_to_dxf, convert_batch
from .dxf_analyzer import analyze_dxf
from .pdf_analyzer import analyze_pdf


class DrawingParserService:
    """
    图纸解析统一服务。
    
    用法：
        service = DrawingParserService()
        result = service.parse_single("/path/to/file.stp")
        result = service.parse_archive("/path/to/archive.zip")
    """
    
    def __init__(self, freecad_cmd: str = None, oda_path: str = None, work_dir: str = None):
        """
        初始化解析服务。
        
        Args:
            freecad_cmd: FreeCAD 命令路径
            oda_path: ODA File Converter 路径
            work_dir: 工作临时目录
        """
        self.freecad_cmd = freecad_cmd
        self.oda_path = oda_path
        self.work_dir = work_dir or WORK_DIR
    
    # ===================== 单文件解析 =====================
    
    def parse_single(self, file_path: str) -> Dict:
        """
        自动识别文件类型并解析。
        
        Returns:
            dict: 标准化解析结果
        """
        if not os.path.exists(file_path):
            return self._error_result(f"文件不存在: {file_path}")
        
        ext = Path(file_path).suffix.lower()
        
        if ext in ('.stp', '.step'):
            return self.parse_stp(file_path)
        elif ext == '.dwg':
            return self.parse_dwg(file_path)
        elif ext == '.dxf':
            return self.parse_dxf(file_path)
        elif ext == '.pdf':
            return self.parse_pdf(file_path)
        else:
            return self._error_result(f"不支持的文件格式: {ext}")
    
    def parse_stp(self, stp_path: str) -> Dict:
        """
        解析 STP/STEP 文件。
        
        Returns:
            dict: 截面尺寸、截面积、米重、加工特征等
        """
        result = self._base_result(stp_path, 'stp')
        
        try:
            data = _parse_stp(stp_path, self.freecad_cmd, include_cnc=True)
            
            # 映射到标准字段
            result['section_width_mm'] = data.get('section_width_mm', 0)
            result['section_height_mm'] = data.get('section_height_mm', 0)
            result['section_size'] = data.get('section_size', '')
            result['section_area_mm2'] = data.get('section_area_mm2', 0)
            result['outer_perimeter_mm'] = data.get('outer_perimeter_mm', 0)
            result['weight_kg_per_m'] = data.get('weight_kg_per_m', 0)
            result['extrusion_length_mm'] = data.get('extrusion_length_mm', 0)
            result['extrusion_axis'] = data.get('extrusion_axis', '')
            result['cnc_holes'] = data.get('cnc_holes', [])
            result['cnc_total_holes'] = data.get('cnc_total_holes', 0)
            result['machining_time_min'] = data.get('machining_time_min', 0)
            result['area_method'] = data.get('area_method', '')
            result['bbox'] = data.get('bbox', {})
            result['volume_mm3'] = data.get('volume_mm3', 0)
            result['parse_success'] = True
            
        except Exception as e:
            result['parse_success'] = False
            result['parse_errors'] = [str(e)]
        
        return result
    
    def parse_dwg(self, dwg_path: str) -> Dict:
        """
        解析 DWG 文件（先转 DXF，再分析）。
        
        Returns:
            dict: 标题栏、孔位、标注、技术要求等
        """
        result = self._base_result(dwg_path, 'dwg')
        
        try:
            # DWG → DXF
            dxf_path = convert_dwg_to_dxf(dwg_path)
            
            # 解析 DXF
            dxf_result = analyze_dxf(dxf_path)
            
            # 合并结果
            result['titleblock'] = dxf_result.get('titleblock', {})
            result['hole_count'] = dxf_result.get('holes', {}).get('total_count', 0)
            result['hole_groups'] = dxf_result.get('holes', {}).get('groups', [])
            result['drawing_dimensions'] = dxf_result.get('dimensions', [])
            result['drawing_layers'] = dxf_result.get('layers', [])
            result['technical_requirements'] = dxf_result.get('technical_requirements', {})
            result['unit'] = dxf_result.get('unit', {})
            result['entity_stats'] = dxf_result.get('entity_stats', {})
            result['dxf_path'] = dxf_path
            result['parse_success'] = True
            
            # 提取标题栏中的产品/材料/版本/设计师信息
            tb = result.get('titleblock', {})
            if tb.get('product'):
                result['product_name'] = tb['product']
            if tb.get('material'):
                result['material'] = tb['material']
            if tb.get('version'):
                result['product_version'] = tb['version']
            if tb.get('date'):
                result['product_date'] = tb['date']
            if tb.get('designer'):
                result['designer'] = tb['designer']
            if tb.get('drawing_number'):
                result['product_code'] = tb['drawing_number']
            
        except Exception as e:
            result['parse_success'] = False
            result['parse_errors'] = [str(e)]
        
        return result
    
    def parse_dxf(self, dxf_path: str) -> Dict:
        """直接解析 DXF 文件"""
        result = self._base_result(dxf_path, 'dxf')
        
        try:
            data = analyze_dxf(dxf_path)
            
            result['titleblock'] = data.get('titleblock', {})
            result['hole_count'] = data.get('holes', {}).get('total_count', 0)
            result['hole_groups'] = data.get('holes', {}).get('groups', [])
            result['drawing_dimensions'] = data.get('dimensions', [])
            result['drawing_layers'] = data.get('layers', [])
            result['technical_requirements'] = data.get('technical_requirements', {})
            result['unit'] = data.get('unit', {})
            result['entity_stats'] = data.get('entity_stats', {})
            result['parse_success'] = True
            
        except Exception as e:
            result['parse_success'] = False
            result['parse_errors'] = [str(e)]
        
        return result
    
    def parse_pdf(self, pdf_path: str) -> Dict:
        """
        解析 PDF 图纸。
        
        Returns:
            dict: 材料、重量、表面处理、产品编号等
        """
        result = self._base_result(pdf_path, 'pdf')
        
        try:
            data = analyze_pdf(pdf_path)
            
            result['material'] = data.get('material', '')
            result['weight_g'] = data.get('weight_g')
            result['surface_treatment'] = data.get('surface_treatment', '')
            result['salt_fog_test'] = data.get('salt_fog_test', '')
            result['rohs_compliant'] = data.get('rohs_compliant')
            result['product_code'] = data.get('product_code', '')
            result['product_name'] = data.get('product_name', '')
            result['product_version'] = data.get('version', '')
            result['designer'] = data.get('designer', '')
            result['full_text_preview'] = data.get('full_text_preview', '')
            result['parse_success'] = True
            
        except Exception as e:
            result['parse_success'] = False
            result['parse_errors'] = [str(e)]
        
        return result
    
    # ===================== 压缩包解析 =====================
    
    def parse_archive(self, archive_path: str) -> Dict:
        """
        完整解析压缩包中的所有图纸文件。
        
        流程：
        1. 解压 → 2. 扫描文件 → 3. 按部件分组 → 4. 逐文件解析 → 5. 汇总
        
        Returns:
            dict: 完整解析结果，按部件分组
        """
        result = {
            'archive_name': os.path.basename(archive_path),
            'version': VERSION,
            'success': False,
            'error': '',
            'components': {},
            'summary': {},
        }
        
        try:
            # 1. 解压
            extract_result = extract_archive(archive_path)
            files = extract_result['files']
            
            if not files:
                result['error'] = "压缩包中没有找到可识别的文件"
                return result
            
            # 2. 按部件分组
            groups = group_by_component(files)
            
            # 3. 逐部件解析
            for component_name, comp_files in groups.items():
                comp_result = self._parse_component(component_name, comp_files)
                result['components'][component_name] = comp_result
            
            # 4. 汇总
            result['summary'] = self._build_summary(result['components'])
            result['success'] = True
            
        except Exception as e:
            result['error'] = str(e)
        
        return result
    
    def _parse_component(self, name: str, files: List[Dict]) -> Dict:
        """解析单个部件的所有文件"""
        comp = {
            'name': name,
            'files': [],
            'stp_result': None,
            'dwg_result': None,
            'pdf_result': None,
        }
        
        for f in files:
            fpath = f['path']
            ftype = f['type']
            file_result = {'name': f['name'], 'type': ftype, 'success': False}
            
            try:
                if ftype == 'stp':
                    data = self.parse_stp(fpath)
                    comp['stp_result'] = data
                    file_result['success'] = data.get('parse_success', False)
                
                elif ftype == 'dwg':
                    data = self.parse_dwg(fpath)
                    comp['dwg_result'] = data
                    file_result['success'] = data.get('parse_success', False)
                
                elif ftype == 'dxf':
                    data = self.parse_dxf(fpath)
                    comp['dwg_result'] = data  # DXF 和 DWG 结果结构相同
                    file_result['success'] = data.get('parse_success', False)
                
                elif ftype == 'pdf':
                    data = self.parse_pdf(fpath)
                    comp['pdf_result'] = data
                    file_result['success'] = data.get('parse_success', False)
                
                else:
                    file_result['success'] = True  # 图片等跳过
                
            except Exception as e:
                file_result['error'] = str(e)
            
            comp['files'].append(file_result)
        
        return comp
    
    def _build_summary(self, components: Dict) -> Dict:
        """构建汇总信息"""
        summary = {
            'total_components': len(components),
            'total_files': sum(len(c['files']) for c in components.values()),
            'components_parsed': sum(1 for c in components.values() 
                                     if c.get('stp_result') or c.get('dwg_result')),
            'material_summary': {},
            'weight_summary': {},
        }
        
        for name, comp in components.items():
            # 材料汇总
            if comp.get('pdf_result', {}).get('material'):
                mat = comp['pdf_result']['material']
                summary['material_summary'][mat] = summary['material_summary'].get(mat, 0) + 1
            
            # 米重汇总
            if comp.get('stp_result', {}).get('weight_kg_per_m'):
                summary['weight_summary'][name] = comp['stp_result']['weight_kg_per_m']
        
        return summary
    
    # ===================== 辅助方法 =====================
    
    def _base_result(self, file_path: str, file_type: str) -> Dict:
        """构建基础结果字典"""
        return {
            'file_name': os.path.basename(file_path),
            'file_type': file_type,
            'file_size_kb': round(os.path.getsize(file_path) / 1024, 1) if os.path.exists(file_path) else 0,
            'parser_version': VERSION,
            'parse_success': False,
            'parse_errors': None,
        }
    
    def _error_result(self, error: str) -> Dict:
        """构建错误结果"""
        return {
            'file_name': '',
            'file_type': '',
            'file_size_kb': 0,
            'parser_version': VERSION,
            'parse_success': False,
            'parse_errors': [error],
        }


# ===================== 便捷函数 =====================

def parse_file(file_path: str) -> Dict:
    """一键解析文件"""
    service = DrawingParserService()
    return service.parse_single(file_path)
