import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/storage/database/supabase-client";

interface QuotationRequest {
  product_id?: number;
  image_key?: string;
  identified_material?: string;
  identified_process?: string;
  identified_surface_treatment?: string;
  oxidation_color?: string;
  cost_price: number;
  quantity: number;
  tax_rate?: number;
  discount?: number;
  gross_margin?: number;
  notes?: string;
}

interface QuotationResult {
  cost_price: number;
  quantity: number;
  tax_rate: number;
  discount: number;
  gross_margin: number;
  base_price: number; // 基础价格（成本 × 数量）
  gross_profit: number; // 毛利润
  price_before_tax: number; // 税前价格
  tax_amount: number; // 税额
  total_price: number; // 总价
  is_valid: boolean;
  validation_message?: string;
}

// 计算报价
function calculateQuotation(params: QuotationRequest): QuotationResult {
  const {
    cost_price,
    quantity,
    tax_rate = 13,
    discount = 0,
    gross_margin = 30,
  } = params;

  // 基础价格 = 成本单价 × 数量
  const base_price = cost_price * quantity;

  // 毛利润 = 基础价格 × 毛利率
  const gross_profit = base_price * (gross_margin / 100);

  // 税前价格 = 基础价格 + 毛利润 - 折扣
  const price_before_tax = base_price + gross_profit - discount;

  // 税额 = 税前价格 × 税率
  const tax_amount = price_before_tax * (tax_rate / 100);

  // 总价 = 税前价格 + 税额
  const total_price = price_before_tax + tax_amount;

  return {
    cost_price,
    quantity,
    tax_rate,
    discount,
    gross_margin,
    base_price,
    gross_profit,
    price_before_tax,
    tax_amount,
    total_price,
    is_valid: true,
  };
}

// 验证报价
function validateQuotation(
  result: QuotationResult,
  min_price?: number
): QuotationResult {
  const validations: string[] = [];

  // 检查最低限价
  if (min_price && result.total_price < min_price * result.quantity) {
    validations.push("报价低于最低限价");
  }

  // 检查毛利率是否合理（通常不应低于10%）
  if (result.gross_margin < 10) {
    validations.push("毛利率过低，建议不低于10%");
  }

  // 检查总价是否为负数
  if (result.total_price < 0) {
    validations.push("总价为负数，请检查折扣设置");
  }

  // 检查税前价格是否低于成本
  if (result.price_before_tax < result.base_price) {
    validations.push("税前价格低于成本价");
  }

  return {
    ...result,
    is_valid: validations.length === 0,
    validation_message:
      validations.length > 0 ? validations.join("；") : undefined,
  };
}

// POST - 计算并保存报价
export async function POST(request: NextRequest) {
  try {
    const body: QuotationRequest = await request.json();

    // 验证必填字段
    if (!body.cost_price || !body.quantity) {
      return NextResponse.json(
        { error: "缺少必填字段：成本单价和数量" },
        { status: 400 }
      );
    }

    const client = getSupabaseClient();

    // 查询产品信息（如果提供了产品ID）
    let product = null;
    if (body.product_id) {
      const { data } = await client
        .from("products")
        .select("*")
        .eq("id", body.product_id)
        .single();
      product = data;
    }

    // 计算报价
    let result = calculateQuotation(body);

    // 验证报价
    if (product?.min_price) {
      result = validateQuotation(result, parseFloat(product.min_price));
    } else {
      result = validateQuotation(result);
    }

    // 保存报价历史
    const { data, error } = await client
      .from("quotation_history")
      .insert({
        product_id: body.product_id,
        image_key: body.image_key,
        identified_material: body.identified_material,
        identified_process: body.identified_process,
        identified_surface_treatment: body.identified_surface_treatment,
        oxidation_color: body.oxidation_color,
        cost_price: body.cost_price,
        quantity: body.quantity,
        tax_rate: body.tax_rate || 13,
        discount: body.discount || 0,
        gross_margin: body.gross_margin || 30,
        total_price: result.total_price,
        is_valid: result.is_valid,
        validation_message: result.validation_message,
        notes: body.notes,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`保存报价历史失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      quotation: {
        ...result,
        id: data.id,
        created_at: data.created_at,
      },
    });
  } catch (error) {
    console.error("计算报价失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "计算报价失败" },
      { status: 500 }
    );
  }
}

// GET - 获取报价历史
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("product_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

    const client = getSupabaseClient();

    let query = client
      .from("quotation_history")
      .select(`
        *,
        products (
          id,
          product_code,
          name,
          material,
          process,
          surface_treatment
        )
      `)
      .order("created_at", { ascending: false });

    if (productId) {
      query = query.eq("product_id", parseInt(productId));
    }
    if (startDate) {
      query = query.gte("created_at", startDate);
    }
    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`查询报价历史失败: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error("获取报价历史失败:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取报价历史失败" },
      { status: 500 }
    );
  }
}
