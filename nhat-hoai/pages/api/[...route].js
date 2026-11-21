// Compatibility router for the existing Vercel-style Node handlers.
// Keep bodyParser disabled: handlers parse raw streams themselves.
const handlers = {
  'admin-login': require('../../src/api/admin-login'),
  access: require('../../src/api/access'),
  'access-page': require('../../src/api/access-page'),
  'admin-access': require('../../src/api/admin-access'),
  'admin-album': require('../../src/api/admin-album'),
  'admin-components': require('../../src/api/admin-components'),
  'admin-html': require('../../src/api/admin-html'),
  'admin-images': require('../../src/api/admin-images'),
  'admin-preview-session': require('../../src/api/admin-preview-session'),
  'admin-upload': require('../../src/api/admin-upload'),
  'album-images': require('../../src/api/album-images'),
  'album-page': require('../../src/api/album-page'),
  site: require('../../src/api/site'),
  telegram: require('../../src/api/telegram'),
  wall: require('../../src/api/wall'),
};

async function apiRouter(req, res) {
  const route = Array.isArray(req.query.route) ? req.query.route.join('/') : '';
  const handler = handlers[route];
  if (!handler) return res.status(404).json({ error: 'API endpoint không tồn tại.' });
  return handler(req, res);
}

module.exports = apiRouter;
module.exports.config = {
  api: { bodyParser: false, responseLimit: '45mb' },
};
