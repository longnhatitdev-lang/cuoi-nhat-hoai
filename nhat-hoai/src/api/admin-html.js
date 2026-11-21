const { getSide, updateSideIfVersion } = require('../supabase-content');
const { send, auth, body } = require('../vercel-utils');
module.exports = async (req,res) => {
  const a=auth(req); if(!a.ok) return send(res,a.status,{error:a.error});
  const url=new URL(req.url,'https://local.invalid'); const side=url.searchParams.get('side')==='gai'?'gai':'nam';
  try {
    const row=await getSide(side); const content={...(row?.content||{})};
    if(req.method==='GET') return send(res,200,{ok:true,side,updatedAt:row?.updated_at||null});
    if(req.method!=='PUT') return send(res,405,{error:'Method Not Allowed'});
    const expected=String(req.headers['if-match']||'').replace(/^"|"$/g,'');
    if(!expected) return send(res,428,{error:'Thiếu phiên bản nội dung. Hãy tải lại Admin trước khi lưu.'});
    const action=String(req.headers['x-admin-action']||'');
    if(action==='undo') {
      if(typeof content.previousHtml!=='string') return send(res,400,{error:'Chưa có phiên bản trước để khôi phục.'});
      const old=content.html; content.html=content.previousHtml; content.previousHtml=old||content.previousHtml;
    } else if(action==='reset-all') {
      if(typeof content.originalHtml!=='string') return send(res,400,{error:'Chưa có bản gốc để khôi phục.'});
      content.previousHtml=content.html||''; content.html=content.originalHtml;
    } else {
      const html=await body(req,10*1024*1024);
      if(!html.includes('<html') || html.length>10*1024*1024) return send(res,400,{error:'HTML không hợp lệ hoặc vượt quá 10 MB.'});
      if(typeof content.originalHtml!=='string') content.originalHtml=html;
      if(typeof content.html==='string') content.previousHtml=content.html;
      content.html=html;
    }
    const saved=await updateSideIfVersion(side,content,expected);
    return send(res,200,{ok:true,side,updatedAt:saved.updated_at});
  } catch(e) {
    if(e.code==='VERSION_CONFLICT') return send(res,409,{error:e.message,code:e.code});
    console.error('Admin HTML save:',e);
    return send(res,500,{error:e.message||'Không lưu được nội dung.'});
  }
};
