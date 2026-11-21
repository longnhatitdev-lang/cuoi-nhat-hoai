const {send,body}=require('../vercel-utils');
const {accessConfig,isClientAllowed,getLock,failAttempt,resetAttempts,verifyPassword,setSession,clearSession}=require('../access-control');
module.exports=async(req,res)=>{
 try{
  if(req.method==='GET'){
   const cfg=await accessConfig(); if(!cfg.enabled)return send(res,200,{required:false,authorized:true});
   const state=await isClientAllowed(req); return send(res,200,{required:true,authorized:state.ok,unconfigured:!!state.unconfigured});
  }
  if(req.method==='DELETE'){clearSession(res);return send(res,200,{ok:true});}
  if(req.method!=='POST')return send(res,405,{error:'Method Not Allowed'});
  const cfg=await accessConfig(); if(!cfg.enabled)return send(res,200,{ok:true,required:false});
  const locked=await getLock(req); if(locked>0)return send(res,429,{error:`Bạn đã nhập sai quá số lần cho phép. Vui lòng đợi ${locked} giây.`,retryAfter:locked},{'Retry-After':String(locked)});
  const data=JSON.parse(await body(req,4096));
  if(!verifyPassword(data.password,cfg.password_hash)){
   const seconds=await failAttempt(req);
   return send(res,401,{error:seconds?`Bạn đã nhập sai 3 lần. Tạm khóa ${seconds} giây.`:'Mật khẩu không đúng. Bạn còn số lần thử trong lượt này.',retryAfter:seconds});
  }
  await resetAttempts(req);setSession(res,cfg.updated_at,req);return send(res,200,{ok:true});
 }catch(e){return send(res,503,{error:e.message||'Không thể xác thực lúc này.'});}
};
