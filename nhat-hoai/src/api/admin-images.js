const { send, auth } = require('../vercel-utils');
const fs = require('node:fs');
const path = require('node:path');
module.exports = async (req, res) => {
  const a = auth(req); if (!a.ok) return send(res, a.status, { error: a.error });
  if (req.method !== 'GET') return send(res, 405, { error: 'Method Not Allowed' });
  const { CLOUDINARY_CLOUD_NAME: cloud, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret } = process.env;
  if (!cloud || !key || !secret) return send(res, 503, { error: 'Chưa cấu hình Cloudinary trên máy chủ.' });
  try {
    const authHeader = 'Basic ' + Buffer.from(`${key}:${secret}`).toString('base64');
    const expression = encodeURIComponent('tags=lcln-library AND resource_type:image');
    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/resources/search?expression=${expression}&sort_by[0][created_at]=desc&max_results=500`, { headers: { Authorization: authHeader }, cache: 'no-store' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error?.message || `Cloudinary trả về ${r.status}.`);
    const images = (data.resources || []).map(x => x.secure_url).filter(Boolean);
    const assetRoot = path.join(process.cwd(), 'public', 'asset');
    const walk = (dir, rel = '') => { if (!fs.existsSync(dir)) return; for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); const next = path.posix.join(rel, entry.name); if (entry.isDirectory()) walk(full, next); else if (/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(entry.name)) images.push('/asset/' + next.split(path.sep).join('/')); } };
    walk(assetRoot);
    return send(res, 200, { images: [...new Set(images)].sort() });
  } catch (e) { return send(res, 502, { error: e.message || 'Không tải được thư viện Cloudinary.' }); }
};
