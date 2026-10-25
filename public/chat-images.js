import { esc } from '/common.js';
export const chatImageTools = () => '<div class="chat-image-toolbar"><button type="button" id="add-chat-image" class="secondary mini">添加图片</button><input type="file" id="chat-image-input" accept="image/png,image/jpeg,image/webp" multiple hidden></div><ul id="chat-image-list" class="chat-image-list" aria-label="待发送图片"></ul>';
export async function filesToChatImages(files, previous = []) {
  if (files.length + previous.length > 3) throw Error('每条消息最多3张图片');
  const type = file => file.type || ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' })[file.name.split('.').pop().toLowerCase()];
  if (files.some(file => !['image/png', 'image/jpeg', 'image/webp'].includes(type(file)) || !file.size || file.size > 5 * 1024 * 1024)) throw Error('请选择PNG、JPG或WebP图片，单张不超过5MB');
  const values = await Promise.all(files.map(file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(Error('图片读取失败，请重新选择')); reader.onload = () => resolve({ name: file.name, mime: type(file), data: reader.result.split(',')[1] }); reader.readAsDataURL(file); })));
  if ([...previous, ...values].reduce((n, image) => n + Math.floor(image.data.length * 3 / 4), 0) > 10 * 1024 * 1024) throw Error('每条消息的图片合计不能超过10MB');
  return values;
}
export function chatImagesHTML(images, editable = false) {
  return (images || []).map((image, index) => `<li><img src="data:${esc(image.mime)};base64,${esc(image.data)}" alt="${esc(image.name)}"><span>${esc(image.name)}</span>${editable ? `<button type="button" class="text-button" data-remove-chat-image="${index}" aria-label="移除图片 ${esc(image.name)}">移除</button>` : ''}</li>`).join('');
}
