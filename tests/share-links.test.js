import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { issueShareLink, handleShareLink } from '../share-links.js';

test('扫码入口在24小时边界失效、不可篡改且禁止缓存跳转', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'report-qr-'));
  try {
    const now = Date.now(), link = issueShareLink(directory, { now });
    assert.equal(link.expiresAt - now, 86400000);
    function visit(pathname, time, method = 'GET') {
      const response = { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } };
      assert.equal(handleShareLink({ method }, response, new URL(pathname, 'http://localhost'), directory, time), true);
      return response;
    }
    const valid = visit(link.pathname, link.expiresAt - 1);
    assert.equal(valid.status, 302); assert.equal(valid.headers.Location, '/login');
    assert.match(valid.headers['Cache-Control'], /no-store/);
    const expired = visit(link.pathname, link.expiresAt);
    assert.equal(expired.status, 410); assert.match(expired.body, /二维码已过期/); assert.equal(expired.headers.Location, undefined);
    assert.equal(visit(link.pathname + 'tampered', now).status, 404);
    assert.equal(visit(link.pathname, now, 'POST').status, 405);
    assert.equal(visit(link.pathname, link.expiresAt, 'HEAD').body, undefined);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
