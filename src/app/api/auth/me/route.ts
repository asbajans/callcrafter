import { NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import crypto from 'crypto';

const rawSecret = process.env.PAYLOAD_SECRET || 'fallback-secret';
const secret = new TextEncoder().encode(
  crypto.createHash('sha256').update(rawSecret).digest('hex').slice(0, 32)
);

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('payload-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { payload } = await jwtVerify(token, secret);
    const userId = (payload as any).id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const p = await getPayload({ config });
    const user = await p.findByID({
      collection: 'users',
      id: parseInt(userId),
      depth: 0,
    });

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenant: user.tenant,
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
