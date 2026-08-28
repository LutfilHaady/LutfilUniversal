//initialize supabase database

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

//for GES
const supabaseUrl2 = process.env.NEXT_PUBLIC_SUPABASE_URL2;
const supabaseAnonKey2 = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY2;

export const supabase2 = createClient(supabaseUrl2, supabaseAnonKey2);

//for SkillsFuture
const supabaseUrl3 = process.env.NEXT_PUBLIC_SUPABASE_URL3;
const supabaseAnonKey3 = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY3;

export const supabase3 = createClient(supabaseUrl3, supabaseAnonKey3);