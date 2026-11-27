import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/** Handles email confirmation and password-reset links (PKCE code or token hash). */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const next = url.searchParams.get('next')
  const to = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const sb = await createClient()
  const code = url.searchParams.get('code')
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  let ok = false
  if (code) ok = !(await sb.auth.exchangeCodeForSession(code)).error
  else if (tokenHash && type) ok = !(await sb.auth.verifyOtp({ token_hash: tokenHash, type })).error
  return NextResponse.redirect(new URL(ok ? to : '/login?error=link', url.origin))
}
