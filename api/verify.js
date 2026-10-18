const fs = require('fs');
const path = require('path');
const https = require('https');

// Profil Baku Yayasan
const PROFIL_YAYASAN = {
  namaYayasan: 'Syarif Internasional Boarding School',
  lembaga: 'Lembaga Pendidikan Al-Quran Syarief Institute Bondowoso',
  alamat: 'Dusun Bunduh RT 09 RW 03, Desa Bataan, Kec. Tenggarang, Kab. Bondowoso',
  penandatangan: 'Anggit Hadi Prasaja, M.Pd',
  nik: '357110905950006',
  jabatan: 'Kepala Lembaga Pendidikan Al-Quran Syarief Institute Bondowoso'
};

/**
 * Helper HTTP GET untuk Vercel Serverless Function (zero-dependency)
 */
function fetchHttps(url, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (res) => {
      // Tangani redirect (HTTP 301, 302, 307)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchHttps(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    
    request.on('error', reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      reject(new Error('Koneksi timeout setelah 4 detik'));
    });
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
 * Ambil seluruh records dari Google Sheets atau Fallback Lokal
 */
async function loadAllRecords(customSpreadsheetId) {
  let records = [];
  const spreadsheetId = customSpreadsheetId || process.env.SPREADSHEET_ID;
  const sheetName = process.env.SHEET_NAME || 'Sertifikat';

  // 1. Coba dari Google Sheets CSV
  if (spreadsheetId) {
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
      const csvRes = await fetchHttps(csvUrl, 4000);

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
        })).filter(item => item.id && item.nama);
      }
    } catch (err) {
      console.warn('Gagal membaca Google Sheets via CSV:', err.message);
    }
  }

  // 2. Fallback ke file JSON lokal jika Google Sheets kosong / belum diset
  if (records.length === 0) {
    try {
      records = require('../data/certificates.json');
    } catch (e) {
      try {
        records = require('./data/certificates.json');
      } catch (e2) {
        records = [];
      }
    }
  }

  return { records, source: spreadsheetId ? 'google_sheets' : 'local_database' };
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
    const action = (req.query.action || '').trim().toLowerCase();
    const rawId = req.query.id || '';
    const id = String(rawId).trim().toUpperCase();

    // AKSI 1: Ambil seluruh daftar santri untuk Admin Panel
    if (action === 'list' || (!id && action !== 'verify')) {
      const { records, source } = await loadAllRecords(req.query.sheet_id);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json({
        success: true,
        source: source,
        total: records.length,
        records: records
      });
    }

    // AKSI 2: Verifikasi nomor sertifikat tunggal
    if (!id) {
      return res.status(400).json({
        success: false,
        status: 'EMPTY_ID',
        message: 'Parameter ID sertifikat wajib disertakan.'
      });
    }

    const { records } = await loadAllRecords(req.query.sheet_id);

    // Cari ID sertifikat (case-insensitive)
    const match = records.find(item => String(item.id).trim().toUpperCase() === id);

    // Cache di CDN Vercel selama 60 detik untuk kecepatan
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');

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
