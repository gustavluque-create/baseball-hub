import { z } from 'zod';

export const VALID_POSITIONS = [
  'P',
  'SP',
  'RP',
  'C',
  '1B',
  '2B',
  '3B',
  'SS',
  'OF',
  'LF',
  'CF',
  'RF',
  'DH',
  'BD',
] as const;

export type ValidPosition = (typeof VALID_POSITIONS)[number];

/**
 * Zod Schema for creating a new player
 */
export const playerCreateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'El nombre debe tener al menos 2 caracteres.')
    .max(70, 'El nombre no puede exceder los 70 caracteres.')
    .regex(
      /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]+$/,
      'El nombre solo debe contener letras, espacios, puntos o guiones.'
    ),
  teamId: z.string().trim().min(1, 'Debes seleccionar un equipo válido.'),
  jerseyNumber: z.coerce
    .number()
    .int('El dorsal debe ser un número entero.')
    .min(0, 'El dorsal no puede ser negativo.')
    .max(99, 'El dorsal no puede ser superior a 99.'),
  position: z.string().refine((val) => (VALID_POSITIONS as readonly string[]).includes(val), {
    message: 'Posición no válida en el béisbol.',
  }),
  bats: z.string().refine((val) => ['R', 'L', 'S'].includes(val), {
    message: 'Bateo debe ser R (Derecha), L (Zurda) o S (Ambidiestro).',
  }),
  throws: z.string().refine((val) => ['R', 'L'].includes(val), {
    message: 'Lanzamiento debe ser R (Derecha) o L (Zurda).',
  }),
  photo: z
    .string()
    .trim()
    .min(1, 'La foto no puede estar vacía.')
    .refine(
      (val) =>
        val.startsWith('http://') ||
        val.startsWith('https://') ||
        val.startsWith('data:image/') ||
        val.startsWith('/'),
      'La foto debe ser una URL válida (http/https), imagen base64 o ruta válida.'
    ),
  bio: z
    .string()
    .trim()
    .max(800, 'La biografía no puede superar los 800 caracteres.')
    .optional(),
  isStar: z.boolean().default(false),
});

export type PlayerCreateInput = z.infer<typeof playerCreateSchema>;

/**
 * Zod Schema for editing an existing player
 */
export const playerEditSchema = playerCreateSchema.extend({
  age: z.coerce
    .number()
    .int('La edad debe ser un número entero.')
    .min(15, 'La edad mínima para competir en la Serie Nacional es 15 años.')
    .max(55, 'La edad máxima permitida es 55 años.'),
  height: z
    .string()
    .trim()
    .regex(
      /^$|^(\d{1,2}\.?\d{0,2}\s*(m|cm)?)$/i,
      'Formato de estatura inválido (ej: 1.85 m o 185 cm).'
    )
    .optional(),
  weight: z
    .string()
    .trim()
    .regex(
      /^$|^(\d{2,3}\.?\d{0,2}\s*(kg|lbs)?)$/i,
      'Formato de peso inválido (ej: 85 kg o 190 lbs).'
    )
    .optional(),
});

export type PlayerEditInput = z.infer<typeof playerEditSchema>;

/**
 * Zod Schema for updating a team's logo and branding color
 */
export const teamLogoSchema = z.object({
  logo: z
    .string()
    .trim()
    .min(1, 'El logo no puede estar vacío.')
    .refine(
      (val) =>
        val.startsWith('http://') ||
        val.startsWith('https://') ||
        val.startsWith('data:image/') ||
        val.startsWith('/') ||
        /\p{Extended_Pictographic}/u.test(val) ||
        val.length <= 4,
      'El logo debe ser una URL de imagen, imagen base64 o un emoji del equipo.'
    ),
  primaryColor: z
    .string()
    .trim()
    .regex(
      /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/,
      'El color primario debe ser un código hexadecimal válido (ej: #10B981).'
    ),
});

export type TeamLogoInput = z.infer<typeof teamLogoSchema>;

/**
 * Zod Schema for creating or editing a baseball team
 */
export const teamCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'El nombre del equipo debe tener al menos 3 caracteres.')
    .max(60, 'El nombre del equipo no puede superar los 60 caracteres.'),
  nickname: z
    .string()
    .trim()
    .min(2, 'El apodo del equipo debe tener al menos 2 caracteres.')
    .max(40, 'El apodo no puede superar los 40 caracteres.'),
  shortName: z
    .string()
    .trim()
    .min(2, 'La sigla debe tener entre 2 y 4 caracteres.')
    .max(4, 'La sigla no puede exceder los 4 caracteres.')
    .regex(/^[A-Za-z0-9]+$/, 'La sigla solo puede contener letras y números.')
    .transform((val) => val.toUpperCase()),
  city: z
    .string()
    .trim()
    .min(2, 'La provincia/ciudad debe tener al menos 2 caracteres.')
    .max(50, 'La ciudad no puede exceder los 50 caracteres.'),
  stadium: z
    .string()
    .trim()
    .min(3, 'El nombre del estadio debe tener al menos 3 caracteres.')
    .max(70, 'El estadio no puede exceder los 70 caracteres.'),
  capacity: z.coerce
    .number()
    .int('La capacidad debe ser un número entero.')
    .min(500, 'La capacidad mínima es de 500 espectadores.')
    .max(120000, 'Capacidad máxima de 120,000 espectadores.')
    .default(15000),
  manager: z
    .string()
    .trim()
    .min(2, 'El director técnico debe tener al menos 2 caracteres.')
    .max(60, 'El director técnico no puede superar los 60 caracteres.'),
  foundedYear: z.coerce
    .number()
    .int('El año debe ser un número entero.')
    .min(1850, 'El año de fundación debe ser posterior a 1850.')
    .max(new Date().getFullYear(), 'El año no puede ser futuro.')
    .default(1977),
  championships: z.coerce
    .number()
    .int('Los campeonatos deben ser un número entero.')
    .min(0, 'Los campeonatos no pueden ser negativos.')
    .max(50, 'Número máximo de campeonatos es 50.')
    .default(0),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Color primario inválido (ej: #10B981).')
    .default('#10B981'),
  secondaryColor: z
    .string()
    .trim()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Color secundario inválido (ej: #1E293B).')
    .default('#1E293B'),
  textColor: z
    .string()
    .trim()
    .regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Color de texto inválido (ej: #FFFFFF).')
    .default('#FFFFFF'),
  logo: z
    .string()
    .trim()
    .min(1, 'El logo o emoji no puede estar vacío.')
    .default('⚾'),
});

export type TeamCreateInput = z.infer<typeof teamCreateSchema>;
export type TeamEditInput = Partial<TeamCreateInput>;

/**
 * Zod Schema for publishing or editing an editorial news article
 */
export const newsArticleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'El título debe tener al menos 5 caracteres.')
    .max(160, 'El título no puede superar los 160 caracteres.'),
  category: z
    .string()
    .trim()
    .min(2, 'La categoría debe tener al menos 2 caracteres.')
    .max(50, 'La categoría no puede exceder 50 caracteres.'),
  excerpt: z
    .string()
    .trim()
    .min(10, 'El resumen editorial debe tener al menos 10 caracteres.')
    .max(400, 'El resumen no puede superar los 400 caracteres.'),
  content: z
    .string()
    .trim()
    .min(15, 'El cuerpo de la noticia debe tener al menos 15 caracteres.'),
  author: z
    .string()
    .trim()
    .min(3, 'El nombre del autor debe tener al menos 3 caracteres.')
    .max(80, 'El nombre del autor no puede superar los 80 caracteres.'),
  image: z
    .string()
    .trim()
    .refine(
      (val) =>
        !val ||
        val.startsWith('http://') ||
        val.startsWith('https://') ||
        val.startsWith('data:image/') ||
        val.startsWith('/'),
      'La imagen de cabecera debe ser una URL válida o estar vacía.'
    )
    .optional(),
});

export type NewsArticleInput = z.infer<typeof newsArticleSchema>;

/**
 * Utility helper to convert ZodError into key-value map for form field highlights
 */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'root';
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

/**
 * Validates data against a schema safely and returns clean result with per-field errors
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
):
  | { success: true; data: T; errors: null; firstError: null }
  | { success: false; data: null; errors: Record<string, string>; firstError: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data, errors: null, firstError: null };
  }
  const errors = formatZodErrors(result.error);
  const firstError = result.error.issues[0]?.message || 'Error de validación en los datos.';
  return { success: false, data: null, errors, firstError };
}
