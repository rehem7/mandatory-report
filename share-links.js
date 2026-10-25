import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const registryFile = directory => path.join(directory, 'qr-links.json');
function readLinks(directory) {
  const file = registryFile(directory);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}
export function issueShareLink(directory, { now = Date.now(), ttlMs = 24 * 60 * 60 * 1000 } = {}) {
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(ttlMs) || ttlMs <= 0) throw Error('无效的有效期');
  const token = crypto.randomBytes(18).toString('base64url');
  const expiresAt = now + ttlMs;
  const links = readLinks(directory);
  for (const [key, value] of Object.entries(links)) if (value.expiresAt <= now) delete links[key];
  links[token] = { expiresAt };
  fs.mkdirSync(directory, { recursive: true });
  const temporary = registryFile(directory) + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(links, null, 2));
  fs.renameSync(temporary, registryFile(directory));
  return { pathname: '/share/' + token, expiresAt };
}

export function handleShareLink(req, res, url, directory, now = Date.now()) {
  if (!url.pathname.startsWith('/share/')) return false;
  const headers = { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache', Expires: '0', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { ...headers, Allow: 'GET, HEAD' }); res.end(); return true;
  }
  const match = url.pathname.match(/^\/share\/([A-Za-z0-9_-]{24})$/);
  const record = match ? readLinks(directory)[match[1]] : null;
  if (record && Number.isSafeInteger(record.expiresAt) && now < record.expiresAt) {
    res.writeHead(302, { ...headers, Location: '/login' }); res.end(); return true;
  }
  const title = record ? '二维码已过期' : '二维码无效';
  const message = record ? '此二维码的24小时有效期已结束，请联系分享者获取新的二维码。' : '此二维码链接不存在，请联系分享者确认。';
  res.writeHead(record ? 410 : 404, { ...headers, 'Content-Type': 'text/html; charset=utf-8' });
  res.end(req.method === 'HEAD' ? undefined : `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f7fb;font:16px/1.8 system-ui,sans-serif;color:#24384b}main{max-width:440px;margin:24px;padding:32px;background:white;border-radius:18px}h1{font-size:24px;margin:0 0 12px}p{margin:0;color:#5d7183}</style><main><h1>${title}</h1><p>${message}</p></main></html>`);
  return true;
}
