import { NextRequest, NextResponse } from 'next/server';

// 公司搜索 API - 从企查查搜索匹配的公司列表
// GET /api/company/search?q=关键词

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('q');

  if (!keyword || keyword.length < 2) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    const results = await searchCompanies(keyword);
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error('搜索公司失败:', error);
    return NextResponse.json({ success: false, data: [], error: '搜索失败' }, { status: 500 });
  }
}

async function searchCompanies(keyword: string) {
  // 使用企查查搜索
  const searchUrl = `https://www.qcc.com/web/search?key=${encodeURIComponent(keyword)}`;
  
  const resp = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://www.qcc.com/',
    },
  });

  if (!resp.ok) {
    throw new Error(`搜索请求失败: ${resp.status}`);
  }

  const html = await resp.text();
  
  const companies: {name: string; address: string; creditCode: string; orgCode: string; legalPerson: string; url: string}[] = [];
  
  // 尝试从搜索结果中提取公司信息
  // 企查查搜索结果中会有公司名称、地址、统一社会信用代码等
  
  // 提取公司名称
  const namePattern = /class="[^"]*title[^"]*"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/g;
  const names: string[] = [];
  let match;
  while ((match = namePattern.exec(html)) !== null) {
    const name = match[1].trim();
    if (name.length > 4 && (name.includes('公司') || name.includes('厂') || name.includes('企业'))) {
      names.push(name);
    }
  }

  // 提取统一社会信用代码（18位）
  const creditCodePattern = /(?:统一社会信用代码|信用代码)[^0-9A-Z]*([0-9A-Z]{18})/g;
  const creditCodes: string[] = [];
  while ((match = creditCodePattern.exec(html)) !== null) {
    creditCodes.push(match[1]);
  }

  // 提取组织机构代码（9位，格式 XXXXXXXX-X）
  const orgCodePattern = /(?:组织机构代码)[^0-9A-Z]*([0-9A-Z]{8}-[0-9A-Z])/gi;
  const orgCodes: string[] = [];
  while ((match = orgCodePattern.exec(html)) !== null) {
    orgCodes.push(match[1]);
  }

  // 提取地址
  const addrPattern = /(?:地址|住所|注册地址)[^<]*[:：][^<]*<[^>]*>([^<]+)/g;
  const addresses: string[] = [];
  while ((match = addrPattern.exec(html)) !== null) {
    const addr = match[1].trim();
    if (addr.length > 5 && addr.length < 200) {
      addresses.push(addr);
    }
  }

  // 提取法定代表人
  const legalPattern = /(?:法定代表人|法人)[^<]*[:：][^<]*<[^>]*>([^<]+)/g;
  const legals: string[] = [];
  while ((match = legalPattern.exec(html)) !== null) {
    legals.push(match[1].trim());
  }

  // 提取公司链接
  const urlPattern = /href="(\/firm\/[^"]+)"/g;
  const urls: string[] = [];
  while ((match = urlPattern.exec(html)) !== null) {
    urls.push(match[1]);
  }

  // 组合结果（最多返回8条）
  const count = Math.min(names.length, 8);
  for (let i = 0; i < count; i++) {
    companies.push({
      name: names[i] || '',
      address: addresses[i] || '',
      creditCode: creditCodes[i] || '',
      orgCode: orgCodes[i] || '',
      legalPerson: legals[i] || '',
      url: urls[i] ? `https://www.qcc.com${urls[i]}` : '',
    });
  }

  // 备用方案：如果上面没匹配到，尝试从 JSON 数据中提取
  if (companies.length === 0) {
    const jsonPattern = /"companyName"\s*:\s*"([^"]+)"[\s\S]*?"creditCode"\s*:\s*"([^"]*)"[\s\S]*?"address"\s*:\s*"([^"]*)"/g;
    while ((match = jsonPattern.exec(html)) !== null && companies.length < 8) {
      companies.push({
        name: match[1],
        creditCode: match[2],
        address: match[3],
        orgCode: '',
        legalPerson: '',
        url: '',
      });
    }
  }

  // 如果还是没结果，尝试更宽松的匹配
  if (companies.length === 0) {
    // 从页面中提取所有可能的统一社会信用代码
    const looseCreditPattern = /([0-9A-Z]{18})/g;
    const allCreditCodes: string[] = [];
    while ((match = looseCreditPattern.exec(html)) !== null) {
      const code = match[1];
      // 验证是否是有效的统一社会信用代码（以91开头）
      if (code.startsWith('91') && !allCreditCodes.includes(code)) {
        allCreditCodes.push(code);
      }
    }

    // 从页面中提取所有公司名称
    const looseNamePattern = />([^<]*(?:有限公司|股份有限公司|制品厂|企业)[^<]*)</g;
    const seen = new Set<string>();
    while ((match = looseNamePattern.exec(html)) !== null && companies.length < 8) {
      const name = match[1].trim();
      if (name.length > 4 && name.length < 50 && !seen.has(name)) {
        seen.add(name);
        companies.push({
          name: name,
          address: '',
          creditCode: allCreditCodes[companies.length] || '',
          orgCode: '',
          legalPerson: '',
          url: '',
        });
      }
    }
  }

  return companies;
}
