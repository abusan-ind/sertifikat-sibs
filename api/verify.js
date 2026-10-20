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
 * Parser URL Google Drive untuk Preview & Download Langsung
 */
function parseDriveLinks(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const driveRegex = /https?:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|document\/d\/|presentation\/d\/)([a-zA-Z0-9_-]+)/i;
  const match = trimmed.match(driveRegex);
  if (match && match[1]) {
    const fileId = match[1];
    return {
      hasFile: true,
      isGoogleDrive: true,
      fileId: fileId,
      previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
      viewUrl: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`,
      originalUrl: trimmed
    };
  }

  // Direct / generic file link (PDF / Image / Cloudinary / dll)
  return {
    hasFile: true,
    isGoogleDrive: false,
    fileId: null,
    previewUrl: trimmed,
    downloadUrl: trimmed,
    viewUrl: trimmed,
    originalUrl: trimmed
  };
}

/**
 * Normalisasi nama untuk pencarian mirip (case-insensitive & toleran spasi)
 */
function normalizeName(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
        records = parsed.slice(1).map((row, idx) => ({
          rowNumber: idx + 2,
          id: String(row[0] || '').trim(),
          nama: String(row[1] || '').trim(),
          lomba: String(row[2] || '').trim(),
          predikat: String(row[3] || 'Peserta').trim(),
          tanggal: String(row[4] || '').trim(),
          status: String(row[5] || 'AKTIF').trim().toUpperCase(),
          fileUrl: String(row[6] || '').trim() // Kolom G: Link File Sertifikat
        })).filter(item => item.id && item.nama);
      }
    } catch (err) {
      console.warn('Gagal membaca Google Sheets via CSV:', err.message);
    }
  }

  // 2. Fallback ke file JSON lokal jika Google Sheets kosong / belum diset
  if (records.length === 0) {
    try {
      const localData = require('../data/certificates.json');
      records = localData.map((item, idx) => ({ ...item, fileUrl: item.fileUrl || '', rowNumber: idx + 2 }));
    } catch (e) {
      try {
        const localData = require('./data/certificates.json');
        records = localData.map((item, idx) => ({ ...item, fileUrl: item.fileUrl || '', rowNumber: idx + 2 }));
      } catch (e2) {
        records = [];
      }
    }
  }

  return { records, source: spreadsheetId ? 'google_sheets' : 'local_database' };
}

/**
 * Helper format satu record menjadi response data
 */
function formatRecordData(match) {
  const isAktif = (match.status || 'AKTIF').toUpperCase() === 'AKTIF';
  return {
    id: match.id,
    nama: match.nama,
    lomba: match.lomba,
    predikat: match.predikat || 'Peserta',
    tanggal: match.tanggal,
    status: match.status || 'AKTIF',
    isValid: isAktif,
    file: parseDriveLinks(match.fileUrl)
  };
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
    const rawNama = req.query.nama || req.query.name || '';
    const namaQuery = String(rawNama).trim();
    const generalQ = String(req.query.q || '').trim();

    const { records, source } = await loadAllRecords(req.query.sheet_id);

    // Hitung kemunculan setiap ID untuk mendeteksi nomor duplikat (Anti-Collision Guard)
    const idCountMap = {};
    const duplicateDetailMap = {};

    records.forEach(item => {
      const normId = item.id.toUpperCase();
      if (!idCountMap[normId]) {
        idCountMap[normId] = 1;
        duplicateDetailMap[normId] = [item];
      } else {
        idCountMap[normId]++;
        duplicateDetailMap[normId].push(item);
      }
    });

    const duplicateIds = Object.keys(idCountMap).filter(normId => idCountMap[normId] > 1);

    // AKSI 1: Ambil seluruh daftar santri untuk Admin Panel
    if (action === 'list' || (!id && !namaQuery && !generalQ && action !== 'verify')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json({
        success: true,
        source: source,
        total: records.length,
        hasDuplicates: duplicateIds.length > 0,
        duplicateCount: duplicateIds.length,
        duplicateIds: duplicateIds,
        records: records.map(item => ({
          ...item,
          isDuplicate: duplicateIds.includes(item.id.toUpperCase()),
          file: parseDriveLinks(item.fileUrl)
        }))
      });
    }

    // AKSI 2: Pencarian Berdasarkan NAMA
    const targetNama = namaQuery || (!id && generalQ ? generalQ : '');
    if (targetNama && !id) {
      const normTarget = normalizeName(targetNama);
      const matches = records.filter(item => normalizeName(item.nama) === normTarget);

      if (matches.length === 0) {
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
        return res.status(200).json({
          success: false,
          status: 'NOT_FOUND',
          searchType: 'NAME',
          query: targetNama,
          message: `Sertifikat atas nama "${targetNama}" tidak ditemukan dalam buku induk resmi Syarief Internasional Boarding School. Pastikan ejaan nama lengkap telah sesuai.`
        });
      }

      // Jika ditemukan lebih dari 1 sertifikat untuk nama ini (misal ikut beberapa lomba)
      if (matches.length > 1) {
        res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
        return res.status(200).json({
          success: true,
          status: 'MULTIPLE_MATCHES',
          searchType: 'NAME',
          totalMatches: matches.length,
          query: targetNama,
          nama: matches[0].nama,
          yayasan: PROFIL_YAYASAN.namaYayasan,
          lembaga: PROFIL_YAYASAN.lembaga,
          alamat: PROFIL_YAYASAN.alamat,
          penandatangan: {
            nama: PROFIL_YAYASAN.penandatangan,
            nik: PROFIL_YAYASAN.nik,
            jabatan: PROFIL_YAYASAN.jabatan
          },
          records: matches.map(formatRecordData),
          message: `Ditemukan ${matches.length} sertifikat atas nama "${matches[0].nama}". Silakan pilih kegiatan/lomba yang ingin diverifikasi.`
        });
      }

      // Tepat 1 sertifikat ditemukan
      const match = matches[0];
      const isAktif = (match.status || 'AKTIF').toUpperCase() === 'AKTIF';
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');

      return res.status(200).json({
        success: true,
        status: isAktif ? 'VALID' : 'REVOKED',
        searchType: 'NAME',
        totalMatches: 1,
        yayasan: PROFIL_YAYASAN.namaYayasan,
        lembaga: PROFIL_YAYASAN.lembaga,
        alamat: PROFIL_YAYASAN.alamat,
        penandatangan: {
          nama: PROFIL_YAYASAN.penandatangan,
          nik: PROFIL_YAYASAN.nik,
          jabatan: PROFIL_YAYASAN.jabatan
        },
        data: formatRecordData(match),
        message: isAktif 
          ? 'Sertifikat resmi terverifikasi dan sah terdaftar pada Syarief Internasional Boarding School Bondowoso.' 
          : 'Sertifikat telah dicabut atau dinyatakan tidak berlaku oleh pimpinan yayasan.'
      });
    }

    // AKSI 3: Verifikasi Berdasarkan NOMOR ID SERTIFIKAT
    const searchId = id || (generalQ ? generalQ.toUpperCase() : '');
    if (!searchId) {
      return res.status(400).json({
        success: false,
        status: 'EMPTY_QUERY',
        message: 'Parameter nomor sertifikat atau nama santri wajib disertakan.'
      });
    }

    const matches = records.filter(item => String(item.id).trim().toUpperCase() === searchId);

    // Nomor tidak terdaftar
    if (matches.length === 0) {
      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
      return res.status(200).json({
        success: false,
        status: 'NOT_FOUND',
        searchType: 'ID',
        id: searchId,
        message: 'Nomor sertifikat tidak ditemukan dalam buku induk resmi Syarief Internasional Boarding School.'
      });
    }

    // Cek Duplikasi Nomor
    if (matches.length > 1) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json({
        success: false,
        status: 'DUPLICATE_ERROR',
        searchType: 'ID',
        id: searchId,
        yayasan: PROFIL_YAYASAN.namaYayasan,
        lembaga: PROFIL_YAYASAN.lembaga,
        alamat: PROFIL_YAYASAN.alamat,
        duplicateCount: matches.length,
        recipients: matches.map(m => ({ nama: m.nama, lomba: m.lomba, tanggal: m.tanggal, baris: m.rowNumber })),
        message: `PERINGATAN INTEGRITAS: Nomor registrasi "${searchId}" ditemukan GANDA pada ${matches.length} penerima berbeda di buku induk yayasan! Dokumen ini ditangguhkan sampai dilakukan perbaikan oleh pengurus yayasan.`
      });
    }

    // 1 Data Unik Terdaftar
    const match = matches[0];
    const isAktif = (match.status || 'AKTIF').toUpperCase() === 'AKTIF';

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');

    return res.status(200).json({
      success: true,
      status: isAktif ? 'VALID' : 'REVOKED',
      searchType: 'ID',
      yayasan: PROFIL_YAYASAN.namaYayasan,
      lembaga: PROFIL_YAYASAN.lembaga,
      alamat: PROFIL_YAYASAN.alamat,
      penandatangan: {
        nama: PROFIL_YAYASAN.penandatangan,
        nik: PROFIL_YAYASAN.nik,
        jabatan: PROFIL_YAYASAN.jabatan
      },
      data: formatRecordData(match),
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
