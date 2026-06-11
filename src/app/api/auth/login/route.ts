import { NextResponse } from 'next/server';
import { z } from 'zod';

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

    // TODO: Replace with Payload CMS authentication
    // const user = await payload.login({
    //   collection: 'users',
    //   data: { email, password },
    // });

    // Mock authentication for development
    if (email === 'admin@callcrafter.com' && password === 'password123') {
      return NextResponse.json({
        token: 'mock-jwt-token',
        user: {
          id: '1',
          email: 'admin@callcrafter.com',
          name: 'Admin User',
        },
      });
    }

    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
