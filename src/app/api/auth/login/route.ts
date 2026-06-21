import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../payload.config';
const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const payload = await getPayload({ config });

    const result = await payload.login({
      collection: 'users',
      data: { email, password },
    });

    if (!result.token || !result.user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Return payload token for middleware to handle
    const jwtToken = result.token;

    const response = NextResponse.json({
      token: jwtToken, // Return JWT for middleware
      user: {
        id: result.user.id,
        email: result.user.email,
        name: `${result.user.firstName || ''} ${result.user.lastName || ''}`.trim() || result.user.email,
        role: result.user.role,
        tenant: result.user.tenant,
      },
    });

    // Also set Payload token for compatibility
    const isHttps = request.headers.get('x-forwarded-proto') === 'https' || request.url.startsWith('https://');
    response.cookies.set('payload-token', result.token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error?.message || error, 'Stack:', error?.stack);
    return NextResponse.json(
      {
        error: error?.message || 'Invalid email or password',
        type: error?.constructor?.name || typeof error,
      },
      { status: 401 }
    );
  }
}
