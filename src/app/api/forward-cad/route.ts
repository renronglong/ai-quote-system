import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('userId') as string;
    const remark = formData.get('remark') as string;

    if (!file) return NextResponse.json({ error: '未收到文件' }, { status: 400 });

    const fileName = file.name.toLowerCase();
    if (!/\.(dxf|step|stp|zip|dwg|pdf|png|jpg|jpeg|gif|bmp|webp)$/i.test(fileName))
      return NextResponse.json({ error: '不支持的文件格式' }, { status: 400 });

    const apiToken = process.env.COZE_API_TOKEN;
    const apiBase = process.env.COZE_API_BASE_URL || 'https://api.coze.cn';
    const botId = process.env.COZE_RECOG_BOT_ID || '7677190179169796123';

    let userInfo = { phone: '未提供', email: '未提供', company: '未提供' };
    if (userId && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: user } = await supabase.from('users').select('phone, email, company_name').eq('id', userId).single();
        if (user) userInfo = { phone: user.phone || '未提供', email: user.email || '未提供', company: user.company_name || '未提供' };
      } catch {}
    }

    // 1. 上传文件到Coze
    const buffer = Buffer.from(await file.arrayBuffer());
    const uf = new FormData();
    const ext = fileName.split('.').pop() || 'png';
    const mt: Record<string,string> = {png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',bmp:'image/bmp',webp:'image/webp',pdf:'application/pdf'};
    uf.append('file', new Blob([new Uint8Array(buffer)], { type: mt[ext] || 'application/octet-stream' }), file.name);

    const ur = await fetch(`${apiBase}/v1/files/upload`, { method:'POST', headers:{Authorization:`Bearer ${apiToken}`}, body:uf });
    const ulr = await ur.json() as {code?:number;data?:{id:string};msg?:string};
    if (ulr.code !== 0 || !ulr.data?.id) {
      console.error('[FC] upload fail:', ulr);
      return NextResponse.json({ error: ulr.msg || '文件上传失败' }, { status: 500 });
    }
    const cozeFileId = ulr.data.id;

    // 2. 非图片文件直接存工单
    const isImage = IMAGE_EXTS.some(e => fileName.endsWith(e));
    if (!isImage || !apiToken) {
      await saveReq(supabaseServiceKey, supabaseUrl, { userId, cozeFileId, fileName: file.name, fileSize: file.size, userInfo, remark, status: 'pending' });
      return NextResponse.json({ success: true, autoFill: false, message: '文件已提交，工程师将尽快处理' });
    }

    // 3. 调Bot识别
    const prompt = `你是铝型材工程图纸识别专家。请分析这张图纸/截面图/零件图片，提取报价参数。
逐项识别，无法确定的填null：
1.product_type:extrusion/stamping/die_casting/cnc/injection
2.material_grade:如6063-T5,6061-T6,304,SPCC,ADC12,ABS,PP,PC,PA6
3.material_category:铝合金/不锈钢/冷轧板/压铸铝/塑胶
4.width:截面宽度mm 5.height:截面高度mm 6.wall_thickness:壁厚mm
7.length:长度mm(无null) 8.perimeter:周长mm(无null)
9.meter_weight:米重kg/m(>10需÷1000) 10.num_cavities:面域数(实心1,空心≥2)
11.surface_treatment:氧化本色/氧化黑色/粉末喷涂/电泳/拉丝/抛光/喷砂/无
12.processes:加工数组如["冲压","钻孔"],无[] 13.quantity:数量(无null)
14.product_name:产品名称 15.product_code:图号

只输出JSON不输出其他文字：
{"product_type":"extrusion","material_grade":"6063-T5","material_category":"铝合金","width":25,"height":45,"wall_thickness":0.8,"length":null,"perimeter":null,"meter_weight":0.375,"num_cavities":2,"surface_treatment":"无","processes":[],"quantity":null,"product_name":null,"product_code":"LF-YL-079","confidence":0.9,"notes":""}
规则：宽高取外形最大尺寸；米重>10是g/m需÷1000；面域实心=1有内腔≥2；confidence 0-1。`;

    const cr = await fetch(`${apiBase}/v3/chat`, {
      method:'POST', headers:{Authorization:`Bearer ${apiToken}`,'Content-Type':'application/json'},
      body:JSON.stringify({
        bot_id:botId, user_id:'fc_'+Date.now(), stream:false, auto_save_history:true,
        additional_messages:[
          {role:'user',content:prompt,content_type:'text',type:'question'},
          {role:'user',content:JSON.stringify([{type:'image',file_id:cozeFileId}]),content_type:'object_string',type:'question'},
        ],
      }),
    });
    const cResult = await cr.json() as {code?:number;data?:{id:string;conversation_id:string};msg?:string};
    if (cResult.code !== 0 || !cResult.data?.id) {
      await saveReq(supabaseServiceKey, supabaseUrl, { userId, cozeFileId, fileName:file.name, fileSize:file.size, userInfo, remark, status:'pending' });
      return NextResponse.json({ success:true, autoFill:false, message:'AI服务暂不可用，已提交工程师处理' });
    }

    const chatId = cResult.data.id, convId = cResult.data.conversation_id;

    // 4. 轮询(500ms间隔,40次=20秒)
    let rc = '';
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 500));
      const sr = await fetch(`${apiBase}/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${convId}`, {headers:{Authorization:`Bearer ${apiToken}`}});
      const sd = await sr.json() as {data?:{status:string}};
      const st = sd.data?.status;
      if (st === 'completed') {
        const mr = await fetch(`${apiBase}/v3/chat/message/list?chat_id=${chatId}&conversation_id=${convId}`, {headers:{Authorization:`Bearer ${apiToken}`}});
        const md = await mr.json() as {data?:Array<{role:string;type:string;content:string}>};
        const a = md.data?.find(m => m.role==='assistant' && m.type==='answer');
        if (a?.content) rc = a.content;
        break;
      }
      if (st==='failed'||st==='requires_action') {
        await saveReq(supabaseServiceKey, supabaseUrl, { userId, cozeFileId, fileName:file.name, fileSize:file.size, userInfo, remark, status:'pending' });
        return NextResponse.json({ success:true, autoFill:false, message:'AI识别失败，已提交工程师处理' });
      }
    }

    if (!rc) {
      await saveReq(supabaseServiceKey, supabaseUrl, { userId, cozeFileId, fileName:file.name, fileSize:file.size, userInfo, remark, status:'pending' });
      return NextResponse.json({ success:true, autoFill:false, message:'AI识别超时，已提交工程师处理' });
    }

    // 5. 解析
    let parsed: Record<string,unknown>;
    try {
      let c = rc.trim();
      if (c.startsWith('```json')) c=c.slice(7); if (c.startsWith('```')) c=c.slice(3); if (c.endsWith('```')) c=c.slice(0,-3);
      const fb=c.indexOf('{'),lb=c.lastIndexOf('}');
      if (fb>=0&&lb>fb) c=c.substring(fb,lb+1);
      parsed = JSON.parse(c.trim());
    } catch {
      await saveReq(supabaseServiceKey, supabaseUrl, { userId, cozeFileId, fileName:file.name, fileSize:file.size, userInfo, remark, status:'pending' });
      return NextResponse.json({ success:true, autoFill:false, message:'解析失败，已提交工程师处理' });
    }

    if (typeof parsed.meter_weight==='number' && parsed.meter_weight>10)
      parsed.meter_weight = Math.round(parsed.meter_weight/1000*10000)/10000;
    if (typeof parsed.num_cavities==='number')
      parsed.die_type = parsed.num_cavities<=1?'flat':'split';

    const conf = typeof parsed.confidence==='number'?parsed.confidence:0;
    const hasDims = typeof parsed.width==='number'&&typeof parsed.height==='number';
    const autoFill = conf>=0.75 && hasDims;

    await saveReq(supabaseServiceKey, supabaseUrl, {
      userId, cozeFileId, fileName:file.name, fileSize:file.size, userInfo, remark,
      status: autoFill?'auto_recognized':'pending', recognitionResult: parsed,
    });

    if (autoFill) return NextResponse.json({ success:true, autoFill:true, data:parsed, message:'深度识别完成，已自动填入参数' });
    const reason = conf<0.75 ? `置信度${(conf*100).toFixed(0)}%不足75%` : '缺少关键尺寸';
    return NextResponse.json({ success:true, autoFill:false, data:parsed, message:`识别完成但${reason}，已提交工程师处理` });

  } catch (err) {
    console.error('[FC] Error:', err);
    return NextResponse.json({ error:'服务器错误: '+(err instanceof Error?err.message:String(err)) }, { status:500 });
  }
}

async function saveReq(sk:string,su:string,opts:{userId:string;cozeFileId:string;fileName:string;fileSize:number;userInfo:{phone:string;email:string;company:string};remark:string;status:string;recognitionResult?:Record<string,unknown>;}) {
  if (!sk) return;
  try {
    const s = createClient(su,sk);
    await s.from('cad_requests').upsert({
      user_id:opts.userId||null, file_name:opts.fileName, file_size:opts.fileSize,
      coze_file_id:opts.cozeFileId, status:opts.status,
      user_email:opts.userInfo.email, user_phone:opts.userInfo.phone,
      company_name:opts.userInfo.company, remark:opts.remark||'',
      recognition_result:opts.recognitionResult?JSON.stringify(opts.recognitionResult):null,
      created_at:new Date().toISOString(),
    });
  } catch {}
}
