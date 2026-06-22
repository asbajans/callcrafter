import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import { getPayload } from 'payload';
import config from '@payload-config';
import { cookies } from 'next/headers';

const rawSecret = process.env.PAYLOAD_SECRET || 'fallback-secret';
const secret = new TextEncoder().encode(
  crypto.createHash('sha256').update(rawSecret).digest('hex').slice(0, 32)
);

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  tenantId?: string;
}

export interface CurrentUser {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  tenantId?: number;
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getUserIdFromToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = (payload as any).id || (payload as any).userId;
    return userId ? Number(userId) : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('payload-token')?.value;
    if (!token) return null;
    const userId = await getUserIdFromToken(token);
    if (!userId) return null;
    const payload = await getPayload({ config });
    const user = await payload.findByID({ collection: 'users', id: userId, depth: 0 });
    if (!user) return null;
    const tenantId = user.tenant ? (typeof user.tenant === 'object' ? (user.tenant as any).id : Number(user.tenant)) : undefined;
    return {
      id: user.id as number,
      email: user.email as string,
      firstName: user.firstName as string | undefined,
      lastName: user.lastName as string | undefined,
      role: user.role as string,
      tenantId,
    };
  } catch {
    return null;
  }
}
