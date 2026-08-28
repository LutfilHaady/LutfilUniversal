import { createServerClient } from '@supabase/ssr'
import { NextResponse, userAgent } from 'next/server'
import type { NextRequest } from 'next/server'

type Role = 'Operator' | 'Engineer' | 'Admin'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() validates the JWT server-side (more secure than getSession)
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const publicPaths = ['/login', '/reset-password']
  if (!user && pathname !== '/' && !publicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && (pathname === '/' || pathname === '/login')) {
    const { device } = userAgent(request)
    if (device.type === 'mobile' || device.type === 'tablet') {
      return NextResponse.redirect(new URL('/batches', request.url))
    }
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (user && pathname.startsWith('/reset-password')) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  let role: Role | null = null
  if (user) {
    try {
      const { data } = await supabase
        .from('users')
        .select('roles(name)')
        .eq('id', user.id)
        .single()

      const rawRole = (data as { roles?: { name?: string } | null } | null)?.roles?.name
      if (rawRole === 'Operator' || rawRole === 'Engineer' || rawRole === 'Admin') {
        role = rawRole
      }
    } catch (error) {
      console.error('[middleware] role fetch failed:', error)
    }
  }

  const isAdmin = role === 'Admin'
  const isOperator = role === 'Operator'
  const roleResolved = role !== null

  if (pathname.startsWith('/admin') && !isAdmin) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if ((pathname.startsWith('/reports') || pathname.startsWith('/recall'))
      && (isOperator || !roleResolved)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/reports/:path*',
    '/recall/:path*',
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
