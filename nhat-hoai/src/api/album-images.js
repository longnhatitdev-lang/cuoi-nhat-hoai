const fs = require('node:fs/promises');
const path = require('node:path');
const { getSide } = require('../supabase-content');
const { isClientAllowed } = require('../access-control');

function extractImages(html) {
  const found = new Set();
  const add = (raw) => {
    if (!raw) return;
    let value = raw.trim().replace(/&amp;/g, '&');
    if (!value || /^(data:|blob:)/i.test(value)) return;
    const imagePath = value.split(/[?#]/)[0];
    if (/\.(?:png|jpe?g|webp|gif|avif)$/i.test(imagePath) && (/^https:\/\//i.test(value) || /(?:asset\/img|uploads\/|\/uploads\/)/i.test(imagePath))) found.add(value);
  };
  for (const m of html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/<source\b[^>]*?\bsrcset\s*=\s*["']([^"']+)["']/gi)) add(m[1].split(',')[0].trim().split(/\s+/)[0]);
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) add(m[1]);
  return [...found];
}
module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.statusCode=405; return res.end('Method Not Allowed'); }
  try {
    const access = await isClientAllowed(req);
    if (!access.ok) { res.statusCode=401; res.setHeader('Content-Type','application/json; charset=utf-8'); return res.end(JSON.stringify({error:'Cần đăng nhập để xem album.'})); }
    const all = new Set();
    for (const side of ['nam','gai']) {
      let html = '', row = null;
      try { row = await getSide(side); if (typeof row?.content?.html === 'string') html = row.content.html; } catch {}
      if (Array.isArray(row?.content?.albumImages)) { row.content.albumImages.forEach(x => { if (x?.url) all.add(x.url); }); continue; }
      if (!html) html = await fs.readFile(path.join(process.cwd(),'client',`index-${side}.html`),'utf8');
      extractImages(html).forEach(x => all.add(x));
    }
    res.statusCode=200; res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','no-store, max-age=0'); res.setHeader('X-Content-Type-Options','nosniff');
    return res.end(JSON.stringify({images:[...all]}));
  } catch (e) { res.statusCode=500; res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({error:'Không tải được danh sách ảnh.'})); }
};
