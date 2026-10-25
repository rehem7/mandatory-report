import { MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS_BYTES, ATTACHMENT_MIMES, canonicalMime } from './public/attachment-policy.js';

export const MAX_BODY_BYTES = Math.ceil(MAX_ATTACHMENTS_BYTES * 4 / 3) + 1024 * 1024;
const fail = message => { throw Object.assign(Error(message), { status: 400 }); };
export const attachmentsOf = record => Array.isArray(record.attachments) ? record.attachments : record.attachment ? [record.attachment] : [];
export const attachmentSize = data => Math.floor(data.length * 3 / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
export const attachmentMetadata = files => files.map(({ name, mime, data }) => ({ name, mime, size: attachmentSize(data) }));
export function normalizeAttachments(body) {
  const values = Object.hasOwn(body, 'attachments') ? body.attachments : body.attachment ? [body.attachment] : [];
  if (!Array.isArray(values) || values.length > MAX_ATTACHMENTS) fail('附件须为列表，最多上传10个文件');
  let total = 0;
  return values.map(a => {
    const mime = canonicalMime(a?.mime);
    if (!a || typeof a.name !== 'string' || !a.name.trim() || !ATTACHMENT_MIMES.has(mime) || typeof a.data !== 'string' || !a.data.length || a.data.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(a.data)) fail('附件格式无效，请使用照片、视频、录音、PDF或TXT');
    const size = attachmentSize(a.data);
    if (size > MAX_ATTACHMENT_BYTES) fail('单个附件不能超过10MB');
    if (size <= 0 || a.data.length > Math.ceil(MAX_ATTACHMENT_BYTES / 3) * 4) fail('附件内容无效或超过10MB');
    total += size;
    if (total > MAX_ATTACHMENTS_BYTES) fail('附件合计不能超过50MB');
    return { name: a.name.trim().slice(0, 200), mime, data: a.data };
  });
}
