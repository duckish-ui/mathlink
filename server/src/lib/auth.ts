import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-secret';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production.');
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function signToken(userId: string) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
}

/** Returns the user id inside a valid token, or undefined. Also used to authenticate sockets. */
export function verifyToken(token: unknown): string | undefined {
  if (typeof token !== 'string' || !token) return undefined;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return typeof payload === 'object' ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}

function readUserId(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return verifyToken(header.slice('Bearer '.length));
}

/** Attaches req.userId when a valid token is present, but lets guests through. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.userId = readUserId(req);
  next();
}

/** Rejects the request with 401 unless a valid token is present. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = readUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Please log in to continue.' });
    return;
  }
  req.userId = userId;
  next();
}
