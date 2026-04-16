const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];

const normalizeOrigin = (origin) => origin?.replace(/\/$/, '').toLowerCase();

const parseAllowedOrigins = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
};

const wildcardToRegex = (pattern) => {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\*/g, '.*')}$`);
};

const matchesPattern = (origin, pattern) => {
  if (!pattern) return false;
  if (pattern === origin) return true;
  if (!pattern.includes('*')) return false;
  return wildcardToRegex(pattern).test(origin);
};

const isLocalOrigin = (origin) =>
  origin?.startsWith('http://localhost') || origin?.startsWith('http://127.0.0.1');

const deriveNetlifyPreviewOrigins = (origin) => {
  if (!origin) return [];
  const normalized = normalizeOrigin(origin);
  const match = normalized.match(/^https?:\/\/([^.]+)\.netlify\.app$/);
  if (!match) return [];
  const site = match[1];
  if (!site || site.includes('--')) return [];
  return [`https://*--${site}.netlify.app`];
};

export const getAllowedOrigins = () => {
  const envOrigins = parseAllowedOrigins(process.env.CLIENT_URL);
  const derivedOrigins = envOrigins.flatMap(deriveNetlifyPreviewOrigins);
  return Array.from(new Set([...envOrigins, ...derivedOrigins, ...DEFAULT_ORIGINS]));
};

export const isOriginAllowed = (origin, allowedOrigins) => {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  if (isLocalOrigin(normalized)) return true;
  return allowedOrigins.some((pattern) => matchesPattern(normalized, pattern));
};
