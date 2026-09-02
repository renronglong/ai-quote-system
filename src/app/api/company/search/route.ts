import { NextRequest, NextResponse } from 'next/server';

// 公司搜索 API - 通过搜索引擎搜索匹配的公司列表
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
  // 通过搜索引擎搜索公司信息，附加"统一社会信用代码"关键词提高信息密度
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword + ' 公司 统一社会信用代码 地址')}&hl=zh-CN`;
  
  const resp = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    next: { revalidate: 300 }, // 缓存5分钟
  });

  if (!resp.ok) {
    throw new Error(`搜索请求失败: ${resp.status}`);
  }

  const html = await resp.text();
  
  const companies: {name: string; address: string; creditCode: string; orgCode: string; legalPerson: string; url: string}[] = [];
  
  // 从搜索结果中提取统一社会信用代码（18位，通常以91开头）
  const creditCodePattern = /(?:统一社会信用代码|信用代码)[^0-9A-Z]*([0-9A-Z]{18})/gi;
  const creditCodes: string[] = [];
  let match;
  while ((match = creditCodePattern.exec(html)) !== null) {
    const code = match[1];
    if (!creditCodes.includes(code)) {
      creditCodes.push(code);
    }
  }

  // 提取组织机构代码
  const orgCodePattern = /(?:组织机构代码)[^0-9A-Z]*([0-9A-Z]{8}-[0-9A-Z])/gi;
  const orgCodes: string[] = [];
  while ((match = orgCodePattern.exec(html)) !== null) {
    orgCodes.push(match[1]);
  }

  // 提取公司名称（搜索结果标题中）
  const titlePattern = /<h3[^>]*>([^<]+)<\/h3>/g;
  const titles: string[] = [];
  while ((match = titlePattern.exec(html)) !== null) {
    const title = match[1].trim();
    // 过滤出包含公司关键词的标题
    if ((title.includes('公司') || title.includes('集团') || title.includes('企业')) && 
        title.length > 4 && title.length < 80 &&
        !title.includes(' - ') === false || title.includes(keyword)) {
      titles.push(title);
    }
  }

  // 提取地址（搜索结果摘要中）
  const addrPattern = /(?:地址|注册地址|企业地址)[^<]*[:：]\s*([^<,，\n]{5,100})/g;
  const addresses: string[] = [];
  while ((match = addrPattern.exec(html)) !== null) {
    const addr = match[1].trim();
    if (addr.length > 5 && addr.length < 200 && !addresses.includes(addr)) {
      addresses.push(addr);
    }
  }

  // 提取法定代表人
  const legalPattern = /(?:法定代表人|法人)[^<]*[:：]\s*([^<,，\n]{1,20})/g;
  const legals: string[] = [];
  while ((match = legalPattern.exec(html)) !== null) {
    legals.push(match[1].trim());
  }

  // 组合结果（最多返回8条）
  const maxResults = Math.min(Math.max(titles.length, creditCodes.length, addresses.length), 8);
  for (let i = 0; i < maxResults; i++) {
    const name = (titles[i] || '').replace(/[-–|]\s*(企查查|天眼查|启信宝|爱企查|顺企网|水滴信用|企知道|工商信息).*/g, '').trim();
    if (!name || name.length < 4) continue;
    
    companies.push({
      name: name,
      address: addresses[i] || '',
      creditCode: creditCodes[i] || '',
      orgCode: orgCodes[i] || '',
      legalPerson: legals[i] || '',
      url: '',
    });
  }

  // 备用方案：如果上面的正则没匹配到，尝试从页面中提取所有信用代码+名称组合
  if (companies.length === 0) {
    // 提取所有18位信用代码
    const allCreditPattern = /([0-9A-Z]{18})/g;
    const allCodes: string[] = [];
    while ((match = allCreditPattern.exec(html)) !== null) {
      const code = match[1];
      if (code.startsWith('91') && !allCodes.includes(code)) {
        allCodes.push(code);
      }
    }

    // 提取所有公司名称
    const allNamePattern = />([^<]*(?:有限公司|股份有限公司|集团有限公司)[^<]*)</g;
    const seen = new Set<string>();
    for (let i = 0; i < allCodes.length && companies.length < 8; i++) {
      // 在信用代码附近找公司名称
      const codePos = html.indexOf(allCodes[i]);
      const context = html.substring(Math.max(0, codePos - 500), codePos + 100);
      const nameMatch = context.match(/([^<>\n]*(?:有限公司|股份有限公司|集团有限公司)[^<>\n]*)/);
      if (nameMatch) {
        const name = nameMatch[1].trim().replace(/[-–|]\s*(企查查|天眼查|启信宝|爱企查).*/g, '');
        if (name.length > 4 && name.length < 50 && !seen.has(name)) {
          seen.add(name);
          // 在上下文里找地址
          const addrMatch = context.match(/(?:地址|注册地址)[^:：]*[:：]\s*([^<,，\n]{5,100})/);
          companies.push({
            name: name,
            address: addrMatch ? addrMatch[1].trim() : '',
            creditCode: allCodes[i],
            orgCode: '',
            legalPerson: '',
            url: '',
          });
        }
      }
    }
  }

  return companies;
}
