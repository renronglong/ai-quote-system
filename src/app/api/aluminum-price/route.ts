import { NextResponse } from 'next/server';

// 南海灵通铝锭价 API
// 多数据源获取最新铝价，失败时返回默认值
export async function GET() {
  // 数据源1：大沥铝材网 dynamic 页面
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch('https://www.lvdingjia.com/dynamic', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);
    
    if (response.ok) {
      const text = await response.text();
      
      // 匹配 "南海铝锭XXXXX" 格式（data-copy属性中的数据）
      const nanHaiMatch = text.match(/南海铝锭[^\d]*(\d{5})/);
      if (nanHaiMatch) {
        const price = parseInt(nanHaiMatch[1]);
        if (price > 10000 && price < 50000) {
          return NextResponse.json({
            price,
            source: 'lvdingjia.com-dynamic',
            date: new Date().toISOString().slice(0, 10),
          });
        }
      }
      
      // 备用：匹配data-copy中的完整格式 "06月18日南海铝锭24030"
      const dateCopyMatch = text.match(/\d{2}月\d{2}日南海铝锭(\d{5})/);
      if (dateCopyMatch) {
        const price = parseInt(dateCopyMatch[1]);
        if (price > 10000 && price < 50000) {
          return NextResponse.json({
            price,
            source: 'lvdingjia.com-copy',
            date: new Date().toISOString().slice(0, 10),
          });
        }
      }
    }
  } catch {
    // 数据源1失败
  }

  // 数据源2：大沥铝材网 /price/nanhai/ 页面
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch('https://www.lvdingjia.com/price/nanhai/', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/json,*/*',
      },
    });
    clearTimeout(timeout);
    
    if (response.ok) {
      const text = await response.text();
      
      // 尝试解析JSON格式
      try {
        const json = JSON.parse(text);
        const content = json?.data?.content || '';
        const avgMatch = content.match(/南海铝锭[\s\S]*?均价[▼\s]*(\d{4,6})/);
        if (avgMatch) {
          const price = parseInt(avgMatch[1]);
          if (price > 10000 && price < 50000) {
            return NextResponse.json({
              price,
              source: 'lvdingjia.com',
              date: new Date().toISOString().slice(0, 10),
            });
          }
        }
      } catch {
        // JSON解析失败
      }
      
      // HTML文本解析
      const htmlMatch = text.match(/南海铝锭[^\d]*(\d{5})/);
      if (htmlMatch) {
        const price = parseInt(htmlMatch[1]);
        if (price > 10000 && price < 50000) {
          return NextResponse.json({
            price,
            source: 'lvdingjia.com-html',
            date: new Date().toISOString().slice(0, 10),
          });
        }
      }
    }
  } catch {
    // 数据源2失败
  }
  
  // 数据源3：世铝网 cnal.com
  try {
    const controller2 = new AbortController();
    const timeout2 = setTimeout(() => controller2.abort(), 5000);
    
    const response2 = await fetch('https://www.cnal.com/market_7AAepE3/', {
      signal: controller2.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    clearTimeout(timeout2);
    
    if (response2.ok) {
      const html = await response2.text();
      // 匹配"均价24090"或"均价：24090"
      const priceMatch = html.match(/均价[：:\s]*(\d{4,6})/);
      if (priceMatch) {
        const price = parseInt(priceMatch[1]);
        if (price > 10000 && price < 50000) {
          return NextResponse.json({
            price,
            source: 'cnal.com',
            date: new Date().toISOString().slice(0, 10),
          });
        }
      }
      // 备用：匹配价格区间
      const rangeMatch = html.match(/(\d{5})[~～\-—](\d{5})/);
      if (rangeMatch) {
        const low = parseInt(rangeMatch[1]);
        const high = parseInt(rangeMatch[2]);
        if (low > 10000 && high < 50000) {
          return NextResponse.json({
            price: Math.round((low + high) / 2),
            source: 'cnal.com-avg',
            date: new Date().toISOString().slice(0, 10),
          });
        }
      }
    }
  } catch {
    // 数据源3失败
  }

  // 数据源4：中国有色网 cnmn.com.cn
  try {
    const controller3 = new AbortController();
    const timeout3 = setTimeout(() => controller3.abort(), 5000);
    
    const response3 = await fetch('https://www.cnmn.com.cn/ShowNews1.aspx?id=471714', {
      signal: controller3.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    clearTimeout(timeout3);
    
    if (response3.ok) {
      const html = await response3.text();
      // 匹配国产A00批售（送厂）的均价
      const a00Match = html.match(/国产A00批售（送厂）[^均]*均价[^\d]*(\d{4,6})/);
      if (a00Match) {
        const price = parseInt(a00Match[1]);
        if (price > 10000 && price < 50000) {
          return NextResponse.json({
            price,
            source: 'cnmn.com.cn',
            date: new Date().toISOString().slice(0, 10),
          });
        }
      }
      // 备用：匹配价格区间并取均值
      const rangeMatch = html.match(/(\d{5})[~～\-—](\d{5})/);
      if (rangeMatch) {
        const low = parseInt(rangeMatch[1]);
        const high = parseInt(rangeMatch[2]);
        if (low > 10000 && high < 50000) {
          return NextResponse.json({
            price: Math.round((low + high) / 2),
            source: 'cnmn.com.cn-avg',
            date: new Date().toISOString().slice(0, 10),
          });
        }
      }
    }
  } catch {
    // 数据源4失败
  }

  // 所有数据源都失败，返回默认值
  return NextResponse.json({
    price: 24000,
    source: 'default-fallback',
    date: new Date().toISOString().slice(0, 10),
    warning: '未能获取实时铝价，使用默认值',
  });
}
