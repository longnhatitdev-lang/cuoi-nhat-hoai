(()=>{
'use strict';
const $=s=>document.querySelector(s),gallery=$('#gallery'),viewer=$('#viewer'),large=$('#large'),count=$('#count'),number=$('#number'),auto=$('#auto'),direction=$('#direction');
let images=[],index=0,playing=false,dir=1,timer=null,touchX=0,touchY=0;
const label=()=>{number.textContent=`${String(index+1).padStart(2,'0')} / ${String(images.length).padStart(2,'0')}`;direction.textContent=`Hướng: ${dir>0?'Sang phải':'Sang trái'}`};
function preload(){[-1,1].forEach(d=>{const im=new Image();im.src=images[(index+d+images.length)%images.length]})}
function show(i){if(!images.length)return;index=(i+images.length)%images.length;large.style.opacity='0.55';large.src=images[index];large.onload=()=>{large.style.opacity='1'};label();preload()}
function step(){show(index+dir)}
function stop(){playing=false;clearInterval(timer);timer=null;auto.classList.remove('on');auto.textContent='▶ Tự động: Tắt'}
function start(){if(images.length<2)return;clearInterval(timer);playing=true;auto.classList.add('on');auto.textContent='Ⅱ Tự động: Bật';timer=setInterval(step,3600)}
function resetTimer(){if(playing)start()}
function open(i){stop();show(i);viewer.classList.add('open');viewer.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';$('#close').focus({preventScroll:true})}
function close(){stop();viewer.classList.remove('open');viewer.setAttribute('aria-hidden','true');document.body.style.overflow='';gallery.querySelector(`[data-index="${index}"]`)?.focus({preventScroll:true})}
$('#close').onclick=close;$('#prev').onclick=()=>{dir=-1;show(index-1);resetTimer()};$('#next').onclick=()=>{dir=1;show(index+1);resetTimer()};auto.onclick=()=>playing?stop():start();
viewer.addEventListener('click',e=>{if(e.target===viewer)close()});
document.addEventListener('keydown',e=>{if(!viewer.classList.contains('open'))return;if(e.key==='Escape')close();if(e.key==='ArrowRight'){dir=1;show(index+1);resetTimer()}if(e.key==='ArrowLeft'){dir=-1;show(index-1);resetTimer()}});
viewer.addEventListener('touchstart',e=>{touchX=e.changedTouches[0].clientX;touchY=e.changedTouches[0].clientY;stop()},{passive:true});
viewer.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-touchX,dy=e.changedTouches[0].clientY-touchY;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){dir=dx<0?1:-1;show(index+dir)}},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop()});
fetch('/api/album-images',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('api');return r.json()}).then(data=>{images=[...new Set(data.images||[])];count.textContent=`${images.length} TÁC PHẨM`;if(!images.length){$('#empty').hidden=false;return}gallery.innerHTML=images.map((src,i)=>`<button class="tile" type="button" data-index="${i}" aria-label="Mở ảnh ${i+1}"><img loading="lazy" decoding="async" src="${src.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" alt="Khoảnh khắc cưới ${i+1}"></button>`).join('');gallery.addEventListener('click',e=>{const tile=e.target.closest('[data-index]');if(tile)open(Number(tile.dataset.index))})}).catch(()=>{if(document.cookie.indexOf('lcln_access=')<0){location.replace('/access?next=%2Falbum');return}count.textContent='KHÔNG THỂ TẢI ALBUM';$('#empty').hidden=false});
})();
