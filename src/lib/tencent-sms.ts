/**
 * 腾讯云短信 SDK 封装模块
 *
 * 基于 tencentcloud-sdk-nodejs-sms 封装，提供发送短信验证码能力。
 * 环境变量：
 *   - TENCENT_SMS_SECRET_ID: 腾讯云 SecretId
 *   - TENCENT_SMS_SECRET_KEY: 腾讯云 SecretKey
 *   - TENCENT_SMS_SDK_APP_ID: 短信应用 SDKAppID
 *   - TENCENT_SMS_SIGN_NAME: 短信签名（可选，默认从环境变量读取）
 *   - TENCENT_SMS_TEMPLATE_ID: 短信模板 ID（可选，默认从环境变量读取）
 */

import SmsClient from 'tencentcloud-sdk-nodejs-sms/tencentcloud/services/sms/v20210111/sms_client';
import * as tencentcloud from 'tencentcloud-sdk-nodejs-sms/tencentcloud/common';

// ─── 腾讯云短信配置 ───────────────────────────────────────────
interface SmsConfig {
  secretId: string;
  secretKey: string;
  sdkAppId: string;
  signName: string;
  templateId: string;
}

function getSmsConfig(): SmsConfig {
  const secretId = process.env.TENCENT_SMS_SECRET_ID || '';
  const secretKey = process.env.TENCENT_SMS_SECRET_KEY || '';
  const sdkAppId = process.env.TENCENT_SMS_SDK_APP_ID || '';
  const signName = process.env.TENCENT_SMS_SIGN_NAME || '';
  const templateId = process.env.TENCENT_SMS_TEMPLATE_ID || '';

  if (!secretId || !secretKey || !sdkAppId) {
    throw new Error('腾讯云短信配置不完整，请检查环境变量 TENCENT_SMS_SECRET_ID / SECRET_KEY / SDK_APP_ID');
  }

  return { secretId, secretKey, sdkAppId, signName, templateId };
}

// ─── 创建短信客户端 ───────────────────────────────────────────
function createSmsClient(config: SmsConfig): SmsClient {
  const credential = new tencentcloud.Credential(config.secretId, config.secretKey);
  const clientProfile = new tencentcloud.ClientProfile();
  const httpProfile = new tencentcloud.HttpProfile();
  httpProfile.reqMethod = 'POST';
  httpProfile.reqTimeout = 10;
  clientProfile.httpProfile = httpProfile;

  return new SmsClient(credential, 'ap-guangzhou', clientProfile);
}

// ─── 发送验证码短信 ───────────────────────────────────────────
export interface SendSmsResult {
  success: boolean;
  requestId?: string;
  code?: string;
  message?: string;
}

/**
 * 发送短信验证码
 * @param phoneNumbers 手机号（带国际区号，如 +8613800138000 或 13800138000）
 * @param code 验证码
 * @param expireMinutes 过期分钟数（默认5分钟）
 * @returns 发送结果
 */
export async function sendVerificationCode(
  phoneNumbers: string,
  code: string,
  expireMinutes: number = 5
): Promise<SendSmsResult> {
  try {
    const config = getSmsConfig();
    const client = createSmsClient(config);

    // 统一手机号格式：确保带 +86 前缀
    let formattedPhone = phoneNumbers.trim();
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = `+86${formattedPhone}`;
    }

    const params = {
      SmsSdkAppId: config.sdkAppId,
      SignName: config.signName,
      TemplateId: config.templateId,
      TemplateParamSet: [code, String(expireMinutes)],
      PhoneNumberSet: [formattedPhone],
    };

    const response = await client.SendSms(params);

    if (response.SendStatusSet && response.SendStatusSet.length > 0) {
      const status = response.SendStatusSet[0];
      if (status.Code === 'Ok') {
        return {
          success: true,
          requestId: response.RequestId,
        };
      } else {
        console.error('[TencentSMS] 发送失败:', status.Code, status.Message);
        return {
          success: false,
          code: status.Code,
          message: status.Message,
        };
      }
    }

    return {
      success: false,
      message: '短信服务返回异常：无发送状态',
    };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[TencentSMS] 发送异常:', errMsg);
    return {
      success: false,
      message: `短信发送异常: ${errMsg}`,
    };
  }
}
