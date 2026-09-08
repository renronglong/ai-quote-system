"""
drawing_parser - 铝型材图纸解析器工具链
========================================

版本: 1.0.0
用途: 解析铝型材 STP/DWG/DXF/PDF 图纸，提取截面、材料、尺寸、孔位等技术信息
部署: FastAPI 服务，可直接部署到 gyparts.cn

作者: gyparts.cn
"""

__version__ = "1.0.0"
__author__ = "gyparts.cn"

from .parser_service import DrawingParserService

__all__ = ["DrawingParserService"]
