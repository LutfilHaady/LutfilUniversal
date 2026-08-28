import { supabase2 } from '@/backend/supabaseClient';

export async function GET() {
  const { data, error } = await supabase2
    .from('ges_data')
    .select('industry')
    .neq('industry', null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const uniqueIndustries = Array.from(new Set(data.map(item => item.industry)));

  return new Response(JSON.stringify(uniqueIndustries), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
