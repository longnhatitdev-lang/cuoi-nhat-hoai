// ==========================================
// PREMIUM LOADING: mạng chậm, ảnh tải muộn
// ==========================================
(function () {
  const loader = document.getElementById("lcln-page-loader");
  const images = [...document.images];
  let pendingCritical = 0;
  let domReady = document.readyState !== "loading";
  let shown = false;
  let finished = false;
  let showTimer = 0;
  const label = loader && loader.querySelector(".lcln-loader-label");

  function hideLoader() {
    if (!loader || finished) return;
    finished = true;
    clearTimeout(showTimer);
    loader.hidden = true;
    window.setTimeout(() => loader.remove(), 500);
  }
  function maybeFinish() {
    if (domReady && pendingCritical <= 0) hideLoader();
  }
  function imageDone(img, ok) {
    img.classList.remove("lcln-img-pending");
    img.classList.add(ok ? "lcln-img-ready" : "lcln-img-error");
    if (img.dataset.lclnCritical === "1") {
      img.dataset.lclnCritical = "0";
      pendingCritical = Math.max(0, pendingCritical - 1);
      maybeFinish();
    }
  }

  images.forEach((img) => {
    const lazy = img.loading === "lazy";
    if (!img.complete || img.naturalWidth === 0) {
      img.classList.add("lcln-img-pending");
      if (!lazy) { img.dataset.lclnCritical = "1"; pendingCritical++; }
      img.addEventListener("load", () => imageDone(img, true), { once: true });
      img.addEventListener("error", () => imageDone(img, false), { once: true });
    } else {
      img.classList.add("lcln-img-ready");
    }
  });

  if (loader) {
    showTimer = window.setTimeout(() => {
      if (finished) return;
      shown = true;
      loader.hidden = false;
      if (label) label.textContent = pendingCritical > 0 ? "Đang tải ảnh và hiệu ứng…" : "Đang chuẩn bị thiệp cưới…";
    }, 240);
    document.addEventListener("DOMContentLoaded", () => {
      domReady = true;
      maybeFinish();
    }, { once: true });
    // Không che trang vô thời hạn nếu một tài nguyên bị máy chủ treo.
    window.setTimeout(hideLoader, 9000);
  }

  // Các ảnh được thêm sau khi Admin thay đổi DOM cũng có shimmer khi tải.
  if ("MutationObserver" in window) {
    const observer = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) return;
      const added = [...(node.matches("img") ? [node] : []), ...node.querySelectorAll("img")];
      added.forEach((img) => {
        if (img.complete && img.naturalWidth > 0) return;
        img.classList.add("lcln-img-pending");
        img.addEventListener("load", () => imageDone(img, true), { once: true });
        img.addEventListener("error", () => imageDone(img, false), { once: true });
      });
    })));
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();

// ==========================================
// XỬ LÝ NHẠC NỀN (AUTOPLAY + TẮT KHI RỜI TRANG)
// ==========================================
document.addEventListener("DOMContentLoaded", function () {
  const audio = document.getElementById("my_audio");
  const audioPlayBtn = document.getElementById("audio_play");
  const wrap = document.getElementById("wrap");

  if (!audio) return;

  let isManuallyPaused = false; // Cờ kiểm tra người dùng có cố tình bấm dừng nhạc không

  // Hàm phát nhạc
  function playAudio() {
    if (audio.paused && !isManuallyPaused) {
      audio
        .play()
        .then(() => {
          if (audioPlayBtn) audioPlayBtn.classList.add("playing");
          removeGlobalUnlockEvents();
        })
        .catch((error) => console.log("Lỗi phát nhạc:", error));
    }
  }

  // Hàm tạm dừng nhạc
  function pauseAudio() {
    if (!audio.paused) {
      audio.pause();
      if (audioPlayBtn) audioPlayBtn.classList.remove("playing");
    }
  }

  // 1. Kích hoạt nhạc KHI BẤM MỞ THIỆP
  if (wrap) {
    wrap.addEventListener("click", () => {
      isManuallyPaused = false;
      playAudio();
    });
  }

  // 2. Dự phòng: Mở nhạc khi có tương tác đầu tiên trên trang
  function unlockAudioOnInteraction() {
    playAudio();
  }

  function addGlobalUnlockEvents() {
    ["pointerdown", "touchstart", "click"].forEach((evt) => {
      document.addEventListener(evt, unlockAudioOnInteraction, {
        once: true,
        capture: true,
      });
    });
  }

  function removeGlobalUnlockEvents() {
    ["pointerdown", "touchstart", "click"].forEach((evt) => {
      document.removeEventListener(evt, unlockAudioOnInteraction, {
        capture: true,
      });
    });
  }

  addGlobalUnlockEvents();

  // 3. Nút Bật/Tắt nhạc trực tiếp
  if (audioPlayBtn) {
    audioPlayBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (audio.paused) {
        isManuallyPaused = false;
        playAudio();
      } else {
        isManuallyPaused = true; // Người dùng chủ động tắt -> Không tự phát lại khi chuyển tab
        pauseAudio();
      }
    });
  }

  // =========================================================
  // XỬ LÝ TẮT NHẠC KHI RỜI TRANG / THOÁT TAB / KHÓA MÀN HÌNH
  // =========================================================

  // A. Khi ẩn/hiện Tab (Page Visibility API)
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseAudio(); // Ẩn tab / Rời trang -> Tắt nhạc
    } else {
      playAudio(); // Quay lại tab -> Tự phát tiếp (nếu trước đó không bấm tắt thủ công)
    }
  });

  // B. Dự phòng khi chuyển cửa sổ trình duyệt (Window Blur / Focus)
  window.addEventListener("blur", pauseAudio);
  window.addEventListener("focus", () => {
    if (!document.hidden) playAudio();
  });

  // C. Tắt nhạc triệt để khi đóng hẳn trang hoặc chuyển hướng link
  window.addEventListener("pagehide", pauseAudio);
});

// Đếm ngược ngày cưới
// Countdown — đọc lại data-wedding-date MỖI giây để sửa trực tiếp từ
// trang quản trị có hiệu lực ngay, và giá trị đã sửa được ghi xuống HTML.
document.addEventListener("DOMContentLoaded", function () {
  const card = document.querySelector(".countdown-card");
  if (!card) return;
  const titleEl = card.querySelector(".countdown-title");
  const DEFAULT_TITLE = (titleEl && titleEl.textContent.trim()) || "";
  const DEFAULT_DATE = card.dataset.weddingDate || "2026-12-28T08:00:00";

  function resolveTarget() {
    // Ưu tiên giá trị đang sửa trên thẻ, sau đó mới tới thuộc tính,
    // rồi tới mặc định (hỗ trợ cả định dạng "2026-12-28T08:00" không có giây).
    const raw =
      (card.dataset.weddingDate && card.dataset.weddingDate.trim()) ||
      DEFAULT_DATE;
    let value = new Date(raw).getTime();
    if (Number.isNaN(value)) value = new Date(DEFAULT_DATE).getTime();
    return value;
  }

  let target = resolveTarget();
  let lastRaw = card.dataset.weddingDate || "";

  function updateCountdown() {
    // Phát hiện thay đổi từ trang admin -> tính lại mốc thời gian ngay
    const raw = card.dataset.weddingDate || "";
    if (raw !== lastRaw) {
      lastRaw = raw;
      target = resolveTarget();
      if (titleEl && DEFAULT_TITLE) titleEl.textContent = DEFAULT_TITLE;
    }
    const left = target - Date.now();
    if (left < 0) {
      if (titleEl) titleEl.textContent = "Đã diễn ra lễ cưới!";
      return;
    }
    const values = [
      Math.floor(left / 86400000),
      Math.floor((left % 86400000) / 3600000),
      Math.floor((left % 3600000) / 60000),
      Math.floor((left % 60000) / 1000),
    ];
    ["days", "hours", "minutes", "seconds"].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(values[i]).padStart(2, "0");
    });
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);
});

// Hiệu ứng mưa biểu tượng nền
const CONFIG = {
  PARTICLE_COUNT: window.matchMedia("(max-width: 600px)").matches ? 24 : 50, // ít hạt hơn trên điện thoại cho đỡ nóng máy
  FALL_SPEED_MIN: 0.5,
  FALL_SPEED_RANDOM: 1.2,
  GRAVITY: 0.0015,
  POINTER_RADIUS: 100,
  METEOR_SPEED_X: 10,
  METEOR_SPEED_Y: 7,
};
const ICON_LIST = ["❤️", "💕", "💖", "💗", "💓", "✨", "🌸", "🌹"];
function createEmojiSprite(emoji, size) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  context.font = `${size - 2}px serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(emoji, size / 2, size / 2);
  return canvas;
}
const rainCanvas = document.getElementById("rainCanvas");
const rainContext = rainCanvas?.getContext("2d", { alpha: true });
let screenWidth = window.innerWidth;
let screenHeight = window.innerHeight;
function resizeScreen() {
  if (!rainCanvas) return;
  screenWidth = rainCanvas.width = window.innerWidth;
  screenHeight = rainCanvas.height = window.innerHeight;
}
resizeScreen();
window.addEventListener("resize", resizeScreen);

const emojiSprites = ICON_LIST.map((e) => createEmojiSprite(e, 36));

const pointer = {
  x: -1000,
  y: -1000,
  lastX: -1000,
  lastY: -1000,
  velocityX: 0,
  velocityY: 0,
  radius: CONFIG.POINTER_RADIUS,
  radiusSq: CONFIG.POINTER_RADIUS * CONFIG.POINTER_RADIUS,
  isActive: false,
};
const updatePointer = (x, y) => {
  pointer.lastX = pointer.x;
  pointer.lastY = pointer.y;
  pointer.x = x;
  pointer.y = y;
  pointer.velocityX = x - pointer.lastX;
  pointer.velocityY = y - pointer.lastY;
  pointer.isActive = true;
  clearTimeout(pointer.hideTimer);
  pointer.hideTimer = setTimeout(() => (pointer.isActive = false), 120);
};
addEventListener("mousemove", (e) => updatePointer(e.clientX, e.clientY), {
  passive: true,
});
// Chỉ cập nhật vị trí con trỏ để đẩy hạt mưa.
// TUYỆT ĐỐI không preventDefault ở đây: preventDefault trên touchmove sẽ
// khoá cuộn trang và khoá cuộn danh sách lời chúc trên điện thoại.
addEventListener("touchmove", (e) => {
  const t = e.touches && e.touches[0];
  if (t) updatePointer(t.clientX, t.clientY);
}, { passive: true });
addEventListener("pointermove", (e) => {
  if (e.pointerType !== "touch") updatePointer(e.clientX, e.clientY);
}, { passive: true });

class RainParticle {
  constructor() {
    this.reset(true);
  }
  reset(isFirst = false) {
    this.sprite = emojiSprites[(Math.random() * emojiSprites.length) | 0];
    this.x = Math.random() * screenWidth;
    this.y = isFirst ? Math.random() * screenHeight : -50;
    this.velocityX = (Math.random() - 0.5) * 0.8;
    this.velocityY =
      Math.random() * CONFIG.FALL_SPEED_RANDOM + CONFIG.FALL_SPEED_MIN;
    this.scale = Math.random() * 0.3 + 0.85;
  }
  update() {
    const dx = this.x - pointer.x,
      dy = this.y - pointer.y,
      distSq = dx * dx + dy * dy;
    if (distSq < pointer.radiusSq) {
      const dist = Math.sqrt(distSq) || 1;
      const force = (pointer.radius - dist) / pointer.radius;
      const nx = dx / dist,
        ny = dy / dist;
      this.velocityX += nx * force * 2.5 + pointer.velocityX * 0.3 * force;
      this.velocityY += ny * force * 2.5 + pointer.velocityY * 0.3 * force;
      this.x += nx * force * 5;
      this.y += ny * force * 5;
    }
    this.velocityX *= 0.985;
    this.velocityY += CONFIG.GRAVITY;
    this.x += this.velocityX;
    this.y += this.velocityY;
    if (this.y > screenHeight + 60) this.reset();
  }
  draw(ctx) {
    ctx.drawImage(
      this.sprite,
      this.x,
      this.y,
      this.sprite.width * this.scale,
      this.sprite.height * this.scale,
    );
  }
}
class ShootingStar {
  constructor() {
    this.isAlive = false;
  }
  launch() {
    this.isAlive = true;
    this.x = Math.random() * screenWidth * 0.4 - 100;
    this.y = -20;
    this.velocityX = CONFIG.METEOR_SPEED_X + Math.random() * 6;
    this.velocityY = CONFIG.METEOR_SPEED_Y + Math.random() * 4;
    this.trailLength = 0;
    this.life = 1;
  }
  update() {
    if (!this.isAlive) return;
    this.x += this.velocityX;
    this.y += this.velocityY;
    this.trailLength = Math.min(200, this.trailLength + 12);
    this.velocityX *= 1.008;
    this.velocityY *= 1.008;
    if (
      this.x > screenWidth + 300 ||
      this.y > screenHeight + 300 ||
      this.life <= 0
    )
      this.isAlive = false;
  }
  draw(ctx) {
    if (!this.isAlive) return;
    ctx.save();
    ctx.globalAlpha = this.life;
    const grad = ctx.createLinearGradient(
      this.x,
      this.y,
      this.x - this.trailLength,
      this.y - this.trailLength * 0.5,
    );
    grad.addColorStop(0, "#fff");
    grad.addColorStop(1, "transparent");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.trailLength, this.y - this.trailLength * 0.5);
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
const rainParticles = Array.from(
  { length: CONFIG.PARTICLE_COUNT },
  () => new RainParticle(),
);
const shootingStars = [new ShootingStar(), new ShootingStar()];
setInterval(() => {
  const dead = shootingStars.find((s) => !s.isAlive);
  if (dead && Math.random() < 0.7) dead.launch();
}, 2500);
shootingStars[0].launch();

function renderLoop() {
  if (!window.isPageActive) {
    window.globalAnimationFrameId = null;
    return;
  }
  rainContext.clearRect(0, 0, screenWidth, screenHeight);
  for (const p of rainParticles) {
    p.update();
    p.draw(rainContext);
  }
  for (const s of shootingStars) {
    s.update();
    s.draw(rainContext);
  }
  window.globalAnimationFrameId = requestAnimationFrame(renderLoop);
}
if (rainContext) {
  window.globalAnimationFrameId = requestAnimationFrame(renderLoop);
  window.resumeRain = () => {
    if (!window.globalAnimationFrameId) renderLoop();
  };
}

//hộp quà
const modalH = document.getElementById("qrModal");
document.getElementById("giftBox").onclick = () => modalH.classList.add("show");
document.getElementById("hintId").onclick = () => modalH.classList.add("show");
function closeGift() {
  modalH.classList.remove("show");
}
//  click ngoài  đóng
modalH.onclick = (e) => {
  if (e.target === modalH) closeGift();
};
async function copy(id, btn) {
  const txt = document.getElementById(id).innerText;
  await navigator.clipboard.writeText(txt);
  const old = btn.innerText;
  btn.innerText = "Đã copy STK";
  setTimeout(() => (btn.innerText = old), 2000);
}
// tải thẳng về máy
async function dl(id, name, btn) {
  const src = document.getElementById(id).src;
  const res = await fetch(src);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `QR-${name}.png`;
  a.click();
  btn.innerText = "Đã tải mã QR";
  URL.revokeObjectURL(url);
}

// ==========================================
// INTRO THIỆP: nhấn giữ 3 giây -> lật thẻ -> mở phong bì -> rèm -> vào thiệp
// ==========================================
(() => {
'use strict';
const intro = document.getElementById('lcln-in-weddingIntro');
if (!intro) return;
const HOLD_TIME = 3000;
const isMobile = matchMedia('(max-width:600px), (pointer:coarse)').matches;
const rand = (a, b) => Math.random() * (b - a) + a;
const pick = arr => arr[(Math.random() * arr.length) | 0];
const delay = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);
const body = document.body;
const flipWrapper = $('lcln-in-flipWrapper'), flipper = $('lcln-in-flipper'), invitation = $('lcln-in-invitation'),
      insideCard = $('lcln-in-insideCard'), water = $('lcln-in-waterGroupFront'), holdGlow = $('lcln-in-holdGlow'),
      curtain = $('lcln-in-screenCurtain'), curtainTop = $('lcln-in-curtainTop'), heartLayer = $('lcln-in-heartLayer');
body.classList.add('lcln-in-intro-active');

function waitFor(el, type, prop, fallback) {
    return new Promise(resolve => {
        let done = false, timer;
        const finish = () => { if (done) return; done = true; clearTimeout(timer); el.removeEventListener(type, handler); resolve(); };
        const handler = e => { if (e.target === el && (e.propertyName || e.animationName) === prop) finish(); };
        el.addEventListener(type, handler);
        timer = setTimeout(finish, fallback);
    });
}

const avatarImg = $('lcln-in-avatarImg');
avatarImg.onerror = () => {
    avatarImg.onerror = null;
    avatarImg.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#f3d9c0"/><text x="50" y="66" font-size="52" text-anchor="middle" fill="#a50d2b">&#9829;</text></svg>');
};

if (avatarImg.complete && avatarImg.naturalWidth === 0) avatarImg.onerror(); // ảnh lỗi trước khi script chạy vẫn có ảnh dự phòng
(function createAmbient() {
    const count = isMobile ? 8 : 16, symbols = ['\u2665\uFE0E', '\u2726', '\u2740'], frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        const el = document.createElement('span');
        el.className = 'lcln-in-ambient-item';
        el.textContent = pick(symbols);
        el.style.cssText = `--x:${rand(2, 98)}%;--y:${rand(5, 100)}%;--size:${rand(12, 22)}px;--opacity:${rand(.3, .7)};--duration:${rand(7, 12)}s;--delay:${rand(-12, 0)}s;--drift:${rand(-60, 60)}px`;
        frag.appendChild(el);
    }
    $('lcln-in-ambientParticles').appendChild(frag);
})();

// Hạt tim: object pool + Web Animations API
const HEART_SYMBOLS = ['\u2665\uFE0E', '\u2665\uFE0E', '\u2726', '\u2740'];
const HEART_COLORS = ['#ff174f', '#ff527b', '#ff8da5', '#ffd2dc', '#fff1d0'];
const heartPool = [];
(function buildPool() {
    const n = isMobile ? 18 : 32, frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) { const el = document.createElement('span'); el.className = 'lcln-in-heart-particle'; frag.appendChild(el); heartPool.push(el); }
    heartLayer.appendChild(frag);
})();
function spawnHeart(x, y) {
    const el = heartPool.pop();
    if (!el) return;
    const sx = x + rand(-30, 30), sy = y + rand(-18, 18), o = rand(.65, 1);
    el.textContent = pick(HEART_SYMBOLS);
    el.style.fontSize = rand(16, 26) + 'px';
    el.style.color = pick(HEART_COLORS);
    el.animate([
        { transform: `translate3d(${sx}px,${sy}px,0) scale(.4) rotate(0deg)`, opacity: 0 },
        { opacity: o, offset: .15 }, { opacity: o, offset: .75 },
        { transform: `translate3d(${sx + rand(-80, 80)}px,${sy - rand(160, 280)}px,0) scale(.6) rotate(${rand(-160, 160)}deg)`, opacity: 0 }
    ], { duration: rand(1400, 2100), easing: 'cubic-bezier(.18,.8,.2,1)' }).onfinish = () => heartPool.push(el);
}
function heartBurst(x, y, count) { for (let i = 0; i < count; i++) setTimeout(() => spawnHeart(x, y), i * 35); }

// Bụi lấp lánh (canvas, chỉ chạy khi rèm hiện)
const sCanvas = $('lcln-in-sparkleCanvas'), sCtx = sCanvas.getContext('2d');
function makeSprite(rgb) {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'), grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, `rgba(${rgb},1)`); grad.addColorStop(.25, `rgba(${rgb},.8)`); grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
    return c;
}
const sprites = [makeSprite('255,255,255'), makeSprite('255,215,0')];
let sparkles = [], sparkRaf = 0;
function resizeSparkle() { sCanvas.width = innerWidth; sCanvas.height = innerHeight; }
function newSparkle(randomY) {
    return { x: rand(0, sCanvas.width), y: randomY ? rand(0, sCanvas.height) : sCanvas.height + 10, size: rand(6, 14), vy: -rand(.3, 1.1), phase: rand(0, 6.28), speed: rand(.02, .05), sprite: sprites[Math.random() > .4 ? 0 : 1] };
}
function sparkleLoop() {
    sCtx.clearRect(0, 0, sCanvas.width, sCanvas.height);
    for (const s of sparkles) {
        s.y += s.vy; s.phase += s.speed;
        if (s.y < -10) Object.assign(s, newSparkle(false));
        sCtx.globalAlpha = (Math.sin(s.phase) + 1) / 2;
        sCtx.drawImage(s.sprite, s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
    }
    sparkRaf = requestAnimationFrame(sparkleLoop);
}
function startSparkles() { resizeSparkle(); addEventListener('resize', resizeSparkle); sparkles = Array.from({ length: isMobile ? 28 : 60 }, () => newSparkle(true)); sparkleLoop(); }
function stopSparkles() { cancelAnimationFrame(sparkRaf); removeEventListener('resize', resizeSparkle); }

// Nhấn giữ để mở
let holding = false, opened = false, exiting = false, t0 = 0, lastHeart = 0, px = 0, py = 0, raf = 0, lastY = -1;
function tick(now) {
    if (!holding) return;
    const p = Math.min((now - t0) / HOLD_TIME, 1), y = +(70 - p * 70).toFixed(1);
    if (y !== lastY) { water.style.transform = `translate3d(0,${y}px,0)`; holdGlow.style.opacity = (p * .9).toFixed(2); lastY = y; }
    if (now - lastHeart >= (isMobile ? 140 : 100)) { spawnHeart(px, py); lastHeart = now; }
    if (p >= 1) { openCard(); return; }
    raf = requestAnimationFrame(tick);
}
function startHold(e) {
    if (opened) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    holding = true; t0 = performance.now(); lastHeart = 0; lastY = -1; px = e.clientX; py = e.clientY;
    water.style.transition = 'none';
    heartBurst(px, py, 3);
    if (navigator.vibrate) navigator.vibrate(12);
    try { flipWrapper.setPointerCapture(e.pointerId); } catch (_) {}
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
}
function moveHold(e) { if (!holding) return; px = e.clientX; py = e.clientY; }
function cancelHold() {
    if (!holding || opened) return;
    holding = false; cancelAnimationFrame(raf);
    water.style.transition = 'transform .4s cubic-bezier(.25,1,.5,1)';
    water.style.transform = 'translate3d(0,70px,0)';
    holdGlow.style.opacity = 0;
}
async function openCard() {
    if (opened) return;
    opened = true; holding = false; cancelAnimationFrame(raf);
    water.style.transition = 'none'; water.style.transform = 'translate3d(0,0,0)'; holdGlow.style.opacity = 1;
    heartBurst(px, py, isMobile ? 14 : 24);
    if (navigator.vibrate) navigator.vibrate([20, 40, 30]);
    flipWrapper.classList.add('lcln-in-zoom-out');
    await waitFor(flipWrapper, 'transitionend', 'scale', 800);
    flipWrapper.classList.add('lcln-in-flipped');
    await waitFor(flipper, 'transitionend', 'transform', 2400);
    holdGlow.style.opacity = 0;
    flipWrapper.classList.remove('lcln-in-zoom-out');
    await waitFor(flipWrapper, 'transitionend', 'scale', 800);
    await delay(250);
    invitation.classList.add('lcln-in-open');
    await waitFor(insideCard, 'animationend', 'lcln-in-cardSlideOut', 3200);
    invitation.classList.add('lcln-in-card-settled');
}

// Thoát intro -> vào trang chính
async function exitIntro() {
    if (!opened || exiting) return;
    exiting = true;
    curtain.classList.add('lcln-in-active');
    void curtain.offsetWidth;
    curtain.classList.add('lcln-in-closed');
    startSparkles();
    await waitFor(curtainTop, 'transitionend', 'transform', 1500);
    window.scrollTo(0, 0);
    body.classList.remove('lcln-in-intro-active');
    if (window.lclnReveal) window.lclnReveal.start();      // hiệu ứng hiện dần khi cuộn
    intro.classList.add('lcln-in-hide');
    await delay(400);
    curtain.classList.remove('lcln-in-closed');
    await waitFor(curtainTop, 'transitionend', 'transform', 1500);
    stopSparkles();
    intro.remove(); curtain.remove(); heartLayer.remove();
    body.classList.add('lcln-ready');                      // hiện thanh menu nhà trai/nhà gái
    if (window.lclnWall) window.lclnWall.start();          // bắt đầu tự cuộn lời chúc
    if (window.startAutoScroll) window.startAutoScroll();  // tự cuộn trang
}

insideCard.addEventListener('click', e => {
    const b = e.target.closest('.lcln-in-side-btn');
    if (!b) return;
    e.stopPropagation();
    if (window.lclnGoSide) window.lclnGoSide(b.dataset.side); // sang trang nhà trai / nhà gái
    exitIntro();                                               // rồi đóng intro
});
flipWrapper.addEventListener('pointerdown', startHold);
flipWrapper.addEventListener('pointermove', moveHold);
flipWrapper.addEventListener('pointerup', cancelHold);
flipWrapper.addEventListener('pointercancel', cancelHold);
flipWrapper.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('lcln-in-paused', document.hidden);
    if (document.hidden && holding) cancelHold();
});
})();

document.addEventListener("DOMContentLoaded", () => {
  const WEDDING_LIMIT = 3; // mỗi tên tối đa 3 tin nhắn
  let wallCache = [];
  async function lclnWallRequest(method = "GET", record) {
    const response = await fetch("/api/wall", {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify(record) : undefined,
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Không gửi được dữ liệu. Vui lòng thử lại.");
    return data;
  }
  // nhập lờI chúc
  const DOM = {
    wallList: document.getElementById("js-wall-list"),
    commentInput: document.getElementById("js-comment-input"),
    modalProfile: document.getElementById("js-modal-profile"),
    modalRsvp: document.getElementById("js-modal-rsvp"),
    toast: document.getElementById("js-toast"),
  };

  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (m) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[m],
    );
  const getP = () => {
    try {
      return JSON.parse(localStorage.getItem("wedding_profile_v2"));
    } catch {
      return null;
    }
  };
  const saveP = (p) =>
    localStorage.setItem("wedding_profile_v2", JSON.stringify(p));
  const toast = (msg) => {
    DOM.toast.innerText = msg;
    DOM.toast.style.display = "block";
    setTimeout(() => (DOM.toast.style.display = "none"), 3000);
  };
  function lclnCelebrate(message, onClose) {
    const old = document.getElementById("lcln-celebration");
    if (old) old.remove();
    const layer = document.createElement("div");
    layer.id = "lcln-celebration";
    layer.setAttribute("role", "dialog");
    layer.setAttribute("aria-modal", "true");
    layer.setAttribute("aria-live", "polite");
    layer.innerHTML = '<div class="lcln-celebration__box"><span class="lcln-celebration__mark">♥</span><p></p><button type="button" class="lcln-celebration__close">Đóng</button></div><div class="lcln-celebration__confetti" aria-hidden="true"></div>';
    layer.querySelector("p").textContent = message || "Cảm ơn quý khách đã gửi lời chúc/ tham gia tiệc cưới đến gia đình chúng tôi.";
    document.body.appendChild(layer);
    const palette = ["#b91c1c", "#e11d48", "#f4cf7a", "#fff1d9", "#fb7185", "#ffffff"];
    const bits = layer.querySelector(".lcln-celebration__confetti");
    for (let i = 0; i < 56; i++) {
      const piece = document.createElement("i");
      piece.className = "lcln-celebration__piece" + (i % 5 === 0 ? " lcln-celebration__piece--heart" : "");
      piece.textContent = i % 5 === 0 ? "♥" : "";
      piece.style.left = (Math.random() * 100) + "%";
      piece.style.setProperty("--lcln-piece-color", palette[i % palette.length]);
      piece.style.setProperty("--lcln-piece-delay", (Math.random() * .65) + "s");
      piece.style.setProperty("--lcln-piece-drift", ((Math.random() - .5) * 180) + "px");
      bits.appendChild(piece);
    }
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      layer.remove();
      if (typeof onClose === "function") onClose();
    };
    layer.querySelector(".lcln-celebration__close").addEventListener("click", close);
    layer.addEventListener("click", e => { if (e.target === layer) close(); });
    layer.querySelector(".lcln-celebration__close").focus({ preventScroll: true });
    window.setTimeout(close, 6500);
  }

  function render(msg, opts = {}) {
    if (msg.id != null) {
      // Chống trùng: lời chúc vừa gửi sẽ về lại qua realtime
      const ex = DOM.wallList.querySelector(`[data-id="${msg.id}"]`);
      if (ex) {
        return ex;
      }
    }
    const el = document.createElement("div");
    if (msg.id != null) el.dataset.id = msg.id;
    el.className = `wall-message ${msg.side === "nha-trai" ? "wall-message--groom" : "wall-message--bride"}`;
    el.dataset.name = (msg.name || "").toLowerCase().trim();
    el.dataset.msg = msg.message || "";
    const phe = msg.side === "nha-trai" ? "🤵 Nhà trai" : "👰 Nhà gái";
    const badge =
      msg.status === "yes"
        ? `✅ Sẽ đến • ${msg.guests} khách`
        : msg.status === "no"
          ? `❌ Không đến được`
          : `💬 Lời chúc`;
    el.innerHTML = `<div style="display:flex;justify-content:space-between"><b>${esc(msg.name)}</b><small>${phe}</small></div><div style="font-size:13px;font-weight:600">${badge}</div><div>${esc(msg.message || "")}</div>`;
    DOM.wallList.appendChild(el);
    // Không tự nhảy xuống cuối nữa: danh sách tự cuộn từ từ; lời chúc của chính khách thì cuộn tới đúng nó
    return el;
  }
  async function count(name) {
    const key = name.toLowerCase().trim();
    return wallCache.filter((m) => String(m.name || "").toLowerCase().trim() === key).length;
  }

  // Chuẩn hoá để so sánh nội dung: bỏ hoa/thường, dấu tiếng Việt, dấu câu, khoảng trắng thừa
  const norm = (s) =>
    String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
      .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  async function mine(name) {
    const key = name.toLowerCase().trim();
    return wallCache.filter((m) => String(m.name || "").toLowerCase().trim() === key).map((m) => m.message || "");
  }
  async function validate(name, text) {
    const list = await mine(name);
    if (list.length >= WEDDING_LIMIT) {
      toast(`${name} đã gửi đủ ${WEDDING_LIMIT} lần rồi ạ!`);
      return false;
    }
    if (list.some((m) => norm(m) === norm(text))) {
      toast("Nội dung này bạn đã gửi rồi, hãy viết nội dung khác nhé!");
      return false;
    }
    return true;
  }

  let tempSide = null;
  function checkLock() {
    const p = getP();
    if (!p) {
      DOM.commentInput.placeholder = "Bấm vào đây để nhập tên trước nhé!";
      DOM.commentInput.readOnly = true;
      DOM.commentInput.style.opacity = "0.6";
      return false;
    }
    DOM.commentInput.readOnly = false;
    DOM.commentInput.style.opacity = "1";
    DOM.commentInput.placeholder = "Nhập lời chúc...";
    return true;
  }
  checkLock();

  // OPEN MODAL
  document.getElementById("js-open-rsvp").addEventListener("click", () => {
    DOM.modalRsvp.classList.remove("is-hidden");
  });

  // CLOSE MODAL VIA BUTTON
  document.getElementById("js-close-rsvp").addEventListener("click", () => {
    DOM.modalRsvp.classList.add("is-hidden");
  });

  document.getElementById("js-done-rsvp").addEventListener("click", () => {
    DOM.modalRsvp.classList.add("is-hidden");
    document.getElementById("js-rsvp-content").classList.remove("is-hidden");
    document.getElementById("js-rsvp-success").classList.add("is-hidden");
  });

  // CLOSE MODAL WHEN CLICKING OUTSIDE (OVERLAY)
  DOM.modalRsvp.addEventListener("click", (e) => {
    // Nếu nhấp trực tiếp vào phần nền modalRsvp (không phải nội dung bên trong)
    if (e.target === DOM.modalRsvp) {
      DOM.modalRsvp.classList.add("is-hidden");
    }
  });
  document
    .getElementById("js-profile-groom")
    .addEventListener("click", function () {
      tempSide = "nha-trai";
      this.classList.add("is-active");
      document.getElementById("js-profile-bride").classList.remove("is-active");
      document
        .getElementById("js-profile-side-error")
        .classList.remove("is-show");
    });
  document
    .getElementById("js-profile-bride")
    .addEventListener("click", function () {
      tempSide = "nha-gai";
      this.classList.add("is-active");
      document.getElementById("js-profile-groom").classList.remove("is-active");
      document
        .getElementById("js-profile-side-error")
        .classList.remove("is-show");
    });
  document.getElementById("js-close-profile").addEventListener("click", () => {
    DOM.modalProfile.classList.add("is-hidden");
    checkLock();
  });
  DOM.commentInput.addEventListener("click", () => {
    if (!getP()) DOM.modalProfile.classList.remove("is-hidden");
  });
  DOM.commentInput.addEventListener("focus", (e) => {
    if (!getP()) {
      e.target.blur();
      DOM.modalProfile.classList.remove("is-hidden");
    }
  });

  document.getElementById("js-save-profile").addEventListener("click", () => {
    const name = document.getElementById("js-profile-name").value.trim();
    let ok = true;
    if (!name) {
      document.getElementById("js-profile-name-error").classList.add("is-show");
      ok = false;
    }
    if (!tempSide) {
      document.getElementById("js-profile-side-error").classList.add("is-show");
      ok = false;
    }
    if (!ok) return;
    saveP({ name, side: tempSide });
    document.getElementById("js-rsvp-name").value = name;
    DOM.modalProfile.classList.add("is-hidden");
    checkLock();
  });

  async function notifyTelegram(payload) {
    try {
      const response = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        console.warn(
          "Không gửi được Telegram:",
          result.error || response.status,
        );
      }
    } catch (error) {
      console.warn("Không kết nối được server Telegram:", error);
    }
  }
  async function sendLive() {
    const txt = DOM.commentInput.value.trim();
    if (!txt) return;
    if (!getP()) {
      DOM.modalProfile.classList.remove("is-hidden");
      return;
    }
    const p = getP();
    if (!(await validate(p.name, txt))) return;
    let row;
    try {
      row = await lclnWallRequest("POST", { name: p.name, side: p.side, status: "live", guests: 0, message: txt });
    } catch (error) { toast(error.message); return; }
    wallCache.push(row);
    const sentItem = render(row);
    lclnCelebrate("Cảm ơn quý khách đã gửi lời chúc/ tham gia tiệc cưới đến gia đình chúng tôi.", () => {
      if (window.lclnWall && sentItem) window.lclnWall.focusMine(sentItem, 3000);
    });
    DOM.commentInput.value = "";
    void notifyTelegram({
      type: "wish",
      name: p.name,
      side: p.side,
      message: txt,
    });
  }
  document.getElementById("js-send-live").addEventListener("click", sendLive);
  DOM.commentInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendLive();
  });

  // RSVP
  let rsvpSide = null,
    rsvpStatus = null,
    rsvpCount = 1;
  document
    .getElementById("js-rsvp-groom")
    .addEventListener("click", function () {
      rsvpSide = "nha-trai";
      this.classList.add("is-active");
      document.getElementById("js-rsvp-bride").classList.remove("is-active");
    });
  document
    .getElementById("js-rsvp-bride")
    .addEventListener("click", function () {
      rsvpSide = "nha-gai";
      this.classList.add("is-active");
      document.getElementById("js-rsvp-groom").classList.remove("is-active");
    });
  document.getElementById("js-opt-yes").addEventListener("click", function () {
    rsvpStatus = "yes";
    this.classList.add("is-active");
    document.getElementById("js-opt-no").classList.remove("is-active");
    document.getElementById("js-group-qty").classList.remove("is-hidden");
  });
  document.getElementById("js-opt-no").addEventListener("click", function () {
    rsvpStatus = "no";
    this.classList.add("is-active");
    document.getElementById("js-opt-yes").classList.remove("is-active");
    document.getElementById("js-group-qty").classList.add("is-hidden");
  });
  document.getElementById("js-qty-plus").addEventListener("click", () => {
    if (rsvpCount < 20) {
      rsvpCount++;
      document.getElementById("js-qty-count").innerText = rsvpCount;
    }
  });
  document.getElementById("js-qty-minus").addEventListener("click", () => {
    if (rsvpCount > 1) {
      rsvpCount--;
      document.getElementById("js-qty-count").innerText = rsvpCount;
    }
  });
  document
    .getElementById("js-submit-rsvp")
    .addEventListener("click", async () => {
      const name = document.getElementById("js-rsvp-name").value.trim();
      const msg = document.getElementById("js-rsvp-msg").value.trim();
      if (!name || !rsvpSide || !rsvpStatus) {
        if (!name)
          document
            .getElementById("js-rsvp-name-error")
            .classList.add("is-show");
        if (!rsvpSide)
          document
            .getElementById("js-rsvp-side-error")
            .classList.add("is-show");
        if (!rsvpStatus)
          document
            .getElementById("js-rsvp-status-error")
            .classList.add("is-show");
        return;
      }
      const finalMsg = msg || (rsvpStatus === "yes" ? `Sẽ đến ${rsvpCount} khách` : "Không đến được");
      if (!(await validate(name, finalMsg))) return;
      const savedRecord = {
        name,
        side: rsvpSide,
        status: rsvpStatus,
        guests: rsvpStatus === "yes" ? rsvpCount : 0,
        message:
          msg ||
          (rsvpStatus === "yes"
            ? `Sẽ đến ${rsvpCount} khách`
            : "Không đến được"),
      };
      let row;
      try { row = await lclnWallRequest("POST", savedRecord); }
      catch (error) { toast(error.message); return; }
      wallCache.push(row);
      const sentItem = render(row);
      void notifyTelegram({ type: "rsvp", ...savedRecord });
      saveP({ name, side: rsvpSide });
      checkLock();
      document.getElementById("js-rsvp-content").classList.add("is-hidden");
      document.getElementById("js-rsvp-success").classList.remove("is-hidden");
      lclnCelebrate("Cảm ơn quý khách đã gửi lời chúc/ tham gia tiệc cưới đến gia đình chúng tôi.", () => {
        if (window.lclnWall && sentItem) window.lclnWall.focusMine(sentItem, 3000);
      });
    });

  async function lclnLoadWall() {
    try {
      const rows = await lclnWallRequest("GET");
      wallCache = Array.isArray(rows) ? rows : [];
      wallCache.forEach((m) => render(m));
    } catch (error) { console.warn("Không tải được sổ lời chúc:", error.message); }
  }
  void lclnLoadWall();
  window.setInterval(async () => {
    if (document.hidden) return;
    try {
      const rows = await lclnWallRequest("GET");
      if (!Array.isArray(rows)) return;
      wallCache = rows;
      rows.forEach((m) => render(m));
    } catch { /* giữ nguyên danh sách hiện có khi mất kết nối tạm thời */ }
  }, 15000);
});

// Danh sách lời chúc: chỉ khởi chạy sau khi intro đóng; dừng khi khách tương tác.
(function () {
  const list = document.getElementById("js-wall-list");
  const btn = document.getElementById("toggleWallBtn");
  if (!list) return;

  let hidden = false;
  let interacting = false;
  let raf = 0;
  let idleTimer = 0;
  let endTimer = 0;
  let started = false;
  const SPEED = 0.42;

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (endTimer) clearTimeout(endTimer);
    endTimer = 0;
  }
  function setHidden(value) {
    hidden = value;
    list.classList.toggle("is-hidden", hidden);
    if (btn) btn.textContent = hidden ? "👀 Hiện lời chúc" : "🙈 Ẩn lời chúc";
    if (hidden) stop();
  }
  function scheduleResume(delay = 1800) {
    interacting = true;
    stop();
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      interacting = false;
      if (started && !hidden) run();
    }, delay);
  }
  function run() {
    if (!started || hidden || interacting || raf || !window.isPageActive) return;
    const step = () => {
      raf = 0;
      if (!started || hidden || interacting || !window.isPageActive) return;
      const max = Math.max(0, list.scrollHeight - list.clientHeight);
      if (max <= 1) {
        if (list.children.length && !endTimer) {
          endTimer = setTimeout(() => { endTimer = 0; if (!interacting && !hidden) setHidden(true); }, 3000);
        }
        return;
      }
      if (list.scrollTop < max - 1) {
        list.scrollTop = Math.min(max, list.scrollTop + SPEED);
        if (endTimer) { clearTimeout(endTimer); endTimer = 0; }
      } else if (!endTimer) {
        endTimer = setTimeout(() => {
          endTimer = 0;
          if (!interacting && !hidden) setHidden(true);
        }, 3000);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  list.addEventListener("pointerdown", () => scheduleResume(2200), { passive: true });
  list.addEventListener("touchstart", () => scheduleResume(2200), { passive: true });
  list.addEventListener("wheel", () => scheduleResume(1800), { passive: true });
  list.addEventListener("scroll", () => {
    if (started && !interacting && !hidden) {
      if (endTimer) { clearTimeout(endTimer); endTimer = 0; }
    }
  }, { passive: true });

  window.lclnWall = {
    start() {
      started = true;
      setHidden(false);
      list.scrollTop = 0;
      interacting = false;
      run();
    },
    show() {
      started = true;
      setHidden(false);
      run();
    },
    focusMine(el, hideAfter = 3000) {
      if (!el) return;
      started = true;
      setHidden(false);
      interacting = true;
      stop();
      if (idleTimer) clearTimeout(idleTimer);
      el.classList.add("wall-message--mine");
      requestAnimationFrame(() => {
        const listRect = list.getBoundingClientRect();
        const itemRect = el.getBoundingClientRect();
        const top = Math.max(0, list.scrollTop + itemRect.top - listRect.top - (list.clientHeight - el.offsetHeight) / 2);
        list.scrollTo({ top, behavior: "smooth" });
        if (endTimer) clearTimeout(endTimer);
        endTimer = setTimeout(() => {
          endTimer = 0;
          interacting = false;
          setHidden(true);
        }, Math.max(1000, hideAfter));
      });
    },
    stop() { stop(); },
  };

  const contentObserver = new MutationObserver(() => {
    if (started && !hidden && !interacting) run();
  });
  contentObserver.observe(list, { childList: true });

  if (btn) btn.addEventListener("click", () => {
    setHidden(!hidden);
    if (!hidden) {
      started = true;
      list.scrollTop = 0;
      scheduleResume(700);
    }
  });
})();

// Tự cuộn trang: tạm dừng khi chạm, click, nhập liệu hoặc mở chức năng; tiếp tục theo chiều vuốt.
(function () {
  let raf = 0;
  let velocity = 0.85;
  let direction = 1;
  let touching = false;
  let lastY = 0;
  let lastTime = 0;
  let idleTimer = 0;
  let pausedByFocus = false;
  const BASE = 0.72;

  const hasOpenLayer = () => !!document.querySelector(
    '#js-modal-rsvp:not(.is-hidden),#js-modal-profile:not(.is-hidden),#qrModal.show,#imageViewerModal.is-active,.lightbox-modal.is-active,#js-wedding-widget.open-main,#js-wedding-widget.open-share,#js-wedding-widget.open-contact,#lcln-celebration'
  );
  const hasFocusedField = () => {
    const a = document.activeElement;
    return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  };
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function loop() {
    raf = 0;
    if (!window.isPageActive || touching || pausedByFocus || hasOpenLayer() || hasFocusedField()) return;
    const root = document.documentElement;
    const max = Math.max(0, root.scrollHeight - window.innerHeight);
    const y = window.scrollY || root.scrollTop;
    if ((direction > 0 && y >= max - 1) || (direction < 0 && y <= 0) || max < 2) return;
    if (Math.abs(velocity) < BASE) velocity = BASE * direction;
    window.scrollBy(0, velocity);
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (!raf && !touching && !pausedByFocus && !hasOpenLayer() && !hasFocusedField()) {
      if (Math.abs(velocity) < BASE) velocity = BASE * direction;
      raf = requestAnimationFrame(loop);
    }
  }
  function pause(delay = 1800) {
    stop();
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!touching && !pausedByFocus && !hasOpenLayer() && !hasFocusedField()) start();
    }, delay);
  }
  window.startAutoScroll = start;
  window.resumePageScroll = start;
  window.stopAutoScroll = stop;

  window.addEventListener('touchstart', (e) => {
    touching = true;
    stop();
    if (idleTimer) clearTimeout(idleTimer);
    lastY = e.touches[0]?.clientY ?? 0;
    lastTime = performance.now();
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (!touching || !e.touches[0]) return;
    const y = e.touches[0].clientY;
    const now = performance.now();
    const dy = lastY - y;
    const dt = Math.max(1, now - lastTime);
    if (Math.abs(dy) > 1) {
      direction = dy > 0 ? 1 : -1;
      velocity = Math.max(BASE, Math.min(5, Math.abs(dy / dt * 16))) * direction;
    }
    lastY = y;
    lastTime = now;
  }, { passive: true });
  window.addEventListener('touchend', () => {
    touching = false;
    if (Math.abs(velocity) < BASE) velocity = BASE * direction;
    pause(1900);
  }, { passive: true });
  window.addEventListener('touchcancel', () => { touching = false; pause(1900); }, { passive: true });
  window.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > 1) {
      direction = e.deltaY > 0 ? 1 : -1;
      velocity = Math.max(BASE, Math.min(4, Math.abs(e.deltaY) * .12)) * direction;
    }
    pause(1500);
  }, { passive: true });
  document.addEventListener('pointerdown', () => pause(2000), { passive: true });
  document.addEventListener('click', () => pause(2000), { passive: true });
  document.addEventListener('focusin', (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) {
      pausedByFocus = true;
      stop();
    }
  });
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      pausedByFocus = hasFocusedField();
      if (!pausedByFocus) pause(1200);
    }, 80);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else pause(800);
  });
})();
// ==========================================
//  ĐÓNG BĂNG TOÀN BỘ HIỆU ỨNG KHÔNG CHẠY NGẦM
// ==========================================
(function () {
  window.isPageActive = true;

  function freezeProject() {
    window.isPageActive = false;
    // Tạm dừng mọi CSS Animation & Transition toàn trang
    document.body.classList.add("freeze-effects");

    // Dừng vòng lặp requestAnimationFrame (nếu trong code của bạn có sử dụng)
    if (window.globalAnimationFrameId) {
      cancelAnimationFrame(window.globalAnimationFrameId);
      window.globalAnimationFrameId = null;
    }
  }

  function unfreezeProject() {
    window.isPageActive = true;
    // Khôi phục lại toàn bộ CSS Animation
    document.body.classList.remove("freeze-effects");

    // Khôi phục vòng lặp JS
    if (typeof window.resumeRain === "function") window.resumeRain();
    if (typeof window.resumePageScroll === "function")
      window.resumePageScroll();

    if (typeof window.resumeAppLoops === "function") {
      window.resumeAppLoops();
    }
  }

  // Lắng nghe sự kiện chuyển tab / ẩn trang từ trình duyệt
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      freezeProject();
    } else {
      unfreezeProject();
    }
  });
})();
const widgetWrapper = document.getElementById("js-wedding-widget");
const widgetToggle = document.getElementById("js-widget-toggle");
const btnShareMain = document.getElementById("js-btn-share-main");
const btnContactMain = document.getElementById("js-btn-contact-main");
const copyBtn = document.getElementById("js-copy-link");

// Click Trái Tim -> Mở/Đóng Cấp 1
widgetToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  widgetWrapper.classList.toggle("open-main");
  widgetWrapper.classList.remove("open-share", "open-contact");
});

// Click Share Cấp 1 -> Bật/Tắt Cấp 2 Share
btnShareMain.addEventListener("click", (e) => {
  e.stopPropagation();
  if (widgetWrapper.classList.contains("open-share")) {
    widgetWrapper.classList.remove("open-share");
  } else {
    widgetWrapper.classList.add("open-share");
    widgetWrapper.classList.remove("open-contact");
  }
});

// Click Contact Cấp 1 -> Bật/Tắt Cấp 2 Contact
btnContactMain.addEventListener("click", (e) => {
  e.stopPropagation();
  if (widgetWrapper.classList.contains("open-contact")) {
    widgetWrapper.classList.remove("open-contact");
  } else {
    widgetWrapper.classList.add("open-contact");
    widgetWrapper.classList.remove("open-share");
  }
});

// Click ngoài Widget -> Đóng toàn bộ
document.addEventListener("click", (e) => {
  if (!widgetWrapper.contains(e.target)) {
    widgetWrapper.classList.remove("open-main", "open-share", "open-contact");
  }
});

// Copy link
copyBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  try {
    await navigator.clipboard.writeText(window.location.href);
  } catch (err) {}

  const icon = copyBtn.querySelector("i");
  icon.className = "fa-solid fa-check";
  copyBtn.classList.add("copied");

  setTimeout(() => {
    widgetWrapper.classList.remove("open-main", "open-share", "open-contact");
    setTimeout(() => {
      icon.className = "fa-regular fa-copy";
      copyBtn.classList.remove("copied");
    }, 300);
  }, 400);
});

// GALARY AMBUM ẢNH VÀ SLICK SLIDER
document.addEventListener("DOMContentLoaded", () => {
  // ----------------------------------------------------------------------
  // 1. CHỨC NĂNG LIGHTBOX MODAL (XEM ẢNH + VUỐT SANG TRÁI/PHẢI + ĐẾM SỐ)
  // ----------------------------------------------------------------------
  const modal = document.getElementById("imageViewerModal");
  const modalImg = modal?.querySelector(".js-lightbox-display-img");
  const closeBtn = modal?.querySelector(".js-lightbox-close");
  const prevBtnLightbox = modal?.querySelector(".js-lightbox-prev");
  const nextBtnLightbox = modal?.querySelector(".js-lightbox-next");
  const counterEl = modal?.querySelector(".js-lightbox-counter");

  let activeImageList = []; // Danh sách các ảnh của nhóm đang mở
  let activeImageIndex = 0; // Vị trí ảnh hiện tại

  const updateLightboxContent = () => {
    if (!activeImageList.length || !modalImg) return;
    const currentData = activeImageList[activeImageIndex];
    modalImg.src = currentData.src;
    modalImg.alt = currentData.alt || "Ảnh phóng to";

    if (counterEl) {
      counterEl.textContent = `${activeImageIndex + 1} / ${activeImageList.length}`;
    }
  };

  const openLightboxGroup = (imageList, startIndex = 0) => {
    if (!imageList || !imageList.length) return;
    activeImageList = imageList;
    activeImageIndex = startIndex;
    updateLightboxContent();
    modal?.classList.add("is-active");
  };

  const closeModal = () => {
    modal?.classList.remove("is-active");
  };

  const showNextLightbox = () => {
    if (!activeImageList.length) return;
    activeImageIndex = (activeImageIndex + 1) % activeImageList.length;
    updateLightboxContent();
  };

  const showPrevLightbox = () => {
    if (!activeImageList.length) return;
    activeImageIndex =
      (activeImageIndex - 1 + activeImageList.length) % activeImageList.length;
    updateLightboxContent();
  };

  closeBtn?.addEventListener("click", closeModal);
  nextBtnLightbox?.addEventListener("click", showNextLightbox);
  prevBtnLightbox?.addEventListener("click", showPrevLightbox);

  modal?.addEventListener("click", (e) => {
    if (
      e.target === modal ||
      e.target.classList.contains("lightbox-modal__container")
    ) {
      closeModal();
    }
  });

  // Bàn phím điều hướng
  document.addEventListener("keydown", (e) => {
    if (!modal?.classList.contains("is-active")) return;
    if (e.key === "Escape") closeModal();
    if (e.key === "ArrowLeft") showPrevLightbox();
    if (e.key === "ArrowRight") showNextLightbox();
  });

  // Vuốt (Touch Swipe) trên Lightbox Popup
  let touchStartX = 0;
  let touchEndX = 0;

  modal?.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.changedTouches[0].screenX;
    },
    { passive: true },
  );

  modal?.addEventListener(
    "touchend",
    (e) => {
      touchEndX = e.changedTouches[0].screenX;
      handleLightboxSwipe();
    },
    { passive: true },
  );

  const handleLightboxSwipe = () => {
    const swipeThreshold = 40; // Độ dài vuốt tối thiểu
    if (touchEndX < touchStartX - swipeThreshold) {
      showNextLightbox(); // Vuốt sang trái -> Xem ảnh tiếp
    } else if (touchEndX > touchStartX + swipeThreshold) {
      showPrevLightbox(); // Vuốt sang phải -> Xem ảnh trước
    }
  };

  // ----------------------------------------------------------------------
  // 2. XỬ LÝ EVENT CLICK CHO GALLERY GRID (TỰ ĐỘNG GỘP NHÓM ẢNH GALLERY)
  // ----------------------------------------------------------------------
  document.addEventListener("click", (e) => {
    const clickedImg = e.target.closest(
      ".gallery-grid[data-lightbox] .gallery-grid__image",
    );
    if (clickedImg) {
      const galleryContainer = clickedImg.closest(".gallery-grid");
      const allImgs = Array.from(
        galleryContainer.querySelectorAll(".gallery-grid__image"),
      );

      // Tạo danh sách ảnh riêng cho Gallery này
      const galleryList = allImgs.map((img) => ({
        src: img.src,
        alt: img.alt,
      }));

      const clickedIndex = allImgs.indexOf(clickedImg);
      openLightboxGroup(galleryList, clickedIndex !== -1 ? clickedIndex : 0);
    }
  });

  // ----------------------------------------------------------------------
  // 3. 3D SLIDER LOGIC (AUTO 1S + SWIPE + PAUSE ON HOVER + DOTS)
  // ----------------------------------------------------------------------
  const stage = document.getElementById("stage");

  // Nếu quản trị viên đã đổi ảnh slider thì dùng lại (tránh ghi đè khi tải lại).
  const savedSlides = stage
    ? Array.from(stage.querySelectorAll(".slide img"))
        .map((img, index) => ({
          src: img.getAttribute("src"),
          alt: img.getAttribute("alt") || `Slider ${index + 1}`,
        }))
        .filter((slide) => slide.src)
    : [];

  const slidesData = savedSlides.length
    ? savedSlides
    : [
        { src: "./asset/img/mau1.webp", alt: "Slider 1" },
        { src: "./asset/img/mau13.webp", alt: "Slider 2" },
        { src: "./asset/img/mau2.webp", alt: "Slider 3" },
        { src: "./asset/img/mau13.webp", alt: "Slider 4" },
        { src: "./asset/img/mau1.webp", alt: "Slider 5" },
        { src: "./asset/img/mau2.webp", alt: "Slider 6" },
        { src: "./asset/img/mau13.webp", alt: "Slider 7" },
      ];

  let currentIndex = Math.max(0, Math.min(3, slidesData.length - 1));
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const sliderWrapper = document.getElementById("weddingSlider");
  const dotsContainer = document.getElementById("sliderDots");

  // Khởi tạo Carousel & Render Dots
  const renderCarousel = () => {
    if (!stage) return;

    // 1. Render Slides (Giữ nguyên class "slide")
    if (!stage.querySelector(".slide")) {
      const fragment = document.createDocumentFragment();

      slidesData.forEach((slide, index) => {
        const slideEl = document.createElement("div");
        slideEl.className = "slide";
        slideEl.dataset.index = index;
        slideEl.innerHTML = `<img src="${slide.src}" alt="${slide.alt}">`;
        fragment.appendChild(slideEl);
      });

      stage.appendChild(fragment);
    }

    // 2. Render Dots (Tạo theo style class ngắn gọn của code cũ)
    if (dotsContainer) {
      dotsContainer.innerHTML = "";
      const dotsFragment = document.createDocumentFragment();

      slidesData.forEach((_, index) => {
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.dataset.index = index;
        if (index === currentIndex) dot.classList.add("active");

        // Click vào dot chuyển tới slide tương ứng
        dot.addEventListener("click", () => {
          currentIndex = index;
          updateCarousel();
        });

        dotsFragment.appendChild(dot);
      });

      dotsContainer.appendChild(dotsFragment);
    }
  };

  const updateCarousel = () => {
    if (!stage) return;
    const slideElements = stage.querySelectorAll(".slide");
    const total = slidesData.length;

    // Cập nhật slide (Giữ nguyên logic & class cũ)
    slideElements.forEach((slide, index) => {
      let offset = index - currentIndex;

      if (offset < -3) offset += total;
      if (offset > 3) offset -= total;

      slide.className = "slide";

      if (offset === 0) {
        slide.classList.add("active");
      } else if (offset < 0) {
        slide.classList.add("left", `left-${Math.abs(offset)}`);
      } else if (offset > 0) {
        slide.classList.add("right", `right-${offset}`);
      }
    });

    // Cập nhật trạng thái active cho Dots
    if (dotsContainer) {
      const dots = dotsContainer.querySelectorAll(".dot");
      dots.forEach((dot, index) => {
        dot.classList.toggle("active", index === currentIndex);
      });
    }
  };

  const nextSlide = () => {
    currentIndex = (currentIndex + 1) % slidesData.length;
    updateCarousel();
  };

  const prevSlide = () => {
    currentIndex = (currentIndex - 1 + slidesData.length) % slidesData.length;
    updateCarousel();
  };

  prevBtn?.addEventListener("click", prevSlide);
  nextBtn?.addEventListener("click", nextSlide);

  // --- CHỨC NĂNG AUTO PLAY (3 GIÂY) ---
  let autoPlayTimer = null;

  const startAutoPlay = () => {
    if (!autoPlayTimer) {
      autoPlayTimer = setInterval(nextSlide, 3000);
    }
  };

  const stopAutoPlay = () => {
    if (autoPlayTimer) {
      clearInterval(autoPlayTimer);
      autoPlayTimer = null;
    }
  };

  sliderWrapper?.addEventListener("mouseenter", stopAutoPlay);
  sliderWrapper?.addEventListener("mouseleave", startAutoPlay);

  // Bắt sự kiện Click ảnh trong 3D Slider
  stage?.addEventListener("click", (e) => {
    const slide = e.target.closest(".slide");
    if (!slide) return;

    const index = parseInt(slide.dataset.index, 10);

    if (index === currentIndex) {
      openLightboxGroup(slidesData, index);
    } else {
      currentIndex = index;
      updateCarousel();
    }
  });

  // Touch Swipe cho Slider
  let sliderTouchStartX = 0;
  let sliderTouchEndX = 0;

  sliderWrapper?.addEventListener(
    "touchstart",
    (e) => {
      stopAutoPlay();
      sliderTouchStartX = e.changedTouches[0].screenX;
    },
    { passive: true },
  );

  sliderWrapper?.addEventListener(
    "touchend",
    (e) => {
      sliderTouchEndX = e.changedTouches[0].screenX;
      const threshold = 30;
      if (sliderTouchEndX < sliderTouchStartX - threshold) {
        nextSlide();
      } else if (sliderTouchEndX > sliderTouchStartX + threshold) {
        prevSlide();
      }
      startAutoPlay();
    },
    { passive: true },
  );

  // Khởi chạy
  renderCarousel();
  updateCarousel();
  startAutoPlay();
});
///////////// CHUYỆN TÌNH YÊU (mới) /////////////
(function(){
  'use strict';

  /* ========= SỬA NỘI DUNG Ở ĐÂY ========= */
  var lclnData = (function(){
    try {
      var node = document.getElementById('lcln-story-data');
      var data = node ? JSON.parse(node.textContent) : [];
      return Array.isArray(data) && data.length ? data : [];
    } catch (error) { console.warn('Không đọc được dữ liệu Chuyện tình yêu:', error); return []; }
  })();
  /* ======================================= */

  var N = lclnData.length;
  var $ = function(id){return document.getElementById(id)};
  var sec = $('lcln-ls-love'), stage = $('lcln-ls-stage'), slidesBox = $('lcln-ls-slides'), progress = $('lcln-ls-progress');
  var btnPrev = $('lcln-ls-prev'), btnNext = $('lcln-ls-next');
  var bgA = null, bgB = null, bgFront = null, bgBack = null;
  var viewer = $('lcln-ls-viewer'), vImg = $('lcln-ls-v-img');
  var slides = [], segs = [], cur = 0, lock = false, vIdx = 0;
  var pad = function(n){return (n<10?'0':'')+n};

  /* ---- Dựng DOM một lần ---- */
  slidesBox.innerHTML = ''; progress.innerHTML = '';
  var f1 = document.createDocumentFragment(), f2 = document.createDocumentFragment();
  lclnData.forEach(function(d,i){
    var s = document.createElement('div');
    s.className = 'lcln-ls-slide';
    s.innerHTML =
      '<div class="lcln-ls-frame">' +
        '<button class="lcln-ls-photo" type="button" aria-label="Xem ảnh"><img alt="" decoding="async">' +
          '<span class="lcln-ls-zoom"><svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg></span>' +
        '</button>' +
        '<div class="lcln-ls-glass"><span class="lcln-ls-chip"></span><h3 class="lcln-ls-card-title"></h3><p class="lcln-ls-card-text"></p></div>' +
      '</div>';
    s.querySelector('.lcln-ls-chip').textContent = pad(i+1) + ' / ' + pad(N);
    s.querySelector('.lcln-ls-card-title').textContent = d.title;
    s.querySelector('.lcln-ls-card-text').textContent = d.text;
    s.querySelector('img').alt = d.title;
    s.querySelector('.lcln-ls-photo').dataset.i = i;
    f1.appendChild(s); slides.push(s);

    var b = document.createElement('button');
    b.className = 'lcln-ls-seg'; b.type = 'button'; b.dataset.i = i; b.setAttribute('aria-label','Ảnh ' + (i+1));
    b.innerHTML = '<span class="lcln-ls-seg-bar"><span class="lcln-ls-seg-fill"></span></span>';
    f2.appendChild(b); segs.push(b);
  });
  slidesBox.appendChild(f1); progress.appendChild(f2);

  /* ---- Tải ảnh lười: chỉ slide hiện tại ±1 ---- */
  function loadImg(i){
    if(i<0||i>=N) return;
    var im = slides[i].querySelector('img');
    if(!im.getAttribute('src')) im.src = lclnData[i].img;
  }

  /* ---- Ảnh nền mờ: crossfade 2 lớp ---- */
  function setBg(src){ /* Nền riêng của component đã được loại bỏ để đồng bộ với website. */ }

  function render(){
    for(var i=0;i<N;i++){
      slides[i].classList.toggle('lcln-ls-is-active', i===cur);
      slides[i].classList.toggle('lcln-ls-is-prev', i<cur);
      segs[i].classList.toggle('lcln-ls-is-active', i===cur);
      segs[i].classList.toggle('lcln-ls-is-done', i<cur);
    }
    loadImg(cur); loadImg(cur+1); loadImg(cur-1);
    setBg(lclnData[cur].img);
    btnPrev.disabled = cur===0;
    btnNext.disabled = cur===N-1;
  }
  function go(n){
    if(n<0||n>=N||n===cur||lock) return;
    lock = true; cur = n; render();
    setTimeout(function(){lock=false},450);
  }
  render();

  btnPrev.onclick = function(){go(cur-1)};
  btnNext.onclick = function(){go(cur+1)};
  progress.addEventListener('click',function(e){
    var b = e.target.closest('.lcln-ls-seg'); if(b) go(+b.dataset.i);
  });

  /* ---- Tự chạy: thanh tiến trình chạy xong => sang ảnh kế (không dùng timer) ---- */
  progress.addEventListener('animationend',function(e){
    if(e.animationName!=='lcln-ls-fill') return;
    if(cur<N-1) go(cur+1);
    else { cur = -1; lock=false; go(0); }                 /* hết vòng => quay lại ảnh đầu */
  });

  /* ---- Kéo / vuốt ngang bằng Pointer Events ---- */
  var px=0, py=0, dragging=false, decided=false, id=null, moved=false, raf=0, ddx=0;
  stage.addEventListener('pointerdown',function(e){
    if(e.pointerType==='mouse'&&e.button!==0) return;
    px=e.clientX; py=e.clientY; dragging=false; decided=false; id=e.pointerId; ddx=0;
  });
  stage.addEventListener('pointermove',function(e){
    if(id!==e.pointerId) return;
    var dx=e.clientX-px, dy=e.clientY-py;
    if(!decided && (Math.abs(dx)>8||Math.abs(dy)>8)){
      decided=true; dragging = Math.abs(dx)>Math.abs(dy);
      if(dragging){ try{stage.setPointerCapture(id)}catch(_){} stage.classList.add('lcln-ls-drag'); sec.classList.add('lcln-ls-hold'); }
    }
    if(!dragging) return;
    var atEdge = (dx>0&&cur===0)||(dx<0&&cur===N-1);
    ddx = atEdge ? dx*.3 : dx;
    if(!raf) raf = requestAnimationFrame(function(){
      raf=0;
      stage.style.setProperty('--lcln-ls-dx', ddx+'px');
      stage.style.setProperty('--lcln-ls-rot', (ddx*.025)+'deg');
    });
  });
  function endDrag(e){
    if(id!==e.pointerId) return;
    id=null;
    if(!dragging) return;
    moved = true; setTimeout(function(){moved=false},60);
    dragging=false;
    if(raf){cancelAnimationFrame(raf);raf=0}
    stage.classList.remove('lcln-ls-drag'); sec.classList.remove('lcln-ls-hold');
    stage.style.removeProperty('--lcln-ls-dx'); stage.style.removeProperty('--lcln-ls-rot');
    if(ddx<-55) go(cur+1); else if(ddx>55) go(cur-1);
  }
  stage.addEventListener('pointerup',endDrag);
  stage.addEventListener('pointercancel',endDrag);

  /* ---- Chế độ xem ảnh (tiêu đề hiện phía trên) ---- */
  function fillViewer(i){
    $('lcln-ls-v-chip').textContent = pad(i+1) + ' / ' + pad(N);
    $('lcln-ls-v-title').textContent = lclnData[i].title;
    $('lcln-ls-v-text').textContent = lclnData[i].text;
    $('lcln-ls-v-count').textContent = (i+1) + ' / ' + N;
    vImg.src = lclnData[i].img; vImg.alt = lclnData[i].title;
    $('lcln-ls-v-prev').disabled = i===0; $('lcln-ls-v-next').disabled = i===N-1;
  }
  function openViewer(i){
    vIdx = i; fillViewer(i);
    viewer.classList.add('lcln-ls-open'); viewer.setAttribute('aria-hidden','false');
    sec.classList.add('lcln-ls-hold');
    document.documentElement.style.overflow = 'hidden';
  }
  function closeViewer(){
    viewer.classList.remove('lcln-ls-open'); viewer.setAttribute('aria-hidden','true');
    sec.classList.remove('lcln-ls-hold');
    document.documentElement.style.overflow = '';
    if(vIdx!==cur){ lock=false; go(vIdx); }                /* đồng bộ slider với ảnh vừa xem */
  }
  function vStep(d){
    var n = vIdx+d; if(n<0||n>=N) return;
    vImg.classList.add('lcln-ls-swap');
    setTimeout(function(){ vIdx=n; fillViewer(n); vImg.classList.remove('lcln-ls-swap'); },160);
  }
  slidesBox.addEventListener('click',function(e){
    if(moved) return;
    var p = e.target.closest('.lcln-ls-photo'); if(p) openViewer(+p.dataset.i);
  });
  $('lcln-ls-close').onclick = closeViewer;
  $('lcln-ls-v-prev').onclick = function(){vStep(-1)};
  $('lcln-ls-v-next').onclick = function(){vStep(1)};
  $('lcln-ls-v-body').addEventListener('click',function(e){ if(e.target!==vImg) closeViewer(); });

  var vx=0, vy=0;
  viewer.addEventListener('touchstart',function(e){vx=e.touches[0].clientX; vy=e.touches[0].clientY},{passive:true});
  viewer.addEventListener('touchend',function(e){
    var dx=e.changedTouches[0].clientX-vx, dy=e.changedTouches[0].clientY-vy;
    if(Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)) vStep(dx<0?1:-1);
    else if(dy>90 && Math.abs(dy)>Math.abs(dx)) closeViewer();
  },{passive:true});

  document.addEventListener('keydown',function(e){
    var open = viewer.classList.contains('lcln-ls-open');
    if(e.key==='Escape') return closeViewer();
    if(e.key==='ArrowRight') open ? vStep(1) : go(cur+1);
    if(e.key==='ArrowLeft')  open ? vStep(-1) : go(cur-1);
  });

  /* ---- Tạm dừng khi ra khỏi màn hình hoặc tab ẩn ---- */
  function setAway(a){ sec.classList.toggle('lcln-ls-away', a); }
  if('IntersectionObserver' in window){
    new IntersectionObserver(function(en){ setAway(!en[0].isIntersecting); },{threshold:.25}).observe(sec);
  }
  document.addEventListener('visibilitychange',function(){ if(document.hidden) setAway(true); });
})();

// ==========================================
// HAI TRANG: NHÀ TRAI / NHÀ GÁI (cùng giao diện, khác ngày giờ + địa chỉ)
// Dữ liệu từng nhà nằm trong <script id="lcln-sides"> của index.html
// ==========================================
(function () {
  const cfgEl = document.getElementById("lcln-sides");
  const nav = document.getElementById("lcln-side-nav");
  const intro = document.getElementById("lcln-in-weddingIntro");
  const PATH = { trai: "/index-nam", gai: "/index-gai" };
  const $ = (s) => document.querySelector(s);
  const WD = ["chủ nhật", "thứ hai", "thứ ba", "thứ tư", "thứ năm", "thứ sáu", "thứ bảy"];
  const DN = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "CN"];
  const pad = (n) => String(n).padStart(2, "0");
  const readCfg = () => { try { return JSON.parse(cfgEl.textContent); } catch (e) { return {}; } };
  const fromPath = () => {
    const p = location.pathname.replace(/\/+$/, "");
    return (p === PATH.gai || p === "/nha-gai") ? "gai" : (p === PATH.trai || p === "/nha-trai" || p === "/") ? "trai" : null;
  };
  let current = fromPath() || "trai";

  function apply(side) {
    current = side;
    const c = readCfg()[side] || {};
    if (c.date) {
      const [y, m, d] = c.date.split("-").map(Number);
      const time = c.time || "00:00", [h, mi] = time.split(":");
      const cd = $(".countdown-card");
      if (cd) cd.dataset.weddingDate = `${c.date}T${time}`; // đếm ngược đọc lại mỗi giây
      const wd = (new Date(y, m - 1, d).getDay() + 6) % 7;
      const off = (new Date(y, m - 1, 1).getDay() + 6) % 7;
      const n = new Date(y, m, 0).getDate();
      const cal = $(".calendar-card");
      if (cal) {
        Object.assign(cal.dataset, { month: pad(m), year: y, weddingDay: pad(d) });
        cal.querySelector(".month").textContent = "Tháng " + m;
        cal.querySelector(".year").textContent = y;
        cal.querySelector(".calendar-grid").innerHTML =
          DN.map((x, i) => `<span class="day-name${i == wd ? " wedding-day" : ""}">${x}</span>`).join("") +
          '<span class="day-item" style="visibility:hidden"></span>'.repeat(off) +
          Array.from({ length: n }, (_, i) => `<span class="day-item${i + 1 == d ? " wedding-day" : ""}">${i + 1}</span>`).join("");
      }
      const th = $(".thu-gio");
      if (th) { th.children[0].textContent = WD[(wd + 1) % 7]; th.children[1].textContent = `${h} giờ ${mi}`; }
      const ng = $(".ngay");
      if (ng) {
        ng.children[0].textContent = pad(d);
        const s = ng.querySelectorAll(".thang span");
        s[0].textContent = "Tháng " + m; s[1].textContent = y;
      }
    }
    const lp = $(".date-top>p:last-child");
    if (lp && c.lunar != null) lp.textContent = c.lunar;
    const ad = $(".address");
    if (ad && c.address != null) ad.textContent = "📍 " + c.address;
    const btn = $(".section_five .wedding-btn-group a"), fr = $(".map_iframe");
    if (btn && c.map) btn.href = c.map;
    if (fr) {
      const e = c.embed || (c.map && c.map.includes("/embed") ? c.map : "") ||
        (c.address ? `https://maps.google.com/maps?q=${encodeURIComponent(c.address)}&output=embed` : "");
      if (e && fr.getAttribute("src") !== e) fr.src = e;
    }
    if (nav) nav.querySelectorAll("a").forEach((a) => a.classList.toggle("on", a.dataset.side === side));
    document.documentElement.dataset.side = side;
  }
  window.lclnApplySide = apply; // trang admin dùng để xem trước từng nhà

  // Chuyển nhà không tải lại trang => nhạc vẫn phát, không phải xem lại intro
  function go(side) {
    if (fromPath() !== side) history.pushState({}, "", PATH[side]);
    apply(side);
  }
  window.addEventListener("popstate", () => apply(fromPath() || current));

  // Intro: nút chọn nhà nằm trong thẻ thiệp (xem intro). Vào thẳng /nha-trai hoặc /nha-gai thì nút của nhà đó được tô nổi bật
  window.lclnGoSide = go;
  if (intro) {
    const cur = fromPath();
    if (cur) intro.querySelectorAll(".lcln-in-side-btn").forEach((b) => b.classList.toggle("is-current", b.dataset.side === cur));
  } else document.body.classList.add("lcln-ready");

  // Thanh menu: lướt lên thì hiện, lướt xuống thì ẩn
  if (nav) {
    nav.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-side]");
      if (!a) return;
      e.preventDefault();
      go(a.dataset.side);
    });
    let lastY = window.scrollY;
    window.addEventListener("scroll", () => {
      const y = window.scrollY, dy = y - lastY;
      if (dy < -4) nav.classList.add("show");
      else if (dy > 4) nav.classList.remove("show");
      lastY = y;
    }, { passive: true });
  }
  apply(current);
})();

// Nội dung website chỉ tải khi mở hoặc tải lại trang; không polling và không ép refresh.

// ==========================================
// HIỆU ỨNG HIỆN DẦN / MỜ DẦN KHI CUỘN (rồng, phượng, mây, chữ, ảnh...)
// Vào màn hình thì hiện, ra khỏi màn hình thì mờ đi; cuộn lên/xuống hay tự cuộn đều chạy lại.
// Mặc định theo RULES bên dưới; từng đối tượng có thể chọn kiểu riêng trong admin
// (lưu thành data-fx="up|down|left|right|zoom|swoop-l|swoop-r|fade|none", data-fx-speed="fast|slow").
// ==========================================
(function () {
  const RULES = [
    [".bg_right,.baner_bg-right", "swoop-r"],
    [".bg_left,.baner_bg-left", "swoop-l"],
    [".bg-sml_1,.bg-sml_2,.img_benner-may,.img_benner-may-1,.img_benner-hi,.content_dau-re .icon_hi img", "zoom"],
    [".title-big,.headig_text,.titel_thong-bao,.text_message,.date-top>p,.date-top .thu-gio,.date-top .ngay,.address,.rsvp-text,.countdown-title", "up"],
    [".item_cha-me:first-child,.content_dau-re .content_item:first-child", "left"],
    [".item_cha-me:last-child,.content_dau-re .content_item:last-child", "right"],
    [".gallery-grid__item,.img_khung,.img_avt,.img_benner,.content_map,.countdown-card,.calendar-card,.wedding-btn-group", "zoom"],
  ];
  const SKIP = ".lcln-ls-section,.wedding-wall,.wedding-widget,[class*=modal]";
  const SEC = "main>section:not(.intro_thu)";
  let started = false;
  window.lclnReveal = {
    start() {
      if (started) return;
      started = true;
      if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
      const io = new IntersectionObserver(
        (es) => es.forEach((e) => e.target.classList.toggle("lcln-seen", e.isIntersecting)),
        { threshold: 0, rootMargin: "-6% 0px -6% 0px" },
      );
      const perParent = new Map(), done = new Set();
      const add = (el, fx) => {
        if (done.has(el) || el.closest(SKIP)) return;
        done.add(el);
        if (fx === "none") return;
        const n = perParent.get(el.parentNode) || 0;
        perParent.set(el.parentNode, n + 1);
        el.classList.add("lcln-rv", "lcln-rv-" + fx);
        if (el.dataset.fxSpeed) el.classList.add("lcln-rv-" + el.dataset.fxSpeed);
        if (n) el.classList.add("lcln-rv-d" + Math.min(n, 4)); // so le nhẹ cho các phần tử cùng nhóm
        io.observe(el);
      };
      document.querySelectorAll(`${SEC}[data-fx],${SEC} [data-fx]`).forEach((el) => add(el, el.dataset.fx)); // chọn riêng từ admin
      RULES.forEach(([sel, fx]) =>
        document.querySelectorAll(sel.split(",").map((s) => `${SEC} ${s.trim()}`).join(",")).forEach((el) => add(el, fx)));
    },
  };
  if (!document.getElementById("lcln-in-weddingIntro")) window.lclnReveal.start(); // mở thẳng, không có intro
})();
