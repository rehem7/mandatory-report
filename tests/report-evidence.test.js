import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { sessionClient } from './support/client.js';
import { normalizeAttachments, attachmentsOf } from '../attachments.js';

const evidence = (name, mime, content = 'fictional evidence ' + name) => ({ name, mime, data: Buffer.from(content).toString('base64') });
test('附件数量、单件与总量校验，并兼容旧单附件结构', () => {
  const file = evidence('录音.m4a', 'audio/x-m4a');
  assert.equal(normalizeAttachments({ attachments: [file] })[0].mime, 'audio/mp4');
  assert.deepEqual(attachmentsOf({ attachment: file }), [file]);
  assert.equal(normalizeAttachments({ attachment: file }).length, 1);
  assert.deepEqual(normalizeAttachments({ attachments: [] }), []);
  assert.throws(() => normalizeAttachments({ attachments: Array(11).fill(file) }), /10个/);
  assert.throws(() => normalizeAttachments({ attachments: [{ ...file, mime: 'text/html' }] }), /格式/);
  assert.throws(() => normalizeAttachments({ attachments: [{ ...file, data: 'invalid!' }] }), /格式/);
  const tooLarge = { ...file, data: Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64') };
  assert.throws(() => normalizeAttachments({ attachments: [tooLarge] }), /10MB/);
  const large = { ...file, data: Buffer.alloc(9 * 1024 * 1024).toString('base64') };
  assert.throws(() => normalizeAttachments({ attachments: Array(6).fill(large) }), /50MB/);
});

test('多份照片视频录音的提交、逐个下载、旧附件及跨账号草稿隔离', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'report-evidence-'));
  const old = evidence('旧附件.txt', 'text/plain');
  fs.writeFileSync(path.join(dir, 'database.json'), JSON.stringify({ accountSchemaVersion: 1, reports: [{ id: 'legacy-single', attachment: old, confirmedTag: null, supervision: [] }], logs: [] }));
  process.env.DATA_DIR = dir; process.env.AI_CATALOG_ENABLED = '0'; process.env.FREE_API_KEY = 'local-test-placeholder';
  const { server } = await import('../server.js');
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port, a = sessionClient(base), b = sessionClient(base), otherBrowser = sessionClient(base);
  const json = async (client, url, value, method = value ? 'POST' : 'GET', headers = {}) => {
    const response = await client(url, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(value ? { body: JSON.stringify(value) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  try {
    const files = [evidence('现场照片.png', 'image/png'), evidence('情况视频.mp4', 'video/mp4'), evidence('情况录音.m4a', 'audio/mp4')];
    const fields = { identity: '教师/教育工作者', types: ['身体虐待'], region: '湖南省 长沙市 岳麓区', regionCodes: { province: '430000', city: '430100', district: '430104' }, address: '虚构学校', occurredAt: '2026-10-25T09:00', age: '7-13岁', description: '仅供测试的虚构线索', consent: true, attachments: files };
    const report = await json(a, '/api/reports', fields); assert.equal(report.status, 201);
    const detail = await json(a, '/api/reports/' + report.data.id);
    assert.equal(detail.data.attachments.length, 3); assert.equal(detail.data.attachment.name, files[0].name);
    assert.ok(detail.data.attachments.every(file => !('data' in file) && file.size > 0));
    for (let index = 0; index < files.length; index++) {
      const response = await a('/api/reports/' + report.data.id + '/attachments/' + index);
      assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), files[index].mime);
      assert.equal(await response.text(), Buffer.from(files[index].data, 'base64').toString());
    }
    assert.equal((await a('/api/reports/' + report.data.id + '/attachments/99')).status, 404);
    assert.equal((await a('/api/reports/' + report.data.id + '/attachments/0', { headers: { 'X-Demo-Role': encodeURIComponent('检察院') } })).status, 404);
    assert.equal(await (await a('/api/reports/legacy-single/attachment')).text(), Buffer.from(old.data, 'base64').toString());
    const legacy = await json(a, '/api/reports/legacy-single'); assert.equal(legacy.data.attachments.length, 1); assert.ok(!legacy.data.attachments[0].data);
    assert.equal((await json(a, '/api/reports', { ...fields, regionCodes: { ...fields.regionCodes, district: '440106' } })).status, 400);
    assert.equal((await json(a, '/api/reports', { ...fields, attachments: Array(11).fill(files[0]) })).status, 400);
    assert.equal((await json(a, '/api/reports', { ...fields, attachments: [evidence('bad.html', 'text/html')] })).status, 400);
    await json(a, '/api/auth/register', { email: 'evidence-a@example.test', identity: '教师/教育工作者' });
    await json(b, '/api/auth/register', { email: 'evidence-b@example.test', identity: '医护人员' });
    const id = crypto.randomUUID();
    let saved = await json(a, '/api/drafts/' + id, { fields }, 'PUT'); assert.equal(saved.status, 200);
    const revision = saved.data.revision;
    saved = await json(a, '/api/drafts/' + id + '/attachments', { revision, attachments: files }, 'PUT'); assert.equal(saved.status, 200);
    assert.equal(saved.data.attachmentNames.length, 3); assert.ok(!JSON.stringify(saved.data).includes(files[0].data));
    assert.equal((await json(b, '/api/drafts/' + id + '/attachments')).status, 404);
    assert.equal((await json(b, '/api/drafts/' + id + '/attachments', { revision: saved.data.revision, attachments: [] }, 'PUT')).status, 404);
    assert.equal((await json(a, '/api/drafts/' + id + '/attachments', { revision, attachments: [] }, 'PUT')).status, 409);
    await json(otherBrowser, '/api/auth/login', { email: 'evidence-a@example.test', password: '123456' });
    const restored = await json(otherBrowser, '/api/drafts/' + id + '/attachments'); assert.deepEqual(restored.data, files);
    const reduced = await json(a, '/api/drafts/' + id + '/attachments', { revision: saved.data.revision, attachments: [files[0], files[2]] }, 'PUT'); assert.equal(reduced.status, 200);
    assert.equal((await json(otherBrowser, '/api/drafts/' + id + '/attachments')).data.length, 2);
    assert.equal((await json(a, '/api/drafts/' + id, { revision: reduced.data.revision }, 'DELETE')).status, 200);
    assert.equal((await json(otherBrowser, '/api/drafts/' + id + '/attachments', { revision: reduced.data.revision, attachments: files }, 'PUT')).status, 404);
  } finally {
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); fs.rmSync(dir, { recursive: true, force: true });
  }
});
