import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const execFileAsync = promisify(execFile);

/**
 * POST /api/pricing/parse-step
 * 
 * 接收 STEP 文件上传，使用 cadquery/OCP 精确解析几何参数
 * 返回 JSON 格式的解析结果（包围盒、体积、表面积、重量、挤压件判断等）
 */
export async function POST(request: Request) {
  let tmpFilePath: string | null = null;
  
  try {
    // 解析上传的文件
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: '请上传 STEP 文件' },
        { status: 400 }
      );
    }
    
    // 验证文件扩展名
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.step') && !fileName.endsWith('.stp')) {
      return NextResponse.json(
        { success: false, error: '仅支持 .step 或 .stp 格式的文件' },
        { status: 400 }
      );
    }
    
    // 验证文件大小（限制 50MB）
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: '文件大小不能超过 50MB' },
        { status: 400 }
      );
    }
    
    // 保存文件到临时目录
    const buffer = Buffer.from(await file.arrayBuffer());
    tmpFilePath = join(tmpdir(), `step_${randomUUID()}.step`);
    await writeFile(tmpFilePath, buffer);
    
    // 调用 Python 解析脚本
    const scriptPath = join(process.cwd(), 'scripts', 'parse_step.py');
    
    try {
      const { stdout, stderr } = await execFileAsync(
        'python3',
        [scriptPath, tmpFilePath],
        { 
          timeout: 30000,  // 30秒超时
          maxBuffer: 10 * 1024 * 1024,
        }
      );
      
      if (stderr) {
        console.error('[parse-step] Python stderr:', stderr);
      }
      
      const result = JSON.parse(stdout);
      
      return NextResponse.json({
        success: result.success,
        data: result,
        fileName: file.name,
        fileSize: file.size,
      });
      
    } catch (execError: any) {
      // Python 脚本执行失败（可能 cadquery 未安装）
      console.error('[parse-step] Python exec error:', execError.message);
      
      // 返回降级提示
      return NextResponse.json(
        { 
          success: false, 
          error: 'STEP 解析服务暂不可用',
          detail: execError.message,
          fallback: true,
        },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('[parse-step] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '解析失败',
      },
      { status: 500 }
    );
  } finally {
    // 清理临时文件
    if (tmpFilePath) {
      try {
        await unlink(tmpFilePath);
      } catch {
        // 忽略清理错误
      }
    }
  }
}

// 允许大文件上传（STEP 文件可达几十MB）
export const config = {
  api: {
    bodyParser: false,
  },
};

// Next.js App Router: 设置请求体大小限制
export const maxDuration = 30; // 30秒超时
