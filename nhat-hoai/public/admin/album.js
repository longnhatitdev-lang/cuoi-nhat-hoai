(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  let side = 'nam', items = [], version = ''; 
  const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  async function api(url, opt = {}) {
    const r = await fetch(url, {credentials:'same-origin', ...opt, headers:{...(opt.headers||{})}});
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(d.error || 'Lỗi máy chủ');
    return d;
  }
  const post = (url, method, data) => api(url, {method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(data)});
  const say = (t) => { $('#status').textContent = t; };
  // Chuyển WebP ngay trên trình duyệt, giữ nguyên width/height pixel, không resize hoặc crop.
  async function shrink(file) {
    if (!file || !file.type.startsWith('image/')) throw Error('Vui lòng chọn tệp ảnh hợp lệ.');
    let source, width, height, cleanup=()=>{};
    if (typeof createImageBitmap === 'function') {
      try {
        let bitmap;
        try { bitmap=await createImageBitmap(file,{imageOrientation:'from-image'}); }
        catch { bitmap=await createImageBitmap(file); }
        source=bitmap; width=bitmap.width; height=bitmap.height;
        cleanup=()=>bitmap.close && bitmap.close();
      } catch (_) { /* dùng fallback HTMLImageElement */ }
    }
    if (!source) {
      const objectUrl=URL.createObjectURL(file);
      try {
        source=await new Promise((resolve,reject)=>{
          const img=new Image(); img.onload=()=>resolve(img);
          img.onerror=()=>reject(Error('Không đọc được ảnh này. Hãy chuyển sang JPG hoặc PNG rồi thử lại.'));
          img.src=objectUrl;
        });
        width=source.naturalWidth; height=source.naturalHeight;
        cleanup=()=>URL.revokeObjectURL(objectUrl);
      } catch(error) { URL.revokeObjectURL(objectUrl); throw error; }
    }
    try {
      if(!width||!height) throw Error('Kích thước ảnh không hợp lệ.');
      const canvas=document.createElement('canvas');
      canvas.width=width; canvas.height=height;
      const ctx=canvas.getContext('2d',{alpha:true});
      if(!ctx) throw Error('Trình duyệt không hỗ trợ xử lý ảnh.');
      ctx.drawImage(source,0,0,width,height);
      const encode=q=>new Promise((resolve,reject)=>canvas.toBlob(blob=>{
        if(!blob||blob.type!=='image/webp') return reject(Error('Không thể xuất ảnh WebP trên trình duyệt này.'));
        resolve(blob);
      },'image/webp',q));
      let blob=await encode(.84);
      if(blob.size>8*1024*1024) blob=await encode(.76);
      if(blob.size>28*1024*1024) throw Error('Ảnh WebP vẫn vượt giới hạn 28 MB. Hãy chọn ảnh khác; kích thước pixel không bị thay đổi.');
      return blob;
    } finally { cleanup(); }
  }
  async function uploadAsset(blob, cat='wed') {
    const ticket=await post('/api/admin-upload','POST',{intent:'signed-upload',mime:blob.type,cat});
    const uploaded=await fetch(ticket.uploadUrl,{method:'PUT',headers:{'Content-Type':blob.type},body:blob});
    if(!uploaded.ok) throw Error('Supabase Storage từ chối tệp tải lên. Hãy kiểm tra bucket và quyền Storage.');
    return ticket.url;
  }
  function draw() {
    const grid=$('#grid');
    grid.innerHTML=items.map((x,i)=>`<article class="manage-card"><img src="${esc(x.url)}" alt="Ảnh album ${i+1}" loading="lazy"><div class="fields"><label class="notice">Chú thích ảnh<input data-caption="${i}" maxlength="180" value="${esc(x.caption||'')}" placeholder="Nhập chú thích (không bắt buộc)"></label><div class="row"><span class="notice">Ảnh ${String(i+1).padStart(2,'0')}</span><div style="display:flex;gap:6px"><label class="action" style="padding:7px 10px">Thay ảnh<input data-replace="${i}" type="file" accept="image/*" hidden></label><button class="delete" data-delete="${i}">Xóa</button></div></div></div></article>`).join('');
    $('#empty').hidden=items.length>0;
    grid.querySelectorAll('[data-caption]').forEach(el=>el.oninput=()=>{items[Number(el.dataset.caption)].caption=el.value;});
    grid.querySelectorAll('[data-delete]').forEach(el=>el.onclick=()=>{items.splice(Number(el.dataset.delete),1);draw();});
    grid.querySelectorAll('[data-replace]').forEach(el=>el.onchange=async()=>{
      const file=el.files[0]; if(!file)return;
      try { say('Đang chuyển ảnh thay thế sang WebP (giữ nguyên kích thước)…'); const webpBlob=await shrink(file); const url=await uploadAsset(webpBlob,'wed'); items[Number(el.dataset.replace)].url=url; draw(); say('Đã thay ảnh WebP, giữ nguyên kích thước. Nhấn Lưu thay đổi để xuất bản.'); }
      catch(e){say(e.message);}
    });
  }
  async function load(){
    say('Đang tải…');
    try { const data=await api(`/api/admin-album?side=${side}`); items=data.images||[]; version=data.updatedAt||''; draw(); say(`${items.length} ảnh`); }
    catch(e){say(e.message);}
  }
  document.querySelectorAll('[data-side]').forEach(button=>button.onclick=()=>{
    side=button.dataset.side;
    document.querySelectorAll('[data-side]').forEach(x=>x.classList.toggle('active',x===button));
    load();
  });
  $('#refresh').onclick=load;
  $('#save').onclick=async()=>{
    try { const result=await api(`/api/admin-album?side=${side}`,{method:'PUT',headers:{'Content-Type':'application/json','If-Match':version},body:JSON.stringify({images:items})}); version=result.updatedAt||version; say('Đã lưu album ✓'); }
    catch(e){say(e.message);}
  };
  $('#files').onchange=async e=>{
    const files=[...e.target.files];
    for(const file of files){
      try { say(`Đang chuyển ${file.name} sang WebP…`); const webpBlob=await shrink(file); const url=await uploadAsset(webpBlob,'wed'); items.push({id:`img_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,url,caption:''}); }
      catch(err){say(err.message);break;}
    }
    draw(); say('Đã thêm ảnh WebP, giữ nguyên kích thước. Nhấn “Lưu thay đổi” để xuất bản.'); e.target.value='';
  };
  api('/api/admin-login').then(state=>{if(!state.authenticated) location.replace('/admin'); else load();}).catch(()=>location.replace('/admin'));
})();
