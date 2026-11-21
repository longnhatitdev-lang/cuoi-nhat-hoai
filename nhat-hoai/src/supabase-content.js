const { SUPABASE_URL, SUPABASE_KEY } = require('./config');
function config() {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_KEY trên Vercel.');
  return { base: SUPABASE_URL.replace(/\/$/, ''), key: SUPABASE_KEY };
}
function headers(extra = {}) {
  const { key } = config();
  const h = { apikey: key, ...extra };
  // Legacy JWT (anon/service_role) needs Authorization; sb_publishable_/sb_secret_ keys do not use Bearer JWT.
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}
async function getSide(side) {
  const { base } = config();
  const r = await fetch(`${base}/rest/v1/wedding_site_content?select=side,content,updated_at&side=eq.${encodeURIComponent(side)}&limit=1`, { headers: headers(), cache: 'no-store' });
  if (!r.ok) throw new Error(`Không đọc được wedding_site_content (${r.status}).`);
  const rows = await r.json();
  return rows[0] || null;
}
async function upsertSide(side, content) {
  const { base } = config();
  const r = await fetch(`${base}/rest/v1/wedding_site_content?on_conflict=side`, {
    method: 'POST', headers: headers({ 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify({ side, content, updated_at: new Date().toISOString() })
  });
  if (!r.ok) throw new Error(`Không lưu được nội dung Supabase (${r.status}): ${(await r.text()).slice(0, 300)}`);
  return (await r.json())[0];
}

async function updateSideIfVersion(side, content, expectedUpdatedAt) {
  const { base } = config();
  const expected = String(expectedUpdatedAt || '').replace(/^"|"$/g, '');
  if (!expected) throw new Error('Thiếu phiên bản nội dung. Hãy tải lại Admin trước khi lưu.');
  const next = new Date().toISOString();
  const url = new URL(`${base}/rest/v1/wedding_site_content`);
  url.searchParams.set('side', `eq.${side}`);
  url.searchParams.set('updated_at', `eq.${expected}`);
  const r = await fetch(url, {
    method: 'PATCH',
    headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify({ content, updated_at: next }),
    cache: 'no-store'
  });
  if (!r.ok) throw new Error(`Không lưu được nội dung Supabase (${r.status}).`);
  const rows = await r.json();
  if (!Array.isArray(rows) || !rows.length) {
    const error = new Error('Nội dung đã được thay đổi ở một phiên Admin khác. Hãy tải lại trang Admin để tránh ghi đè dữ liệu mới.');
    error.code = 'VERSION_CONFLICT';
    throw error;
  }
  return rows[0];
}

module.exports = { config, headers, getSide, upsertSide, updateSideIfVersion };
