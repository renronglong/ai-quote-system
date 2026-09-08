"""
drawing_parser.api
==================
FastAPI 接口层，可直接部署到 gyparts.cn

接口：
- POST /api/parse/upload  - 上传压缩包/文件解析
- POST /api/parse/stp     - 解析单个 STP
- POST /api/parse/dwg     - 解析单个 DWG
- POST /api/parse/pdf     - 解析单个 PDF
- GET  /api/health        - 健康检查
"""

import os
import json
import tempfile
import shutil
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from .config import VERSION
from .parser_service import DrawingParserService


# ===================== FastAPI 应用 =====================

app = FastAPI(
    title="铝型材图纸解析器",
    description="解析 STP/DWG/DXF/PDF 铝型材图纸，提取截面、材料、尺寸、孔位等技术参数",
    version=VERSION,
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局解析服务实例
_parser_service: Optional[DrawingParserService] = None


def get_parser() -> DrawingParserService:
    """获取或创建解析服务实例"""
    global _parser_service
    if _parser_service is None:
        _parser_service = DrawingParserService(
            freecad_cmd=os.environ.get("FREECAD_CMD"),
            oda_path=os.environ.get("ODA_PATH"),
        )
    return _parser_service


# ===================== 健康检查 =====================

@app.get("/api/health")
async def health_check():
    """健康检查接口"""
    from .dwg_converter import check_oda_available
    
    status = {
        "status": "ok",
        "version": VERSION,
        "tools": {
            "freecad": _check_freecad(),
            "oda": check_oda_available(),
        }
    }
    return status


def _check_freecad() -> bool:
    """检查 FreeCAD 是否可用"""
    import subprocess
    cmd = os.environ.get("FREECAD_CMD", "freecadcmd")
    try:
        result = subprocess.run(
            [cmd, "--version"],
            capture_output=True, text=True, timeout=5
        )
        return result.returncode == 0
    except Exception:
        return False


# ===================== 文件上传解析 =====================

@app.post("/api/parse/upload")
async def parse_upload(
    file: UploadFile = File(...),
):
    """
    上传压缩包或单个文件进行解析。
    
    支持格式：
    - 压缩包：zip, rar, 7z, tar.gz
    - 单文件：stp, dwg, dxf, pdf
    """
    parser = get_parser()
    
    # 保存上传文件到临时目录
    tmp_dir = tempfile.mkdtemp(prefix="upload_")
    file_path = os.path.join(tmp_dir, file.filename)
    
    try:
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        # 判断文件类型
        ext = os.path.splitext(file.filename)[1].lower()
        
        if ext in ('.zip', '.rar', '.7z', '.tgz') or file.filename.lower().endswith('.tar.gz'):
            result = parser.parse_archive(file_path)
        elif ext in ('.stp', '.step'):
            result = parser.parse_stp(file_path)
        elif ext == '.dwg':
            result = parser.parse_dwg(file_path)
        elif ext == '.dxf':
            result = parser.parse_dxf(file_path)
        elif ext == '.pdf':
            result = parser.parse_pdf(file_path)
        else:
            raise HTTPException(status_code=400, detail=f"不支持的文件格式: {ext}")
        
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"解析失败: {str(e)}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ===================== STP 解析 =====================

@app.post("/api/parse/stp")
async def parse_stp_endpoint(
    file: UploadFile = File(...),
):
    """解析单个 STP/STEP 文件"""
    parser = get_parser()
    
    tmp_dir = tempfile.mkdtemp(prefix="stp_")
    file_path = os.path.join(tmp_dir, file.filename)
    
    try:
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        result = parser.parse_stp(file_path)
        return JSONResponse(content=result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"STP 解析失败: {str(e)}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ===================== DWG 解析 =====================

@app.post("/api/parse/dwg")
async def parse_dwg_endpoint(
    file: UploadFile = File(...),
):
    """解析单个 DWG 文件"""
    parser = get_parser()
    
    tmp_dir = tempfile.mkdtemp(prefix="dwg_")
    file_path = os.path.join(tmp_dir, file.filename)
    
    try:
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        result = parser.parse_dwg(file_path)
        return JSONResponse(content=result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DWG 解析失败: {str(e)}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ===================== PDF 解析 =====================

@app.post("/api/parse/pdf")
async def parse_pdf_endpoint(
    file: UploadFile = File(...),
):
    """解析单个 PDF 文件"""
    parser = get_parser()
    
    tmp_dir = tempfile.mkdtemp(prefix="pdf_")
    file_path = os.path.join(tmp_dir, file.filename)
    
    try:
        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        result = parser.parse_pdf(file_path)
        return JSONResponse(content=result)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF 解析失败: {str(e)}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ===================== 本地文件解析（调试用） =====================

@app.post("/api/parse/local")
async def parse_local(
    file_path: str = Form(...),
):
    """
    解析本地文件（仅调试环境使用）。
    
    注意：生产环境应禁用此接口。
    """
    if os.environ.get("PRODUCTION", "false").lower() == "true":
        raise HTTPException(status_code=403, detail="生产环境已禁用本地文件解析")
    
    parser = get_parser()
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"文件不存在: {file_path}")
    
    result = parser.parse_single(file_path)
    return JSONResponse(content=result)


# ===================== 启动入口 =====================

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(
        "drawing_parser.api:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info",
    )
