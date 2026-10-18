/**
 * Server lokal untuk pengujian lingkungan Vercel
 * Menjalankan server lokal dengan port 3000 tanpa perlu install dependensi tambahan.
 * Jalankan dengan: node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const verifyApiHandler = require('./api/verify');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  // 1. Tangani Route API Vercel (/api/verify)
  if (pathname === '/api/verify' || pathname.startsWith('/api/verify/')) {
    // Inject parsed query
    req.query = Object.fromEntries(reqUrl.searchParams);
    if (pathname.startsWith('/api/verify/') && !req.query.id) {
      req.query.id = pathname.split('/api/verify/')[1];
    }

    // Helper res.json dan res.status untuk menyamai Vercel Serverless
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

  // 2. Tangani Rewrite Clean URL Vercel: /verify/:id -> verify.html
  if (pathname === '/verify' || pathname.startsWith('/verify/')) {
    const filePath = path.join(__dirname, 'verify.html');
    return serveStaticFile(filePath, res);
  }

  // 3. Tangani Rewrite Clean URL Vercel: /admin dan /generator -> generator-sertifikat.html
  if (pathname === '/admin' || pathname === '/generator') {
    const filePath = path.join(__dirname, 'generator-sertifikat.html');
    return serveStaticFile(filePath, res);
  }

  // 4. File Statis Biasa (index.html, dll)
  let safePath = pathname === '/' ? '/index.html' : pathname;
  let fullPath = path.join(__dirname, safePath);

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return serveStaticFile(fullPath, res);
  }

  // 404
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end('<h1>404 Halaman Tidak Ditemukan</h1><p><a href="/">Kembali ke Beranda</a></p>');
});

function serveStaticFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.statusCode = 500;
      res.end('Server Error: ' + err.code);
      return;
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.end(content);
  });
}

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Server Lokal Verifikasi Yayasan berjalan di:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log(`   👉 Uji URL Bersih: http://localhost:${PORT}/verify/YYS-2026-0001`);
  console.log(`   👉 Uji Generator:  http://localhost:${PORT}/generator`);
  console.log(`=======================================================`);
});
