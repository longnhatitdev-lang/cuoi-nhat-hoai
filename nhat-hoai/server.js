// Điểm khởi động của dự án: node server.js
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { HOST, PORT, PUBLIC_DIR } = require("./src/config");
const { serveStaticFile } = require("./src/static-server");
const { handleTelegramRequest } = require("./src/telegram");
const { handleAdminRequest } = require("./src/admin-api");
const { sendJson } = require("./src/http-utils");
const { handleWallRequest } = require("./src/wall-api");
const handleAlbumImages = require("./api/album-images");
const handleAccess = require("./api/access");
const handleAdminAccess = require("./api/admin-access");
const handleAdminAlbum = require("./api/admin-album");
const handleAdminPreviewSession = require("./api/admin-preview-session");
const handleAlbumPage = require("./api/album-page");
const { isClientAllowed } = require("./src/access-control");

const server = http.createServer(async (request, response) => {
  const route = new URL(request.url || "/", `http://${HOST}`).pathname;
  try {
    if (route === "/api/access") return await handleAccess(request, response);
    if (route === "/api/admin-access") return await handleAdminAccess(request, response);
    if (route === "/api/admin-preview-session") return await handleAdminPreviewSession(request, response);
    if (route === "/api/admin-album") return await handleAdminAlbum(request, response);
    if (route === "/album" || route === "/album.html") return await handleAlbumPage(request, response);
    if (route === "/api/wall") return await handleWallRequest(request, response);
    if (route === "/api/album-images") return await handleAlbumImages(request, response);
    if (route === "/api/telegram") {
      if (request.method !== "POST") return sendJson(response, 405, { error: "Method Not Allowed" });
      return await handleTelegramRequest(request, response);
    }
    if (route === "/api/site-version") {
      try { const access = await isClientAllowed(request); if (!access.ok) return sendJson(response, 401, { error: "Cần đăng nhập để xem thiệp." }); } catch { return sendJson(response, 503, { error: "Không thể kiểm tra quyền truy cập." }); } // khách đang mở thiệp hỏi: admin đã lưu bản mới chưa?
      const side = new URL(request.url || "/", `http://${HOST}`).searchParams.get("side") === "gai" ? "gai" : "nam";
      return sendJson(response, 200, { v: fs.statSync(path.join(__dirname, "client", `index-${side}.html`)).mtimeMs });
    }
    if (route.startsWith("/api/admin-")) return await handleAdminRequest(request, response, route);
    if (route.startsWith("/api/")) return sendJson(response, 404, { error: "Not Found" });
    if (["/", "/index-nam", "/index-gai", "/nha-trai", "/nha-gai"].includes(route)) {
      try { const access = await isClientAllowed(request); if (!access.ok) { response.writeHead(302, { Location: "/access?next=" + encodeURIComponent(request.url || "/index-nam") }); return response.end(); } } catch { return sendJson(response, 503, { error: "Không thể kiểm tra quyền truy cập." }); }
    }
    return serveStaticFile(request, response);
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendJson(response, 500, { error: "Lỗi máy chủ" });
  }
});

server.listen(PORT, HOST, () => console.log(`Thiệp cưới: http://${HOST}:${PORT}  |  Quản trị: http://${HOST}:${PORT}/admin.html`));
