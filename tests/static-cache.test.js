import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mandatory-cache-'));
process.env.FREE_API_KEY = 'test-only';
process.env.AI_CATALOG_ENABLED = '0';
const { server } = await import('../server.js');
test('版本化静态资源、条件缓存、压缩与账号启动数据隔离', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const html = await fetch(base + '/ask', { headers: { 'Accept-Encoding': 'br' } });
    assert.equal(html.headers.get('content-encoding'), 'br');
    assert.match(html.headers.get('cache-control'), /must-revalidate/);
    assert.equal(html.headers.get('set-cookie'), null);
    const source = await html.text();
    const entry = source.match(/src="(\/portal\.js\?v=[a-f0-9]+)"/)[1];
    assert.match(source, /rel="modulepreload"/);
    const js = await fetch(base + entry, { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(js.headers.get('content-encoding'), 'gzip');
    assert.match(js.headers.get('cache-control'), /immutable/);
    assert.match(await js.text(), /from "\/common\.js\?v=[a-f0-9]+"/);
    const etag = js.headers.get('etag');
    const cached = await fetch(base + entry, { headers: { 'If-None-Match': etag } });
    assert.equal(cached.status, 304); assert.equal(await cached.text(), '');
    const unversioned = await fetch(base + '/portal.js');
    assert.match(unversioned.headers.get('cache-control'), /must-revalidate/);
    const head = await fetch(base + '/style.css', { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(await head.text(), '');
    const noGzip = await fetch(base + '/portal.js', { headers: { 'Accept-Encoding': 'gzip;q=0' } });
    assert.equal(noGzip.headers.get('content-encoding'), null);
    const login = await (await fetch(base + '/login')).text();
    assert.doesNotMatch(login, /login-child-(?:before|after)\.png/);
    const portraitSets = [...login.matchAll(/srcset="([^"]*login-child[^"]*)"/g)];
    assert.equal(portraitSets.length, 2);
    for (const [, candidates] of portraitSets) {
      assert.match(candidates, /240w, .*480w, .*800w/);
      for (const candidate of candidates.split(',')) {
        const [url] = candidate.trim().split(/\s+/);
        assert.match(url, /\.webp\?v=[a-f0-9]{16}$/);
        const asset = await fetch(base + url, { headers: { 'Accept-Encoding': 'br, gzip' } });
        assert.equal(asset.status, 200);
        assert.equal(asset.headers.get('content-type'), 'image/webp');
        assert.equal(asset.headers.get('content-encoding'), null);
        assert.match(asset.headers.get('cache-control'), /immutable/);
        const bytes = Buffer.from(await asset.arrayBuffer());
        assert.ok(bytes.length < 80000, 'display-sized portrait should stay below 80 KB');
        // Artwork revisions depend on its own bytes, independent of code releases.
        assert.equal(new URL(url, base).searchParams.get('v'), crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 16));
      }
    }
    const loginEntry = login.match(/src="(\/login\.js\?v=[a-f0-9]+)"/)[1];
    const loginModule = await (await fetch(base + loginEntry)).text();
    assert.match(loginModule, /import\("\/bounce-cards\.js\?v=[a-f0-9]+"\)/);
    assert.match(loginModule, /import\("\/stroke-text\.js\?v=[a-f0-9]+"\)/);
    const visuals = await (await fetch(base + '/visual.js')).text();
    assert.doesNotMatch(visuals, /guardian-(?:question\.png|confident\.png|expressions\.jpg)/);
    const mascotUrls = [...new Set([...visuals.matchAll(/"?(\/assets\/mascot\/[^'"\s]+\.webp\?v=[a-f0-9]{16})/g)].map(match => match[1]))];
    assert.equal(mascotUrls.length, 7);
    for (const url of mascotUrls) {
      const asset = await fetch(base + url);
      assert.equal(asset.status, 200);
      assert.equal(asset.headers.get('content-type'), 'image/webp');
      assert.match(asset.headers.get('cache-control'), /immutable/);
      assert.ok((await asset.arrayBuffer()).byteLength < 40000, 'individual mascot should stay below 40 KB');
    }
    assert.equal((await fetch(base + '/assets/not-public.png')).status, 404);
    const first = await fetch(base + '/api/portal/bootstrap');
    assert.equal(first.headers.get('cache-control'), 'no-store');
    const a = await first.json();
    assert.equal(a.catalog.profiles[0].id, a.account.ownerId);
    assert.equal(a.catalog.units[0].id, a.account.ownerId);
    assert.ok(a.catalog.cases.length); assert.ok(a.config.models.length);
    assert.equal(a.config.apiKey, undefined);
    const b = await (await fetch(base + '/api/portal/bootstrap')).json();
    assert.notEqual(a.account.ownerId, b.account.ownerId);
    const cookie = first.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    const created = await (await fetch(base + '/api/sessions', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'qa', model: a.config.defaultModel }) })).json();
    const ownRecords = await fetch(base + '/api/portal/records', { headers: { Cookie: cookie } });
    assert.equal(ownRecords.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await ownRecords.json()).sessions.map(s => s.id), [created.id]);
    assert.deepEqual((await (await fetch(base + '/api/portal/records')).json()).sessions, []);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
