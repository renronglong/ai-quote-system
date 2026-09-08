# ============================================
# 铝型材图纸解析器 Docker 镜像
# 基于 Ubuntu 22.04 + FreeCAD + ODA + Python 3.10
# ============================================

FROM ubuntu:22.04

LABEL maintainer="gyparts.cn"
LABEL description="铝型材图纸解析器 - STP/DWG/DXF/PDF 解析服务"

# 避免交互式安装提示
ENV DEBIAN_FRONTEND=noninteractive

# ===================== 系统依赖 =====================
RUN apt-get update && apt-get install -y \
    # Python
    python3 \
    python3-pip \
    python3-dev \
    # FreeCAD
    freecad \
    # ODA File Converter 依赖
    libxcb-xinerama0 \
    libxcb-cursor0 \
    libgl1-mesa-glx \
    libxkbcommon0 \
    # Xvfb 虚拟显示
    xvfb \
    # 文件工具
    p7zip-full \
    unrar \
    curl \
    wget \
    # 中文字体支持
    fonts-wqy-zenhei \
    && rm -rf /var/lib/apt/lists/*

# ===================== ODA File Converter =====================
# 下载并安装 ODA（需要替换为实际的下载链接）
# 注意：ODA 需要从 https://www.opendesign.com/guestfiles/oda_file_converter 下载
ARG ODA_VERSION="24.11"
ARG ODA_DEB="ODAFileConverter_QT6_lnxX64_8.3dll_25.11.deb"
RUN wget -q "https://download.opendesign.com/guestfiles/ODAFileConverter/${ODA_DEB}" -O /tmp/oda.deb || true && \
    dpkg -i /tmp/oda.deb || true && \
    rm -f /tmp/oda.deb && \
    # 创建符号链接
    ln -sf /usr/local/bin/ODAFileConverter /usr/bin/ODAFileConverter || true

# ===================== Python 依赖 =====================
COPY requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir -r /app/requirements.txt

# ===================== 应用代码 =====================
COPY . /app/drawing_parser/

# 设置工作目录
WORKDIR /app

# ===================== 环境变量 =====================
ENV FREECAD_CMD=freecadcmd
ENV ODA_PATH=/usr/bin/ODAFileConverter
ENV XVFB_DISPLAY=:99
ENV AL_DENSITY=2700.0
ENV PORT=8000
ENV PYTHONPATH=/app

# ===================== 数据卷 =====================
VOLUME ["/app/data", "/app/output"]

# ===================== 暴露端口 =====================
EXPOSE 8000

# ===================== 健康检查 =====================
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# ===================== 启动命令 =====================
CMD ["python3", "-m", "uvicorn", "drawing_parser.api:app", "--host", "0.0.0.0", "--port", "8000"]
