import { createClient } from '@supabase/supabase-js';

// 获取环境变量
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 创建服务端 Supabase 客户端（使用 service_role key，可以绕过 RLS）
export function getSupabaseClient() {
    if (!supabaseUrl) {
        throw new Error('Missing SUPABASE_URL environment variable');
    }
    
    // 优先使用 service role key，服务端使用
    if (supabaseServiceKey) {
        return createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
    }
    
    // 回退到 anon key
    if (supabaseAnonKey) {
        return createClient(supabaseUrl, supabaseAnonKey);
    }
    
    throw new Error('Missing Supabase API keys environment variables');
}

// 创建带用户认证的客户端
export function getSupabaseClientWithAuth(accessToken: string) {
    if (!supabaseUrl) {
        throw new Error('Missing SUPABASE_URL environment variable');
    }
    
    const client = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
    
    // 设置用户 token
    client.auth.setSession({
        access_token: accessToken,
        refresh_token: '',
    });
    
    return client;
}

// 创建浏览器端客户端（仅使用 anon key）
export function getSupabaseBrowserClient() {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase environment variables for browser client');
    }
    
    return createClient(supabaseUrl, supabaseAnonKey);
}

export { supabaseUrl, supabaseAnonKey };
