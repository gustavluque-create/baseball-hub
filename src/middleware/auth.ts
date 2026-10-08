import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { supabaseAuthService, AppUserRole } from '../../server/services/supabase-auth.service.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken | any;
}

export const extractRequestToken = (req: Request): string | undefined => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const customHeader = req.headers['x-admin-token'] as string;
  if (customHeader) {
    return customHeader.trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/baseball_session=([^;]+)/) || cookieHeader.match(/baseball_admin_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]).trim();
  }
  return undefined;
};

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = extractRequestToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  // 1. Supabase Auth (PRIMARY)
  try {
    const sessionRes = await supabaseAuthService.verifyToken(token);
    if (sessionRes.valid && sessionRes.user) {
      req.user = {
        uid: sessionRes.user.uid,
        id: sessionRes.user.id,
        email: sessionRes.user.email,
        name: sessionRes.user.name,
        picture: sessionRes.user.avatar,
        role: sessionRes.user.role,
        preferences: sessionRes.user.preferences,
        provider: sessionRes.user.provider,
      };
      return next();
    }
    if (sessionRes.expired) {
      return res.status(401).json({ error: 'Unauthorized: Session expired', expired: true });
    }
  } catch (err) {
    console.warn('[AuthMiddleware] Supabase verification error, falling back to Firebase:', err);
  }

  // 2. Fallback to Firebase Auth (TEMPORARY FALLBACK)
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
      role: (decodedToken as any).role || 'user',
      provider: 'firebase',
    };
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireServerRole = (...allowedRoles: AppUserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
    }

    const userRole = (req.user.role || 'user') as AppUserRole;
    if (!supabaseAuthService.hasPermission(userRole, allowedRoles)) {
      return res.status(403).json({
        error: 'Forbidden: Insufficient privileges',
        role: userRole,
        requiredRoles: allowedRoles,
      });
    }

    next();
  };
};

