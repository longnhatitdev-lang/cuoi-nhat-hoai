const {send,auth}=require('../vercel-utils');
const {accessConfig,setSession}=require('../access-control');
module.exports=async(req,res)=>{const a=auth(req);if(!a.ok)return send(res,a.status,{error:a.error});if(req.method!=='POST')return send(res,405,{error:'Method Not Allowed'});try{const cfg=await accessConfig();if(cfg.enabled&&cfg.password_hash)setSession(res,cfg.updated_at,req);return send(res,200,{ok:true})}catch(e){return send(res,503,{error:e.message||'Không thể tạo phiên xem trước.'})}};
