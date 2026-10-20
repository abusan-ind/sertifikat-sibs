/**
 * Server Utama untuk Vercel (Serverless Handler) & Pengujian Lokal
 * Syarief Internasional Boarding School (Bondowoso)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const verifyApiHandler = require('./api/verify');

const PORT = process.env.PORT || 3000;

// Pre-load file HTML ke memory (dibundel otomatis oleh Vercel NFT compiler)
function loadStaticFile(filename) {
  try {
    return fs.readFileSync(path.join(__dirname, filename), 'utf8');
  } catch (err) {
    console.warn(`[WARN] Gagal membaca ${filename}:`, err.message);
    return null;
  }
}

function getStaticFile(filename, fallbackMemory) {
  try {
    return fs.readFileSync(path.join(__dirname, filename), 'utf8');
  } catch (err) {
    return fallbackMemory;
  }
}

const INDEX_HTML = loadStaticFile('index.html');
const VERIFY_HTML = loadStaticFile('verify.html');
const GENERATOR_HTML = loadStaticFile('generator-sertifikat.html');

let LOGO_BUFFER = null;
let LOGO_SYARIEF_BUFFER = null;
try {
  LOGO_BUFFER = fs.readFileSync(path.join(__dirname, 'logo-sibs.png'));
} catch (e) {
  console.warn('[WARN] Gagal membaca logo-sibs.png:', e.message);
}
try {
  LOGO_SYARIEF_BUFFER = fs.readFileSync(path.join(__dirname, 'logo-syarief.png'));
} catch (e) {
  console.warn('[WARN] Gagal membaca logo-syarief.png:', e.message);
}

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

/**
 * Request Handler Utama (Mendukung Vercel Serverless Function (req, res))
 */
function handleRequest(req, res) {
  try {
    const host = req.headers.host || 'localhost';
    const reqUrl = new URL(req.url, `http://${host}`);
    const pathname = reqUrl.pathname;

    // Route Logo Yayasan Resmi SIBS & LPQ Syarief Institute
    if (pathname === '/logo-syarief.png') {
      if (LOGO_SYARIEF_BUFFER) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.end(LOGO_SYARIEF_BUFFER);
      }
    }
    if (pathname === '/logo-sibs.png' || pathname === '/logo.png') {
      if (LOGO_BUFFER) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.end(LOGO_BUFFER);
      }
    }

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
      return res.end(getStaticFile('verify.html', VERIFY_HTML) || '<h1>Halaman Verifikasi Tidak Tersedia</h1>');
    }

    // 3. Panel Khusus Admin (/admin atau /generator atau /generator-sertifikat.html)
    if (pathname === '/admin' || pathname === '/generator' || pathname === '/generator-sertifikat.html') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(getStaticFile('generator-sertifikat.html', GENERATOR_HTML) || '<h1>Halaman Generator Tidak Tersedia</h1>');
    }

    // 4. Halaman Beranda Publik (/)
    if (pathname === '/' || pathname === '/index.html') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(getStaticFile('index.html', INDEX_HTML) || '<h1>Portal Yayasan Tidak Tersedia</h1>');
    }

    // 5. Cek File Statis Lainnya
    let safePath = pathname.replace(/^\/+/, '');
    let fullPath = path.join(__dirname, safePath);

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.statusCode = 200;
      res.setHeader('Content-Type', contentType);
      return res.end(fs.readFileSync(fullPath));
    }

    // 6. Fallback ke Index jika tidak ditemukan
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(INDEX_HTML);

  } catch (err) {
    console.error('[SERVER ERROR]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Internal Server Error: ' + err.message);
  }
}

// EKSPOR HANDLER SEBAGAI FUNCTION (Wajib untuk Vercel Serverless Function agar tidak loading terus)
module.exports = handleRequest;

// Jalankan HTTP server lokal HANYA jika dipanggil manual di laptop (node server.js)
if (require.main === module) {
  const localServer = http.createServer(handleRequest);
  localServer.listen(PORT, () => {
    console.log(`[SIBS Server] Berjalan pada port ${PORT}`);
  });
}
