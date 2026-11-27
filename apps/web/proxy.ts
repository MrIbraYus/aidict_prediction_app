import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigured } from './lib/supabase/env'

const PUBLIC = ['/login', '/signup', '/forgot', '/reset-password', '/auth/callback', '/setup', '/responsible', '/about']

/** Refreshes the Supabase session on every request and keeps private pages behind sign-in. */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname
  // Email links fall back to the Site URL when /auth/callback is not on Supabase's redirect allow-list: finish sign-in anyway.
  const code = request.nextUrl.searchParams.get('code')
  if (code && path !== '/auth/callback') {
    const to = new URL('/auth/callback', request.url)
    to.searchParams.set('code', code)
    to.searchParams.set('next', path === '/' ? '/' : path)
    return NextResponse.redirect(to)
  }
  if (!supabaseConfigured()) {
    return path.startsWith('/setup') ? NextResponse.next() : NextResponse.redirect(new URL('/setup', request.url))
  }
  let response = NextResponse.next({ request })
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })
  const { data } = await supabase.auth.getUser()
  // Deactivated accounts are signed out on their next request, even if their session token has not expired yet.
  if (data.user?.banned_until && new Date(data.user.banned_until).getTime() > Date.now()) {
    await supabase.auth.signOut()
    const out = NextResponse.redirect(new URL('/login?error=deactivated', request.url))
    response.cookies.getAll().forEach((c) => out.cookies.set(c))
    return out
  }
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + '/'))
  if (!data.user && !isPublic) {
    const to = new URL('/login', request.url)
    if (path !== '/') to.searchParams.set('next', path)
    return NextResponse.redirect(to)
  }
  if (data.user && (path === '/login' || path === '/signup')) return NextResponse.redirect(new URL('/', request.url))
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|sounds/|.*\\.(?:png|svg|jpg|wav|ico)$).*)'],
}
