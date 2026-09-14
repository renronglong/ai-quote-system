#!/bin/bash
# ============================================
# 铝型材图纸解析器 部署脚本
# 用法: bash deploy.sh [build|start|stop|restart|logs|test]
# ============================================

set -e

SERVICE_NAME="drawing-parser"
IMAGE_NAME="gyparts/drawing-parser"
TAG="latest"
PORT=${PORT:-8000}

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ===================== 操作函数 =====================

do_build() {
    log_info "构建 Docker 镜像: ${IMAGE_NAME}:${TAG}"
    docker build -t "${IMAGE_NAME}:${TAG}" .
    log_info "构建完成"
}

do_start() {
    log_info "启动服务..."
    docker-compose up -d
    log_info "服务已启动，端口: ${PORT}"
    log_info "健康检查: http://localhost:${PORT}/api/health"
}

do_stop() {
    log_info "停止服务..."
    docker-compose down
    log_info "服务已停止"
}

do_restart() {
    do_stop
    do_build
    do_start
}

do_logs() {
    docker-compose logs -f --tail=100
}

do_test() {
    log_info "运行测试..."
    
    # 健康检查
    log_info "测试健康接口..."
    curl -s "http://localhost:${PORT}/api/health" | python3 -m json.tool
    
    # 测试 STP 解析
    if [ -n "$1" ]; then
        log_info "测试文件解析: $1"
        curl -s -X POST "http://localhost:${PORT}/api/parse/upload" \
            -F "file=@$1" | python3 -m json.tool
    fi
    
    log_info "测试完成"
}

do_status() {
    log_info "服务状态:"
    docker-compose ps
    echo ""
    log_info "端口映射:"
    docker-compose port drawing-parser 8000 2>/dev/null || echo "  未运行"
}

# ===================== 主逻辑 =====================

case "${1:-help}" in
    build)   do_build ;;
    start)   do_start ;;
    stop)    do_stop ;;
    restart) do_restart ;;
    logs)    do_logs ;;
    test)    do_test "$2" ;;
    status)  do_status ;;
    help|*)
        echo "用法: bash deploy.sh [命令] [参数]"
        echo ""
        echo "命令:"
        echo "  build     构建 Docker 镜像"
        echo "  start     启动服务"
        echo "  stop      停止服务"
        echo "  restart   重新构建并启动"
        echo "  logs      查看日志"
        echo "  test      运行测试"
        echo "  status    查看状态"
        echo ""
        echo "示例:"
        echo "  bash deploy.sh build"
        echo "  bash deploy.sh start"
        echo "  bash deploy.sh test /path/to/test.stp"
        ;;
esac
