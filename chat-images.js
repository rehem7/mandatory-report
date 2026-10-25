export const MAX_CHAT_IMAGES = 3, MAX_IMAGE_BYTES = 5 * 1024 * 1024, MAX_CHAT_IMAGE_BYTES = 10 * 1024 * 1024;
const fail = message => { throw Object.assign(Error(message), { status: 400 }); };
function dimensions(bytes, mime) {
  if (mime === 'image/png' && bytes.length >= 33) return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (mime === 'image/webp') {
    const kind = bytes.toString('ascii', 12, 16);
    if (kind === 'VP8X' && bytes.length >= 30) return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
    if (kind === 'VP8 ' && bytes.length >= 30 && bytes.toString('hex', 23, 26) === '9d012a') return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
    if (kind === 'VP8L' && bytes.length >= 25 && bytes[20] === 0x2f) { const bits = bytes.readUInt32LE(21); return [1 + (bits & 0x3fff), 1 + (bits >>> 14 & 0x3fff)]; }
  }
  if (mime === 'image/jpeg') {
    let i = 2;
    while (i + 4 < bytes.length) {
      if (bytes[i++] !== 0xff) continue;
      while (bytes[i] === 0xff) i++;
      const marker = bytes[i++]; if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd8) continue;
      if (i + 2 > bytes.length) break;
      const length = bytes.readUInt16BE(i); if (length < 2 || i + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) return [bytes.readUInt16BE(i + 5), bytes.readUInt16BE(i + 3)];
      i += length;
    }
  }
  return [0, 0];
}
export function normalizeChatImages(values = []) {
  if (!Array.isArray(values) || values.length > MAX_CHAT_IMAGES) fail('每条消息最多3张图片');
  let total = 0;
  return values.map(value => {
    if (!value || !['image/png', 'image/jpeg', 'image/webp'].includes(value.mime) || typeof value.data !== 'string' || value.data.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.data)) fail('图片仅支持PNG、JPG、WebP，单张不超过5MB');
    const bytes = Buffer.from(value.data, 'base64');
    const valid = value.mime === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : value.mime === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!valid || bytes.length > MAX_IMAGE_BYTES) fail('图片内容与格式不符，或超过5MB');
    const [width, height] = dimensions(bytes, value.mime); if (!width || !height || width > 8192 || height > 8192 || width * height > 20000000) fail('图片尺寸无效或过大，请缩小至2000万像素以内');
    total += bytes.length; if (total > MAX_CHAT_IMAGE_BYTES) fail('每条消息的图片合计不能超过10MB');
    return { name: String(value.name || '图片').slice(0, 150), mime: value.mime, data: bytes.toString('base64') };
  });
}
export const imageBytes = images => (images || []).reduce((size, image) => size + Buffer.byteLength(image.data, 'base64'), 0);
export function modelMessage(message) {
  return { role: message.role, content: message.role === 'user' && message.images?.length ? [{ type: 'text', text: message.content || '请描述这张图片中可直接观察到的信息，不推断身份、伤情或侵害事实。' }, ...message.images.map(image => ({ type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.data}`, detail: 'low' } }))] : message.content };
}
