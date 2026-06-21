import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

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
