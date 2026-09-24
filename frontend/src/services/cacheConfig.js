/**
 * What may be cached, and for how long.
 *
 * Only reference data that changes rarely is listed here. Anything not listed is
 * always fetched from the network - live lists (tickets, visits, attendance,
 * dashboards, notifications) are deliberately absent.
 *
 * Patterns are anchored to the list endpoint itself, so action sub-routes such as
 * /products/export or /import/template/... can never match.
 */
const MINUTES = 60 * 1000;

export const CACHE_CONFIG = [
  { pattern: /^\/branches(\?|$)/, ttl: 5 * MINUTES },
  { pattern: /^\/territories(\?|$)/, ttl: 5 * MINUTES },
  { pattern: /^\/states(\?|$)/, ttl: 30 * MINUTES },
  { pattern: /^\/cities(\?|$)/, ttl: 30 * MINUTES },
  { pattern: /^\/mgrs(\?|$)/, ttl: 5 * MINUTES },
  { pattern: /^\/designations(\?|$)/, ttl: 5 * MINUTES },
  { pattern: /^\/company-settings(\?|$)/, ttl: 5 * MINUTES },
  { pattern: /^\/users(\?|$)/, ttl: 5 * MINUTES },
  { pattern: /^\/products(\?|$)/, ttl: 5 * MINUTES },
  { pattern: /^\/customers(\?|$)/, ttl: 5 * MINUTES },
  { pattern: /^\/payroll\/(departments|designations|employees)(\?|$)/, ttl: 5 * MINUTES },
  { pattern: /^\/csm\/masters\/(categories|types|priorities|sources|designations|teams|engineers|problems|sla-policies)(\?|$)/, ttl: 5 * MINUTES },
  { pattern: /^\/csm\/tickets\/customers(\?|$)/, ttl: 5 * MINUTES },
];

// Free-text search and filter combinations are unbounded, so they are never cached:
// caching them would fill memory with one entry per keystroke-driven query.
const VOLATILE_PARAMS = ['search', 'q', 'query', 'keyword', 'term', 'filter'];

const hasVolatileParams = (config = {}) => {
  const params = config.params;
  if (!params || typeof params !== 'object') return false;
  return VOLATILE_PARAMS.some((key) => {
    const value = params[key];
    return value !== undefined && value !== null && String(value).trim() !== '';
  });
};

/** Returns the TTL in ms for a cacheable request, or null when it must not be cached. */
export const ttlFor = (url, config = {}) => {
  if (config.cache === false) return null;
  if (config.responseType) return null;        // file downloads (blob / arraybuffer)
  if (hasVolatileParams(config)) return null;  // search / filter queries

  const entry = CACHE_CONFIG.find(({ pattern }) => pattern.test(url));
  return entry ? entry.ttl : null;
};

/** Cache identity: the URL plus its query params, so page 1 and page 2 stay separate. */
export const cacheKeyFor = (url, config = {}) => {
  const params = config.params ? JSON.stringify(config.params) : '';
  return `GET:${url}|${params}`;
};

export const API_CACHE_DEBUG = Boolean(import.meta.env?.DEV);
