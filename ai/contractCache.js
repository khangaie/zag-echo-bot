// ai/contractCache.js
class LRUCache {
  constructor(max = 200) {
    this.max = max;
    this.map = new Map();
  }
  get(key) {
    if (!this.map.has(key)) return null;
    const v = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, v);
    return v.value;
  }
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, ts: Date.now() });
    if (this.map.size > this.max) {
      const first = this.map.keys().next().value;
      this.map.delete(first);
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
  const company = opts.company || '';
  return `${domain}::${company}::${norm(question)}`;
}

module.exports = { contractCache, makeContractCacheKey };
