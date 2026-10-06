import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getSupabaseServerClient, isSupabaseServerConfigured } from '../../server/lib/supabase.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken | any;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  // 1. Check Supabase Auth first if configured
  if (isSupabaseServerConfigured()) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.getUser(token);
        if (!error && data?.user) {
          req.user = {
            uid: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.full_name || data.user.user_metadata?.name,
            picture: data.user.user_metadata?.avatar_url,
            role: data.user.app_metadata?.role || data.user.user_metadata?.role || 'user',
          };
          return next();
        }
      } catch {
        // Fallback to Firebase
      }
    }
  }

  // 2. Fallback to Firebase Auth
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

