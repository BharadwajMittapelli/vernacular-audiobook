// ponytail: comma-separated FRONTEND_URL; empty/unset falls back to the local dev
// origin. Upgrade path is a per-route policy only if storefront-style wildcards appear.
export function parseAllowedOrigins(raw) {
  return (raw || 'http://localhost:5175')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}
