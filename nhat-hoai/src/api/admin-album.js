const fs=require('node:fs/promises');
const path=require('node:path');
const {getSide,updateSideIfVersion}=require('../supabase-content');
const {send,auth,body}=require('../vercel-utils');
module.exports=async(req,res)=>{
 const a=auth(req);if(!a.ok)return send(res,a.status,{error:a.error});
 const u=new URL(req.url,'https://local.invalid');const side=u.searchParams.get('side')==='gai'?'gai':'nam';
 try{
  const row=await getSide(side);const content={...(row?.content||{})};const images=Array.isArray(content.albumImages)?content.albumImages:[];
  if(req.method==='GET'){
   if(Array.isArray(content.albumImages))return send(res,200,{side,images,updatedAt:row?.updated_at||null});
   const html=typeof content.html==='string'?content.html:await fs.readFile(path.join(process.cwd(),'client',`index-${side}.html`),'utf8');
   const urls=new Set();const add=v=>{v=String(v||'').trim().replace(/&amp;/g,'&');const imagePath=v.split(/[?#]/)[0];if(v.startsWith('./'))v='/'+v.slice(2);if(/\.(png|jpe?g|webp|gif|avif)$/i.test(imagePath)&&(/^https:\/\//i.test(v)||/(asset\/img|uploads\/|\/uploads\/)/i.test(imagePath)))urls.add(v)};
   for(const m of html.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi))add(m[1]);
   for(const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi))add(m[1]);
   return send(res,200,{side,images:[...urls].map((url,i)=>({id:`legacy_${i}`,url,caption:''})),updatedAt:row?.updated_at||null});
  }
  if(req.method!=='PUT')return send(res,405,{error:'Method Not Allowed'});
  const expected=String(req.headers['if-match']||'').replace(/^"|"$/g,'');if(!expected)return send(res,428,{error:'Thiếu phiên bản album. Hãy tải lại album trước khi lưu.'});
  const data=JSON.parse(await body(req,1024*1024));if(!Array.isArray(data.images)||data.images.length>1000)return send(res,400,{error:'Danh sách album không hợp lệ.'});
  const clean=data.images.map((x,i)=>({id:String(x.id||`img_${Date.now()}_${i}`).slice(0,100),url:String(x.url||'').slice(0,2048),caption:String(x.caption||'').slice(0,180),position:i}));
  if(clean.some(x=>!/^https:\/\//i.test(x.url)&&!/^\/(?:uploads|asset)\//.test(x.url)))return send(res,400,{error:'Đường dẫn ảnh không hợp lệ.'});
  content.albumImages=clean;
  const saved=await updateSideIfVersion(side,content,expected);
  return send(res,200,{ok:true,images:clean,updatedAt:saved.updated_at});
 }catch(e){if(e.code==='VERSION_CONFLICT')return send(res,409,{error:e.message,code:e.code});return send(res,500,{error:e.message||'Không lưu được album.'});}
};
