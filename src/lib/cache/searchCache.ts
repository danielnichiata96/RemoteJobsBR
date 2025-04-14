import NodeCache from 'node-cache';

// --- Cache Setup ---
// stdTTL: default time-to-live in seconds for cache items (1 hour)
// checkperiod: interval in seconds to check for expired items (10 minutes)
const CACHE_TTL = 3600; // 1 hour in seconds

export const searchCache = new NodeCache({ 
  stdTTL: CACHE_TTL, 
  checkperiod: 600 // 10 minutes
});

// Helper function to generate a stable cache key from query parameters
export const generateCacheKey = (query: NodeJS.Dict<string | string[]>): string => {
    // Sort keys to ensure consistent order
    const sortedKeys = Object.keys(query).sort();
    // Build a stable string representation
    const keyParts = sortedKeys.map(key => `${key}=${JSON.stringify(query[key])}`);
    // Prefix for easy identification/clearing
    return `search:${keyParts.join('&')}`;
}; 