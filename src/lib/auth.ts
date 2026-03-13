import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { Database } from './database.types';

const JWT_SECRET = new TextEncoder().encode(
  (import.meta.env.JWT_SECRET || 'super-secret-key-change-this-in-production') as string
);

export type UserProfile = Database['public']['Tables']['users']['Row'];

export async function hashPassword(password: string) {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return await bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

export async function verifySession(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { id: string; email: string; role: string; name: string };
  } catch (error) {
    return null;
  }
}

/**
 * Get the current user from the request cookies (JWT)
 */
export async function getCurrentUser(request: Request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('='))
  );
  
  const token = cookies['session'];
  if (!token) return null;

  return await verifySession(token);
}

/**
 * Ensure user is authenticated, otherwise throw error
 */
export async function requireAuth(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

/**
 * Ensure user is admin, otherwise throw error
 */
export async function requireAdmin(request: Request) {
  const user = await requireAuth(request);
  if (user.role !== 'admin') {
    throw new Error('Forbidden: Admin access required');
  }
  return user;
}
