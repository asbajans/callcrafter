import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPayload } from 'payload';
import config from '../../../../../payload.config';

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
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;

    const payload = await getPayload({ config });

    const user = await payload.create({
      collection: 'users',
      data: { email, password, firstName, lastName, role: 'tenant-admin', status: 'active' },
    });

    const tenant = await payload.create({
      collection: 'tenants',
      data: { name: tenantName, email, status: 'trial' },
    });

    await payload.update({
      collection: 'users',
      id: user.id,
      data: { tenant: tenant.id },
    });

    return NextResponse.json(
      {
        message: 'User registered successfully',
        user: { id: user.id, email, name },
        tenant: { id: tenant.id, name: tenantName },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration error:', error);
    const message = error?.message?.includes('duplicate')
      ? 'This email or company name is already registered'
      : error?.message || 'Internal server error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
