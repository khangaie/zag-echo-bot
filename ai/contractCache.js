// ai/contractCache.js
// Simple in-memory LRU cache for CONTRACT answers (0 Graph burst on repeats)
class LRUCache {
  constructor(max = 100) {
    this.max = max;
    this.map = new Map(); // key -> { value, ts }
  }
  get(key) {
    if (!this.map.has(key)) return null;
    const v = this.map.get(key);
    // refresh
    this.map.delete(key);
    this.map.set(key, v);
    return v.value;
  }
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, ts: Date.now() });
    if (this.map.size > this.max) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
  }
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

const contractCache = new LRUCache(Number(process.env.CONTRACT_CACHE_MAX || 200));

function makeContractCacheKey(question, opts = {}) {
  const domain = opts.domain || 'contract';
  const smc = opts.smc ? 'smc:1' : 'smc:0';
  return `${domain}::${smc}::${norm(question)}`;
}

module.exports = { contractCache, makeContractCacheKey };
