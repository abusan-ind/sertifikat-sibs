const fs = require('fs');
const path = require('path');
const https = require('https');

// Profil Baku Yayasan
const PROFIL_YAYASAN = {
  namaYayasan: 'Syarief Internasional Boarding School',
  lembaga: 'Lembaga Pendidikan Al-Quran Syarief Institute Bondowoso',
  alamat: 'Dusun Bunduh RT 09 RW 03, Desa Bataan, Kec. Tenggarang, Kab. Bondowoso',
  penandatangan: 'Anggit Hadi Prasaja, M.Pd',
  nik: '357110905950006',
  jabatan: 'Kepala Lembaga Pendidikan Al-Quran Syarief Institute Bondowoso'
};

/**
 * Helper HTTP GET untuk Vercel Serverless Function (zero-dependency)
 */
function fetchHttps(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Tangani redirect (HTTP 301, 302, 307)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHttps(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

/**
 * Parser CSV ringan tanpa library eksternal
 */
function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  return lines.map(line => {
    const row = [];
    let inQuotes = false;
    let token = '';
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          token += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(token.trim());
        token = '';
      } else {
        token += char;
      }
    }
    row.push(token.trim());
    return row;
  });
}

/**
 * Main Vercel Serverless Function Handler
 */
module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const rawId = req.query.id || '';
    const id = String(rawId).trim().toUpperCase();

    if (!id) {
      return res.status(400).json({
        success: false,
        status: 'EMPTY_ID',
        message: 'Parameter ID sertifikat wajib disertakan.'
      });
    }

    let records = [];

    // OPSI 1: Sambungan langsung ke Google Sheets CSV (jika SPREADSHEET_ID diset di Vercel Environment Variables)
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetName = process.env.SHEET_NAME || 'Sertifikat';

    if (spreadsheetId) {
      try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
        const csvRes = await fetchHttps(csvUrl);

        if (csvRes.status === 200 && csvRes.data) {
          const parsed = parseCsv(csvRes.data);
          // Lewati baris header pertama
          records = parsed.slice(1).map(row => ({
            id: String(row[0] || '').trim(),
            nama: String(row[1] || '').trim(),
            lomba: String(row[2] || '').trim(),
            predikat: String(row[3] || 'Peserta').trim(),
            tanggal: String(row[4] || '').trim(),
            status: String(row[5] || 'AKTIF').trim().toUpperCase()
          }));
        }
      } catch (err) {
        console.warn('Gagal membaca Google Sheets via CSV, menggunakan fallback:', err.message);
      }
    }

    // OPSI 2: Sambungan via Apps Script API (jika GAS_API_URL diset)
    if (records.length === 0 && process.env.GAS_API_URL) {
      try {
        const gasUrl = `${process.env.GAS_API_URL}${process.env.GAS_API_URL.includes('?') ? '&' : '?'}action=api&id=${encodeURIComponent(id)}`;
        const gasRes = await fetchHttps(gasUrl);
        if (gasRes.status === 200 && gasRes.data) {
          const gasJson = JSON.parse(gasRes.data);
          res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
          return res.status(200).json(gasJson);
        }
      } catch (err) {
        console.warn('Gagal membaca dari GAS API:', err.message);
      }
    }

    // OPSI 3: Fallback ke database JSON lokal (data/certificates.json)
    if (records.length === 0) {
      const jsonPath = path.join(process.cwd(), 'data', 'certificates.json');
      if (fs.existsSync(jsonPath)) {
        const rawJson = fs.readFileSync(jsonPath, 'utf8');
        records = JSON.parse(rawJson);
      }
    }

    // Cari ID sertifikat (case-insensitive)
    const match = records.find(item => String(item.id).trim().toUpperCase() === id);

    // Cache di CDN Vercel selama 60 detik
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=180');

    if (!match) {
      return res.status(200).json({
        success: false,
        status: 'NOT_FOUND',
        id: id,
        message: 'Nomor sertifikat tidak ditemukan dalam buku induk resmi Syarief Internasional Boarding School.'
      });
    }

    const isAktif = (match.status || 'AKTIF').toUpperCase() === 'AKTIF';

    return res.status(200).json({
      success: true,
      status: isAktif ? 'VALID' : 'REVOKED',
      yayasan: PROFIL_YAYASAN.namaYayasan,
      lembaga: PROFIL_YAYASAN.lembaga,
      alamat: PROFIL_YAYASAN.alamat,
      penandatangan: {
        nama: PROFIL_YAYASAN.penandatangan,
        nik: PROFIL_YAYASAN.nik,
        jabatan: PROFIL_YAYASAN.jabatan
      },
      data: {
        id: match.id,
        nama: match.nama,
        lomba: match.lomba,
        predikat: match.predikat || 'Peserta',
        tanggal: match.tanggal,
        status: match.status || 'AKTIF',
        isValid: isAktif
      },
      message: isAktif 
        ? 'Sertifikat resmi terverifikasi dan sah terdaftar pada Syarief Internasional Boarding School Bondowoso.' 
        : 'Sertifikat telah dicabut atau dinyatakan tidak berlaku oleh pimpinan yayasan.'
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      status: 'SERVER_ERROR',
      message: 'Terjadi kendala pemrosesan verifikasi pada server: ' + error.message
    });
  }
};
