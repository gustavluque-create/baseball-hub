/**
 * SEO-Optimized Slug Generation & Utilities
 * Creates clean, crawlable, keyword-rich URLs for news articles and content.
 */

// Common Spanish stop-words that can be optionally pruned if slugs are overly long,
// while preserving key baseball terms and identifiers.
const SPANISH_STOP_WORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'y', 'o', 'en', 'a', 'del', 'al', 'con', 'por', 'para',
]);

/**
 * Generates an SEO-optimized slug from a title string.
 * Example: "Cocodrilos de Matanzas mantienen el liderato con ofensiva implacable!"
 * Output: "cocodrilos-matanzas-liderato-ofensiva-implacable"
 */
export function generateSeoSlug(text: string, maxLength: number = 80): string {
  if (!text) return 'articulo-' + Date.now();

  // 1. Normalize unicode accents (á -> a, é -> e, ñ -> n, etc.)
  let normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  // 2. Replace known sports abbreviations and symbols
  normalized = normalized
    .replace(/&/g, ' y ')
    .replace(/%/g, ' porciento ')
    .replace(/#/g, ' numero ')
    .replace(/@/g, ' ');

  // 3. Remove non-alphanumeric characters (keep only letters, numbers, spaces, and hyphens)
  normalized = normalized.replace(/[^a-z0-9\s-]/g, '');

  // 4. Split into words
  const words = normalized.split(/\s+/).filter(Boolean);

  // 5. If slug is long (> 6 words), prune non-critical stop words to keep it punchy for SEO
  let processedWords = words;
  if (words.length > 6) {
    const filtered = words.filter((w, index) => {
      // Always keep first and last word for semantic integrity
      if (index === 0 || index === words.length - 1) return true;
      return !SPANISH_STOP_WORDS.has(w);
    });
    // Fall back to original words if pruning left too few
    if (filtered.length >= 3) {
      processedWords = filtered;
    }
  }

  // 6. Join with hyphens
  let slug = processedWords.join('-');

  // 7. Enforce max length without breaking words abruptly
  if (slug.length > maxLength) {
    slug = slug.substring(0, maxLength);
    const lastHyphen = slug.lastIndexOf('-');
    if (lastHyphen > 20) {
      slug = slug.substring(0, lastHyphen);
    }
  }

  // 8. Clean up trailing or consecutive hyphens
  slug = slug.replace(/-+/g, '-').replace(/^-|-$/g, '');

  return slug || 'articulo-' + Date.now();
}

/**
 * Formats the full independent public URL for an article slug.
 */
export function getArticleFullUrl(slug: string): string {
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    return `${origin}/${slug}`;
  }
  return `/${slug}`;
}

/**
 * Known system paths that are NOT article slugs.
 */
export const SYSTEM_PATHS = new Set([
  'admin',
  'api',
  'assets',
  'games',
  'standings',
  'statistics',
  'leaders',
  'teams',
  'players',
  'news',
  'noticias',
  'videos',
  'home',
  'settings',
]);

/**
 * Checks if a path segment qualifies as an article slug.
 */
export function isPotentialArticleSlug(segment: string): boolean {
  if (!segment) return false;
  const clean = segment.toLowerCase().replace(/^\/|\/$/g, '');
  if (!clean || clean.includes('.') || clean.includes('/')) return false;
  return !SYSTEM_PATHS.has(clean);
}
