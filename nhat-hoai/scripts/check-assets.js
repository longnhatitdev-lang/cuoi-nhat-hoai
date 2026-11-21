const fs=require("node:fs"),path=require("node:path");const root=path.join(__dirname,".."),pub=path.join(root,"public"),client=path.join(root,"client");const files=["index-nam.html","index-gai.html","style.css","javascript.js"];const ref=/(?:\.\/|\/)?((?:asset|uploads)\/[^\s"'()<>`\\]+?\.(?:webp|png|jpe?g|gif|svg|avif|ico|mp3|m4a|ogg|wav))/gi;const refs=new Map();for(const f of files){const s=fs.readFileSync(path.join(client,f),"utf8");for(const m of s.matchAll(ref))if(!refs.has(m[1]))refs.set(m[1],f)}const missing=[...refs].filter(([f])=>!fs.existsSync(path.join(pub,decodeURI(f))));console.log(`Đã quét ${files.length} tệp giao diện, ${refs.size} tham chiếu tài nguyên.`);if(missing.length){console.log(`ℹ️ ${missing.length} tài nguyên chưa có trong ZIP (được chủ động lược bỏ):`);for(const [f,src] of missing)console.log(` - public/${f} (từ client/${src})`)}else console.log("✅ Không thiếu tài nguyên được tham chiếu.");console.log("Kiểm tra cú pháp bằng: node --check server.js && node --check client/javascript.js && node --check admin/admin.js");

// Kiểm tra cú pháp và bảo đảm khóa Supabase không bị nhúng lại vào mã trình duyệt.
const { spawnSync } = require("node:child_process");
const syntaxFiles = ["server.js", "src/config.js", "src/http-utils.js", "src/static-server.js", "src/admin-api.js", "src/wall-api.js", "src/telegram.js", "client/javascript.js", "admin/admin.js"];
let syntaxFailed = false;
for (const file of syntaxFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) { syntaxFailed = true; console.error(`❌ Lỗi cú pháp ${file}:\n${result.stderr || result.stdout}`); }
}
const clientFiles = ["client/index-nam.html", "client/index-gai.html", "client/javascript.js", "client/style.css"];
const secretPattern = /(?:sb_secret_[A-Za-z0-9_-]{12,}|service_role.{0,40}(?:key|token)|createClient\s*\(\s*["'][^"']+supabase\.co["']\s*,\s*["'](?:eyJ|sb_publishable_|sb_secret_))/i;
for (const file of clientFiles) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  if (secretPattern.test(content)) { syntaxFailed = true; console.error(`❌ Có dấu hiệu nhúng thông tin Supabase vào phía client: ${file}`); }
}
if (syntaxFailed) process.exitCode = 1;
else console.log("✅ Cú pháp JavaScript hợp lệ; không phát hiện key Supabase nhúng trực tiếp trong client.");
