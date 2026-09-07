const fs = require('fs');
const path = require('path');
const http = require('http');
const apiHandler = require('./api/index.js');

const ROOT = __dirname;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8'
};

function safeFile(name) {
  let clean;
  try { clean = decodeURIComponent(String(name || '')).replace(/^\/+/, ''); }
  catch { return null; }
  const full = path.resolve(ROOT, clean || 'index.html');
  if (full === path.join(ROOT, 'index.html') || full.startsWith(ROOT + path.sep)) return full;
  return null;
}

function sendFile(req, res, name) {
  const full = safeFile(name);
  if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Not found');
  }
  const ext = path.extname(full).toLowerCase();
  res.statusCode = 200;
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  const base = path.basename(full);
  res.setHeader('Cache-Control', (base === 'index.html' || base === 'app.js' || base === 'app.css') ? 'no-cache, no-store, must-revalidate' : 'public, max-age=300, stale-while-revalidate=600');
  const accept = String(req.headers?.['accept-encoding'] || '');
  const br = full + '.br';
  if (/\bbr\b/.test(accept) && fs.existsSync(br)) {
    res.setHeader('Content-Encoding', 'br');
    res.setHeader('Vary', 'Accept-Encoding');
    return fs.createReadStream(br).pipe(res);
  }
  return fs.createReadStream(full).pipe(res);
}

async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=(self)');
  let pathname = '/';
  try { pathname = new URL(req.url || '/', `http://${req.headers?.host || 'localhost'}`).pathname; } catch {}
  if (pathname === '/api' || pathname.startsWith('/api/')) return apiHandler(req, res);
  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const full = safeFile(requested);
  if (full && fs.existsSync(full) && fs.statSync(full).isFile()) return sendFile(req, res, requested);
  return sendFile(req, res, 'index.html');
}

module.exports = handler;

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  http.createServer(handler).listen(port, '0.0.0.0', () => console.log(`ClariNavi listening on ${port}`));
}
