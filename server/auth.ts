import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { User, UserRole } from '../src/types/lms.ts';

const SESSION_SECRET = process.env.SESSION_SECRET || 'maktab348-dev-session-secret-key-2026';
export const COOKIE_NAME = 'maktab348_session';

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('998') && digits.length === 12) return `+${digits}`;
  if (digits.length === 9) return `+998${digits}`;
  if (raw.startsWith('+')) return `+${digits}`;
  return digits ? `+${digits}` : '';
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(key, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

interface TokenPayload {
  uid: string;
  role: UserRole;
  exp: number;
}

export function signToken(user: { id: string; role: UserRole }): string {
  const payload: TokenPayload = {
    uid: user.id,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 365, // 365 days
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    if (!parsed.uid || !parsed.role || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const val = decodeURIComponent(pair.slice(idx + 1).trim());
    result[key] = val;
  }
  return result;
}

export interface AuthedRequest extends Request {
  authUser?: User;
}

export function extractTokenFromReq(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] || null;
}

export function sanitizeUser(user: User & { passwordHash?: string }): User {
  const { passwordHash: _removed, ...safe } = user;
  return safe;
}

export function requireRoleMiddleware(
  getUserById: (id: string) => (User & { passwordHash?: string }) | undefined,
  allowedRoles?: UserRole[],
  options?: { allowUnapprovedTeacher?: boolean }
) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const token = extractTokenFromReq(req);
    if (!token) {
      return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
    }
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Sessiya muddati tugagan yoki yaroqsiz' });
    }
    const found = getUserById(payload.uid);
    if (!found) {
      return res.status(401).json({ error: 'Foydalanuvchi topilmadi' });
    }
    if (found.role === 'teacher' && !found.approved && !options?.allowUnapprovedTeacher) {
      return res.status(403).json({ error: 'O‘qituvchi hisobi uchun yuzni tasdiqlash bosqichi yakunlanmagan' });
    }
    if (allowedRoles && !allowedRoles.includes(found.role)) {
      return res.status(403).json({ error: 'Sizda ushbu bo‘limga kirish huquqi yo‘q' });
    }
    req.authUser = sanitizeUser(found);
    next();
  };
}
