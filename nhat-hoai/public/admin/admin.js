/* Quản trị thiệp cưới LCLN — lưu riêng vào client/index-nam.html hoặc client/index-gai.html */
(() => {
  const $ = (s) => document.querySelector(s), f = $("#lcln-f"), ov = $("#lcln-ov");
  let doc, w, edit = false, sel = null, lastW = null, music = null, drag = null, contentVersion = "", side = (new URLSearchParams(location.search).get("side") || document.documentElement.dataset.lclnSide || "trai") === "gai" ? "gai" : "trai", cfg = {}, cfgEl = null;
  const esc = (s) => String(s).replace(/"/g, "&quot;");
  const LN = { wed: "Ảnh cưới", bg: "Ảnh nền", icon: "Icon" };
  const cat = (u) => (/^\/uploads\/(bg|icon)\//.exec(u) || /\/(bg|icon)\//.exec(u) || [])[1] || (/img_backgroud/i.test(u) ? "bg" : /\/icon\//i.test(u) ? "icon" : "wed");
  const txt = (el) => [...el.childNodes].some((c) => c.nodeType == 3 && c.textContent.trim());

  async function api(url, opt = {}) {
    const r = await fetch(url, { credentials: "same-origin", ...opt, headers: { ...(opt.headers || {}) } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || "Lỗi máy chủ");
    return d;
  }
  const post = (url, method, body) => api(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  function toast(m) { const t = $("#lcln-toast"); t.textContent = m; t.classList.toggle("is-loading", /^(Nén |Đang chuyển|Đang tải|Đang lưu|Đang xử lý)/i.test(String(m))); t.style.display = "block"; clearTimeout(t._t); if (!t.classList.contains("is-loading")) t._t = setTimeout(() => (t.style.display = "none"), 2800); }
  function close() { ov.style.display = "none"; ov.innerHTML = ""; }
  function modal(title, html, mount) {
    ov.innerHTML = `<div class="lcln-bx"><div class="lcln-hd"><b>${title}</b><span id="lcln-cx">✕</span></div><div id="lcln-bd">${html}</div></div>`;
    ov.style.display = "flex"; $("#lcln-cx").onclick = close; mount && mount($("#lcln-bd"));
  }
  ov.onclick = (e) => { if (e.target === ov) close(); };

  /* ---------- Đăng nhập ---------- */
  async function enter(password) {
    if (password) await post("/api/admin-login", "POST", { password });
    const state = await api("/api/admin-login");
    if (!state.authenticated) throw new Error("Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.");
    const meta = await api(`/api/admin-html?side=${side}`);
    contentVersion = meta.updatedAt || "";
    await api("/api/admin-preview-session", { method: "POST" });
    $("#lcln-login").hidden = true; $("#lcln-app").hidden = false;
    f.src = side === "gai" ? "/index-gai" : "/index-nam";
  }
  $("#lcln-form").onsubmit = async (e) => { e.preventDefault(); try { await enter($("#lcln-pw").value); $("#lcln-pw").value = ""; } catch (er) { $("#lcln-msg").textContent = er.message; } };
  enter().catch(() => { $("#lcln-login").hidden = false; $("#lcln-app").hidden = true; });

  /* ---------- Ảnh: chuyển WebP, giữ nguyên kích thước pixel ---------- */
  // Không resize/crop. EXIF orientation được áp dụng khi giải mã để ảnh không bị xoay sai.
  // GIF/ảnh động sẽ được chuyển thành WebP tĩnh (khung đầu tiên).
  async function shrink(file) {
    if (!file || !file.type.startsWith("image/")) throw new Error("Vui lòng chọn một tệp ảnh.");
    let source, width, height, cleanup = () => {};
    if (typeof createImageBitmap === "function") {
      try {
        let bitmap;
        try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
        catch { bitmap = await createImageBitmap(file); }
        source = bitmap; width = bitmap.width; height = bitmap.height;
        cleanup = () => bitmap.close && bitmap.close();
      } catch (_) { /* fallback cho trình duyệt/định dạng chưa hỗ trợ createImageBitmap */ }
    }
    if (!source) {
      const objectUrl = URL.createObjectURL(file);
      try {
        const image = await new Promise((resolve, reject) => {
          const img = new Image(); img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("Trình duyệt không đọc được ảnh này. Hãy chuyển ảnh sang JPG hoặc PNG rồi thử lại."));
          img.src = objectUrl;
        });
        source = image; width = image.naturalWidth; height = image.naturalHeight;
        cleanup = () => URL.revokeObjectURL(objectUrl);
      } catch (error) { URL.revokeObjectURL(objectUrl); throw error; }
    }
    try {
      if (!width || !height) throw new Error("Ảnh không hợp lệ.");
      const canvas = document.createElement("canvas");
      // Kích thước canvas khớp 1:1 với ảnh đã giải mã; tuyệt đối không thu nhỏ.
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("Trình duyệt không hỗ trợ xử lý ảnh.");
      context.drawImage(source, 0, 0, width, height);
      const encode = quality => new Promise((resolve, reject) => canvas.toBlob(blob => {
        if (!blob || blob.type !== "image/webp") return reject(new Error("Trình duyệt không hỗ trợ xuất WebP."));
        resolve(blob);
      }, "image/webp", quality));
      let blob = await encode(0.84);
      if (blob.size > 8 * 1024 * 1024) blob = await encode(0.76);
      if (blob.size > 28 * 1024 * 1024) throw new Error("Ảnh WebP vẫn vượt giới hạn tải lên 28 MB. Hãy chọn ảnh khác hoặc giảm dung lượng nguồn mà không đổi kích thước.");
      return blob;
    } finally { cleanup(); }
  }
  async function uploadAsset(blob, catName = "wed") {
    const ticket = await post("/api/admin-upload", "POST", { intent: "signed-upload", mime: blob.type, cat: catName });
    const uploaded = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": blob.type }, body: blob });
    if (!uploaded.ok) throw new Error("Supabase Storage từ chối tệp tải lên. Hãy kiểm tra bucket và quyền Storage.");
    return ticket.url;
  }
  async function libModal(cb, c = "wed") {
    let L; try { L = (await api("/api/admin-images")).images; } catch (e) { return toast(e.message); }
    const draw = () => {
      const list = L.filter((u) => cat(u) == c);
      modal(cb ? "Chọn ảnh thay thế" : "Thư viện ảnh",
        `<div class="lcln-tabs">${Object.keys(LN).map((k) => `<button data-c="${k}" class="${k == c ? "on" : ""}">${LN[k]} (${L.filter((u) => cat(u) == k).length})</button>`).join("")}</div>
         <div class="lcln-grid">${list.map((s, i) => `<div class="lcln-th"><img src="${esc(s)}" data-i="${i}">${(s.startsWith("/uploads/") || s.includes("/storage/v1/object/public/wedding-assets/")) ? `<span data-d="${i}">✕</span>` : ""}</div>`).join("")}
         <label class="lcln-th" style="display:grid;place-items:center;font-size:30px;cursor:pointer">＋<input type="file" accept="image/*" multiple hidden></label></div>`,
        (b) => {
          b.querySelectorAll("[data-c]").forEach((x) => (x.onclick = () => { c = x.dataset.c; draw(); }));
          b.querySelectorAll("img").forEach((x) => (x.onclick = () => { if (cb) { const s = list[x.dataset.i]; close(); cb(s); } }));
          b.querySelectorAll("[data-d]").forEach((x) => (x.onclick = async () => {
            if (!confirm("Xoá ảnh này khỏi server?")) return;
            try { await post("/api/admin-upload", "DELETE", { url: list[x.dataset.d] }); L = L.filter((u) => u !== list[x.dataset.d]); draw(); } catch (e) { toast(e.message); }
          }));
          b.querySelector("input").onchange = async (e) => {
            const files = [...(e.target.files || [])]; if (!files.length) return;
            try {
              for (const fl of files) {
                toast(`Chuyển ${fl.name} sang WebP (giữ nguyên kích thước)…`);
                const webpBlob = await shrink(fl);
                const url = await uploadAsset(webpBlob, c);
                L.push(url);
              }
              draw(); toast(`Đã chuyển và tải lên ${files.length} ảnh WebP, giữ nguyên kích thước ✓`);
            } catch (er) { toast(er.message); }
            finally { e.target.value = ""; }
          };
        });
    };
    draw();
  }
  const setGal = (box, l) => (box.innerHTML = l.map((s, i) => `<div class="gallery-grid__item"><img class="gallery-grid__image" src="${s}" alt="Ảnh Gallery ${i + 1}"></div>`).join(""));
  function setSld(st, l) {
    const n = l.length, c = Math.min(3, n - 1);
    st.innerHTML = l.map((s, i) => `<div class="slide" data-index="${i}"><img src="${s}" alt="Slider ${i + 1}"></div>`).join("");
    [...st.children].forEach((e, i) => { let o = i - c; if (o < -3) o += n; if (o > 3) o -= n; e.className = "slide" + (o == 0 ? " active" : o < 0 ? ` left left-${-o}` : ` right right-${o}`); });
  }
  const grp = (el) => el.closest(".gallery-grid") ? { box: el.closest(".gallery-grid"), q: ".gallery-grid__item img", set: setGal }
    : el.closest("#stage") ? { box: doc.getElementById("stage"), q: ".slide img", set: setSld } : null;
  function albumModal(g) {
    const L = () => [...g.box.querySelectorAll(g.q)].map((i) => i.getAttribute("src"));
    const draw = () => modal("Album ảnh", `<div class="lcln-grid">${L().map((s, i) => `<div class="lcln-th"><img src="${esc(s)}" data-i="${i}"><span data-d="${i}">✕</span></div>`).join("")}
      <div class="lcln-th" data-add style="display:grid;place-items:center;font-size:30px;cursor:pointer">＋</div></div>
      <p style="font-size:12px;color:#666">Chạm ảnh để thay · ✕ để xoá · ＋ để thêm ảnh.</p>`, (b) => {
      const re = (l) => { g.set(g.box, l); draw(); };
      b.querySelectorAll("img").forEach((x) => (x.onclick = () => libModal((s) => { const l = L(); l[x.dataset.i] = s; re(l); })));
      b.querySelectorAll("[data-d]").forEach((x) => (x.onclick = () => { const l = L(); l.splice(x.dataset.d, 1); re(l); }));
      b.querySelector("[data-add]").onclick = () => libModal((s) => re([...L(), s]));
    });
    draw();
  }

  /* ---------- Ngày / Địa chỉ / Map: lưu riêng cho từng nhà ---------- */
  const SIDE_NAME = { trai: "Nhà trai", gai: "Nhà gái" };
  const sync = () => { cfgEl.textContent = JSON.stringify(cfg, null, 2); w.lclnApplySide(side); };
  function dateModal() {
    const c = cfg[side] || {};
    modal(`Ngày giờ cưới – ${SIDE_NAME[side]}`, `<label>Ngày<input type="date" id="lcln-d" value="${c.date || ""}"></label><label>Giờ<input type="time" id="lcln-t" value="${c.time || "08:00"}"></label><button class="lcln-pri" id="lcln-ok">Áp dụng cho lịch & đếm ngược</button>`, () => {
      $("#lcln-ok").onclick = () => { const d = $("#lcln-d").value; if (!d) return; cfg[side] = { ...c, date: d, time: $("#lcln-t").value || "00:00" }; sync(); close(); };
    });
  }
  function mapModal() {
    const c = cfg[side] || {};
    modal(`Địa chỉ & bản đồ – ${SIDE_NAME[side]}`, `<label>Địa chỉ hiển thị<input id="lcln-a" value="${esc(c.address || "")}"></label><label>Link Google Maps hoặc mã nhúng &lt;iframe&gt;<textarea id="lcln-u" rows="4">${esc(c.map || "")}</textarea></label><button class="lcln-pri" id="lcln-ok">Áp dụng cho bản đồ & nút Chỉ đường</button>`, () => {
      $("#lcln-ok").onclick = () => {
        let v = $("#lcln-u").value.trim(); const m = v.match(/src="([^"]+)"/); if (m) v = m[1].replace(/&amp;/g, "&");
        const n = { ...c, address: $("#lcln-a").value.trim() };
        if (v.includes("/embed")) { n.embed = v; n.map = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(n.address); }
        else { n.embed = ""; n.map = v || c.map; }
        cfg[side] = n; sync(); close();
      };
    });
  }
  function linkModal(a) {
    modal("Đường dẫn", `<input id="lcln-u" value="${esc(a.getAttribute("href") || "")}"><button class="lcln-pri" id="lcln-ok">Áp dụng</button>`, () => {
      $("#lcln-ok").onclick = () => { a.setAttribute("href", $("#lcln-u").value.trim()); close(); };
    });
  }

  /* ---------- Chọn / sửa ---------- */
  const hex = (c) => { const m = c.match(/[\d.]+/g); if (!m || (m.length > 3 && +m[3] == 0)) return "#ffffff"; return "#" + m.slice(0, 3).map((x) => (+x).toString(16).padStart(2, "0")).join(""); };
  function select(e) {
    sel && sel.classList.remove("lcln-sel"); sel = e;
    if (!e) { $("#lcln-bar").style.display = "none"; return; }
    e.classList.add("lcln-sel");
    const cs = w.getComputedStyle(e);
    $("#lcln-c").value = hex(cs.color); $("#lcln-b").value = hex(cs.backgroundColor); $("#lcln-fs").value = Math.round(parseFloat(cs.fontSize));
    $("#lcln-fx").value = e.dataset.fx || ""; $("#lcln-fxs").value = e.dataset.fxSpeed || "";
    $("#lcln-bar").style.display = "flex";
  }
  $("#lcln-c").oninput = (e) => sel && (sel.style.color = e.target.value);
  $("#lcln-b").oninput = (e) => sel && (sel.style.backgroundColor = e.target.value);
  $("#lcln-fs").oninput = (e) => sel && e.target.value && (sel.style.fontSize = e.target.value + "px");
  $("#lcln-cl").onclick = () => { if (sel) { sel.style.color = sel.style.backgroundColor = sel.style.fontSize = ""; select(sel); } };

  // Hiệu ứng hiện khi cuộn: lưu vào data-fx / data-fx-speed của đối tượng đang chọn
  function previewFx(el) {
    const fx = el.dataset.fx;
    if (fx === "none") return toast("Đối tượng này không có hiệu ứng");
    const cls = ["lcln-rv", "lcln-rv-" + (fx || "up")];
    if (el.dataset.fxSpeed) cls.push("lcln-rv-" + el.dataset.fxSpeed);
    el.classList.add(...cls); void el.offsetWidth;
    w.requestAnimationFrame(() => el.classList.add("lcln-seen"));
    setTimeout(() => el.classList.remove(...cls, "lcln-seen"), 2200);
  }
  $("#lcln-fx").onchange = (e) => { if (!sel) return; e.target.value ? (sel.dataset.fx = e.target.value) : delete sel.dataset.fx; previewFx(sel); };
  $("#lcln-fxs").onchange = (e) => { if (!sel) return; e.target.value ? (sel.dataset.fxSpeed = e.target.value) : delete sel.dataset.fxSpeed; previewFx(sel); };
  $("#lcln-fxp").onclick = () => sel && previewFx(sel);

  const TW = ".widget-main-btn,.radial-item,.sub-item,#giftBox,#hintId,#js-open-rsvp,a.wedding-btn";
  function closeInner() {
    const g = (i) => doc.getElementById(i);
    g("qrModal")?.classList.remove("show");
    g("js-modal-rsvp")?.classList.add("is-hidden"); g("js-modal-profile")?.classList.add("is-hidden");
    g("js-wedding-widget")?.classList.remove("open-main", "open-share", "open-contact");
  }
  function inner(W) { // click lần 2: mở nội dung ẩn bên trong
    const g = (i) => doc.getElementById(i), wd = g("js-wedding-widget");
    if (W.matches("#giftBox,#hintId")) { g("qrModal").classList.add("show"); return 1; }
    if (W.id === "js-open-rsvp") { g("js-modal-rsvp").classList.remove("is-hidden"); return 1; }
    if (W.matches(".widget-main-btn")) { wd.classList.toggle("open-main"); wd.classList.remove("open-share", "open-contact"); return 1; }
    if (W.matches(".radial-item")) { const c = W.matches(".item-share-main") ? "open-share" : "open-contact", o = wd.classList.contains(c); wd.classList.remove("open-share", "open-contact"); if (!o) wd.classList.add(c); return 1; }
    if (W.matches("a.sub-item,a.wedding-btn")) { linkModal(W); return 1; }
  }
  function textEdit(t, W) {
    let n = t;
    if (W) n = t.closest(".tooltip") || (txt(W) ? W : null);
    else while (n && !/^(SECTION|MAIN|BODY|HTML)$/.test(n.tagName) && !txt(n)) n = n.parentElement;
    if (!n || /^(SECTION|MAIN|BODY|HTML)$/.test(n.tagName)) { select(W || t.closest("section") || t); return; }
    n.contentEditable = "true"; select(n); n.focus();
  }
  function tbAct(b) {
    const s = b.closest("section"), a = b.dataset.a;
    if (a == "up") { const p = s.previousElementSibling; if (p && p.tagName == "SECTION" && !p.classList.contains("intro_thu")) p.before(s); }
    if (a == "dn") { const n = s.nextElementSibling; if (n && n.tagName == "SECTION") n.after(s); }
    if (a == "del" && confirm("Xoá section này?")) { s.remove(); select(null); }
    if (a == "bg") select(s);
    if (a == "dup") {
      if (s.querySelector("[id]") && !confirm("Section có chức năng riêng (id) – bản sao có thể không chạy. Vẫn nhân bản?")) return;
      const c = s.cloneNode(true); c.querySelectorAll(".lcln-tb").forEach((x) => x.remove()); s.after(c); addTb();
    }
  }
  function addTb() {
    doc.querySelectorAll("main>section:not(.intro_thu)").forEach((s) => {
      if (s.querySelector(":scope>.lcln-tb")) return;
      const d = doc.createElement("div"); d.className = "lcln-tb"; d.contentEditable = "false";
      d.innerHTML = '<span class="lcln-dh" draggable="true" title="Kéo để di chuyển">⠿</span><button data-a="up">▲</button><button data-a="dn">▼</button><button data-a="dup">⧉</button><button data-a="bg">🎨</button><button data-a="del">✕</button>';
      s.prepend(d);
    });
  }
  function setEdit(on) {
    edit = on; $("#lcln-tg").checked = on; $("#lcln-add").style.display = on ? "block" : "none";
    doc.documentElement.classList.toggle("lcln-edit", on);
    if (on) addTb();
    else { doc.querySelectorAll(".lcln-tb").forEach((x) => x.remove()); doc.querySelectorAll("[contenteditable]").forEach((x) => x.removeAttribute("contenteditable")); select(null); closeInner(); }
  }
  const TPL = {
    "Tiêu đề": '<h2 class="title-big"><span>Tiêu đề mới</span></h2>',
    "Đoạn văn": '<p class="text_message">Nội dung mới…</p>',
    "Ảnh đơn": '<img src="./asset/img/mau1.webp" alt="" style="width:80%;display:block;margin:12px auto;border-radius:12px">',
    "Album ảnh (lưới)": '<div class="gallery-grid" data-lightbox>' + ["mau1", "mau2", "mau13"].map((n, i) => `<div class="gallery-grid__item"><img class="gallery-grid__image" src="./asset/img/${n}.webp" alt="Ảnh ${i + 1}"></div>`).join("") + "</div>",
    "Nút bấm": '<div class="wedding-btn-group"><a class="wedding-btn" href="#">Nút mới</a></div>',
  };
  $("#lcln-add").onclick = () => modal("Thêm section mới", Object.keys(TPL).map((k) => `<div class="lcln-it" data-k="${k}">＋ ${k}</div>`).join("") + '<p style="font-size:12px;color:#666">Muốn nhân bản section có sẵn: dùng nút ⧉ trên thanh công cụ của section.</p>', (b) => {
    b.querySelectorAll("[data-k]").forEach((x) => (x.onclick = () => {
      const s = doc.createElement("section"); s.innerHTML = TPL[x.dataset.k]; doc.querySelector("main>footer").before(s); addTb(); s.scrollIntoView({ behavior: "smooth" }); close();
    }));
  });

  /* ---------- Thư viện giao diện HTML/CSS/JS tự tạo ---------- */
  const safeText = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const componentSide = () => side === "gai" ? "gai" : "nam";
  async function getComponents() {
    return (await api(`/api/admin-components?side=${componentSide()}`)).components || [];
  }
  function componentEditor(item = {}) {
    const isEdit = !!item.id;
    modal(isEdit ? "Sửa giao diện bằng code" : "Tạo giao diện bằng code", `
      <div class="lcln-code-form">
        <label>Tiêu đề giao diện<input id="lcln-cmp-title" maxlength="120" placeholder="Ví dụ: Khung lời chúc nổi bật"></label>
        <label>Ghi chú / mô tả<textarea id="lcln-cmp-note" rows="2" maxlength="1000" placeholder="Mục đích, cách dùng, lưu ý..."></textarea></label>
        <label>HTML<textarea id="lcln-cmp-html" rows="8" spellcheck="false" placeholder="<div class=\"my-component\">...</div>"></textarea></label>
        <label>CSS<textarea id="lcln-cmp-css" rows="7" spellcheck="false" placeholder=".my-component { ... }"></textarea></label>
        <label>JavaScript<textarea id="lcln-cmp-js" rows="7" spellcheck="false" placeholder="// Mã chạy khi khách mở thiệp"></textarea></label>
        <div class="lcln-code-actions"><button type="button" id="lcln-cmp-preview">▶ Xem trước</button><button type="button" class="lcln-pri" id="lcln-cmp-save">💾 Lưu giao diện</button></div>
        <iframe id="lcln-cmp-preview-frame" title="Xem trước giao diện" sandbox="allow-scripts" style="width:100%;height:260px;background:#fff;border:1px solid #ddd;border-radius:10px;margin-top:10px"></iframe>
        <p class="lcln-code-warning">Chỉ nhập code bạn tin tưởng. JavaScript đã lưu sẽ chạy trên trang thiệp của khách. Hãy đặt tên class riêng để CSS không ảnh hưởng các phần khác.</p>
      </div>`, (b) => {
      const byId = (id) => b.querySelector(`#${id}`);
      byId("lcln-cmp-title").value = item.title || "";
      byId("lcln-cmp-note").value = item.note || "";
      byId("lcln-cmp-html").value = item.html || "";
      byId("lcln-cmp-css").value = item.css || "";
      byId("lcln-cmp-js").value = item.js || "";
      const preview = () => {
        const html = byId("lcln-cmp-html").value;
        const css = byId("lcln-cmp-css").value.replace(/<\/style/gi, "<\\/style");
        const js = byId("lcln-cmp-js").value.replace(/<\/script/gi, "<\\/script");
        const src = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui;margin:12px;color:#222}${css}</style></head><body>${html}<script>try{${js}}catch(e){document.body.insertAdjacentHTML('beforeend','<pre style="color:#b91c1c">JS lỗi: '+String(e).replace(/[&<>]/g,' ')+'</pre>')}<\/script></body></html>`;
        byId("lcln-cmp-preview-frame").srcdoc = src;
      };
      byId("lcln-cmp-preview").onclick = preview;
      byId("lcln-cmp-save").onclick = async () => {
        const data = { id: item.id, title: byId("lcln-cmp-title").value.trim(), note: byId("lcln-cmp-note").value.trim(), html: byId("lcln-cmp-html").value, css: byId("lcln-cmp-css").value, js: byId("lcln-cmp-js").value };
        if (!data.title) return toast("Vui lòng nhập tiêu đề giao diện.");
        try { await post(`/api/admin-components?side=${componentSide()}`, "POST", data); toast("Đã lưu giao diện vào thư viện"); await componentLibrary(); }
        catch (e) { toast(e.message); }
      };
    });
  }
  async function insertComponent(item) {
    if (!doc || !doc.querySelector("main")) return toast("Thiệp chưa tải xong.");
    if (!confirm(`Chèn giao diện “${item.title}” vào thiệp ${SIDE_NAME[side]}? Sau đó bấm Lưu thay đổi.`)) return;
    const id = `lcln-custom-${String(item.id).replace(/[^a-z0-9_-]/gi, "-")}`;
    const section = doc.createElement("section");
    section.className = "lcln-custom-section";
    section.dataset.lclnComponent = item.id;
    section.id = id;
    const style = doc.createElement("style");
    style.textContent = item.css || "";
    section.appendChild(style);
    const mount = doc.createElement("div");
    mount.className = `${id}-content`;
    mount.innerHTML = item.html || "";
    section.appendChild(mount);
    const script = doc.createElement("script");
    script.textContent = item.js || "";
    section.appendChild(script);
    const foot = doc.querySelector("main>footer");
    if (foot) foot.before(section); else doc.querySelector("main").appendChild(section);
    if (edit) addTb(); section.scrollIntoView({ behavior: "smooth", block: "start" }); close();
    toast("Đã chèn giao diện. Bấm Lưu thay đổi để xuất bản.");
  }
  async function componentLibrary() {
    let list;
    try { list = await getComponents(); } catch (e) { return toast(e.message); }
    const draw = () => modal(`Thư viện giao diện – ${SIDE_NAME[side]}`, `
      <div class="lcln-code-actions"><button type="button" class="lcln-pri" id="lcln-cmp-new">＋ Tạo giao diện mới</button></div>
      <p class="lcln-code-hint">Các giao diện đã lưu ở Supabase và dùng lại được khi cần. Chọn “Chèn vào thiệp”, sau đó bấm “Lưu thay đổi” để xuất bản.</p>
      <div class="lcln-component-list">${list.length ? list.map((x) => `<article class="lcln-component-card"><strong>${safeText(x.title)}</strong><p>${safeText(x.note || "Chưa có ghi chú")}</p><small>Cập nhật: ${safeText(x.updatedAt ? new Date(x.updatedAt).toLocaleString("vi-VN") : "—")}</small><div class="lcln-code-actions"><button data-insert="${safeText(x.id)}">＋ Chèn vào thiệp</button><button data-edit="${safeText(x.id)}">✏️ Sửa code</button><button data-del="${safeText(x.id)}">🗑 Xoá</button></div></article>`).join("") : '<p>Chưa có giao diện nào. Bấm “Tạo giao diện mới” để bắt đầu.</p>'}</div>`, (b) => {
      b.querySelector("#lcln-cmp-new").onclick = () => componentEditor();
      b.querySelectorAll("[data-insert]").forEach((el) => el.onclick = () => insertComponent(list.find((x) => x.id === el.dataset.insert)));
      b.querySelectorAll("[data-edit]").forEach((el) => el.onclick = () => componentEditor(list.find((x) => x.id === el.dataset.edit)));
      b.querySelectorAll("[data-del]").forEach((el) => el.onclick = async () => {
        const item = list.find((x) => x.id === el.dataset.del);
        if (!item || !confirm(`Xoá mẫu “${item.title}” khỏi thư viện? Những bản đã chèn vào thiệp trước đó không tự bị xoá.`)) return;
        try { await post(`/api/admin-components?side=${componentSide()}`, "DELETE", { id: item.id }); list = list.filter((x) => x.id !== item.id); draw(); toast("Đã xoá mẫu khỏi thư viện."); }
        catch (e) { toast(e.message); }
      });
    });
  }

  function bind() {
    doc.addEventListener("click", (e) => {
      if (!edit) return;
      const t = e.target; e.preventDefault(); e.stopPropagation();
      const tb = t.closest(".lcln-tb button"); if (tb) return tbAct(tb);
      if (t.closest(".lcln-tb")) return;
      const bd = t.closest("#qrModal,#js-modal-rsvp,#js-modal-profile");
      if (bd && (t === bd || t.closest(".modal_hed button,.wedding-btn--close"))) return closeInner();
      const img = t.closest("img");
      if (img) {
        if (img.closest(".lcln-ls-section,#lcln-ls-viewer")) {
          const slide = img.closest(".lcln-ls-slide");
          const index = slide ? Number(slide.querySelector(".lcln-ls-photo")?.dataset.i) : -1;
          const dataNode = doc.getElementById("lcln-story-data");
          if (!dataNode || !Number.isInteger(index) || index < 0) return toast("Không xác định được ảnh câu chuyện.");
          return libModal((url) => {
            try {
              const data = JSON.parse(dataNode.textContent);
              if (!data[index]) return toast("Không tìm thấy ảnh cần đổi.");
              data[index].img = url;
              dataNode.textContent = "\n" + JSON.stringify(data, null, 2) + "\n";
              img.src = url;
              toast("Đã đổi ảnh. Nhấn Lưu thay đổi để áp dụng.");
            } catch { toast("Không thể cập nhật dữ liệu ảnh."); }
          }, "wed");
        }
        const g = grp(img); return g ? albumModal(g) : libModal((s) => { img.src = s; }, cat(img.getAttribute("src") || "").replace(/^\./, ""));
      }
      if (t.closest(".countdown-card,.calendar-card,.date-top .thu-gio,.date-top .ngay")) return dateModal();
      if (t.closest(".section_five .content_map,.section_five .wedding-btn-group a")) return mapModal();
      const W = t.closest(TW);
      if (W) { if (lastW === W && inner(W)) return; lastW = W; } else lastW = null;
      textEdit(t, W);
    }, true);
    doc.addEventListener("input", (e) => { // sửa chữ trực tiếp ở địa chỉ / dòng âm lịch => lưu vào đúng nhà đang sửa
      const t = e.target, c = cfg[side] || (cfg[side] = {});
      if (t.closest && t.closest(".address")) c.address = t.textContent.replace(/^📍\s*/, "").trim();
      else if (t.closest && t.closest(".date-top>p:last-child")) c.lunar = t.textContent.trim();
      else return;
      cfgEl.textContent = JSON.stringify(cfg, null, 2);
    });
    // Kéo thả bằng chuột (desktop)
    doc.addEventListener("dragstart", (e) => { const h = e.target.closest && e.target.closest(".lcln-dh"); if (h) { drag = h.closest("section"); e.dataTransfer.setData("text", "lcln-section"); } });
    doc.addEventListener("dragover", (e) => { if (!drag) return; const s = e.target.closest("main>section"); if (s && !s.classList.contains("intro_thu")) e.preventDefault(); });
    doc.addEventListener("drop", (e) => {
      const s = e.target.closest("main>section");
      if (drag && s && s !== drag && !s.classList.contains("intro_thu")) { e.preventDefault(); const r = s.getBoundingClientRect(); e.clientY < r.top + r.height / 2 ? s.before(drag) : s.after(drag); }
      drag = null;
    });
    // Kéo thả bằng ngón tay (mobile/tablet), không phụ thuộc HTML5 drag vốn không ổn định trên iOS
    let pointerSection = null;
    let pointerId = null;
    doc.addEventListener("pointerdown", (e) => {
      const handle = e.target.closest && e.target.closest(".lcln-dh");
      if (!edit || !handle || e.pointerType === "mouse") return;
      pointerSection = handle.closest("main>section");
      pointerId = e.pointerId;
      handle.setPointerCapture?.(pointerId);
      pointerSection?.classList.add("lcln-mobile-dragging");
      e.preventDefault();
    }, true);
    doc.addEventListener("pointerup", (e) => {
      if (!pointerSection || e.pointerId !== pointerId) return;
      const target = doc.elementFromPoint(e.clientX, e.clientY)?.closest("main>section");
      if (target && target !== pointerSection && !target.classList.contains("intro_thu")) {
        const rect = target.getBoundingClientRect();
        e.clientY < rect.top + rect.height / 2 ? target.before(pointerSection) : target.after(pointerSection);
      }
      pointerSection.classList.remove("lcln-mobile-dragging");
      pointerSection = null;
      pointerId = null;
    }, true);
    doc.addEventListener("pointercancel", () => {
      pointerSection?.classList.remove("lcln-mobile-dragging");
      pointerSection = null;
      pointerId = null;
    }, true);
  }

  /* ---------- Lưu / Reset / Nhạc ---------- */
  const JUNK = ["lcln-sel", "lcln-ls-away", "lcln-ls-hold", "lcln-ls-open", "lcln-ls-drag"];
  async function save() {
    try {
      closeInner();
      // Lấy bản gốc trên server rồi chỉ thay các section => không lẫn nội dung do JS sinh ra (lời chúc, hiệu ứng...)
      const orig = new DOMParser().parseFromString(await (await fetch(side === "gai" ? "/index-gai" : "/index-nam", { cache: "no-store" })).text(), "text/html");
      const om = orig.querySelector("main"), foot = om.querySelector(":scope>footer");
      om.querySelectorAll(":scope>section").forEach((s) => { if (!s.classList.contains("intro_thu")) s.remove(); });
      doc.querySelectorAll("main>section:not(.intro_thu)").forEach((s) => {
        const c = s.cloneNode(true);
        c.querySelectorAll(".lcln-tb").forEach((x) => x.remove());
        [c, ...c.querySelectorAll("*")].forEach((x) => { x.removeAttribute("contenteditable"); x.classList.remove(...JUNK); [...x.classList].forEach((k) => { if (/^lcln-rv|^lcln-seen$/.test(k)) x.classList.remove(k); }); if (x.getAttribute("class") === "") x.removeAttribute("class"); });
        const wl = c.querySelector("#js-wall-list"); if (wl) wl.innerHTML = "";
        c.querySelector("#qrModal")?.classList.remove("show");
        c.querySelectorAll("#js-modal-rsvp,#js-modal-profile").forEach((x) => x.classList.add("is-hidden"));
        c.querySelector("#js-wedding-widget")?.classList.remove("open-main", "open-share", "open-contact");
        c.querySelector(".lightbox-modal")?.classList.remove("is-active");
        foot.insertAdjacentHTML("beforebegin", c.outerHTML);
      });
      if (music) orig.getElementById("my_audio")?.setAttribute("src", music);
      const se = orig.getElementById("lcln-sides"); if (se) se.textContent = "\n" + JSON.stringify(cfg, null, 2) + "\n    ";
      const storySource = doc.getElementById("lcln-story-data"), storyTarget = orig.getElementById("lcln-story-data");
      if (storySource && storyTarget) storyTarget.textContent = storySource.textContent;
      const saved = await api(`/api/admin-html?side=${side}`, { method: "PUT", headers: { "Content-Type": "text/plain", "If-Match": contentVersion }, body: "<!doctype html>\n" + orig.documentElement.outerHTML });
      contentVersion = saved.updatedAt || contentVersion;
      music = null; toast("Đã lưu thành công ✓ – khách sẽ thấy nội dung mới khi tải lại thiệp");
    } catch (e) { toast(e.message); }
  }
  $("#lcln-sv").onclick = save;
  $("#lcln-m2").onclick = () => modal("Đổi nhạc nền (mp3)", '<input type="file" id="lcln-m" accept="audio/*"><p style="font-size:12px">Chọn xong sẽ tải lên và nghe thử ngay. Bấm Lưu để thay nhạc cũ trên trang khách.</p>', () => {
    $("#lcln-m").onchange = (e) => {
      const fl = e.target.files[0]; if (!fl) return;
      if (fl.size > 28 * 1024 * 1024) return toast("File quá lớn (tối đa ~28MB)");
      (async () => {
        try {
          toast("Đang tải nhạc lên…");
          const url = await uploadAsset(fl, "music");
          music = url; const a = doc.getElementById("my_audio"); a.src = url; a.play().catch(() => {});
          close(); toast("Đã tải nhạc – bấm Lưu để áp dụng");
        } catch (er) { toast(er.message); }
      })();
    };
  });
  $("#lcln-m1").onclick = () => libModal(null);
  $("#lcln-components").onclick = () => componentLibrary();
  $("#lcln-album").onclick = () => { location.href = "/admin-album"; };
  $("#lcln-logout").onclick = async () => {
    try { await api("/api/admin-login", { method: "DELETE" }); }
    catch (e) { toast(e.message); return; }
    f.src = "about:blank"; $("#lcln-app").hidden = true; $("#lcln-login").hidden = false;
    $("#lcln-pw").value = ""; $("#lcln-msg").textContent = "Đã đăng xuất an toàn.";
  };
  $("#lcln-security").onclick = async () => {
    try {
      const state = await api("/api/admin-access");
      modal("Bảo mật trang Client", `<p style="font-size:13px;color:#666;line-height:1.6">Khi bật, khách phải nhập mật khẩu để xem thiệp và album. Admin vẫn dùng mật khẩu quản trị riêng.</p><label style="display:flex;gap:8px;align-items:center;margin:14px 0"><input id="lcln-access-enabled" type="checkbox" ${state.enabled ? "checked" : ""}> Yêu cầu mật khẩu khi truy cập Client</label><label>Mật khẩu Client mới (để trống nếu giữ nguyên)<input id="lcln-access-password" type="password" minlength="10" maxlength="128" autocomplete="new-password" placeholder="Tối thiểu 10 ký tự"></label><p style="font-size:12px;color:#777">${state.hasPassword ? "Đã có mật khẩu Client." : "Chưa thiết lập mật khẩu."} Giới hạn 3 lần sai, khóa 15 giây rồi tăng gấp đôi sau mỗi lần khóa tiếp theo.</p><button class="lcln-pri" id="lcln-access-save">Lưu bảo mật</button>`, (b) => {
        b.querySelector("#lcln-access-save").onclick = async () => {
          const enabled = b.querySelector("#lcln-access-enabled").checked;
          const password = b.querySelector("#lcln-access-password").value;
          try { await post("/api/admin-access", "PUT", { enabled, password }); await api("/api/admin-preview-session", { method: "POST" }); close(); toast(enabled ? "Đã bật bảo mật Client ✓" : "Đã tắt yêu cầu mật khẩu Client ✓"); } catch (e) { toast(e.message); }
        };
      });
    } catch (e) { toast(e.message); }
  };
  $("#lcln-m3").onclick = () => modal("Reset", '<button class="lcln-pri" id="lcln-r1">Bỏ thay đổi chưa lưu</button><button id="lcln-r2">Hoàn tác lần lưu gần nhất</button><button id="lcln-r3" style="background:#b91c1c;color:#fff">Reset toàn bộ như ban đầu</button>', () => {
    const run = async (q, act) => {
      if (!confirm(q)) return;
      try { if (act) { const saved = await api(`/api/admin-html?side=${side}`, { method: "PUT", headers: { "x-admin-action": act, "If-Match": contentVersion }, body: "" }); contentVersion = saved.updatedAt || contentVersion; } music = null; close(); w.location.reload(); } catch (e) { toast(e.message); }
    };
    $("#lcln-r1").onclick = () => run("Bỏ mọi thay đổi chưa lưu?");
    $("#lcln-r2").onclick = () => run("Quay lại phiên bản trước lần lưu gần nhất?", "undo");
    $("#lcln-r3").onclick = () => run("Đưa TOÀN BỘ trang về như ban đầu (bản gốc trước lần lưu đầu tiên)?", "reset-all");
  });
  $("#lcln-mb").onclick = () => { const m = $("#lcln-mn"); m.style.display = m.style.display == "block" ? "none" : "block"; };
  $("#lcln-mn").onclick = (e) => { if (e.target.closest("#lcln-m1,#lcln-m2,#lcln-m3,#lcln-m4,#lcln-components,#lcln-album,#lcln-security")) $("#lcln-mn").style.display = "none"; };
  const sideLabel = () => ($("#lcln-m4").textContent = `🔀 Đang sửa: ${SIDE_NAME[side]}`);
  sideLabel();
  function switchSide(next) {
    side = next;
    const url = new URL(location.href); url.searchParams.set("side", side); history.replaceState(null, "", url);
    sideLabel();
    const requestedSide = side;
    api(`/api/admin-html?side=${requestedSide === "gai" ? "gai" : "nam"}`).then((meta) => { if (side === requestedSide) contentVersion = meta.updatedAt || ""; }).catch((e) => toast(e.message));
    f.src = side === "trai" ? "/index-nam" : "/index-gai";
    toast("Đang mở giao diện " + SIDE_NAME[side]);
  }
  $("#lcln-side-nam").onclick = () => switchSide("trai");
  $("#lcln-side-gai").onclick = () => switchSide("gai");
  $("#lcln-tg").onchange = (e) => setEdit(e.target.checked);

  const CSS = `.intro_thu,#intro,#lcln-side-nav{display:none!important}
body.lcln-in-intro-active{position:static!important;overflow:auto!important;touch-action:auto!important}
.lcln-edit [contenteditable=true]{outline:2px dashed #f59e0b;outline-offset:2px;cursor:text}
.lcln-edit img,.lcln-edit .content_map,.lcln-edit .countdown-card,.lcln-edit .calendar-card{cursor:pointer}
.lcln-edit img:hover,.lcln-edit .content_map:hover,.lcln-edit .countdown-card:hover,.lcln-edit .calendar-card:hover{outline:3px solid #3b82f6;outline-offset:-3px}
.lcln-edit .map_iframe{pointer-events:none}
.lcln-edit .lcln-sel{outline:3px solid #16a34a!important;outline-offset:2px}
.lcln-edit main>section{position:relative}
.lcln-tb{position:absolute;top:6px;right:6px;z-index:99999;display:flex;gap:2px;background:#111c;padding:3px;border-radius:8px}
.lcln-tb button,.lcln-dh{all:unset;color:#fff;padding:5px 8px;cursor:pointer;font:600 14px system-ui}
.lcln-dh{cursor:grab}`;
  f.onload = () => {
    doc = f.contentDocument; w = f.contentWindow; sel = null; lastW = null;
    if (!doc.querySelector("main")) return;
    w.startAutoScroll = w.resumePageScroll = () => {}; // Admin không tự cuộn trang
    w.stopAutoScroll && w.stopAutoScroll();
    if (w.lclnWall) { w.lclnWall.start = w.lclnWall.show = w.lclnWall.focusMine = w.lclnWall.stop = () => {}; }
    const sw = doc.getElementById("weddingSlider"); if (sw) sw.replaceWith(sw.cloneNode(true)); // dừng autoplay slider khi sửa
    const st = doc.createElement("style"); st.textContent = CSS; doc.head.append(st);
    cfgEl = doc.getElementById("lcln-sides");
    try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { cfg = {}; }
    w.lclnApplySide(side); sideLabel();
    bind(); setEdit(edit);
  };
})();
