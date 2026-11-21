const { validSession, originAllowed } = require('./admin-session');
function send(res, status, data, headers = {}) { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); for (const [k,v] of Object.entries(headers)) res.setHeader(k,v); res.end(JSON.stringify(data)); }
function auth(req) {
  const expected = String(process.env.ADMIN_PASSWORD || '');
  if (!expected) return { ok: false, status: 503, error: 'Chưa cấu hình ADMIN_PASSWORD trên Vercel.' };
  if (['POST','PUT','PATCH','DELETE'].includes(String(req.method||'').toUpperCase()) && !originAllowed(req)) {
    return { ok: false, status: 403, error: 'Nguồn gửi yêu cầu không hợp lệ.' };
  }
  if (validSession(req)) return { ok: true, session: true };
  return { ok: false, status: 401, error: 'Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.' };
}
async function body(req, max = 12*1024*1024) {
  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) { if(req.body.length>max) throw new Error('Dữ liệu quá lớn.'); return req.body.toString(); }
    if (typeof req.body === 'string') { if(Buffer.byteLength(req.body)>max) throw new Error('Dữ liệu quá lớn.'); return req.body; }
    return JSON.stringify(req.body);
  }
  const chunks=[]; let n=0;
  for await (const c of req) { n+=c.length; if(n>max) throw new Error('Dữ liệu quá lớn.'); chunks.push(c); }
  return Buffer.concat(chunks).toString();
}
module.exports = { send, auth, body };
