import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jotgxnhueagbsvfeepic.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpvdGd4bmh1ZWFnYnN2ZmVlcGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1MDIxMjMsImV4cCI6MjA5OTA3ODEyM30.HMakmupio68bTY2FbJWZnqNPMG-UMwwbKcF2UsTgwlQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
