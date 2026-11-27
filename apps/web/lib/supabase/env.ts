/** Public Supabase settings. Both are safe in the browser: the publishable key only grants what RLS allows. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export function supabaseConfigured() {
  return SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('your-project') && SUPABASE_KEY.length > 20 && !SUPABASE_KEY.startsWith('your-')
}
