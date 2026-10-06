import { z } from 'zod';

/**
 * Escapes common HTML entities to prevent Cross-Site Scripting (XSS)
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validates that an image string is either a safe URL (http/https/relative)
 * or a valid image data URI (png, jpeg, webp, gif, svg) with no malicious script content.
 */
export function isValidImageString(val: string): boolean {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();

  // 1. Emoji or very short symbol (e.g. 🦁, ⚾)
  if (trimmed.length <= 12 && !trimmed.includes('<') && !trimmed.includes('>')) {
    return true;
  }

  // 2. Relative or absolute safe URL
  if (trimmed.startsWith('/') && !trimmed.includes('..') && !trimmed.startsWith('//')) {
    return true;
  }
  if (/^https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+$/i.test(trimmed)) {
    return true;
  }

  // 3. Data URI: image/png, image/jpeg, image/webp, image/gif, image/svg+xml
  if (trimmed.startsWith('data:image/')) {
    // Limit base64 image data to ~10MB max string length
    if (trimmed.length > 10 * 1024 * 1024) {
      return false;
    }
    if (!/^data:image\/(png|jpeg|jpg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/i.test(trimmed)) {
      return false;
    }
    // Deep inspection of SVG base64 payloads to prevent embedded script attacks
    if (trimmed.startsWith('data:image/svg+xml')) {
      try {
        const base64Part = trimmed.split(',')[1] || '';
        const decoded = Buffer.from(base64Part, 'base64').toString('utf-8').toLowerCase();
        if (
          decoded.includes('<script') ||
          decoded.includes('javascript:') ||
          decoded.includes('onload=') ||
          decoded.includes('onerror=') ||
          decoded.includes('<foreignobject')
        ) {
          return false;
        }
      } catch {
        return false;
      }
    }
    return true;
  }

  return false;
}

// Schemas
export const teamLogoSchema = z.object({
  logo: z.string().min(1, 'Logo es requerido').refine(isValidImageString, {
    message: 'Formato de logo inválido. Debe ser una URL válida, emoji o imagen base64.',
  }),
  primaryColor: z
    .string()
    .regex(/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/, 'Color primario debe ser un código HEX válido')
    .optional(),
});

export const playerPhotoSchema = z.object({
  photo: z.string().min(1, 'Foto es requerida').refine(isValidImageString, {
    message: 'Formato de foto inválido. Debe ser una URL válida o imagen base64.',
  }),
});

export const commentSchema = z.object({
  authorName: z
    .string()
    .max(60, 'El nombre no puede exceder 60 caracteres')
    .optional()
    .transform((val) => (val ? sanitizeHtml(val.trim()) : 'Aficionado')),
  favoriteTeam: z
    .string()
    .max(50, 'El equipo no puede exceder 50 caracteres')
    .optional()
    .transform((val) => (val ? sanitizeHtml(val.trim()) : undefined)),
  content: z
    .string()
    .min(3, 'El comentario debe contener al menos 3 caracteres')
    .max(800, 'El comentario no puede exceder los 800 caracteres')
    .transform((val) => sanitizeHtml(val.trim())),
});

export const fcmRegisterSchema = z.object({
  token: z
    .string()
    .min(10, 'Token FCM inválido')
    .max(600, 'Token FCM excede tamaño permitido')
    .regex(/^[A-Za-z0-9_\-:]+$/, 'Token FCM contiene caracteres inválidos'),
  favoriteTeamIds: z.array(z.string().max(20)).max(30).optional().default([]),
  subscribedGameIds: z.array(z.string().max(50)).max(50).optional().default([]),
  userAgent: z.string().max(300).optional(),
});

export const fcmSubscribeGameSchema = z.object({
  token: z
    .string()
    .min(10, 'Token FCM inválido')
    .max(600)
    .regex(/^[A-Za-z0-9_\-:]+$/, 'Token FCM contiene caracteres inválidos'),
  gameId: z.string().min(1).max(60),
  subscribed: z.boolean(),
});
