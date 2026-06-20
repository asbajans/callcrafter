export const runtime = 'nodejs';

import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getPayload } from 'payload';
import payloadConfig from '@payload-config';

const locales = ['tr', 'en'];
const defaultLocale = 'en';
const JWT_SECRET = new TextEncoder().encode(
  process.env.PAYLOAD_SECRET || 'default-secret-change-in-production'
);

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
});

const payloadPaths = ['/admin', '/api'];

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip intl middleware for Payload CMS routes (admin + API)
  for (const prefix of payloadPaths) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return NextResponse.next();
    }
  }

  const protectedPaths = ['/dashboard'];

  const isProtected = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(path + '/') || pathname.match(new RegExp(`^/[a-z]{2}${path}(/.*)?$`))
  );

  if (isProtected) {
    // Verify JWT token and get user
    const token = request.cookies.get('payload-token')?.value;
    
    if (!token) {
      const locale = request.cookies.get('NEXT_LOCALE')?.value || defaultLocale;
      const loginUrl = new URL(`/${locale}/auth/login`, request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const { payload: jwtPayload } = await jwtVerify(token, JWT_SECRET);
      const userId = jwtPayload.sub as string;
      if (!userId) {
        throw new Error('Invalid token payload');
      }

      // Verify user exists in Payload
      const payloadInstance = await getPayload({ config: payloadConfig });
      const user = await payloadInstance.findByID({
        collection: 'users',
        id: userId,
        depth: 0,
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Attach user to request for protected routes
      (request as any).user = user;
      
    } catch (error) {
      // Invalid or expired token
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
