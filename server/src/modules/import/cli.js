// Dòng lệnh của công cụ nhập dữ liệu (§7 việc 2.1–2.7). `tools/import-from-sheets.js` chỉ là vỏ
// gọi vào đây.
//
// Ba việc file này làm mà `importer.js` cố ý không làm:
//   1. Quyết định COMMIT hay ROLLBACK. `--dry-run` chạy y hệt lần thật rồi ROLLBACK, nên đi qua
//      đúng những câu SQL và đúng những ràng buộc — chứ không phải "chạy giả" bằng cách bỏ ghi.
//   2. Ghi báo cáo đối chiếu ra `data/import-report.txt`.
//   3. Ghi mật khẩu tạm ra `data/import-temp-passwords.txt` với quyền 0600.
//
// BẢO MẬT: mật khẩu tạm KHÔNG in ra màn hình, KHÔNG vào báo cáo, KHÔNG vào log — chỉ nằm trong
// một tệp riêng. Cả `data/` không được commit (xem .gitignore) vì chứa email người thật.
import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { closePool, pool } from '../../db/pool.js';
import { AppError } from '../../utils/errors.js';
import { runImport, STEP_NAMES } from './importer.js';
import { createReport, renderReport, reportTotals } from './report.js';
import { loadSnapshot } from './snapshot.js';

const HERE = dirname(fileURLToPath(import.meta.url));

/** `server/src/modules/import` → thư mục `data/` của gốc kho. */
export const DATA_DIR = resolve(HERE, '../../../../data');

export const REPORT_FILE = 'import-report.txt';
export const TEMP_PASSWORD_FILE = 'import-temp-passwords.txt';

const say = (line) => process.stdout.write(`${line}\n`);

/** `--dry-run`, `--file=...` hoặc một đường dẫn đứng một mình. */
export function parseArgs(argv) {
  const out = { dryRun: false, file: null };
  for (const arg of argv) {
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg.startsWith('--file=')) out.file = arg.slice('--file='.length);
    else if (arg.startsWith('-')) throw new AppError('BAD_REQUEST', `Tham số lạ: ${arg}`);
    else out.file = arg;
  }
  return out;
}

/** Không chỉ tệp thì lấy bản chụp MỚI NHẤT trong `data/` (tên có ngày nên xếp chữ là đủ). */
export function newestSnapshot(dir = DATA_DIR) {
  const found = readdirSync(dir)
    .filter((n) => /^snapshot-.*\.json$/.test(n))
    .sort()
    .reverse();
  if (found.length === 0) {
    throw new AppError(
      'BAD_REQUEST',
      `Không có tệp "snapshot-*.json" nào trong ${dir}. Chạy tools/dump-sheets.js trước.`
    );
  }
  return resolve(dir, found[0]);
}

/**
 * Tệp mật khẩu tạm. Quyền 0600 (chỉ chủ sở hữu đọc được) — trên Windows tham số này bị bỏ qua,
 * nên phần chặn thật nằm ở `.gitignore` và ở việc phải xoá tệp sau khi phát mật khẩu.
 */
function writeTempPasswords(dir, list) {
  const lines = [
    'MẬT KHẨU TẠM DO CÔNG CỤ NHẬP SINH RA',
    '='.repeat(72),
    'Những người dưới đây có ô "Mật khẩu" RỖNG trong Google Sheets. Mỗi người được một mật khẩu',
    'ngẫu nhiên và bị bắt đổi ở lần đăng nhập đầu tiên.',
    '',
    'TỆP NÀY LÀ BÍ MẬT: phát cho từng người qua kênh riêng rồi XOÁ tệp. Không commit, không gửi',
    'qua nhóm chat chung.',
    '',
    ...list.map((t) => `${t.code}\t${t.fullName}\t${t.email}\t${t.password}`),
    '',
  ];
  const path = resolve(dir, TEMP_PASSWORD_FILE);
  writeFileSync(path, lines.join('\n'), { encoding: 'utf8', mode: 0o600 });
  return path;
}

/**
 * Nhập cả bản chụp. Trả về đường dẫn các tệp đã ghi và số liệu tổng — chỗ gọi tự in.
 *
 * @param {{file?: string, dryRun?: boolean, dataDir?: string, quiet?: boolean}} options
 */
export async function importFromSheets({
  file = null,
  dryRun = false,
  dataDir = DATA_DIR,
  quiet = false,
} = {}) {
  const path = file ? resolve(file) : newestSnapshot(dataDir);
  const snapshot = loadSnapshot(path);
  const report = createReport({ sourceFile: path, dryRun, snapshotMeta: snapshot.meta });
  const log = quiet ? () => {} : say;

  log(`[import] bản chụp: ${path}`);
  log(`[import] chế độ:  ${dryRun ? 'THỬ (--dry-run) — sẽ ROLLBACK' : 'CHẠY THẬT — sẽ COMMIT'}`);

  const client = await pool.connect();
  let ctx;
  try {
    await client.query('BEGIN');
    ctx = await runImport({
      client,
      snapshot,
      report,
      onStep: (name) =>
        log(`[import] ${STEP_NAMES.indexOf(name) + 1}/${STEP_NAMES.length} ${name}`),
    });
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
  } catch (err) {
    // Lỗi giữa đường ⇒ ROLLBACK sạch. Không có chuyện nhập được nửa số bảng rồi dừng.
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  const reportPath = resolve(dataDir, REPORT_FILE);
  writeFileSync(reportPath, renderReport(report), 'utf8');
  // Chạy thử thì mật khẩu tạm chưa vào CSDL, ghi ra tệp là gây nhầm ⇒ chỉ ghi khi chạy thật.
  const tempPath =
    !dryRun && ctx.tempPasswords.length > 0 ? writeTempPasswords(dataDir, ctx.tempPasswords) : null;

  return { path, dryRun, report, totals: reportTotals(report), reportPath, tempPath, ctx };
}

/** Vài dòng tổng kết trên màn hình. Chi tiết nằm trong tệp báo cáo. */
export function summaryLines(result) {
  const t = result.totals;
  const lines = [
    `[import] Sheets ${t.sheetRows} dòng → chèn ${t.inserted}, cập nhật ${t.updated}, ` +
      `bỏ qua ${t.skipped}`,
    `[import] báo cáo đối chiếu: ${result.reportPath}`,
  ];
  if (result.report.needsHumanFix.length > 0) {
    lines.push(
      `[import] CÓ ${result.report.needsHumanFix.length} việc cần người sửa tay rồi nhập lại — ` +
        'xem mục "CẦN NGƯỜI SỬA TAY" trong báo cáo'
    );
  }
  if (result.tempPath) {
    // Chỉ nói SỐ LƯỢNG và đường dẫn. Mật khẩu không bao giờ ra màn hình.
    lines.push(
      `[import] ${result.ctx.tempPasswords.length} tài khoản được cấp mật khẩu tạm: ` +
        `${result.tempPath} (BÍ MẬT — phát riêng cho từng người rồi xoá tệp)`
    );
  }
  if (result.dryRun) lines.push('[import] đã ROLLBACK: CSDL không thay đổi một dòng nào.');
  return lines;
}

/** Điểm vào của `tools/import-from-sheets.js`. Trả mã thoát cho vỏ CommonJS. */
export async function main(argv = process.argv.slice(2)) {
  try {
    const result = await importFromSheets(parseArgs(argv));
    for (const line of summaryLines(result)) say(line);
    return 0;
  } catch (err) {
    process.stderr.write(`[import] LỖI: ${err.message}\n`);
    // Lỗi ta chủ động ném (dữ liệu phải sửa tay) thì không cần in vết gọi cho rối.
    if (!(err instanceof AppError)) process.stderr.write(`${err.stack}\n`);
    return 1;
  } finally {
    await closePool();
  }
}

export default main;

// Chạy trực tiếp (`npm run import:sheets`) thì tự thực hiện; import từ test thì không chạy gì.
// Dùng `pathToFileURL` chứ không tự ghép chuỗi `file://`: trên Windows đường dẫn có `E:\` và dấu
// `\`, ghép tay ra URL khác với `import.meta.url` nên điều kiện sẽ luôn sai.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main();
}
