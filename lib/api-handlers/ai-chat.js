const https = require('https');
const { URL } = require('url');

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function pick(obj, keys, fallback = '') {
  for (const k of keys) {
    if (obj && typeof obj[k] === 'string' && obj[k].trim()) return obj[k].trim();
  }
  return fallback;
}

function postJson(endpoint, apiKey, payload, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    let target;
    try { target = new URL(endpoint); } catch (_) { return reject(new Error('AI endpoint 格式不正確')); }
    if (target.protocol !== 'https:') return reject(new Error('AI endpoint 必須使用 https'));
    const body = JSON.stringify(payload);
    const req = https.request({
      method: 'POST',
      hostname: target.hostname,
      path: target.pathname + target.search,
      port: target.port || 443,
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${apiKey}`,
        ...extraHeaders
      }
    }, r => {
      let data = '';
      r.setEncoding('utf8');
      r.on('data', chunk => { data += chunk; if (data.length > 1024 * 1024) req.destroy(new Error('AI 回應過大')); });
      r.on('end', () => {
        let parsed = null;
        try { parsed = data ? JSON.parse(data) : null; } catch (_) {}
        if (r.statusCode < 200 || r.statusCode >= 300) {
          const msg = parsed?.error?.message || parsed?.message || `AI 服務回應 ${r.statusCode}`;
          return reject(new Error(msg));
        }
        resolve(parsed || { raw: data });
      });
    });
    req.on('timeout', () => req.destroy(new Error('AI 服務逾時')));
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  const body = req.body || {};
  const provider = pick(body, ['provider'], 'openai-compatible');
  const apiKey = pick(body, ['apiKey']);
  const model = pick(body, ['model'], 'gpt-4o-mini');
  const endpoint = pick(body, ['endpoint'], 'https://api.openai.com/v1/chat/completions');
  const question = String(body.question || '').trim().slice(0, 1200);
  const page = String(body.page || 'market').trim().slice(0, 40);
  const context = String(body.context || '').trim().slice(0, 8000);
  if (!apiKey) return json(res, 400, { ok: false, error: '請先在進階 AI 設定填入自己的 API Key' });
  if (!question) return json(res, 400, { ok: false, error: '請輸入想問 AI 的問題' });

  const messages = [
    { role: 'system', content: '你是 ClariNavi 的市場研究助理。請用繁體中文回答，語氣簡潔、教學導向。只能根據使用者提供的頁面資料與一般投資知識做研究說明；不要承諾報酬、不要給保證式買賣建議、不要假裝知道未提供的即時資料。必要時提醒資料可能延遲，且不構成投資建議。' },
    { role: 'user', content: `目前頁面：${page}\n\n頁面資料：\n${context || '使用者未提供頁面資料。'}\n\n問題：${question}` }
  ];

  try {
    const result = await postJson(endpoint, apiKey, {
      model,
      messages,
      temperature: Number.isFinite(Number(body.temperature)) ? Math.max(0, Math.min(1, Number(body.temperature))) : 0.25,
      max_tokens: Number.isFinite(Number(body.maxTokens)) ? Math.max(128, Math.min(1400, Number(body.maxTokens))) : 700
    }, provider === 'openrouter' ? { 'HTTP-Referer': 'https://clarinavi.local', 'X-Title': 'ClariNavi' } : {});

    const answer = result?.choices?.[0]?.message?.content || result?.choices?.[0]?.text || result?.message?.content || '';
    return json(res, 200, { ok: true, answer: String(answer || 'AI 沒有回傳文字內容。'), usage: result?.usage || null });
  } catch (error) {
    return json(res, 502, { ok: false, error: error.message || 'AI 服務暫時無法使用' });
  }
};
