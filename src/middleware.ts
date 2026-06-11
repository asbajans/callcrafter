import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const locales = ['tr', 'en'];
const defaultLocale = 'en';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

const protectedPaths = ['/dashboard', '/admin'];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some(
    (path) => pathname.startsWith(`/${path}`) || pathname.match(`^/[a-z]{2}${path}`)
  );

  if (isProtected) {
    const token = request.cookies.get('token')?.value || request.headers.get('authorization');

    if (!token) {
      const locale = request.cookies.get('NEXT_LOCALE')?.value || defaultLocale;
      const loginUrl = new URL(`/${locale}/auth/login`, request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // TODO: Verify JWT token with Payload CMS
    // try {
    //   const payload = await jwtVerify(token, secretKey);
    //   request.headers.set('x-user-id', payload.userId);
    // } catch {
    //   return NextResponse.redirect(loginUrl);
    // }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
