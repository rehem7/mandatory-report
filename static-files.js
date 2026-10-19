import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const routes = new Map(Object.entries({
  '/': 'login.html', '/login': 'login.html', '/ask': 'portal.html', '/training': 'portal.html', '/learning': 'portal.html', '/records': 'portal.html', '/ledger': 'portal.html', '/report': 'report.html', '/receiver': 'receiver.html', '/credits': 'credits.html'
}));
for (const name of ['login.css', 'login.js', 'account.js', 'style.css', 'portal.css', 'portal.js', 'shell.js', 'report.js', 'receiver.js', 'common.js', 'model-brand.js', 'event-stream.js', 'report-drafts.js', 'report-tags.js', 'icons.js', 'visual.js', 'visual.css', 'activity-view.js', 'stroke-text.js', 'login-title-paths.js', 'bounce-cards.js', 'specular-button.js', 'specular-light.js']) routes.set('/' + name, name);
for (const name of ['Gemini.svg', 'OpenAI.svg', 'Claude.svg', 'deepseek.svg', 'GROK.svg', 'GLM.svg', 'kimi.svg', 'minimax-color.svg', 'longcat-bright.svg', 'AI.svg', 'login-child-before.png', 'login-child-after.png']) routes.set('/assets/' + name, 'assets/' + name);
for (const name of ['children-support.svg', 'children-learning.svg', 'children-reading.svg', 'children-care.svg', 'children-play.svg', 'guardian-mark.svg', 'illustration-sources.json', 'icon-sources.json', 'adult-avatar-1.png', 'adult-avatar-2.png', 'adult-avatar-3.png', 'adult-avatar-4.png', 'adult-avatar-5.png', 'avatar-sources.json', 'licenses/lucide.txt', 'licenses/react-bits.txt']) routes.set('/assets/visual/' + name, 'assets/visual/' + name);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8' };
for (const name of ['markdown.js', 'vendor/markdown-it.js', 'assets/visual/licenses/markdown-it.txt', 'assets/visual/licenses/markdown-it-cjk-friendly.txt', 'assets/visual/licenses/east-asian-width.txt']) routes.set('/' + name, name);
const digest = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);

export function staticFiles(root) {
  const files = new Map();
  for (const name of new Set(routes.values())) files.set(name, fs.readFileSync(path.join(root, 'public', name)));
  const revision = digest(Buffer.concat([...files.values()]));
  const version = url => routes.has(url) && !url.endsWith('.html') ? url + '?v=' + revision : url;
  const assets = new Map();
  for (const [name, original] of files) {
    const ext = path.extname(name);
    let buffer = original;
    if (ext === '.html' || ext === '.js') {
      let source = original.toString('utf8');
      // Keep the complete module graph on the same release, including its imports.
      source = source.replace(/(["'])(\/(?:assets\/)?[^"'\s?]+\.(?:js|css|svg|png))\1/g, (all, quote, url) => quote + version(url) + quote);
      if (name === 'portal.html' || name === 'report.html') {
        const modules = ['common.js', 'icons.js', 'visual.js', 'account.js', 'shell.js', 'report-drafts.js', 'event-stream.js', 'model-brand.js'];
        source = source.replace('</head>', modules.map(module => `<link rel="modulepreload" href="${version('/' + module)}">`).join('') + '</head>');
      }
      buffer = Buffer.from(source);
    }
    const representations = { identity: buffer };
    if (ext !== '.png' && buffer.length > 512) {
      representations.br = brotliCompressSync(buffer, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } });
      representations.gzip = gzipSync(buffer, { level: 6 });
    }
    assets.set(name, { representations, type: types[ext], html: ext === '.html', etag: `W/"${digest(buffer)}"` });
  }
  return (req, res, url) => {
    const asset = assets.get(routes.get(url.pathname));
    if (!asset || !['GET', 'HEAD'].includes(req.method)) return false;
    const headers = { 'Content-Type': asset.type, 'X-Content-Type-Options': 'nosniff', ETag: asset.etag, Vary: 'Accept-Encoding', 'Cache-Control': !asset.html && url.searchParams.get('v') === revision ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate' };
    if (String(req.headers['if-none-match'] || '').split(',').map(s => s.trim()).some(tag => tag === asset.etag || tag === '*')) {
      res.writeHead(304, headers); res.end(); return true;
    }
    const accepted = String(req.headers['accept-encoding'] || '').split(',').map(item => {
      const [name, ...parameters] = item.trim().split(';');
      const q = parameters.find(p => p.trim().startsWith('q='));
      return { name, q: q ? Number(q.trim().slice(2)) : 1 };
    }).filter(item => item.q > 0).sort((a, b) => b.q - a.q);
    const encoding = accepted.map(item => item.name).find(name => name !== 'identity' && asset.representations[name]);
    const payload = asset.representations[encoding || 'identity'];
    if (encoding) headers['Content-Encoding'] = encoding;
    headers['Content-Length'] = payload.length;
    res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : payload); return true;
  };
}
