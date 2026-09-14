import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';

export const metadata: Metadata = {
  title: '隐私政策 - GYPARTS 报价系统',
  description: 'GYPARTS 报价系统隐私政策',
};

const EFFECTIVE_DATE = '2026年8月31日';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-slate-900 mb-3">{title}</h2>
      <div className="space-y-2 text-sm leading-7 text-slate-700">{children}</div>
    </section>
  );
}

function P({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <p className={strong ? 'font-semibold text-slate-900' : ''}>{children}</p>;
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardContent className="p-6 md:p-10">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">隐私政策</h1>
            <p className="text-sm text-slate-500 mb-6">生效日期：{EFFECTIVE_DATE}</p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8 text-sm leading-7 text-blue-900">
              <p>
                本隐私政策说明 GYPARTS 报价系统（以下简称&ldquo;本平台&rdquo;）如何收集、使用、存储、共享和保护您的个人信息。
                请您在使用本平台前仔细阅读。<span className="font-semibold">您勾选同意并完成注册，即表示您已理解并同意本政策所述的信息处理活动。</span>
              </p>
            </div>

            <Section title="一、我们收集的信息">
              <P strong>1.1 账号注册信息：当您注册账号时，我们收集您的手机号码、短信验证码，以及您主动填写的企业名称、联系人姓名、邮箱等信息。供应商入驻时还可能收集营业执照等资质信息（用于身份核验）。</P>
              <P>1.2 报价与图纸信息：您使用报价功能时上传的图纸（CAD、图片、PDF 等）、填写的产品规格、尺寸、材料、工艺参数，以及系统生成的报价结果与历史报价记录。</P>
              <P>1.3 设备与日志信息：为保障服务安全与排查故障，我们会自动收集设备标识、IP 地址、浏览器类型、访问时间、操作日志等技术信息。</P>
              <P>1.4 我们仅收集为提供服务所必需的信息，不收集与本平台服务无关的个人信息。</P>
            </Section>

            <Section title="二、我们如何使用信息">
              <P>2.1 我们将收集的信息用于：（1）完成账号注册、登录与身份核验；（2）提供 AI 报价计算、图纸识别、报价单生成与存档、供需撮合等核心功能；（3）发送短信验证码、服务通知；（4）保障账号与交易安全、防范欺诈与违规行为；（5）改进产品功能与服务体验。</P>
              <P strong>2.2 我们不会将您的个人信息用于向您推送与本平台服务无关的商业营销，法律法规另有规定或您另行同意的除外。</P>
            </Section>

            <Section title="三、信息的共享、公开与脱敏">
              <P>3.1 本平台不会向任何第三方出售您的个人信息。在以下情形下，我们可能共享必要信息：</P>
              <P>（1）为完成短信发送，向短信服务商提供您的手机号码（仅用于发送验证码与通知）；</P>
              <P>（2）为完成云存储与计算，委托云服务商存储数据（受托方仅按我们的指示处理信息并承担保密义务）；</P>
              <P>（3）根据法律法规规定，或应行政、司法机关的合法要求。</P>
              <P strong>3.2 供应商主动发布的产品规格、报价区间、产品图片、企业名称等属于其自主公开用于商业撮合的信息，平台会在供需撮合范围内展示。</P>
              <P strong>3.3 对您的手机号、联系方式、未公开图纸、报价明细等非公开信息，本平台采取脱敏与访问控制：除您本人及与您存在直接询报价关系的交易相对方（按平台规则）外，其他用户无法查看；平台在统计分析、日志展示中对个人信息进行去标识化、匿名化处理，使其无法识别到特定个人。</P>
            </Section>

            <Section title="四、信息的存储与保护">
              <P>4.1 您的信息存储于中华人民共和国境内的云服务器，存储期限为您账号存续期间及法律法规要求的必要期限；账号注销后，我们将按法律规定删除或匿名化处理您的个人信息。</P>
              <P>4.2 我们采取访问控制、传输加密、权限隔离等合理安全措施保护您的信息，防止信息遭到未经授权的访问、泄露、篡改或丢失。</P>
              <P>4.3 如发生或可能发生个人信息安全事件，我们将依法及时采取补救措施并告知您。</P>
            </Section>

            <Section title="五、您的权利">
              <P>5.1 您有权访问、更正您的个人信息，有权查询您的历史报价记录。</P>
              <P>5.2 在符合法律规定的情形下，您有权删除个人信息、注销账号、撤回已作出的同意授权。您可通过平台客服渠道提出上述请求，我们将在核实身份后依法处理。</P>
              <P>5.3 您注销账号后，我们将停止为您提供服务，并按本政策约定删除或匿名化处理您的个人信息。</P>
            </Section>

            <Section title="六、Cookie 与同类技术">
              <P>6.1 本平台可能使用 Cookie 及同类技术记录您的登录状态、偏好设置，以保障服务正常运行与提升体验。您可通过浏览器设置管理或清除 Cookie，但部分功能可能因此受限。</P>
            </Section>

            <Section title="七、未成年人保护">
              <P>7.1 本平台面向企业及商事主体提供 B2B 服务，不面向未成年人。如发现未成年人在未获监护人同意的情况下注册使用，我们将依法删除相关信息。</P>
            </Section>

            <Section title="八、政策的更新">
              <P>8.1 本政策可能适时修订。涉及重大变更（如信息处理目的、共享范围发生实质变化）时，我们将通过平台显著位置公告或站内通知等方式提示您。修订后的政策自公布的生效日期起生效。</P>
            </Section>

            <Section title="九、联系我们">
              <P>9.1 如您对本隐私政策或个人信息保护有任何疑问、意见或投诉，可通过平台&ldquo;联系我们&rdquo;页面或客服渠道与我们联系，我们将在合理期限内予以回复。</P>
            </Section>

            <div className="mt-10 pt-6 border-t border-slate-200 text-sm text-slate-500 space-y-2">
              <p>本政策与<Link href="/terms" className="text-blue-600 hover:underline">《用户服务协议》</Link>共同构成您使用本平台服务的完整约定。</p>
              <p><Link href="/register" className="text-blue-600 hover:underline">返回注册</Link>　·　<Link href="/" className="text-blue-600 hover:underline">返回首页</Link></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
