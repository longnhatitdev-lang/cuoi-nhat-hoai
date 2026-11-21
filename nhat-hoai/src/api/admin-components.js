const { getSide, upsertSide } = require('../supabase-content');
const { send, auth, body } = require('../vercel-utils');

const MAX_COMPONENTS = 100;
const MAX_CODE = 250000;
module.exports = async (req, res) => {
  const a = auth(req);
  if (!a.ok) return send(res, a.status, { error: a.error });
  const url = new URL(req.url, 'https://local.invalid');
  const side = url.searchParams.get('side') === 'gai' ? 'gai' : 'nam';
  try {
    const row = await getSide(side);
    const content = { ...(row?.content || {}) };
    const components = Array.isArray(content.components) ? content.components : [];
    if (req.method === 'GET') return send(res, 200, { ok: true, side, components });
    if (req.method !== 'POST' && req.method !== 'DELETE') return send(res, 405, { error: 'Method Not Allowed' });
    const raw = await body(req, 1024 * 1024);
    let data;
    try { data = typeof raw === 'string' ? JSON.parse(raw || '{}') : raw; }
    catch { return send(res, 400, { error: 'Dữ liệu JSON không hợp lệ.' }); }
    if (req.method === 'DELETE') {
      content.components = components.filter((x) => x.id !== String(data.id || ''));
      await upsertSide(side, content);
      return send(res, 200, { ok: true, components: content.components });
    }
    const title = String(data.title || '').trim().slice(0, 120);
    const note = String(data.note || '').trim().slice(0, 1000);
    const html = String(data.html || '');
    const css = String(data.css || '');
    const js = String(data.js || '');
    if (!title) return send(res, 400, { error: 'Vui lòng nhập tiêu đề giao diện.' });
    if (html.length + css.length + js.length > MAX_CODE) return send(res, 400, { error: 'Tổng mã HTML/CSS/JS tối đa 250 KB cho mỗi giao diện.' });
    const id = String(data.id || `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
    const component = { id, title, note, html, css, js, updatedAt: new Date().toISOString() };
    const index = components.findIndex((x) => x.id === id);
    if (index >= 0) components[index] = component;
    else {
      if (components.length >= MAX_COMPONENTS) return send(res, 400, { error: `Tối đa ${MAX_COMPONENTS} giao diện cho mỗi bên.` });
      components.push(component);
    }
    content.components = components;
    await upsertSide(side, content);
    return send(res, 200, { ok: true, component, components });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: e.message || 'Không thể xử lý thư viện giao diện.' });
  }
};
