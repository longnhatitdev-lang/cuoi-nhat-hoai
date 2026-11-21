const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { HOST, PUBLIC_DIR, ROOT_DIR } = require("./config");
const { MIME_TYPES, sendJson } = require("./http-utils");

// Hai trang cùng dùng index.html, nội dung đổi theo đường dẫn
const PAGE_ROUTES = new Set(["/nha-trai", "/nha-gai", "/index-nam", "/index-gai", "/admin-nam", "/admin-gai"]);
const EXTRA_TYPES = { ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".ogg": "audio/ogg", ".wav": "audio/wav", ".webp": "image/webp", ".avif": "image/avif", ".woff2": "font/woff2" };
const COMPRESSIBLE = /^(text\/|application\/(javascript|json)|image\/svg)/;
const gzipCache = new Map(); // "đường dẫn|etag" -> Buffer (file nhỏ, tránh nén lại mỗi lần)

function getSafeFilePath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, `http://${HOST}`).pathname);
  let requestedPath = pathname;
  if (pathname === "/" || pathname === "/nha-trai" || pathname === "/index-nam") requestedPath = "/client/index-nam.html";
  else if (pathname === "/nha-gai" || pathname === "/index-gai") requestedPath = "/client/index-gai.html";
  else if (pathname === "/style.css") requestedPath = "/client/style.css";
  else if (pathname === "/javascript.js") requestedPath = "/client/javascript.js";
  else if (pathname === "/album" || pathname === "/album.html") requestedPath = "/client/album.html";
  else if (pathname === "/access") requestedPath = "/client/access.html";
  else if (pathname === "/admin-album") requestedPath = "/admin/album.html";
  else if (pathname === "/admin/album.js") requestedPath = "/admin/album.js";
  else if (pathname === "/album.css") requestedPath = "/client/album.css";
  else if (pathname === "/album.js") requestedPath = "/client/album.js";
  else if (pathname === "/admin.html" || pathname === "/admin") requestedPath = "/admin/index.html";
  else if (pathname === "/admin-nam") requestedPath = "/admin/index-nam.html";
  else if (pathname === "/admin-gai") requestedPath = "/admin/index-gai.html";
  else if (pathname === "/admin.css") requestedPath = "/admin/admin.css";
  else if (pathname === "/admin.js") requestedPath = "/admin/admin.js";
  else if (pathname.startsWith("/asset/") || pathname.startsWith("/uploads/")) requestedPath = "/public" + pathname;
  const allowedFiles = new Set([
    "/client/index-nam.html", "/client/index-gai.html", "/client/style.css", "/client/javascript.js",
    "/client/album.html", "/client/album.css", "/client/album.js", "/client/access.html",
    "/admin/album.html", "/admin/album.js",
    "/admin/index.html", "/admin/index-nam.html", "/admin/index-gai.html", "/admin/admin.css", "/admin/admin.js",
  ]);
  const isPublicAsset = requestedPath.startsWith("/public/asset/") || requestedPath.startsWith("/public/uploads/");
  if (!allowedFiles.has(requestedPath) && !isPublicAsset) return null;
  const filePath = path.resolve(ROOT_DIR, `.${requestedPath}`);
  if (filePath !== ROOT_DIR && !filePath.startsWith(`${ROOT_DIR}${path.sep}`)) return null;
  return filePath;
}

// HTML/CSS/JS: luôn hỏi lại (304 rất nhẹ nhờ ETag) để admin sửa là thấy ngay.
// Ảnh/nhạc: cho điện thoại lưu lại, đỡ tải lại mỗi lần mở thiệp.
function cacheControl(urlPath) {
  if (urlPath.startsWith("/public/uploads/")) return "public, max-age=31536000, immutable"; // tên file duy nhất
  if (urlPath.startsWith("/public/asset/")) return "public, max-age=86400";
  return "no-cache";
}

function serveStaticFile(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") return sendJson(response, 405, { error: "Method Not Allowed" });
  const pathOnly = new URL(request.url || "/", `http://${HOST}`).pathname;
  if (/^\/(nha-trai|nha-gai)\/+$/.test(pathOnly)) { response.writeHead(301, { Location: pathOnly.replace(/\/+$/, "") }); return response.end(); }
  let filePath;
  try { filePath = getSafeFilePath(request.url || "/"); } catch { return sendJson(response, 400, { error: "Bad Request" }); }
  if (!filePath) return sendJson(response, 403, { error: "Forbidden" });

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) return sendJson(response, 404, { error: "Not Found" });
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || EXTRA_TYPES[ext] || "application/octet-stream";
    const urlPath = "/" + path.relative(ROOT_DIR, filePath).split(path.sep).join("/");
    const etag = `W/"${stats.size.toString(16)}-${Math.floor(stats.mtimeMs).toString(16)}"`;
    const headers = { "Content-Type": type, "Cache-Control": cacheControl(urlPath), ETag: etag, "Last-Modified": stats.mtime.toUTCString(), "Accept-Ranges": "bytes" };

    if (request.headers["if-none-match"] === etag) { response.writeHead(304, headers); return response.end(); }

    // Range: bắt buộc cho nhạc/video trên iPhone (Safari không phát nếu server không hỗ trợ)
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range || "");
    if (range && (range[1] || range[2])) {
      let start = range[1] ? Number(range[1]) : stats.size - Number(range[2]);
      let end = range[1] && range[2] ? Math.min(Number(range[2]), stats.size - 1) : stats.size - 1;
      start = Math.max(start, 0);
      if (start > end || start >= stats.size) { response.writeHead(416, { "Content-Range": `bytes */${stats.size}` }); return response.end(); }
      response.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${stats.size}`, "Content-Length": end - start + 1 });
      if (request.method === "HEAD") return response.end();
      return fs.createReadStream(filePath, { start, end }).pipe(response);
    }

    const wantsGzip = COMPRESSIBLE.test(type) && stats.size > 1024 && /\bgzip\b/.test(request.headers["accept-encoding"] || "");
    if (wantsGzip) {
      const key = `${filePath}|${etag}`;
      const send = (buffer) => {
        response.writeHead(200, { ...headers, "Content-Encoding": "gzip", Vary: "Accept-Encoding", "Content-Length": buffer.length });
        response.end(request.method === "HEAD" ? undefined : buffer);
      };
      if (gzipCache.has(key)) return send(gzipCache.get(key));
      return fs.readFile(filePath, (err, data) => {
        if (err) return sendJson(response, 500, { error: "Read error" });
        zlib.gzip(data, { level: 9 }, (e, out) => {
          if (e) return sendJson(response, 500, { error: "Compress error" });
          if (gzipCache.size > 60) gzipCache.clear();
          gzipCache.set(key, out);
          send(out);
        });
      });
    }

    response.writeHead(200, { ...headers, "Content-Length": stats.size });
    if (request.method === "HEAD") return response.end();
    fs.createReadStream(filePath).pipe(response);
  });
}

module.exports = { serveStaticFile };
