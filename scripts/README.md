# STEP 文件解析器

使用 cadquery/OCP 精确解析 STEP 文件几何参数，输出 JSON 格式供 Next.js API 调用。

## 文件说明

- `parse_step.py` - STEP 文件解析器主程序
- `test_step_parser.py` - 测试脚本

## 使用方法

```bash
# 解析 STEP 文件
python3 scripts/parse_step.py /path/to/file.step

# 运行测试
python3 scripts/test_step_parser.py
```

## 输出格式

```json
{
  "success": true,
  "boundingBox": { "x": 38.7, "y": 21.7, "z": 100.0 },
  "volume": 83929.0,
  "surfaceArea": 13641.42,
  "weight": { "grams": 226.61, "kg": 0.2266, "material": "6063-T5" },
  "topology": { "faceCount": 10, "edgeCount": 48 },
  "extrusion": {
    "isExtrusion": true,
    "axis": "z",
    "length": 100.0,
    "crossWidth": 38.7,
    "crossHeight": 21.7,
    "crossSectionArea": 839.29,
    "weightPerMeter": 2.27,
    "isHollow": false,
    "complexity": "simple"
  },
  "pricingParams": { ... }
}
```

## 依赖

- Python 3.10+
- cadquery
- OCP (OpenCascade Python bindings)

## 部署说明

- 本地/服务器部署：直接可用（需安装 cadquery）
- Vercel 部署：STEP 后端解析不可用，自动降级到客户端文本解析
