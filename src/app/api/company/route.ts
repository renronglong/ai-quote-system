import { NextRequest, NextResponse } from 'next/server';

// 从启信宝抓取公司信息的 API
// GET /api/company?name=佛山市碧利莱照明有限公司

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const companyName = searchParams.get('name');

  if (!companyName) {
    return NextResponse.json({ success: false, error: '请提供公司名称' }, { status: 400 });
  }

  try {
    const result = await fetchCompanyInfoFromQixin(companyName);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('抓取公司信息失败:', error);
    return NextResponse.json(
      { success: false, error: '抓取失败，请稍后重试' },
      { status: 500 }
    );
  }
}

async function fetchCompanyInfoFromQixin(companyName: string) {
  // 第一步：搜索公司
  const searchUrl = `https://www.qixin.com/search?key=${encodeURIComponent(companyName)}`;
  
  const searchResp = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://www.qixin.com/',
    },
  });

  if (!searchResp.ok) {
    throw new Error(`搜索请求失败: ${searchResp.status}`);
  }

  const searchHtml = await searchResp.text();
  
  // 从搜索结果中提取公司详情页链接
  const companyUrlMatch = searchHtml.match(/href="(\/company\/[^"]+)"/);
  
  if (!companyUrlMatch) {
    const altMatch = searchHtml.match(new RegExp(`href="(/company/[^"]+)".*?${companyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 's'));
    if (!altMatch) {
      throw new Error('未找到该公司，请检查公司名称是否正确');
    }
  }

  const companyPath = companyUrlMatch ? companyUrlMatch[1] : searchHtml.match(new RegExp(`(\/company\/[a-f0-9-]+)`))?.[0];
  
  if (!companyPath) {
    throw new Error('无法解析公司页面链接');
  }

  const companyUrl = `https://www.qixin.com${companyPath}`;

  // 第二步：访问公司详情页
  const detailResp = await fetch(companyUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Referer': 'https://www.qixin.com/',
    },
  });

  if (!detailResp.ok) {
    throw new Error(`公司详情请求失败: ${detailResp.status}`);
  }

  const detailHtml = await detailResp.text();

  // 第三步：提取地址信息
  let address = '';
  
  const patterns = [
    /注册地址[：:]\s*([^<\n]+)/,
    /企业地址[：:]\s*([^<\n]+)/,
    /住所[：:]\s*([^<\n]+)/,
    />([^<]*(?:省|市|区|县|镇|乡|村|路|街|道|号|栋|幢|室)[^<]*)</,
  ];

  for (const pattern of patterns) {
    const match = detailHtml.match(pattern);
    if (match && match[1]) {
      address = match[1].trim();
      address = address.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      if (address.length > 5 && address.length < 200) {
        break;
      }
    }
  }

  if (!address) {
    const jsonMatch = detailHtml.match(/"address"\s*:\s*"([^"]+)"/);
    if (jsonMatch) {
      address = jsonMatch[1];
    }
  }

  let legalPerson = '';
  let phone = '';
  
  const legalMatch = detailHtml.match(/法定代表人[：:]\s*([^<\n]+)/);
  if (legalMatch) {
    legalPerson = legalMatch[1].trim();
  }

  const phoneMatch = detailHtml.match(/电话[：:]\s*([^<\n]+)/);
  if (phoneMatch) {
    phone = phoneMatch[1].trim();
  }

  return {
    companyName,
    address: address || '未找到地址信息',
    legalPerson: legalPerson || '',
    phone: phone || '',
    sourceUrl: companyUrl,
  };
}
