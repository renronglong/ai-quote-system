"""
drawing_parser.archive_parser
=============================
压缩包图纸解包器
支持 ZIP/RAR/7Z/TAR.GZ，自动修复中文文件名编码（GBK/CP437）
"""

import os
import zipfile
import tempfile
import shutil
import subprocess
from pathlib import Path
from typing import List, Dict, Optional

from .config import SUPPORTED_EXTENSIONS, ARCHIVE_EXTENSIONS, WORK_DIR


# ===================== 中文文件名解码 =====================

def fix_chinese_filename(filename: str) -> str:
    """
    修复压缩包中的中文文件名编码。
    
    场景：Windows ZIP 用 GBK 编码文件名，Python zipfile 可能误读为 CP437/Latin1。
    策略：
    1. 尝试 encode('cp437').decode('gbk') —— 最常见的乱码修复
    2. 尝试 encode('latin1').decode('gbk')
    3. 失败则保留原文件名
    """
    if not filename:
        return filename
    # 检测是否含乱码（CP437 乱码特征：含有非 ASCII 字符但不在常见中文范围）
    try:
        # 尝试 cp437 -> gbk
        fixed = filename.encode('cp437').decode('gbk')
        if fixed != filename:
            # 检查修复后的文件名是否包含中文
            if any('\u4e00' <= c <= '\u9fff' for c in fixed):
                return fixed
    except (UnicodeDecodeError, UnicodeEncodeError):
        pass
    try:
        fixed = filename.encode('latin1').decode('gbk')
        if fixed != filename and any('\u4e00' <= c <= '\u9fff' for c in fixed):
            return fixed
    except (UnicodeDecodeError, UnicodeEncodeError):
        pass
    return filename


# ===================== 文件格式检测 =====================

def detect_file_type(file_path: str) -> str:
    """根据扩展名检测文件类型"""
    ext = Path(file_path).suffix.lower()
    return SUPPORTED_EXTENSIONS.get(ext, 'unknown')


def is_archive(file_path: str) -> bool:
    """判断是否为压缩包"""
    lower = file_path.lower()
    if lower.endswith('.tar.gz'):
        return True
    return Path(file_path).suffix.lower() in ARCHIVE_EXTENSIONS


# ===================== 压缩包解包 =====================

def extract_archive(archive_path: str, output_dir: Optional[str] = None) -> Dict:
    """
    解压压缩包，自动修复中文文件名。
    
    Args:
        archive_path: 压缩包路径
        output_dir: 输出目录（可选，默认创建临时目录）
    
    Returns:
        dict: {
            'extract_dir': 解压目录路径,
            'files': [{'path', 'name', 'type', 'size', 'relative_dir'}],
            'total': 文件总数,
            'supported': 支持的文件数,
        }
    """
    if output_dir is None:
        output_dir = tempfile.mkdtemp(prefix="archive_extract_", dir=WORK_DIR)
    os.makedirs(output_dir, exist_ok=True)
    
    ext = Path(archive_path).suffix.lower()
    
    if ext == '.zip':
        _extract_zip(archive_path, output_dir)
    elif ext in ('.rar', '.7z'):
        _extract_7z(archive_path, output_dir)
    elif ext in ('.tar', '.gz', '.tgz') or archive_path.lower().endswith('.tar.gz'):
        _extract_tar(archive_path, output_dir)
    else:
        raise ValueError(f"不支持的压缩包格式: {ext}")
    
    # 扫描文件
    files = scan_files(output_dir)
    
    return {
        'extract_dir': output_dir,
        'files': files,
        'total': len(files),
        'supported': sum(1 for f in files if f['type'] != 'unknown'),
    }


def _extract_zip(archive_path: str, output_dir: str):
    """解压 ZIP，修复中文文件名"""
    with zipfile.ZipFile(archive_path, 'r') as z:
        for info in z.infolist():
            # 修复中文文件名
            filename = fix_chinese_filename(info.filename)
            target_path = os.path.join(output_dir, filename)
            
            if info.is_dir():
                os.makedirs(target_path, exist_ok=True)
            else:
                os.makedirs(os.path.dirname(target_path), exist_ok=True)
                with z.open(info) as src, open(target_path, 'wb') as dst:
                    dst.write(src.read())


def _extract_7z(archive_path: str, output_dir: str):
    """用 7z 解压 RAR/7Z"""
    try:
        subprocess.run(
            ['7z', 'x', '-y', f'-o{output_dir}', archive_path],
            capture_output=True, check=True, timeout=120
        )
    except FileNotFoundError:
        raise RuntimeError("需要安装 7z: apt-get install p7zip-full")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"7z 解压失败: {e.stderr.decode('utf-8', errors='ignore')}")


def _extract_tar(archive_path: str, output_dir: str):
    """解压 tar/tar.gz/tgz"""
    import tarfile
    with tarfile.open(archive_path, 'r:*') as t:
        t.extractall(output_dir)


# ===================== 文件扫描 =====================

def scan_files(directory: str) -> List[Dict]:
    """递归扫描目录，找出所有可识别的文件"""
    files = []
    for root, dirs, filenames in os.walk(directory):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for fname in sorted(filenames):
            if fname.startswith('.') or fname.startswith('__MACOSX'):
                continue
            fpath = os.path.join(root, fname)
            ftype = detect_file_type(fpath)
            rel_dir = os.path.relpath(root, directory)
            files.append({
                'path': fpath,
                'name': fname,
                'type': ftype,
                'size': os.path.getsize(fpath),
                'relative_dir': rel_dir if rel_dir != '.' else '',
            })
    # 按类型排序：stp > dwg > dxf > pdf > image > unknown
    type_order = {'stp': 0, 'dwg': 1, 'dxf': 2, 'pdf': 3, 'image': 4, 'unknown': 99}
    files.sort(key=lambda x: type_order.get(x['type'], 99))
    return files


# ===================== 按部件分组 =====================

def group_by_component(files: List[Dict]) -> Dict[str, List[Dict]]:
    """
    按部件分组（根据文件所在的目录名）。
    例如：
    - /IGUASSU2.0图纸(1)/主体/xxx.stp → 部件="主体"
    - /IGUASSU2.0图纸(1)/支架/xxx.stp → 部件="支架"
    """
    groups = {}
    for f in files:
        rel_dir = f.get('relative_dir', '')
        if rel_dir:
            # 取最后一级目录名作为部件名
            component = os.path.basename(rel_dir)
        else:
            component = 'root'
        if component not in groups:
            groups[component] = []
        groups[component].append(f)
    return groups
