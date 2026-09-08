"""
drawing_parser.config
=====================
全局配置：路径、密度、公差、默认参数
"""

import os
import tempfile

# ===================== 版本 =====================
VERSION = "1.0.0"

# ===================== 路径配置 =====================
# FreeCAD 命令（Docker 中为 freecadcmd，本地可能为 freecad）
FREECAD_CMD = os.environ.get("FREECAD_CMD", "freecadcmd")
FREECAD_USER_HOME = os.environ.get("FREECAD_USER_HOME", "/tmp")

# ODA File Converter 路径
ODA_PATH = os.environ.get("ODA_PATH", "/usr/bin/ODAFileConverter")

# Xvfb 虚拟显示
XVFB_DISPLAY = os.environ.get("XVFB_DISPLAY", ":99")

# 工作临时目录
WORK_DIR = os.environ.get("DRAWING_PARSER_WORKDIR", tempfile.gettempdir())

# ===================== 材料参数 =====================
# 铝合金密度 (kg/m³)
AL_DENSITY = float(os.environ.get("AL_DENSITY", "2700.0"))

# 常用铝合金牌号
AL_ALLOY_DENSITY = {
    "AL6063-T5": 2700.0,
    "AL6063-T6": 2700.0,
    "AL6061-T6": 2700.0,
    "AL5052-H32": 2680.0,
    "AL5052": 2680.0,
    "AL5083": 2650.0,
    "AL3003": 2730.0,
}

# 米重公式：截面积(mm²) × 密度(kg/m³) × 1e-6 = kg/m
# 简化版：截面积 × 0.0027 = kg/m（6063合金）
WEIGHT_FACTOR = AL_DENSITY * 1e-6  # = 0.0027

# ===================== 单位配置 =====================
# DWG/DXF 单位映射
UNIT_MAP = {
    0: "无单位",
    1: "英寸",
    2: "英尺",
    4: "毫米",
    5: "厘米",
    6: "米",
}

# 单位转毫米系数
TO_MM_FACTOR = {
    0: 1.0,
    1: 25.4,
    2: 304.8,
    4: 1.0,
    5: 10.0,
    6: 1000.0,
}

# ===================== 精度配置 =====================
# 尺寸精度（mm）
DIMENSION_TOLERANCE = 0.01
# 截面积精度（mm²）
AREA_PRECISION = 2
# 米重精度（kg/m）
WEIGHT_PRECISION = 4
# 长度精度（mm）
LENGTH_PRECISION = 1

# ===================== 文件格式 =====================
SUPPORTED_EXTENSIONS = {
    ".stp": "stp",
    ".step": "stp",
    ".igs": "stp",
    ".iges": "stp",
    ".dwg": "dwg",
    ".dxf": "dxf",
    ".pdf": "pdf",
    ".png": "image",
    ".jpg": "image",
    ".jpeg": "image",
}

ARCHIVE_EXTENSIONS = {".zip", ".rar", ".7z", ".tar", ".gz", ".tgz"}

# ===================== 加工参数（铝合金6063） =====================
DRILL_PARAMS = {
    5: (200, 0.06),
    10: (180, 0.10),
    999: (150, 0.15),
}

# CNC 加工时间参数（秒）
SETUP_TIME = 30
TOOL_CHANGE_TIME = 8
POSITION_TIME = 3
DEBURR_TIME = 5
DRILL_EXTRA = 2

# ===================== 输出字段定义（32字段标准输出） =====================
STANDARD_OUTPUT_FIELDS = [
    # 文件信息
    "file_name", "file_type", "file_size_kb",
    # 截面尺寸
    "section_width_mm", "section_height_mm", "section_size",
    # 截面参数
    "section_area_mm2", "outer_perimeter_mm", "weight_kg_per_m",
    "extrusion_length_mm", "extrusion_axis",
    # 材料信息
    "material", "material_density",
    # 产品信息
    "product_code", "product_name", "product_version", "product_date",
    "designer",
    # 孔位信息
    "hole_count", "hole_groups",
    # 加工信息
    "cnc_holes", "cnc_total_holes", "machining_time_min",
    # 技术要求
    "surface_treatment", "salt_fog_test", "rohs_compliant",
    # DWG 标注
    "drawing_dimensions", "drawing_layers",
    # 汇总
    "parse_success", "parse_errors",
]
