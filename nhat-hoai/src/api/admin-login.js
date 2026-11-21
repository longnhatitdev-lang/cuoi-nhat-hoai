const crypto=require('node:crypto');
const {send,body}=require('../vercel-utils');
const {setSession,clearSession,originAllowed,validSession}=require('../admin-session');
const {config,headers}=require('../supabase-content');
function clientKey(req){
 const forwarded=process.env.VERCEL==='1'||process.env.TRUST_PROXY==='true'?String(req.headers['x-forwarded-for']||'').split(',')[0].trim():'';
 const ip=forwarded||String(req.socket?.remoteAddress||'unknown');
 const secret=String(process.env.ADMIN_SESSION_SECRET||process.env.ACCESS_SESSION_SECRET||'');
 if(secret.length<32)throw new Error('Cần cấu hình ADMIN_SESSION_SECRET tối thiểu 32 ký tự.');
 return crypto.createHmac('sha256',secret).update(ip).digest('hex');
}
async function checkLoginLimit(req){
 const {base}=config();
 const r=await fetch(`${base}/rest/v1/rpc/wedding_admin_login_check`,{method:'POST',headers:headers({'Content-Type':'application/json'}),body:JSON.stringify({p_client_key:clientKey(req)}),cache:'no-store'});
 if(!r.ok)throw new Error('Không kiểm tra được giới hạn đăng nhập Admin. Hãy chạy migration bảo mật Supabase.');
 const result=await r.json();return !!result?.allowed;
}
async function resetLoginLimit(req){
 const {base}=config();
 await fetch(`${base}/rest/v1/rpc/wedding_admin_login_reset`,{method:'POST',headers:headers({'Content-Type':'application/json'}),body:JSON.stringify({p_client_key:clientKey(req)}),cache:'no-store'});
}
function equal(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);}
module.exports=async(req,res)=>{
 if(req.method==='GET')return send(res,200,{authenticated:validSession(req)});
 if(req.method==='DELETE'){if(!originAllowed(req))return send(res,403,{error:'Yêu cầu không hợp lệ.'});clearSession(res,req);return send(res,200,{ok:true});}
 if(req.method!=='POST')return send(res,405,{error:'Method Not Allowed'});
 if(!originAllowed(req))return send(res,403,{error:'Nguồn gửi yêu cầu không hợp lệ.'});
 const expected=String(process.env.ADMIN_PASSWORD||'');if(!expected)return send(res,503,{error:'Chưa cấu hình ADMIN_PASSWORD.'});
 try{
  if(!await checkLoginLimit(req))return send(res,429,{error:'Bạn đã thử đăng nhập quá nhiều lần. Hãy chờ 10 phút.'});
  const data=JSON.parse(await body(req,4096));
  if(!equal(expected,data.password||''))return send(res,401,{error:'Sai mật khẩu quản trị.'});
  await resetLoginLimit(req);setSession(res,req);return send(res,200,{ok:true});
 }catch(e){console.error('Admin login:',e);return send(res,503,{error:e.message||'Không thể đăng nhập Admin.'});}
};
