const crypto = require('node:crypto');
const { config, headers } = require('./supabase-content');
const SECRET = () => String(process.env.ACCESS_SESSION_SECRET || '');
function ensureSessionSecret(){const value=SECRET();if(value.length<32)throw new Error('Cần cấu hình ACCESS_SESSION_SECRET tối thiểu 32 ký tự trong Environment Variables.');return value;}
const COOKIE = 'lcln_access';
const enc = (v) => Buffer.from(String(v)).toString('base64url');
function sign(value) { const secret=ensureSessionSecret(); return crypto.createHmac('sha256',secret).update(value).digest('base64url'); }
function cookieValue(req) { const raw=String(req.headers.cookie||''); const m=raw.match(new RegExp('(?:^|;\\s*)'+COOKIE+'=([^;]+)')); return m?decodeURIComponent(m[1]):''; }
function sessionValid(req, version) {
  const token=cookieValue(req); const p=token.split('.'); if(p.length!==3)return false;
  const value=`${p[0]}.${p[1]}`; let expected; try{expected=sign(value)}catch{return false}
  const a=Buffer.from(expected),b=Buffer.from(p[2]); if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return false;
  const expires=Number(Buffer.from(p[0],'base64url').toString()); const v=Buffer.from(p[1],'base64url').toString();
  return Number.isFinite(expires)&&expires>Date.now()&&v===String(version||'');
}
function setSession(res, version, req) {
  const expires=Date.now()+12*60*60*1000; const value=`${enc(expires)}.${enc(version||'')}`;
  const secure = req?.headers?.['x-forwarded-proto'] === 'https' || String(req?.headers?.host || '').startsWith('localhost') ? '; Secure' : '';
  res.setHeader('Set-Cookie',`${COOKIE}=${encodeURIComponent(value+'.'+sign(value))}; Path=/; HttpOnly${secure}; SameSite=Lax; Max-Age=43200`);
}
function clearSession(res) { res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`); }
async function accessConfig() {
  const {base}=config();
  const r=await fetch(`${base}/rest/v1/wedding_site_access_config?select=enabled,password_hash,updated_at&id=eq.1&limit=1`,{headers:headers(),cache:'no-store'});
  if(!r.ok) throw new Error(`Không đọc được cấu hình khóa thiệp (${r.status}). Hãy chạy SQL cập nhật.`);
  const rows=await r.json(); return rows[0]||{enabled:false,password_hash:'',updated_at:''};
}
async function isClientAllowed(req) {
  const cfg=await accessConfig();
  if(!cfg.enabled) return {ok:true,required:false};
  if(!cfg.password_hash) return {ok:false,required:true,unconfigured:true};
  return {ok:sessionValid(req,cfg.updated_at),required:true};
}
function clientKey(req) {
  const forwarded = process.env.VERCEL === '1' || process.env.TRUST_PROXY === 'true'
    ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    : '';
  const ip = forwarded || String(req.socket?.remoteAddress || 'unknown');
  return crypto.createHmac('sha256',ensureSessionSecret()).update(ip).digest('hex');
}
async function getLock(req) {
  const {base}=config(), key=clientKey(req);
  const r=await fetch(`${base}/rest/v1/wedding_site_access_attempts?select=failed_attempts,lock_until,lock_seconds&client_key=eq.${key}&limit=1`,{headers:headers(),cache:'no-store'});
  if(!r.ok) throw new Error('Không kiểm tra được trạng thái bảo mật.');
  const row=(await r.json())[0]; if(row?.lock_until && new Date(row.lock_until).getTime()>Date.now()) return Math.ceil((new Date(row.lock_until).getTime()-Date.now())/1000);
  return 0;
}
async function failAttempt(req) {
  const {base}=config(); const r=await fetch(`${base}/rest/v1/rpc/wedding_access_fail`,{method:'POST',headers:headers({'Content-Type':'application/json'}),body:JSON.stringify({p_client_key:clientKey(req)})});
  if(!r.ok) throw new Error('Không cập nhật được bộ đếm bảo mật.'); const data=await r.json(); return Number(data?.lock_seconds||0);
}
async function resetAttempts(req) {
  const {base}=config(); await fetch(`${base}/rest/v1/wedding_site_access_attempts?client_key=eq.${clientKey(req)}`,{method:'DELETE',headers:headers()});
}
function verifyPassword(password, stored) {
  const p=String(stored||'').split('$'); if(p.length!==4||p[1]!=='scrypt')return false;
  const salt=Buffer.from(p[2],'hex'), expected=Buffer.from(p[3],'hex');
  const actual=crypto.scryptSync(String(password),salt,expected.length); return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected);
}
function hashPassword(password) { const salt=crypto.randomBytes(16); const hash=crypto.scryptSync(String(password),salt,64); return `$scrypt$${salt.toString('hex')}$${hash.toString('hex')}`; }
module.exports={accessConfig,isClientAllowed,getLock,failAttempt,resetAttempts,verifyPassword,hashPassword,setSession,clearSession,ensureSessionSecret};
