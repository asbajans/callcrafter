import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const locales = ['tr', 'en'];
const defaultLocale = 'en';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

const payloadPaths = ['/admin', '/api'];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip intl middleware for Payload CMS routes (admin + API)
  for (const prefix of payloadPaths) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return NextResponse.next();
    }
  }

  const protectedPaths = ['/dashboard'];

  const isProtected = protectedPaths.some(
    (path) => pathname.startsWith(`/${path}`) || pathname.match(`^/[a-z]{2}${path}`)
  );

  if (isProtected) {
    // TODO: Implement proper auth check (Payload JWT)
    // For now, redirect to login if no authorization cookie
    const token = request.cookies.get('payload-token')?.value;

    if (!token) {
      const locale = request.cookies.get('NEXT_LOCALE')?.value || defaultLocale;
      const loginUrl = new URL(`/${locale}/auth/login`, request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
