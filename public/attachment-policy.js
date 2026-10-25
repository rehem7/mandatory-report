export const MAX_ATTACHMENTS = 10;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_BYTES = 50 * 1024 * 1024;
export const ATTACHMENT_HINT = '最多10个文件 · 单个不超过10MB · 合计不超过50MB';
const extensions = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', amr: 'audio/amr', aac: 'audio/aac', pdf: 'application/pdf', txt: 'text/plain' };
export const ATTACHMENT_ACCEPT = Object.keys(extensions).map(ext => '.' + ext).join(',');
export const ATTACHMENT_MIMES = new Set([...Object.values(extensions), 'audio/webm', 'audio/3gpp', 'video/3gpp']);
export function canonicalMime(mime = '') {
  const value = String(mime).split(';')[0].trim().toLowerCase();
  return ({ 'audio/x-m4a': 'audio/mp4', 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/mp3': 'audio/mpeg' })[value] || value;
}
export function attachmentMime(file) {
  const type = canonicalMime(file.type);
  return ATTACHMENT_MIMES.has(type) ? type : extensions[file.name.split('.').pop().toLowerCase()] || '';
}
export function validateFiles(files) {
  if (files.length > MAX_ATTACHMENTS) throw Error('最多可上传10个文件，请移除部分文件后重试');
  let total = 0;
  for (const file of files) {
    if (!file.size) throw Error(`“${file.name}”是空文件，请重新选择`);
    if (file.size > MAX_ATTACHMENT_BYTES) throw Error(`“${file.name}”超过10MB，请选择较小的文件`);
    if (!ATTACHMENT_MIMES.has(attachmentMime(file))) throw Error(`“${file.name}”格式不支持，请选择照片、视频、录音、PDF或TXT`);
    total += file.size;
  }
  if (total > MAX_ATTACHMENTS_BYTES) throw Error('附件合计超过50MB，请移除部分文件后重试');
}
export function fileToAttachment(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, mime: attachmentMime(file), data: reader.result.split(',')[1] });
    reader.onerror = () => reject(Error(`无法读取“${file.name}”，请重新选择`));
    reader.readAsDataURL(file);
  });
}
