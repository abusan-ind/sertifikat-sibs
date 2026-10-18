/**
 * Server Utama untuk Vercel & Pengujian Lokal
 * Syarief Internasional Boarding School (Bondowoso)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const verifyApiHandler = require('./api/verify');

const PORT = process.env.PORT || 3000;

// 1. Pre-load berkas HTML ke Memory (Agar di-bundle oleh compiler Vercel NFT dan bebas error 404)
function loadStaticFile(filename) {
  try {
    return fs.readFileSync(path.join(__dirname, filename), 'utf8');
  } catch (err) {
    console.warn(`[WARN] Gagal membaca ${filename}:`, err.message);
    return null;
  }
}

const INDEX_HTML = loadStaticFile('index.html');
const VERIFY_HTML = loadStaticFile('verify.html');
const GENERATOR_HTML = loadStaticFile('generator-sertifikat.html');

// Pre-load data cadangan
let FALLBACK_CERTS = [];
try {
  FALLBACK_CERTS = require('./data/certificates.json');
} catch (e) {}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // 1. Endpoint API Vercel (/api/verify)
  if (pathname === '/api/verify' || pathname.startsWith('/api/verify/')) {
    req.query = Object.fromEntries(reqUrl.searchParams);
    if (pathname.startsWith('/api/verify/') && !req.query.id) {
      req.query.id = pathname.split('/api/verify/')[1];
    }

    res.status = (statusCode) => {
      res.statusCode = statusCode;
      return res;
    };
    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(data));
      return res;
    };

    return verifyApiHandler(req, res);
  }

  // 2. Halaman Verifikasi Santri (/verify/:id atau /verify atau /verify.html)
  if (pathname === '/verify' || pathname.startsWith('/verify/') || pathname === '/verify.html') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(VERIFY_HTML || '<h1>Halaman Verifikasi Tidak Tersedia</h1>');
  }

  // 3. Panel Khusus Admin (/admin atau /generator atau /generator-sertifikat.html)
  if (pathname === '/admin' || pathname === '/generator' || pathname === '/generator-sertifikat.html') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(GENERATOR_HTML || '<h1>Halaman Generator Tidak Tersedia</h1>');
  }

  // 4. Halaman Beranda Publik (/)
  if (pathname === '/' || pathname === '/index.html') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(INDEX_HTML || '<h1>Portal Yayasan Tidak Tersedia</h1>');
  }

  // 5. Cek File Statis Lainnya (jika ada aset gambar/data)
  let safePath = pathname.replace(/^\/+/, '');
  let fullPath = path.join(__dirname, safePath);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    return res.end(fs.readFileSync(fullPath));
  }

  // 6. Fallback 404
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`
    <div style="font-family: sans-serif; text-align: center; padding: 50px 20px;">
      <h2 style="color: #064e3b;">Syarief Internasional Boarding School</h2>
      <p style="color: #64748b; font-size: 15px;">Halaman yang Anda tuju tidak ditemukan (404).</p>
      <a href="/" style="display: inline-block; margin-top: 15px; padding: 10px 20px; background: #064e3b; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
        Kembali ke Beranda
      </a>
    </div>
  `);
});

server.listen(PORT, () => {
  console.log(`[SIBS Server] Berjalan pada port ${PORT}`);
});

module.exports = server;
