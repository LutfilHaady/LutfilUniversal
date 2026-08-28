import { createBrowserClient } from '@supabase/ssr'

// createBrowserClient stores the session in cookies so middleware can read it.
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default supabase
