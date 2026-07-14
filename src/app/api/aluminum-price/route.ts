import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const material = searchParams.get('material') || '铝型材';
    
    // 获取当前日期
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    
    // 尝试从灵通铝锭价网站获取数据
    let price = 0;
    let change = 0;
    let changePercent = 0;
    let source = '南海铝锭价';
    
    try {
      const url = `http://www.lvdingjia.com/zhishu/${dateStr}.html`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // 提取南海铝锭价（非灵通）
        const match = html.match(/南海(?!灵通)[^<]*?(\d+)~(\d+)/);
        if (match) {
          const low = parseInt(match[1]);
          const high = parseInt(match[2]);
          price = Math.round((low + high) / 2);
          
          // 尝试提取涨跌信息
          const changeMatch = html.match(/涨跌[^<]*?([+-]?\d+)/);
          if (changeMatch) {
            change = parseInt(changeMatch[1]);
          }
          
          // 尝试提取涨跌幅
          const percentMatch = html.match(/涨跌幅[^<]*?([+-]?\d+\.?\d*)/);
          if (percentMatch) {
            changePercent = parseFloat(percentMatch[1]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch aluminum price:', error);
    }
    
    // 如果获取失败，使用默认值
    if (!price) {
      price = 23530; // 默认值
      change = 240;
      changePercent = 1.03;
      source = '默认价格（获取失败）';
    }
    
    return NextResponse.json({
      success: true,
      data: {
        material,
        price,
        change,
        changePercent,
        source,
        date: today.toISOString().split('T')[0],
        pricePerKg: (price / 1000).toFixed(2),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: '获取铝价失败',
      },
      { status: 500 }
    );
  }
}
