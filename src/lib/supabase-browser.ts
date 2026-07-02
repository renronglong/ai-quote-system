import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://br-lush-teal-829ebb2c.supabase2.aidap-global.cn-beijing.volces.com';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjMzNjA2MjY2ODUsInJvbGUiOiJhbm9uIn0.UiqwBeKiQW8EhGY47H4ZqOXOYu7lo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
