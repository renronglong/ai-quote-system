# 铝型材图纸解析器 (drawing_parser)

> 面向铝型材行业的图纸解析工具链，支持 STP/DWG/DXF/PDF 多格式解析，可部署为 Web API 服务。

## 功能概览

| 模块 | 功能 | 输入格式 |
|------|------|---------|
| `stp_parser` | 铝型材截面解析（截面积、米重、外周长） | STP/STEP |
| `dwg_converter` | DWG → DXF 转换 | DWG |
| `dxf_analyzer` | DXF 综合分析（标题栏、孔位、技术要求） | DXF |
| `pdf_analyzer` | PDF 图纸文字提取与信息识别 | PDF |
| `archive_parser` | 压缩包解包 + 文件分类 | ZIP/RAR/7Z |
| `parser_service` | 统一解析入口 | 所有格式 |
| `api` | FastAPI Web 服务 | HTTP |

## 快速开始

### 本地使用（Python 模块）

```python
from drawing_parser import DrawingParserService

service = DrawingParserService()

# 解析单个文件
result = service.parse_stp("model.stp")
result = service.parse_dwg("drawing.dwg")
result = service.parse_pdf("spec.pdf")

# 解析压缩包
result = service.parse_archive("drawings.zip")

# 自动识别文件类型
result = service.parse_single("any_file.xyz")
```

### Docker 部署

```bash
# 构建镜像
bash deploy.sh build

# 启动服务
bash deploy.sh start

# 测试
curl http://localhost:8000/api/health
```

### API 接口

#### 健康检查
```bash
GET /api/health
```

#### 上传解析
```bash
# 上传压缩包
curl -X POST http://localhost:8000/api/parse/upload \
  -F "file=@drawings.zip"

# 上传 STP
curl -X POST http://localhost:8000/api/parse/stp \
  -F "file=@model.stp"

# 上传 DWG
curl -X POST http://localhost:8000/api/parse/dwg \
  -F "file=@drawing.dwg"

# 上传 PDF
curl -X POST http://localhost:8000/api/parse/pdf \
  -F "file=@spec.pdf"
```

## STP 解析算法

### Volume/Length 法

核心原理：对于挤出体，`Volume = Area × Length`，因此 `Area = Volume / Length`。

```
1. FreeCAD Part.open() 加载 STP → 获取 Shape
2. BoundBox → 挤出方向（最长轴）
3. section_area = Volume / ExtrusionLength
4. 外周长 = section().Edges 总长度
5. 米重 = 截面积 × 0.0027 kg/m（AL6063）
```

### Fallback：纯文本解析

当 FreeCAD 不可用时，使用纯文本解析 STP 文件中的 `VERTEX_POINT` 坐标，计算包围盒尺寸。
此方法只能获取截面宽高，无法计算截面积和米重。

## DXF 中文解码

DWG/DXF 中的中文使用 `\M+5xxxx` 编码（GBK 字节对）：

```python
from drawing_parser.dxf_analyzer import decode_m5_gbk

text = r"\M+5BFA1体"  # BFA1 → "主"
result = decode_m5_gbk(text)  # → "主体"
```

## 文件结构

```
drawing_parser/
├── __init__.py          # 包入口
├── config.py            # 全局配置
├── archive_parser.py    # 压缩包解包
├── stp_parser.py        # STP 截面解析
├── dwg_converter.py     # DWG→DXF 转换
├── dxf_analyzer.py      # DXF 综合分析
├── pdf_analyzer.py      # PDF 图纸分析
├── parser_service.py    # 统一服务入口
├── api.py               # FastAPI 接口
├── requirements.txt     # Python 依赖
├── Dockerfile           # Docker 配置
├── docker-compose.yml   # 一键启动
├── deploy.sh            # 部署脚本
└── README.md            # 本文件
```

## 系统依赖

| 组件 | 用途 | 安装方式 |
|------|------|---------|
| FreeCAD 0.19+ | STP 解析 | `apt-get install freecad` |
| ODA File Converter | DWG→DXF | [下载](https://www.opendesign.com/guestfiles/oda_file_converter) |
| Xvfb | 虚拟显示（ODA需要） | `apt-get install xvfb` |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `FREECAD_CMD` | `freecadcmd` | FreeCAD 命令路径 |
| `ODA_PATH` | `/usr/bin/ODAFileConverter` | ODA 路径 |
| `XVFB_DISPLAY` | `:99` | Xvfb 显示号 |
| `AL_DENSITY` | `2700.0` | 铝合金密度 (kg/m³) |
| `PORT` | `8000` | 服务端口 |
| `PRODUCTION` | `false` | 生产模式 |

## 米重计算验证（IGUASSU 2.0）

| 部件 | 截面(mm) | 截面积(mm²) | 米重(kg/m) | 材料 |
|---|---|---|---|---|
| 主体 | 125.3×47.0 | 692.4 | 1.870 | AL6063-T5 |
| 支架 | 40.5×50.8 | 342.5 | 0.925 | AL6063-T5 |
| 灯体散热器 | 45.2×11.7 | 118.2 | 0.319 | AL6063-T5 |
| 主体侧挡板 | 46.4×1.5 | 62.4 | 0.168 | AL5052 |
| 支架侧挡板 | 35.9×1.5 | 39.2 | 0.106 | AL5052 |

## License

Copyright © 2024 gyparts.cn
