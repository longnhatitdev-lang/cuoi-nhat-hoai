const crypto = require('node:crypto');
const { send, auth, body } = require('../vercel-utils');
function cloudinaryConfig() {
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !key || !secret) throw new Error('Thiếu cấu hình Cloudinary trên máy chủ.');
  return { cloud, key, secret };
}
function signature(params, secret) {
  const text = Object.keys(params).filter(k => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort().map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(text + secret).digest('hex');
}
function publicIdFromUrl(value) {
  const u = new URL(String(value || ''));
  if (!/\.cloudinary\.com$/i.test(u.hostname)) throw new Error('URL ảnh không thuộc Cloudinary.');
  const parts = u.pathname.split('/').filter(Boolean); const upload = parts.indexOf('upload');
  if (upload < 0) throw new Error('URL Cloudinary không hợp lệ.');
  let tail = parts.slice(upload + 1); if (tail[0] && /^v\d+$/.test(tail[0])) tail.shift();
  const last = tail.pop(); if (!last) throw new Error('Không xác định được public_id.');
  return [...tail, last.replace(/\.[^.]+$/, '')].join('/');
}
module.exports = async (req, res) => {
  const a = auth(req); if (!a.ok) return send(res, a.status, { error: a.error });
  try {
    const { cloud, key, secret } = cloudinaryConfig();
    if (req.method === 'POST') {
      const data = JSON.parse(await body(req, 8192));
      if (data.intent !== 'signed-upload') return send(res, 400, { error: 'Yêu cầu upload không hợp lệ.' });
      const mime = String(data.mime || '');
      const isAudio = mime.startsWith('audio/');
      const allowedAudio = ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac'];
      if (mime !== 'image/webp' && !allowedAudio.includes(mime)) return send(res, 415, { error: 'Ảnh phải là WebP hoặc âm thanh phải thuộc định dạng được hỗ trợ.' });
      const cat = isAudio ? 'music' : (['wed', 'bg', 'icon'].includes(data.cat) ? data.cat : 'wed');
      const resourceType = isAudio ? 'video' : 'image';
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = `lcln-wedding/${cat}`;
      const params = { folder, timestamp, tags: 'lcln-library' };
      return send(res, 200, { uploadUrl: `https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/upload`, fields: { ...params, api_key: key, signature: signature(params, secret) }, mime, resourceType, expiresIn: 3600 });
    }
    if (req.method === 'DELETE') {
      const data = JSON.parse(await body(req, 4096));
      const public_id = String(data.public_id || (data.url ? publicIdFromUrl(data.url) : ''));
      if (!public_id.startsWith('lcln-wedding/')) return send(res, 403, { error: 'Chỉ được xóa ảnh thuộc thư mục LCLN Wedding.' });
      const resourceType = public_id.includes('/music/') ? 'video' : 'image';
      const timestamp = Math.floor(Date.now() / 1000);
      const params = { public_id, timestamp };
      const form = new URLSearchParams({ ...params, api_key: key, signature: signature(params, secret) });
      const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/destroy`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      const result = await r.json().catch(() => ({}));
      if (!r.ok || !['ok', 'not found'].includes(result.result)) return send(res, 502, { error: result.error?.message || 'Không xóa được ảnh trên Cloudinary.' });
      return send(res, 200, { ok: true, result: result.result });
    }
    return send(res, 405, { error: 'Method Not Allowed' });
  } catch (e) { return send(res, 500, { error: e.message || 'Lỗi xử lý Cloudinary.' }); }
};
