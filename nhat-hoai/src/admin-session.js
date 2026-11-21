const crypto = require('node:crypto');
const COOKIE = 'lcln_admin_session';
const TTL_SECONDS = 8 * 60 * 60;
function secret() {
  const value = String(process.env.ADMIN_SESSION_SECRET || process.env.ACCESS_SESSION_SECRET || '');
  if (value.length < 32) throw new Error('Cần cấu hình ADMIN_SESSION_SECRET hoặc ACCESS_SESSION_SECRET tối thiểu 32 ký tự.');
  return value;
}
function sign(value) { return crypto.createHmac('sha256', secret()).update(value).digest('base64url'); }
function safeEqual(a, b) { const x=Buffer.from(String(a)); const y=Buffer.from(String(b)); return x.length===y.length && crypto.timingSafeEqual(x,y); }
function readCookie(req) {
  const raw=String(req.headers.cookie||'');
  const match=raw.match(new RegExp('(?:^|;\\s*)'+COOKIE+'=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : '';
}
function validSession(req) {
  const token=readCookie(req); const parts=token.split('.');
  if(parts.length!==2) return false;
  const payload=parts[0];
  let expected; try { expected=sign(payload); } catch { return false; }
  if(!safeEqual(expected,parts[1])) return false;
  let data; try { data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8')); } catch { return false; }
  return !!data && data.exp > Date.now() && data.v === 1;
}
function setSession(res, req) {
  const payload=Buffer.from(JSON.stringify({v:1,exp:Date.now()+TTL_SECONDS*1000,nonce:crypto.randomBytes(12).toString('hex')})).toString('base64url');
  const secure=req?.headers?.['x-forwarded-proto']==='https' ? '; Secure' : '';
  res.setHeader('Set-Cookie',`${COOKIE}=${payload}.${sign(payload)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${TTL_SECONDS}${secure}`);
}
function clearSession(res, req) {
  const secure=req?.headers?.['x-forwarded-proto']==='https' ? '; Secure' : '';
  res.setHeader('Set-Cookie',`${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}
function originAllowed(req) {
  const origin=req.headers.origin;
  if(!origin) return true; // server-to-server requests do not carry browser cookies by default
  try {
    const parsed=new URL(origin);
    const host=String(req.headers.host||'');
    const forwardedProto=String(req.headers['x-forwarded-proto']||'').split(',')[0].trim();
    return parsed.host===host && (!forwardedProto || parsed.protocol===`${forwardedProto}:`);
  } catch { return false; }
}
module.exports={validSession,setSession,clearSession,originAllowed};
