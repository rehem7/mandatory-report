import crypto from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { modelRoutes, routeKey } from './model-registry.js';
import { complete } from './ai.js';
const colors = [{ name: '红', rgb: [230, 20, 30] }, { name: '绿', rgb: [15, 175, 40] }, { name: '蓝', rgb: [20, 60, 230] }, { name: '黄', rgb: [245, 220, 10] }, { name: '黑', rgb: [10, 10, 10] }];
const crc32 = bytes => { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; };
const chunk = (name, data) => { const type = Buffer.from(name), length = Buffer.alloc(4), crc = Buffer.alloc(4); length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([type, data]))); return Buffer.concat([length, type, data, crc]); };
export function colorChallenge() {
  const chosen = Array.from({ length: 4 }, () => colors[crypto.randomInt(colors.length)]), width = 128, row = width * 3 + 1, pixels = Buffer.alloc(row * width);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) { const rgb = chosen[(y >= 64 ? 2 : 0) + (x >= 64 ? 1 : 0)].rgb; for (let k = 0; k < 3; k++) pixels[y * row + 1 + x * 3 + k] = rgb[k]; }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(width, 4); header[8] = 8; header[9] = 2;
  return { data: Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]).toString('base64'), expected: chosen.map(c => c.name).join('') };
}
export async function probeModelImages(model) {
  const route = modelRoutes(model).find(r => r.key);
  if (!route) throw Object.assign(Error('该模型未配置可用通道'), { status: 503 });
  const challenge = colorChallenge(), start = Date.now();
  let verified = false;
  try {
    const result = await complete(model, [{ role: 'user', content: [{ type: 'text', text: '图中为2行2列纯色色块。按左上、右上、左下、右下顺序，只回复四个颜色的中文名称，用逗号分隔。' }, { type: 'image_url', image_url: { url: `data:image/png;base64,${challenge.data}`, detail: 'low' } }] }], undefined, { imageRouteKeys: [routeKey(route)] });
    verified = result.replace(/色|[\s,，、。]/g, '') === challenge.expected;
  } catch { /* Failed checks never imply image support and never expose provider errors. */ }
  return { routeKey: routeKey(route), modelId: model, status: verified ? 'verified' : 'unverified', checkedAt: new Date().toISOString(), elapsedMs: Date.now() - start };
}
