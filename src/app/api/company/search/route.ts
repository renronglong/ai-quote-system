import { NextRequest, NextResponse } from 'next/server';

// 公司搜索 API - 从启信宝搜索匹配的公司列表
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
  // 使用启信宝搜索页面
  const searchUrl = `https://www.qixin.com/search?key=${encodeURIComponent(keyword)}`;
  
  const resp = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://www.qixin.com/',
    },
  });

  if (!resp.ok) {
    throw new Error(`搜索请求失败: ${resp.status}`);
  }

  const html = await resp.text();
  
  // 解析搜索结果 - 提取公司名称和地址
  const companies: {name: string; address: string; url: string}[] = [];
  
  // 启信宝搜索结果通常在公司卡片中有公司名称和地址
  // 尝试匹配公司名称列表
  const namePattern = /class="[^"]*company-name[^"]*"[^>]*>([^<]+)</g;
  const addrPattern = /class="[^"]*company-address[^"]*"[^>]*>([^<]+)</g;
  
  let nameMatch;
  const names: string[] = [];
  while ((nameMatch = namePattern.exec(html)) !== null) {
    names.push(nameMatch[1].trim());
  }
  
  let addrMatch;
  const addresses: string[] = [];
  while ((addrMatch = addrPattern.exec(html)) !== null) {
    addresses.push(addrMatch[1].trim());
  }
  
  // 匹配公司链接
  const linkPattern = /href="(\/company\/[a-f0-9-]+)"[^>]*>[\s\S]*?company-name/g;
  const urls: string[] = [];
  let linkMatch;
  while ((linkMatch = linkPattern.exec(html)) !== null) {
    urls.push(linkMatch[1]);
  }

  // 组合结果（最多返回8条）
  const count = Math.min(names.length, 8);
  for (let i = 0; i < count; i++) {
    companies.push({
      name: names[i] || '',
      address: addresses[i] || '',
      url: urls[i] ? `https://www.qixin.com${urls[i]}` : '',
    });
  }

  // 如果上面的正则没匹配到，尝试备用方案
  if (companies.length === 0) {
    // 尝试从 JSON 数据中提取
    const jsonPattern = /"companyName"\s*:\s*"([^"]+)"[\s\S]*?"address"\s*:\s*"([^"]*)"/g;
    let jsonMatch;
    while ((jsonMatch = jsonPattern.exec(html)) !== null && companies.length < 8) {
      companies.push({
        name: jsonMatch[1],
        address: jsonMatch[2],
        url: '',
      });
    }
  }

  // 如果还是没匹配到，尝试更宽松的匹配
  if (companies.length === 0) {
    // 匹配包含"公司"等关键词的文本块
    const loosePattern = />([^<]*(?:有限公司|股份有限公司|集团|企业)[^<]*)</g;
    let looseMatch;
    const seen = new Set<string>();
    while ((looseMatch = loosePattern.exec(html)) !== null && companies.length < 8) {
      const name = looseMatch[1].trim();
      if (name.length > 4 && name.length < 50 && !seen.has(name)) {
        seen.add(name);
        companies.push({
          name: name,
          address: '',
          url: '',
        });
      }
    }
  }

  return companies;
}
