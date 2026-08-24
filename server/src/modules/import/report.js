// Báo cáo đối chiếu của lần nhập (§7 việc 2.7). Mỗi thực thể: số dòng ở Sheets / đã chèn / đã
// cập nhật / bỏ qua — kèm LÝ DO cho từng dòng bất thường.
//
// Báo cáo là sản phẩm chính của Phase 2 chứ không phải phụ phẩm: dữ liệu cũ có tên người không
// dò ra, mã cha không tồn tại, vai trò lạ. Những dòng đó vẫn phải nhập được (hoặc bị bỏ có chủ
// ý), nhưng người dùng phải đọc được danh sách để sửa tay. Vì vậy ở đây KHÔNG có chỗ nào tự
// đoán, chỉ có chỗ ghi lại.
//
// KHÔNG bao giờ đưa mật khẩu vào báo cáo — mật khẩu tạm đi ra file riêng (xem `cli.js`).

/** Một hàng của bảng đối chiếu. */
class EntityCounter {
  constructor(label, table) {
    this.label = label;
    this.table = table;
    this.sheetRows = 0;
    this.inserted = 0;
    this.updated = 0;
    this.skipped = 0;
    this.reasons = [];
    this.notes = [];
  }

  countSheetRows(n) {
    this.sheetRows += n;
  }

  addInserted(n = 1) {
    this.inserted += n;
  }

  addUpdated(n = 1) {
    this.updated += n;
  }

  /** Bỏ một dòng — bắt buộc có lý do, không có lý do thì không được bỏ. */
  addSkipped(reason) {
    this.skipped += 1;
    this.reasons.push(reason);
  }

  /** Dòng vẫn nhập nhưng có điều cần người đọc biết (tên không dò ra, ngày hỏng...). */
  addNote(note) {
    this.notes.push(note);
  }
}

// Thứ tự này là thứ tự NHẬP của §7 việc 2.1 — bảng báo cáo in theo đúng thứ tự đó để đọc xong
// là biết chỗ nào đổ thì những chỗ nào chưa chạy.
const ENTITY_ORDER = Object.freeze([
  ['departments', 'Phòng', 'departments'],
  ['users', 'Người dùng', 'users'],
  ['department_managers', 'Người phụ trách phòng', 'department_managers'],
  ['works', 'Công việc (cấp 1)', 'works'],
  ['work_items', 'Công việc con / Nhiệm vụ', 'work_items'],
  ['reminders', 'Nhắc việc', 'reminders'],
  ['proposals', 'Đề nghị', 'proposals'],
  ['apps', 'Quản lý App', 'apps'],
  ['chat_messages', 'Chat', 'chat_messages'],
  ['notifications', 'Thông báo', 'notifications'],
  ['activity_logs', 'Nhật ký', 'activity_logs'],
]);

export function createReport({ sourceFile = '', dryRun = false, snapshotMeta = null } = {}) {
  const entities = new Map();
  for (const [key, label, table] of ENTITY_ORDER) {
    entities.set(key, new EntityCounter(label, table));
  }

  const decisions = [];
  const needsHumanFix = [];
  const missingSheets = [];

  return {
    dryRun,
    sourceFile,
    snapshotMeta,
    entities,

    entity(key) {
      const found = entities.get(key);
      if (!found) throw new Error(`Thực thể không có trong báo cáo: ${key}`);
      return found;
    },

    /** Quyết định đã áp dụng khi dữ liệu cũ thiếu thông tin (ví dụ nhiệm vụ cũ thành cấp 2). */
    decision(text) {
      decisions.push(text);
    },

    /** Việc người dùng phải sửa tay rồi nhập lại — in thành mục riêng, không lẫn vào ghi chú. */
    humanFix(text) {
      needsHumanFix.push(text);
    },

    missingSheet(name, consequence) {
      missingSheets.push(`${name}: ${consequence}`);
    },

    get decisions() {
      return [...decisions];
    },
    get needsHumanFix() {
      return [...needsHumanFix];
    },
    get missingSheets() {
      return [...missingSheets];
    },
  };
}

const LABEL_WIDTH = 26;
const NUM_WIDTH = 9;
const num = (n) => String(n).padStart(NUM_WIDTH);

function renderTable(report) {
  const lines = [
    'BẢNG ĐỐI CHIẾU  (Sheets = số dòng đọc được ở bản chụp)',
    '  ' +
      'Thực thể'.padEnd(LABEL_WIDTH) +
      num('Sheets') +
      num('Chèn') +
      num('Cập nhật') +
      num('Bỏ qua'),
    '  ' + '-'.repeat(LABEL_WIDTH + NUM_WIDTH * 4),
  ];
  const total = { sheetRows: 0, inserted: 0, updated: 0, skipped: 0 };
  for (const counter of report.entities.values()) {
    lines.push(
      '  ' +
        counter.label.padEnd(LABEL_WIDTH) +
        num(counter.sheetRows) +
        num(counter.inserted) +
        num(counter.updated) +
        num(counter.skipped)
    );
    total.sheetRows += counter.sheetRows;
    total.inserted += counter.inserted;
    total.updated += counter.updated;
    total.skipped += counter.skipped;
  }
  lines.push('  ' + '-'.repeat(LABEL_WIDTH + NUM_WIDTH * 4));
  lines.push(
    '  ' +
      'TỔNG'.padEnd(LABEL_WIDTH) +
      num(total.sheetRows) +
      num(total.inserted) +
      num(total.updated) +
      num(total.skipped)
  );
  return lines;
}

function renderSection(title, items) {
  if (items.length === 0) return [];
  return ['', `${title} (${items.length})`, ...items.map((s) => `  - ${s}`)];
}

/** Báo cáo dạng văn bản, ghi ra `data/import-report.txt` và in ra màn hình. */
export function renderReport(report, { now = new Date().toISOString() } = {}) {
  const meta = report.snapshotMeta ?? {};
  const lines = [
    'BÁO CÁO NHẬP DỮ LIỆU TỪ GOOGLE SHEETS',
    '='.repeat(72),
    `Bản chụp:  ${report.sourceFile}`,
    `Tệp gốc:   ${meta.source_file ?? '(không rõ)'}`,
    `sha256:    ${meta.source_sha256 ?? '(không rõ)'}`,
    `Chụp lúc:  ${meta.generated_at ?? '(không rõ)'}`,
    `Nhập lúc:  ${now}`,
    report.dryRun
      ? 'Chế độ:    THỬ (--dry-run) — KHÔNG ghi một dòng nào vào CSDL'
      : 'Chế độ:    CHẠY THẬT — đã ghi vào CSDL',
    '',
    ...renderTable(report),
    ...renderSection('QUYẾT ĐỊNH ĐÃ ÁP DỤNG', report.decisions),
    ...renderSection('SHEET KHÔNG CÓ TRONG TỆP TẢI VỀ', report.missingSheets),
    ...renderSection('CẦN NGƯỜI SỬA TAY RỒI NHẬP LẠI', report.needsHumanFix),
  ];

  for (const counter of report.entities.values()) {
    lines.push(...renderSection(`LÝ DO BỎ QUA — ${counter.label}`, counter.reasons));
    lines.push(...renderSection(`GHI CHÚ — ${counter.label}`, counter.notes));
  }

  lines.push('');
  return lines.join('\n');
}

/** Số liệu gọn để test và để in một dòng tổng kết ra màn hình. */
export function reportTotals(report) {
  const totals = { sheetRows: 0, inserted: 0, updated: 0, skipped: 0, byEntity: {} };
  for (const [key, c] of report.entities) {
    totals.byEntity[key] = {
      sheetRows: c.sheetRows,
      inserted: c.inserted,
      updated: c.updated,
      skipped: c.skipped,
    };
    totals.sheetRows += c.sheetRows;
    totals.inserted += c.inserted;
    totals.updated += c.updated;
    totals.skipped += c.skipped;
  }
  return totals;
}
