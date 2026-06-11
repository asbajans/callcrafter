import { NextResponse } from 'next/server';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  tenantName: z.string().min(2, 'Company name must be at least 2 characters'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { name, email, password, tenantName } = parsed.data;

    // TODO: Replace with Payload CMS registration
    // const user = await payload.create({
    //   collection: 'users',
    //   data: { name, email, password },
    // });
    // const tenant = await payload.create({
    //   collection: 'tenants',
    //   data: { name: tenantName, owner: user.id },
    // });

    // Mock registration
    console.log('Registration:', { name, email, password, tenantName });

    return NextResponse.json(
      {
        message: 'User registered successfully',
        user: { id: 'new-user-id', name, email },
        tenant: { id: 'new-tenant-id', name: tenantName },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
