const fs = require('node:fs/promises');
const path = require('node:path');
const { getSide } = require('../supabase-content');
const { isClientAllowed } = require('../access-control');
module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode=405; return res.end('Method Not Allowed'); }
  const side = String(req.query?.side || new URL(req.url, 'https://local.invalid').searchParams.get('side') || 'nam') === 'gai' ? 'gai' : 'nam';
  try { const access=await isClientAllowed(req); if(!access.ok){res.statusCode=302;res.setHeader('Location','/access?next='+encodeURIComponent(side==='gai'?'/index-gai':'/index-nam'));return res.end();} } catch(e) { res.statusCode=503;res.setHeader('Content-Type','text/plain; charset=utf-8');return res.end('Không thể kiểm tra quyền truy cập. Vui lòng thử lại sau.'); }
  try {
    const row = await getSide(side);
    const html = row?.content?.html;
    if (typeof html === 'string' && html.includes('<html')) {
      res.statusCode=200; res.setHeader('Content-Type','text/html; charset=utf-8'); res.setHeader('Cache-Control','no-store, max-age=0, must-revalidate'); res.setHeader('X-Content-Type-Options','nosniff'); return res.end(req.method==='HEAD' ? undefined : html);
    }
  } catch (e) { console.error('Supabase site read:', e.message); }
  // First deployment / database temporarily unavailable: serve the committed baseline HTML.
  const file = path.join(process.cwd(), 'client', `index-${side}.html`);
  try { const html=await fs.readFile(file,'utf8'); res.statusCode=200; res.setHeader('Content-Type','text/html; charset=utf-8'); res.setHeader('Cache-Control','no-store, max-age=0, must-revalidate'); return res.end(req.method==='HEAD'?undefined:html); }
  catch { res.statusCode=503; res.setHeader('Content-Type','text/plain; charset=utf-8'); return res.end('Không tải được nội dung thiệp. Kiểm tra cấu hình Supabase và deployment.'); }
};
