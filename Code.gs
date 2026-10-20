/**
 * ============================================================================
 * SISTEM VERIFIKASI SERTIFIKAT YAYASAN
 * Backend: Google Apps Script (GAS)
 * Database: Google Sheets
 * ============================================================================
 * 
 * PETUNJUK:
 * 1. Buat Google Spreadsheet baru bernama "Database Sertifikat Yayasan".
 * 2. Beri nama sheet (tab): "Sertifikat" (tanpa tanda kutip).
 * 3. Baris pertama (Header):
 *    Kolom A: ID
 *    Kolom B: Nama
 *    Kolom C: Lomba / Kegiatan
 *    Kolom D: Predikat / Peran (misal: Juara 1, Peserta, Finalis)
 *    Kolom E: Tanggal
 *    Kolom F: Status (AKTIF / DICABUT / KADALUARSA)
 *    Kolom G: Link File / Sertifikat (Link Google Drive atau direct URL)
 * 4. Salin ID Spreadsheet Anda (dari URL spreadsheet) ke variabel SPREADSHEET_ID di bawah.
 */

// GANTI DENGAN ID SPREADSHEET ANDA
const SPREADSHEET_ID = 'GANTI_DENGAN_ID_SPREADSHEET_ANDA';
const SHEET_NAME = 'Sertifikat';

/**
 * Endpoint Utama (doGet)
 * Mendukung 2 mode:
 * 1. Mode API JSON (untuk dipanggil secara mulus dari halaman Blogger lewat fetch)
 *    Contoh: ?action=api&id=YYS-2026-0001 atau ?action=api&nama=Agung%20Budi
 * 2. Mode Web App / Iframe Standalone (jika ingin dibuka langsung / via iframe)
 *    Contoh: ?id=YYS-2026-0001
 */
function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};
    const id = String(params.id || '').trim().toUpperCase();
    const nama = String(params.nama || params.name || '').trim();
    const action = String(params.action || '').trim().toLowerCase();

    // Jika dipanggil sebagai API JSON oleh Blogger / Web
    if (action === 'api') {
      return handleApiRequest(id, nama);
    }

    // Default: Mode Tampilan Web App / Iframe
    return handleHtmlRequest(id);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Terjadi kesalahan internal server: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Helper Parser Link Google Drive
 */
function parseDriveLinks(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/https?:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|document\/d\/|presentation\/d\/)([a-zA-Z0-9_-]+)/i);
  if (match && match[1]) {
    const fileId = match[1];
    return {
      hasFile: true,
      isGoogleDrive: true,
      fileId: fileId,
      previewUrl: 'https://drive.google.com/file/d/' + fileId + '/preview',
      downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fileId,
      viewUrl: 'https://drive.google.com/file/d/' + fileId + '/view?usp=sharing',
      originalUrl: trimmed
    };
  }

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
 * Normalisasi nama (case-insensitive & toleran spasi)
 */
function normalizeName(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Handler API JSON untuk integrasi Web & Blogger (Fetch AJAX)
 */
function handleApiRequest(id, nama) {
  if (!id && !nama) {
    return createJsonResponse({
      success: false,
      status: 'EMPTY_QUERY',
      message: 'Parameter ID atau Nama sertifikat tidak ditemukan.'
    });
  }

  if (nama && !id) {
    return createJsonResponse(findCertificateByName(nama));
  }

  const lookup = findCertificateById(id);
  return createJsonResponse(lookup);
}

/**
 * Fungsi pencarian data sertifikat di Google Sheets
 */
function findCertificateById(targetId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    return {
      success: false,
      status: 'CONFIG_ERROR',
      message: 'Tab sheet "' + SHEET_NAME + '" tidak ditemukan pada database.'
    };
  }

  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) {
    return {
      success: false,
      status: 'EMPTY_DATABASE',
      message: 'Database sertifikat masih kosong.'
    };
  }

  // Filter berdasarkan ID (Kolom A / index 0)
  const matches = data.slice(1).filter(row => String(row[0]).trim().toUpperCase() === targetId);

  if (matches.length === 0) {
    return {
      success: false,
      status: 'NOT_FOUND',
      id: targetId,
      message: 'Nomor sertifikat tidak terdaftar dalam database resmi yayasan.'
    };
  }

  if (matches.length > 1) {
    return {
      success: false,
      status: 'DUPLICATE',
      id: targetId,
      message: 'Peringatan: Terdapat duplikasi nomor sertifikat. Harap hubungi admin yayasan.'
    };
  }

  const row = matches[0];
  const certId = row[0] || '';
  const nama = row[1] || '';
  const lomba = row[2] || '';
  const predikat = row[3] || 'Peserta';
  const tanggal = row[4] || '';
  const rawStatus = (row[5] || 'AKTIF').trim().toUpperCase();
  const fileUrl = row[6] || '';

  const isAktif = rawStatus === 'AKTIF';

  return {
    success: true,
    status: isAktif ? 'VALID' : 'REVOKED',
    data: {
      id: certId,
      nama: nama,
      lomba: lomba,
      predikat: predikat,
      tanggal: tanggal,
      status: rawStatus,
      isValid: isAktif,
      file: parseDriveLinks(fileUrl)
    },
    message: isAktif ? 'Sertifikat resmi dan terdaftar aktif.' : 'Sertifikat telah dicabut atau non-aktif.'
  };
}

/**
 * Fungsi pencarian data sertifikat berdasarkan Nama (Case-Insensitive)
 */
function findCertificateByName(targetNama) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    return {
      success: false,
      status: 'CONFIG_ERROR',
      message: 'Tab sheet "' + SHEET_NAME + '" tidak ditemukan pada database.'
    };
  }

  const data = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) {
    return {
      success: false,
      status: 'EMPTY_DATABASE',
      message: 'Database sertifikat masih kosong.'
    };
  }

  const normTarget = normalizeName(targetNama);
  const matches = data.slice(1).filter(row => normalizeName(row[1]) === normTarget);

  if (matches.length === 0) {
    return {
      success: false,
      status: 'NOT_FOUND',
      searchType: 'NAME',
      query: targetNama,
      message: 'Sertifikat atas nama "' + targetNama + '" tidak ditemukan dalam database resmi yayasan.'
    };
  }

  const formatRow = function(row) {
    const rawStatus = (row[5] || 'AKTIF').trim().toUpperCase();
    const isAktif = rawStatus === 'AKTIF';
    return {
      id: row[0] || '',
      nama: row[1] || '',
      lomba: row[2] || '',
      predikat: row[3] || 'Peserta',
      tanggal: row[4] || '',
      status: rawStatus,
      isValid: isAktif,
      file: parseDriveLinks(row[6] || '')
    };
  };

  if (matches.length > 1) {
    return {
      success: true,
      status: 'MULTIPLE_MATCHES',
      searchType: 'NAME',
      totalMatches: matches.length,
      query: targetNama,
      nama: matches[0][1] || targetNama,
      records: matches.map(formatRow),
      message: 'Ditemukan ' + matches.length + ' sertifikat atas nama ' + matches[0][1]
    };
  }

  const single = formatRow(matches[0]);
  return {
    success: true,
    status: single.isValid ? 'VALID' : 'REVOKED',
    searchType: 'NAME',
    totalMatches: 1,
    data: single,
    message: single.isValid ? 'Sertifikat resmi dan terdaftar aktif.' : 'Sertifikat telah dicabut atau non-aktif.'
  };
}

/**
 * Output helper untuk JSON dengan CORS
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handler Tampilan Web App HTML (untuk fallback langsung / iframe)
 */
function handleHtmlRequest(id) {
  let statusHtml = '';
  let detailsHtml = '';

  if (!id) {
    statusHtml = `
      <div class="alert info">
        <div class="icon">ℹ️</div>
        <div>
          <h3>Masukkan Nomor Sertifikat</h3>
          <p>Silakan pindai QR code pada sertifikat atau masukkan nomor ID sertifikat.</p>
        </div>
      </div>
    `;
  } else {
    const lookup = findCertificateById(id);

    if (lookup.status === 'NOT_FOUND') {
      statusHtml = `
        <div class="alert error">
          <div class="icon">❌</div>
          <div>
            <h3>Sertifikat Tidak Ditemukan</h3>
            <p>Nomor <b>${esc(id)}</b> tidak terdaftar dalam arsip database resmi kami.</p>
          </div>
        </div>
      `;
    } else if (lookup.status === 'DUPLICATE') {
      statusHtml = `
        <div class="alert warning">
          <div class="icon">⚠️</div>
          <div>
            <h3>Data Perlu Verifikasi Lanjutan</h3>
            <p>Terdeteksi duplikasi nomor ID. Silakan hubungi sekretariat yayasan.</p>
          </div>
        </div>
      `;
    } else if (lookup.status === 'REVOKED') {
      statusHtml = `
        <div class="alert error">
          <div class="icon">⛔</div>
          <div>
            <h3>Status: ${esc(lookup.data.status)}</h3>
            <p>Sertifikat ini telah <b>DICABUT</b> atau dinyatakan tidak berlaku lagi oleh yayasan.</p>
          </div>
        </div>
      `;
      detailsHtml = renderDetailsTable(lookup.data);
    } else if (lookup.status === 'VALID') {
      statusHtml = `
        <div class="alert success">
          <div class="icon">✅</div>
          <div>
            <h3>Sertifikat Resmi Terverifikasi</h3>
            <p>Dokumen ini sah dan terdaftar resmi di database yayasan.</p>
          </div>
        </div>
      `;
      detailsHtml = renderDetailsTable(lookup.data);
    } else {
      statusHtml = `
        <div class="alert error">
          <div class="icon">⚠️</div>
          <div>
            <h3>Terjadi Kendala</h3>
            <p>${esc(lookup.message)}</p>
          </div>
        </div>
      `;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifikasi Sertifikat Yayasan</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #1e40af;
      --primary-light: #3b82f6;
      --success-bg: #ecfdf5;
      --success-border: #a7f3d0;
      --success-text: #065f46;
      --error-bg: #fef2f2;
      --error-border: #fecaca;
      --error-text: #991b1b;
      --warning-bg: #fffbeb;
      --warning-border: #fde68a;
      --warning-text: #92400e;
      --info-bg: #eff6ff;
      --info-border: #bfdbfe;
      --info-text: #1e40af;
      --card-bg: #ffffff;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: #f8fafc;
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .container {
      width: 100%;
      max-width: 580px;
      background: var(--card-bg);
      border-radius: 20px;
      padding: 32px 28px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
      border: 1px solid var(--border-color);
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .badge-org {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: var(--primary);
      background: #eff6ff;
      padding: 6px 14px;
      border-radius: 999px;
      margin-bottom: 12px;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-main);
      margin-bottom: 6px;
    }
    .subtitle {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .alert {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      padding: 16px;
      border-radius: 14px;
      margin-bottom: 24px;
      font-size: 14px;
    }
    .alert .icon { font-size: 22px; line-height: 1; }
    .alert h3 { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
    .alert p { font-size: 13px; margin: 0; line-height: 1.4; }
    .alert.success { background: var(--success-bg); border: 1px solid var(--success-border); color: var(--success-text); }
    .alert.error { background: var(--error-bg); border: 1px solid var(--error-border); color: var(--error-text); }
    .alert.warning { background: var(--warning-bg); border: 1px solid var(--warning-border); color: var(--warning-text); }
    .alert.info { background: var(--info-bg); border: 1px solid var(--info-border); color: var(--info-text); }
    .table-details {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    .table-details tr { border-bottom: 1px solid var(--border-color); }
    .table-details tr:last-child { border-bottom: none; }
    .table-details td {
      padding: 12px 16px;
      font-size: 13px;
    }
    .table-details td.label {
      color: var(--text-muted);
      font-weight: 500;
      width: 38%;
      background: #f8fafc;
    }
    .table-details td.val {
      font-weight: 600;
      color: var(--text-main);
    }
    .status-pill {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
    }
    .status-pill.aktif { background: #dcfce7; color: #15803d; }
    .status-pill.dicabut { background: #fee2e2; color: #b91c1c; }
    .footer-note {
      text-align: center;
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.6;
      border-top: 1px dashed var(--border-color);
      padding-top: 16px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge-org">SISTEM VALIDASI RESMI</span>
      <h1 class="title">Syarief Internasional Boarding School</h1>
      <p class="subtitle">Lembaga Pendidikan Al-Quran Syarief Institute Bondowoso<br>Dusun Bunduh RT 09 RW 03, Desa Bataan, Kec. Tenggarang, Kab. Bondowoso</p>
    </div>

    ${statusHtml}

    ${detailsHtml}

    <div class="footer-note">
      Disahkan oleh: <b>Anggit Hadi Prasaja, M.Pd</b> (Kepala Lembaga Pendidikan Al-Quran Syarief Institute Bondowoso)<br>
      © Syarief Internasional Boarding School. Seluruh hak cipta dilindungi.
    </div>
  </div>
</body>
</html>`;

  return HtmlService.createHtmlOutput(html)
    .setTitle('Verifikasi Sertifikat Yayasan')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Render tabel rincian data peserta
 */
function renderDetailsTable(data) {
  const statusClass = (data.status === 'AKTIF') ? 'aktif' : 'dicabut';
  return `
    <table class="table-details">
      <tr>
        <td class="label">Nomor Sertifikat</td>
        <td class="val" style="font-family: monospace; font-size: 14px; letter-spacing: 0.5px;">${esc(data.id)}</td>
      </tr>
      <tr>
        <td class="label">Nama Penerima</td>
        <td class="val" style="font-size: 15px; color: #1e40af;">${esc(data.nama)}</td>
      </tr>
      <tr>
        <td class="label">Lomba / Kegiatan</td>
        <td class="val">${esc(data.lomba)}</td>
      </tr>
      <tr>
        <td class="label">Predikat / Peran</td>
        <td class="val">${esc(data.predikat)}</td>
      </tr>
      <tr>
        <td class="label">Tanggal Terbit</td>
        <td class="val">${esc(data.tanggal)}</td>
      </tr>
      <tr>
        <td class="label">Status Sertifikat</td>
        <td class="val">
          <span class="status-pill ${statusClass}">${esc(data.status)}</span>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Mencegah XSS (Cross Site Scripting)
 */
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/[&<>"']/g, function(c) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c];
    });
}
