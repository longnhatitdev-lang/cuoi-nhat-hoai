const crypto = require('node:crypto');
const { SUPABASE_URL, SUPABASE_KEY } = require('./config');
const { headers } = require('./supabase-content');
const { isClientAllowed } = require('./access-control');
const { readBody, sendJson } = require('./http-utils');
function clientKey(req, scope = 'post') {
  const forwarded = process.env.VERCEL === '1' || process.env.TRUST_PROXY === 'true'
    ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    : '';
  const ip = forwarded || String(req.socket?.remoteAddress || 'unknown');
  const secret = String(process.env.ACCESS_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET || '');
  if (secret.length < 32) throw new Error('Thiếu secret tối thiểu 32 ký tự để bảo vệ giới hạn gửi lời chúc.');
  return crypto.createHmac('sha256', secret).update(`${scope}:${ip}`).digest('hex');
}
async function handleWallRequest(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return sendJson(res, 405, { error: 'Method Not Allowed' });
  try { const access = await isClientAllowed(req); if (!access.ok) return sendJson(res, 401, { error: 'Cần đăng nhập để sử dụng chức năng này.' }); }
  catch { return sendJson(res, 503, { error: 'Không thể kiểm tra quyền truy cập.' }); }
  if (!SUPABASE_URL || !SUPABASE_KEY) return sendJson(res, 503, { error: 'Chưa cấu hình SUPABASE_URL và SUPABASE_KEY.' });
  const base = SUPABASE_URL.replace(/\/$/, '');
  try {
    if (req.method === 'GET') {
      const limit = await fetch(`${base}/rest/v1/rpc/wedding_wall_read_allowed`, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ p_client_key: clientKey(req, 'read') }), signal: AbortSignal.timeout(10000), cache: 'no-store' });
      if (!limit.ok) return sendJson(res, 502, { error: 'Không kiểm tra được giới hạn tải sổ lời chúc.' });
      const allowed = await limit.json();
      if (!allowed?.allowed) return sendJson(res, 429, { error: 'Bạn tải sổ lời chúc quá nhanh. Vui lòng thử lại sau một phút.' });
      const upstream = await fetch(`${base}/rest/v1/wedding_wall?select=*&order=created_at.asc&limit=200`, { headers: headers(), signal: AbortSignal.timeout(10000), cache: 'no-store' });
      const body = await upstream.text();
      res.writeHead(upstream.status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(body);
    }
    if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) return sendJson(res, 415, { error: 'Content-Type phải là application/json.' });
    let data;
    try { data = JSON.parse((await readBody(req, 8192)).toString()); }
    catch { return sendJson(res, 400, { error: 'Dữ liệu không hợp lệ.' }); }
    const name = typeof data.name === 'string' ? data.name.trim().slice(0, 80) : '';
    const side = ['nha-trai', 'nha-gai'].includes(data.side) ? data.side : '';
    const status = ['live', 'yes', 'no'].includes(data.status) ? data.status : '';
    const message = typeof data.message === 'string' ? data.message.trim().slice(0, 250) : '';
    const guests = status === 'yes' ? Math.min(20, Math.max(1, Number(data.guests) || 1)) : 0;
    if (!name || !/^[\p{L}\p{M}0-9 .'-]{1,80}$/u.test(name) || !side || !status || !message) return sendJson(res, 400, { error: 'Vui lòng nhập tên, chọn phía và nội dung hợp lệ.' });
    const upstream = await fetch(`${base}/rest/v1/rpc/wedding_submit_wall_message`, {
      method: 'POST', headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ p_name: name, p_side: side, p_status: status, p_guests: guests, p_message: message, p_client_key: clientKey(req, 'post') }),
      signal: AbortSignal.timeout(10000), cache: 'no-store'
    });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('Supabase wall RPC:', upstream.status, payload);
      return sendJson(res, 502, { error: 'Không thể lưu lời chúc. Kiểm tra migration giới hạn lời chúc trong Supabase.' });
    }
    if (!payload.ok) {
      if (payload.code === 'rate_limit') return sendJson(res, 429, { error: 'Bạn gửi hơi nhanh. Vui lòng thử lại sau một phút.' });
      if (payload.code === 'name_limit') return sendJson(res, 429, { error: `${name} đã gửi đủ 3 lần rồi ạ!` });
      if (payload.code === 'duplicate') return sendJson(res, 409, { error: 'Nội dung này bạn đã gửi rồi, hãy viết nội dung khác nhé!' });
      return sendJson(res, 400, { error: 'Không thể xác nhận nội dung gửi.' });
    }
    return sendJson(res, 201, payload.row || payload);
  } catch (e) {
    console.error('Wall request:', e);
    return sendJson(res, 502, { error: 'Không kết nối được Supabase. Vui lòng thử lại.' });
  }
}
module.exports = { handleWallRequest };
