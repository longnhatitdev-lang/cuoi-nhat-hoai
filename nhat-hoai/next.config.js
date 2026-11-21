/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  // The API handlers read these legacy HTML snapshots from the project root.
  outputFileTracingIncludes: {
    '/*': ['./client/**/*', './src/**/*', './src/api/**/*'],
  },
  async rewrites() {
    return [
      { source: '/', destination: '/api/site?side=nam' },
      { source: '/index-nam', destination: '/api/site?side=nam' },
      { source: '/index-gai', destination: '/api/site?side=gai' },
      { source: '/nha-trai', destination: '/api/site?side=nam' },
      { source: '/nha-gai', destination: '/api/site?side=gai' },
      { source: '/album', destination: '/api/album-page' },
      { source: '/album.html', destination: '/api/album-page' },
      { source: '/access', destination: '/api/access-page' },
      { source: '/admin-album', destination: '/admin/album.html' },
      { source: '/admin.html', destination: '/admin/index.html' },
      { source: '/admin', destination: '/admin/index.html' },
      { source: '/admin-nam', destination: '/admin/index-nam.html' },
      { source: '/admin-gai', destination: '/admin/index-gai.html' },
      { source: '/style.css', destination: '/client/style.css' },
      { source: '/javascript.js', destination: '/client/javascript.js' },
      { source: '/album.css', destination: '/client/album.css' },
      { source: '/album.js', destination: '/client/album.js' },
      { source: '/admin.css', destination: '/admin/admin.css' },
      { source: '/admin.js', destination: '/admin/admin.js' },
    ];
  },
};
module.exports = nextConfig;
