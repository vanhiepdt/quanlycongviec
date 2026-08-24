#!/usr/bin/env node
/**
 * dump-sheets.js — xuất bản chụp dữ liệu từ file .xlsx tải về từ Google Sheets.
 *
 *   File > Tải xuống > Microsoft Excel (.xlsx)  rồi:
 *   node tools/dump-sheets.js duong-dan/den/file.xlsx
 *
 * Đầu ra: data/snapshot-YYYYMMDD.json  +  data/snapshot-YYYYMMDD.report.txt
 *
 * BA điều tuyệt đối:
 *   1. CHỈ ĐỌC. Không mở kết nối tới Google, không ghi gì vào file nguồn.
 *   2. Xuất NGUYÊN VĂN CHUỖI. Không JSON.parse ô "Nhiệm vụ JSON" / "Nhật ký JSON" /
 *      "Chat JSON" — đã biết là có ô hỏng, việc phân tích thuộc Phase 2.
 *   3. Không đoán. Ô lạ (công thức, ngày, ô gộp) đều được ghi vào file báo cáo.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');

// 8 sheet của bản Apps Script (hằng *_SHEET_NAME trong Code.gs.moi).
// "Nhiệm vụ" đã biết là KHÔNG có trong file thật — nhiệm vụ nằm trong cột "Nhiệm vụ JSON"
// của sheet "Dự án/Nhiệm vụ". Thiếu nó là bình thường, chỉ ghi cảnh báo.
const EXPECTED_SHEETS = [
  { name: 'Người dùng', required: true },
  { name: 'Phòng', required: true },
  { name: 'Dự án/Nhiệm vụ', required: true },
  { name: 'Đề nghị', required: true },
  { name: 'Quản lý App', required: true },
  { name: 'Chat', required: true },
  { name: 'Thông báo', required: true },
  { name: 'Nhiệm vụ', required: false },
];

// Các cột chứa chuỗi JSON. Chỉ ĐẾM ô hỏng để báo cáo, không sửa và không parse vào snapshot.
const JSON_COLUMNS = ['Nhiệm vụ JSON', 'Nhật ký JSON', 'Chat JSON'];

const TOOL_VERSION = 1;

/**
 * Chuẩn hoá tên sheet để so khớp: bỏ hoa/thường, bỏ mọi ký tự mà .xlsx cấm trong tên
 * worksheet (* ? : \ / [ ]) cùng gạch, gạch dưới và khoảng trắng.
 * Lý do: sheet thật tên "Dự án/Nhiệm vụ" có dấu "/", .xlsx KHÔNG cho phép ký tự này nên
 * bản tải về gần như chắc chắn bị đổi tên (thành "Dự án_Nhiệm vụ", "Dự án Nhiệm vụ"...).
 * So khớp cứng theo hằng trong Code.gs.moi sẽ báo "thiếu sheet" oan.
 */
function normalizeSheetName(s) {
  return String(s)
    .toLowerCase()
    .replace(/[*?:\\/[\]\-_\s]/g, '');
}

/** Tìm worksheet: khớp đúng tên trước, không có thì khớp theo tên đã chuẩn hoá. */
function findWorksheet(wb, wanted) {
  const exact = wb.getWorksheet(wanted);
  if (exact) return { ws: exact, renamed: false };
  const target = normalizeSheetName(wanted);
  let hit = null;
  wb.eachSheet((ws) => {
    if (!hit && normalizeSheetName(ws.name) === target) hit = ws;
  });
  return { ws: hit, renamed: hit !== null };
}

/**
 * Đổi một ô Excel thành CHUỖI đúng như người dùng nhìn thấy trên Sheets.
 * Trả về { text, note } — note khác null là chỗ cần Phase 2 để ý.
 */
function cellToText(cell) {
  const v = cell.value;

  if (v === null || v === undefined) return { text: '', note: null };
  if (typeof v === 'string') return { text: v, note: null };
  if (typeof v === 'number') return { text: String(v), note: null };
  if (typeof v === 'boolean') return { text: v ? 'TRUE' : 'FALSE', note: null };

  if (v instanceof Date) {
    // exceljs trả Date theo UTC. Lấy đúng phần ngày theo UTC để không lệch một ngày
    // vì múi giờ máy đang chạy — đúng loại lỗi cần tránh nhất ở dự án này.
    const iso = v.toISOString();
    const hasTime = iso.slice(11, 19) !== '00:00:00';
    return { text: hasTime ? iso : iso.slice(0, 10), note: 'ô kiểu ngày' };
  }

  if (typeof v === 'object') {
    // Ô công thức: lấy giá trị đã tính sẵn, ghi lại công thức để đối chiếu.
    if (v.formula !== undefined || v.sharedFormula !== undefined) {
      const inner = v.result;
      const text =
        inner === null || inner === undefined
          ? ''
          : inner instanceof Date
            ? inner.toISOString().slice(0, 10)
            : typeof inner === 'object'
              ? String(inner.error || '')
              : String(inner);
      return { text, note: `ô công thức: =${v.formula || v.sharedFormula}` };
    }
    if (Array.isArray(v.richText)) {
      return { text: v.richText.map((p) => p.text).join(''), note: 'ô chữ có định dạng' };
    }
    if (v.hyperlink !== undefined) {
      const text = v.text !== undefined && v.text !== null ? String(v.text) : String(v.hyperlink);
      return { text, note: `ô có liên kết: ${v.hyperlink}` };
    }
    if (v.error !== undefined) return { text: String(v.error), note: 'ô lỗi Excel' };
  }

  return { text: String(v), note: `kiểu ô lạ: ${typeof v}` };
}

/** Đọc một worksheet thành { headers, rows, notes }. Hàng 1 là tiêu đề. */
function readSheet(ws) {
  const notes = [];
  const headers = [];
  const rows = [];

  const headerRow = ws.getRow(1);
  const lastCol = ws.actualColumnCount || headerRow.cellCount || 0;
  for (let c = 1; c <= lastCol; c++) {
    const { text } = cellToText(headerRow.getCell(c));
    headers.push(text.trim());
  }
  // Cột không có tiêu đề vẫn phải xuất, nếu không sẽ mất dữ liệu không ai biết.
  headers.forEach((h, i) => {
    if (h === '') {
      headers[i] = `(cột ${i + 1} không tiêu đề)`;
      notes.push(`${ws.name}: cột ${i + 1} không có tiêu đề`);
    }
  });
  const dup = headers.filter((h, i) => headers.indexOf(h) !== i);
  if (dup.length) notes.push(`${ws.name}: tiêu đề trùng nhau: ${[...new Set(dup)].join(', ')}`);

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const obj = {};
    let empty = true;
    for (let c = 1; c <= headers.length; c++) {
      const { text, note } = cellToText(row.getCell(c));
      obj[headers[c - 1]] = text;
      if (text !== '') empty = false;
      if (note) notes.push(`${ws.name}!${row.getCell(c).address} (${headers[c - 1]}): ${note}`);
    }
    if (empty) continue; // hàng trắng ở cuối sheet: bỏ, không tính vào số dòng
    obj.__row = r; // giữ số hàng gốc để Phase 2 báo lỗi chỉ đúng chỗ trong Sheets
    rows.push(obj);
  }

  return { headers, rows, notes };
}

/** Kiểm ô JSON: CHỈ đếm hỏng/ổn để báo cáo. Không sửa, không đưa kết quả parse vào snapshot. */
function auditJsonCells(sheetName, headers, rows) {
  const found = headers.filter((h) => JSON_COLUMNS.includes(h));
  const audit = [];
  for (const col of found) {
    let ok = 0;
    let empty = 0;
    const broken = [];
    for (const row of rows) {
      const raw = row[col];
      if (raw === '') {
        empty++;
        continue;
      }
      try {
        JSON.parse(raw);
        ok++;
      } catch (err) {
        broken.push({ row: row.__row, chars: raw.length, error: err.message });
      }
    }
    audit.push({ sheet: sheetName, column: col, ok, empty, broken });
  }
  return audit;
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function todayStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function parseArgs(argv) {
  const args = { file: null, outDir: 'data', force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force') args.force = true;
    else if (a === '--out') args.outDir = argv[++i];
    else if (a.startsWith('-')) throw new Error(`Tham số lạ: ${a}`);
    else if (args.file === null) args.file = a;
    else throw new Error('Chỉ nhận đúng một file .xlsx');
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error(
      'Cách dùng: node tools/dump-sheets.js <file.xlsx> [--out data] [--force]\n' +
        '\nLấy file: mở Google Sheets > File > Tải xuống > Microsoft Excel (.xlsx).\n' +
        'Công cụ này CHỈ ĐỌC, không ghi gì vào file nguồn.'
    );
    process.exit(2);
  }
  if (!fs.existsSync(args.file)) throw new Error(`Không thấy file: ${args.file}`);

  const stamp = todayStamp();
  const outJson = path.join(args.outDir, `snapshot-${stamp}.json`);
  const outReport = path.join(args.outDir, `snapshot-${stamp}.report.txt`);
  if (fs.existsSync(outJson) && !args.force) {
    throw new Error(`Đã có ${outJson}. Thêm --force nếu thật sự muốn ghi đè.`);
  }
  fs.mkdirSync(args.outDir, { recursive: true });

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(args.file);

  const sheets = {};
  const counts = {};
  const warnings = [];
  const jsonAudit = [];

  const seen = new Set();
  for (const spec of EXPECTED_SHEETS) {
    const { ws, renamed } = findWorksheet(wb, spec.name);
    if (!ws) {
      const msg = `Không có sheet "${spec.name}"`;
      if (spec.required) warnings.push(`THIẾU: ${msg} — sheet này là bắt buộc`);
      else warnings.push(`${msg} (đã biết trước, nhiệm vụ nằm trong cột "Nhiệm vụ JSON")`);
      sheets[spec.name] = { found: false, actual_name: null, headers: [], row_count: 0, rows: [] };
      counts[spec.name] = 0;
      continue;
    }
    if (renamed) {
      warnings.push(
        `Sheet "${spec.name}" trong .xlsx mang tên "${ws.name}" — khớp theo tên chuẩn hoá`
      );
    }
    seen.add(ws.name);
    const { headers, rows, notes } = readSheet(ws);
    sheets[spec.name] = {
      found: true,
      actual_name: ws.name,
      headers,
      row_count: rows.length,
      rows,
    };
    counts[spec.name] = rows.length;
    warnings.push(...notes);
    jsonAudit.push(...auditJsonCells(spec.name, headers, rows));
  }

  // Sheet lạ: không xuất (không nằm trong hợp đồng dữ liệu) nhưng phải nói ra.
  wb.eachSheet((ws) => {
    if (!seen.has(ws.name)) {
      warnings.push(`Sheet ngoài danh sách, KHÔNG xuất: "${ws.name}" (${ws.rowCount} hàng)`);
    }
  });

  const snapshot = {
    meta: {
      tool: 'dump-sheets.js',
      tool_version: TOOL_VERSION,
      generated_at: new Date().toISOString(),
      source_file: path.resolve(args.file),
      source_size_bytes: fs.statSync(args.file).size,
      source_sha256: sha256(args.file),
      note: 'Mọi ô là CHUỖI nguyên văn. Cột *JSON chưa được parse — xem file .report.txt.',
    },
    counts,
    sheets,
  };
  fs.writeFileSync(outJson, JSON.stringify(snapshot, null, 2), 'utf8');

  const lines = [];
  lines.push(`Bản chụp: ${outJson}`);
  lines.push(`Nguồn:    ${path.resolve(args.file)}`);
  lines.push(`sha256:   ${snapshot.meta.source_sha256}`);
  lines.push(`Lúc:      ${snapshot.meta.generated_at}`);
  lines.push('');
  lines.push('SỐ DÒNG THEO SHEET');
  for (const spec of EXPECTED_SHEETS) {
    const s = sheets[spec.name];
    const state = s.found ? `${s.row_count} dòng, ${s.headers.length} cột` : 'KHÔNG CÓ SHEET';
    lines.push(`  ${spec.name.padEnd(18)} ${state}`);
  }
  lines.push('');
  lines.push('CỘT JSON (chỉ đếm, KHÔNG sửa — Phase 2 mới xử lý)');
  if (jsonAudit.length === 0) {
    lines.push('  (không thấy cột JSON nào)');
  }
  for (const a of jsonAudit) {
    lines.push(
      `  ${a.sheet} / ${a.column}: ${a.ok} ô đọc được, ${a.empty} ô trống, ${a.broken.length} ô HỎNG`
    );
    for (const b of a.broken) {
      lines.push(`      hàng ${b.row} (${b.chars} ký tự): ${b.error}`);
    }
  }
  lines.push('');
  lines.push(`CẢNH BÁO (${warnings.length})`);
  if (warnings.length === 0) lines.push('  (không có)');
  for (const w of warnings) lines.push(`  - ${w}`);
  lines.push('');

  const report = lines.join('\n');
  fs.writeFileSync(outReport, report, 'utf8');

  // In ra màn hình bảng đếm; chi tiết ô lạ nằm trong file báo cáo.
  console.log(report);
  const brokenTotal = jsonAudit.reduce((n, a) => n + a.broken.length, 0);
  const missing = EXPECTED_SHEETS.filter((s) => s.required && !sheets[s.name].found);
  console.log(`Báo cáo: ${outReport}`);
  if (missing.length) {
    console.log(`\nCẢNH BÁO: thiếu ${missing.length} sheet bắt buộc — snapshot vẫn được ghi.`);
  }
  if (brokenTotal) {
    console.log(`CẢNH BÁO: ${brokenTotal} ô JSON hỏng. Ghi nguyên văn, Phase 2 sẽ xử lý.`);
  }
}

main().catch((err) => {
  console.error(`\nLỖI: ${err.message}`);
  process.exit(1);
});

