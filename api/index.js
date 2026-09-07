const { URL } = require('url');

const handlerFiles = {
  advanced: 'advanced',
  benchmark: 'benchmark',
  dividends: 'dividends',
  'etf-nav': 'etf-nav',
  etf: 'etf',
  health: 'health',
  industry: 'industry',
  intraday: 'intraday',
  ipo: 'ipo',
  kol: 'kol',
  'market-home': 'market-home',
  'market-rankings': 'market-rankings',
  'etf-market': 'etf-market',
  'market-alerts': 'market-alerts',
  'sector-momentum': 'sector-momentum',
  news: 'news',
  'news-hub': 'news-hub',
  'foreign-costs': 'foreign-costs',
  institutional: 'institutional',
  'portfolio-quotes': 'portfolio-quotes',
  quote: 'quote',
  radar: 'radar',
  research: 'research',
  'supply-chain': 'supply-chain',
  'community-portfolios': 'community-portfolios',
  stock: 'stock',
  targets: 'targets',
  us: 'us',
  'ai-chat': 'ai-chat'
};
const handlerCache = new Map();
function getHandler(route){
  const file=handlerFiles[route];
  if(!file)return null;
  if(handlerCache.has(route))return handlerCache.get(route);
  const fn=require(`../lib/api-handlers/${file}`);
  handlerCache.set(route,fn);
  return fn;
}

function ensureResponse(res) {
  if (typeof res.status !== 'function') res.status = function status(code) { this.statusCode = code; return this; };
  if (typeof res.json !== 'function') res.json = function json(payload) {
    if (!this.headersSent) this.setHeader('Content-Type', 'application/json; charset=utf-8');
    return this.end(JSON.stringify(payload));
  };
  return res;
}

async function parseBody(req) {
  if (!['POST', 'PUT', 'PATCH'].includes(String(req.method || '').toUpperCase())) return req.body || null;
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  if (typeof req.on !== 'function') return {};
  return await new Promise(resolve => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        try { req.destroy(); } catch {}
        resolve({});
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

function resolveRequest(req) {
  const base = `https://${req.headers?.host || 'localhost'}`;
  const u = new URL(req.url || '/api/index', base);
  const existing = req.query && typeof req.query === 'object' ? { ...req.query } : {};
  const explicit = u.searchParams.get('__route') || existing.__route || req.headers?.['x-vercel-original-path'] || '';
  const routePath = explicit || u.pathname || '/api/index';
  const cleanedPath = '/' + String(routePath).replace(/^https?:\/\/[^/]+/i, '').split('?')[0].replace(/^\/+/, '');
  const route = cleanedPath.replace(/^\/api\/?/, '').split('/')[0].trim().toLowerCase();
  const query = { ...existing };
  delete query.__route;
  for (const [key, value] of u.searchParams.entries()) if (key !== '__route') query[key] = value;
  return { route, query, cleanedPath };
}

module.exports = async function vercelApi(req, res) {
  ensureResponse(res);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(self)');
  const { route, query } = resolveRequest(req);
  const fn = getHandler(route);
  if (!fn) return res.status(404).json({ ok: false, error: 'API route not found', route });
  req.query = query;
  req.body = await parseBody(req);
  try {
    return await fn(req, res);
  } catch (error) {
    console.error('[ClariNavi API]', route, error);
    if (!res.headersSent) return res.status(500).json({ ok: false, error: 'API internal error', route });
    try { return res.end(); } catch {}
  }
};

module.exports._test = { resolveRequest };
