/**
 * 腾讯云短信发送模块
 * 
 * 环境变量：
 *   TENCENT_SMS_SECRET_ID  - 腾讯云 SecretId
 *   TENCENT_SMS_SECRET_KEY - 腾讯云 SecretKey
 *   TENCENT_SMS_SDK_APP_ID - 短信应用 AppId
 *   TENCENT_SMS_SIGN_NAME  - 短信签名
 *   TENCENT_SMS_TEMPLATE_ID - 验证码模板 Id
 */

export interface SendSmsResult {
  success: boolean;
  message: string;
  code?: string; // 调试模式下返回的验证码
}

/**
 * 发送短信验证码
 * @param phone 手机号
 * @param code 验证码
 */
export async function sendVerificationCode(
  phone: string,
  code: string
): Promise<SendSmsResult> {
  const secretId = process.env.TENCENT_SMS_SECRET_ID;
  const secretKey = process.env.TENCENT_SMS_SECRET_KEY;
  const appId = process.env.TENCENT_SMS_SDK_APP_ID;
  const signName = process.env.TENCENT_SMS_SIGN_NAME;
  const templateId = process.env.TENCENT_SMS_TEMPLATE_ID;

  // 如果未配置腾讯云短信，进入测试模式
  if (!secretId || !secretKey || !appId || !templateId) {
    console.warn(
      `[SMS] 腾讯云短信未配置，进入测试模式。phone=${phone}, code=${code}`
    );
    return {
      success: true,
      message: '测试模式：验证码已生成（短信未实际发送）',
      code,
    };
  }

  // 实际发送逻辑（待配置腾讯云凭证后启用）
  try {
    const result = await sendViaTencentCloud(
      secretId,
      secretKey,
      appId,
      signName || '',
      templateId,
      phone,
      code
    );
    return result;
  } catch (error: any) {
    console.error('[SMS] 发送失败:', error);
    return {
      success: false,
      message: `短信发送失败: ${error.message}`,
    };
  }
}

/**
 * 通过腾讯云 API 发送短信
 * 使用 TC3-HMAC-SHA256 签名
 */
async function sendViaTencentCloud(
  secretId: string,
  secretKey: string,
  appId: string,
  signName: string,
  templateId: string,
  phone: string,
  code: string
): Promise<SendSmsResult> {
  const host = 'sms.tencentcloudapi.com';
  const service = 'sms';
  const action = 'SendSms';
  const version = '2021-01-11';
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  // 请求参数
  const payload = JSON.stringify({
    SmsSdkAppId: appId,
    SignName: signName,
    TemplateId: templateId,
    TemplateParamSet: [code, '5'],
    PhoneNumberSet: [`+86${phone}`],
  });

  // 构建规范请求
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const hashedRequestPayload = await sha256Hex(payload);
  const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`;

  // 待签名字符串
  const algorithm = 'TC3-HMAC-SHA256';
  const hashedCanonicalRequest = await sha256Hex(canonicalRequest);
  const credentialScope = `${date}/${service}/tc3_request`;
  const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;

  // 计算签名
  const secretDate = await hmacSha256(`TC3${secretKey}`, date);
  const secretService = await hmacSha256(secretDate, service);
  const secretSigning = await hmacSha256(secretService, 'tc3_request');
  const signature = await hmacSha256Hex(secretSigning, stringToSign);

  // 授权信息
  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  // 发送请求
  const response = await fetch(`https://${host}`, {
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Type': 'application/json; charset=utf-8',
      'Host': host,
      'X-TC-Action': action,
      'X-TC-Timestamp': timestamp.toString(),
      'X-TC-Version': version,
      'X-TC-Region': 'ap-guangzhou',
    },
    body: payload,
  });

  const result = await response.json();

  if (result.Response?.Error) {
    return {
      success: false,
      message: `腾讯云短信错误: ${result.Response.Error.Message}`,
    };
  }

  const sendStatus = result.Response?.SendStatusSet?.[0];
  if (sendStatus?.Code === 'Ok') {
    return { success: true, message: '验证码已发送' };
  } else {
    return {
      success: false,
      message: `发送失败: ${sendStatus?.Message || '未知错误'}`,
    };
  }
}

// ─── 加密工具函数 ───────────────────────────────────────────
async function sha256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSha256(key: string | ArrayBuffer, data: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? encoder.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

async function hmacSha256Hex(key: ArrayBuffer, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
