const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { ROOT_DIR, PUBLIC_DIR, ADMIN_PASSWORD } = require("./config");
const { isAuthorized, readBody, sendJson } = require("./http-utils");

const IMAGE_RE = /\.(png|jpe?g|webp|gif|avif)$/i;
const CLIENT_DIR = path.join(ROOT_DIR, "client");
const SIDE_FILE = (side) => path.join(CLIENT_DIR, side === "gai" ? "index-gai.html" : "index-nam.html");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "uploads");
const BACKUP_DIR = path.join(ROOT_DIR, "backup"); // nằm ngoài public => khách không truy cập được
const ORIGINAL = path.join(BACKUP_DIR, "index.original.html"); // bản gốc, chụp lần lưu đầu tiên
const PREVIOUS = path.join(BACKUP_DIR, "index.previous.html"); // bản ngay trước lần lưu gần nhất
const EXT = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/ogg": "ogg", "audio/wav": "wav",
  "audio/x-wav": "wav", "audio/mp4": "m4a", "audio/aac": "aac",
};
const CATS = ["wed", "bg", "icon"];

function collectImages(rootDir, urlPrefix) {
  if (!fs.existsSync(rootDir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) result.push(...collectImages(full, urlPrefix + "/" + entry.name));
    else if (IMAGE_RE.test(entry.name)) result.push(urlPrefix + "/" + entry.name);
  }
  return result.sort();
}

async function handleAdminRequest(request, response, route) {
  if (!ADMIN_PASSWORD) return sendJson(response, 503, { error: "Chưa cấu hình ADMIN_PASSWORD trong .env" });
  if (!isAuthorized(request, ADMIN_PASSWORD)) return sendJson(response, 401, { error: "Sai mật khẩu quản trị" });
  try {
    if (route === "/api/admin-images" && request.method === "GET") {
      return sendJson(response, 200, { images: [...collectImages(UPLOAD_DIR, "/uploads"), ...collectImages(path.join(PUBLIC_DIR, "asset"), "/asset")] });
    }
    if (route === "/api/admin-html" && request.method === "GET") return sendJson(response, 200, { ok: true });

    if (route === "/api/admin-html" && request.method === "PUT") {
      const query = new URL(request.url || "/", "http://localhost").searchParams;
      const side = query.get("side") === "gai" ? "gai" : "trai";
      const indexFile = SIDE_FILE(side);
      const action = String(request.headers["x-admin-action"] || "");
      // Reset: "undo" = quay lại bản trước lần lưu gần nhất, "reset-all" = về bản gốc ban đầu
      if (action === "undo" || action === "reset-all") {
        const src = path.join(BACKUP_DIR, `index-${side}.${action === "undo" ? "previous" : "original"}.html`);
        if (!fs.existsSync(src)) return sendJson(response, 400, { error: "Chưa có bản sao lưu để khôi phục" });
        if (action === "undo") fs.copyFileSync(indexFile, path.join(BACKUP_DIR, `index-${side}.undone.html`));
        fs.copyFileSync(src, indexFile);
        return sendJson(response, 200, { ok: true });
      }
      const html = (await readBody(request)).toString();
      if (!html.includes("<html") || html.length > 10 * 1024 * 1024) return sendJson(response, 400, { error: "HTML không hợp lệ" });
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      if (fs.existsSync(indexFile)) {
        const original = path.join(BACKUP_DIR, `index-${side}.original.html`);
        const previous = path.join(BACKUP_DIR, `index-${side}.previous.html`);
        if (!fs.existsSync(original)) fs.copyFileSync(indexFile, original);
        fs.copyFileSync(indexFile, previous);
      }
      fs.writeFileSync(indexFile, html, "utf8");
      return sendJson(response, 200, { ok: true });
    }

    if (route === "/api/admin-upload" && request.method === "POST") {
      const data = JSON.parse((await readBody(request, 40 * 1024 * 1024)).toString());
      const url = String(data.dataUrl || "");
      const head = /^data:([\w.+-]+\/[\w.+-]+);base64,/.exec(url);
      const ext = head && EXT[head[1]];
      if (!ext) return sendJson(response, 400, { error: "Tệp không hợp lệ (chỉ ảnh png/jpg/webp/gif hoặc nhạc mp3...)" });
      const isAudio = head[1].startsWith("audio/");
      const bytes = Buffer.from(url.slice(head[0].length), "base64");
      if (!isAudio && head[1] !== "image/webp") return sendJson(response, 415, { error: "Ảnh phải được chuyển sang WebP trước khi tải lên." });
      if (!isAudio && (bytes.length < 12 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP")) return sendJson(response, 415, { error: "Dữ liệu ảnh không phải tệp WebP hợp lệ." });
      if (bytes.length > 30 * 1024 * 1024) return sendJson(response, 413, { error: "Tệp quá lớn (tối đa 30 MB)." });
      const sub = isAudio ? "music" : CATS.includes(data.cat) ? data.cat : "wed";
      const dir = path.join(UPLOAD_DIR, sub);
      fs.mkdirSync(dir, { recursive: true });
      const name = `${isAudio ? "music" : "image"}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}.${ext}`;
      fs.writeFileSync(path.join(dir, name), bytes);
      return sendJson(response, 201, { url: `/uploads/${sub}/${name}` });
    }

    if (route === "/api/admin-upload" && request.method === "DELETE") {
      const { url } = JSON.parse((await readBody(request, 4096)).toString());
      const target = path.resolve(PUBLIC_DIR, "." + decodeURIComponent(String(url || "")));
      if (!target.startsWith(UPLOAD_DIR + path.sep)) return sendJson(response, 403, { error: "Chỉ xoá được ảnh đã tải lên" });
      if (fs.existsSync(target)) fs.unlinkSync(target);
      return sendJson(response, 200, { ok: true });
    }
    return sendJson(response, 405, { error: "Method Not Allowed" });
  } catch (error) { return sendJson(response, 400, { error: error.message }); }
}
module.exports = { handleAdminRequest };
