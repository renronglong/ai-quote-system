/**
 * 飞书通知 - 新深度报价工单
 * 通过飞书机器人webhook发送通知
 */
export async function notifyNewCadRequest(opts: {
  fileName: string;
  companyName: string;
  userPhone: string;
  autoFill: boolean;
  confidence: number;
  productCode?: string;
}) {
  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[Notify] FEISHU_WEBHOOK_URL not set, skipping notification');
    return;
  }

  const status = opts.autoFill
    ? `✅ AI已自动识别（置信度${(opts.confidence * 100).toFixed(0)}%）`
    : `⚠️ 需人工处理（置信度${(opts.confidence * 100).toFixed(0)}%）`;

  const card = {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: '📐 新深度报价工单' },
        template: opts.autoFill ? 'green' : 'orange',
      },
      elements: [
        {
          tag: 'div',
          fields: [
            { is_short: true, text: { tag: 'lark_md', content: `**文件：** ${opts.fileName}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**公司：** ${opts.companyName}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**电话：** ${opts.userPhone}` } },
            { is_short: true, text: { tag: 'lark_md', content: `**图号：** ${opts.productCode || '未识别'}` } },
          ],
        },
        { tag: 'hr' },
        {
          tag: 'div',
          text: { tag: 'lark_md', content: status },
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '查看工单' },
              url: 'https://www.gyparts.cn/admin/inquiries',
              type: 'primary',
            },
          ],
        },
      ],
    },
  };

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(card),
    });
    console.log('[Notify] Feishu sent:', resp.status);
  } catch (e) {
    console.error('[Notify] Feishu error:', e);
  }
}
