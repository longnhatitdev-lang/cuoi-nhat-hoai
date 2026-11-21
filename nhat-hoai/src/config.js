const path = require("node:path");

// Vercel chạy ứng dụng từ thư mục Root Directory của project.
// Dùng process.cwd() thay vì __dirname và không đọc .env thủ công ở runtime.
// Next.js tự nạp .env.local / .env.*; Vercel dùng Environment Variables.
const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

module.exports = {
  ROOT_DIR,
  PUBLIC_DIR,
  HOST: process.env.HOST || "localhost",
  PORT: Number.parseInt(process.env.PORT || "3000", 10),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "",
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || "",
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID || "",
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_KEY: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "",
};
