/**
 * In-memory cache and request de-duplication for GET requests.
 *
 * Two separate jobs:
 *   - cache: a response served again within its TTL costs no network request
 *   - de-duplication: identical requests fired at the same moment (several screens
 *     asking for the employee list at once) share a single network request
 *
 * Only successful responses are stored, so a failure is never hidden behind a cache
 * entry - the caller sees the rejection and can retry.
 */
import { API_CACHE_DEBUG, cacheKeyFor, ttlFor } from './cacheConfig';

const store = new Map();     // key -> { expiresAt, response }
const inFlight = new Map();  // key -> Promise

const log = (...args) => {
  if (API_CACHE_DEBUG) console.log('[API CACHE]', ...args);
};

export const clearApiCache = () => {
  store.clear();
  inFlight.clear();
  log('CLEAR all');
};

/** Removes cached reads for a resource, e.g. "/payroll/employees/123" clears "/payroll/*". */
export const invalidateApiCache = (url = '') => {
  if (!url) return clearApiCache();

  const path = String(url).split('?')[0].replace(/^\//, '');
  const root = '/' + path.split('/')[0];
  let removed = 0;
  for (const key of [...store.keys()]) {
    // keys look like "GET:/payroll/employees|{...}"
    if (key.startsWith(`GET:${root}`)) {
      store.delete(key);
      removed++;
    }
  }
  if (removed) log(`INVALIDATE ${root}/* (${removed} entr${removed === 1 ? 'y' : 'ies'})`);
};

export const cacheStats = () => ({ entries: store.size, inFlight: inFlight.size });

/**
 * Wraps a GET. `performRequest` is called only when the response is not cached and
 * no identical request is already running.
 */
export const cachedGet = (url, config, performRequest) => {
  const ttl = ttlFor(url, config);
  if (ttl === null) return performRequest();

  const key = cacheKeyFor(url, config);

  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    log('HIT', url);
    return Promise.resolve(hit.response);
  }

  const pending = inFlight.get(key);
  if (pending) {
    log('DEDUP', url);
    return pending;
  }

  log('MISS', url);
  const request = performRequest()
    .then((response) => {
      store.set(key, { expiresAt: Date.now() + ttl, response });
      log('SET', url, `(ttl ${Math.round(ttl / 1000)}s)`);
      return response;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, request);
  return request;
};
