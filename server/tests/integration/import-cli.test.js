// Test cho lớp dòng lệnh: nơi quyết định COMMIT/ROLLBACK và nơi ghi hai tệp đầu ra.
//
// BẢO MẬT: test ghi bản chụp GIẢ ra thư mục tạm rồi đọc lại — không chạm `data/` thật, không đọc
// bản chụp thật.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  importFromSheets,
  newestSnapshot,
  parseArgs,
  REPORT_FILE,
  summaryLines,
  TEMP_PASSWORD_FILE,
} from '../../src/modules/import/cli.js';
import { buildSnapshot } from '../fixtures/snapshot.js';
import { pool, resetTables } from '../helpers/db.js';

let dir;
let snapshotPath;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'import-cli-'));
  snapshotPath = join(dir, 'snapshot-20260824.json');
  writeFileSync(snapshotPath, JSON.stringify(buildSnapshot()), 'utf8');
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

const read = (name) => readFileSync(resolve(dir, name), 'utf8');
const countRows = async (t) => (await pool.query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;

describe('tham số dòng lệnh', () => {
  it('nhận --dry-run, --file= và đường dẫn đứng một mình', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, file: null });
    expect(parseArgs(['--dry-run'])).toEqual({ dryRun: true, file: null });
    expect(parseArgs(['--file=a.json'])).toEqual({ dryRun: false, file: 'a.json' });
    expect(parseArgs(['b.json', '--dry-run'])).toEqual({ dryRun: true, file: 'b.json' });
  });

  it('tham số lạ thì báo lỗi chứ không lặng lẽ bỏ qua', () => {
    // Gõ sai `--dryrun` mà công cụ vẫn chạy là ghi thật lên CSDL trong khi người dùng tưởng thử.
    expect(() => parseArgs(['--dryrun'])).toThrow(/Tham số lạ: --dryrun/);
  });

  it('không chỉ tệp thì lấy bản chụp mới nhất, không có tệp nào thì nói rõ phải làm gì', () => {
    writeFileSync(join(dir, 'snapshot-20260101.json'), '{}', 'utf8');
    expect(newestSnapshot(dir)).toBe(resolve(dir, 'snapshot-20260824.json'));
    const empty = mkdtempSync(join(tmpdir(), 'import-cli-empty-'));
    expect(() => newestSnapshot(empty)).toThrow(/Chạy tools\/dump-sheets.js trước/);
    rmSync(empty, { recursive: true, force: true });
  });
});

describe('TC-IMP-13: --dry-run ghi báo cáo nhưng không ghi CSDL và không ghi mật khẩu', () => {
  let result;

  beforeAll(async () => {
    await resetTables();
    result = await importFromSheets({
      file: snapshotPath,
      dryRun: true,
      dataDir: dir,
      quiet: true,
    });
  }, 60_000);

  it('CSDL vẫn rỗng', async () => {
    expect(await countRows('users')).toBe(0);
    expect(await countRows('works')).toBe(0);
  });

  it('báo cáo vẫn được ghi ra tệp, có đủ số liệu', () => {
    const out = read(REPORT_FILE);
    expect(out).toContain('KHÔNG ghi một dòng nào');
    expect(out).toContain('BẢNG ĐỐI CHIẾU');
    expect(result.totals.inserted).toBeGreaterThan(0);
  });

  it('KHÔNG ghi tệp mật khẩu tạm khi chỉ chạy thử', () => {
    // Chạy thử mà vẫn phát mật khẩu thì người ta cầm mật khẩu không đăng nhập được.
    expect(existsSync(resolve(dir, TEMP_PASSWORD_FILE))).toBe(false);
    expect(result.tempPath).toBeNull();
  });
});

describe('chạy thật: hai tệp đầu ra và những gì được phép in ra màn hình', () => {
  let result;

  beforeAll(async () => {
    await resetTables();
    result = await importFromSheets({ file: snapshotPath, dataDir: dir, quiet: true });
  }, 60_000);

  it('đã COMMIT: dữ liệu còn trong CSDL sau khi hàm trả về', async () => {
    expect(await countRows('users')).toBe(5);
    expect(await countRows('work_items')).toBe(4);
    expect(read(REPORT_FILE)).toContain('CHẠY THẬT');
  });

  it('tệp mật khẩu tạm có đủ người, và nói rõ đây là tệp bí mật', () => {
    const out = read(TEMP_PASSWORD_FILE);
    expect(result.tempPath).toBe(resolve(dir, TEMP_PASSWORD_FILE));
    expect(out).toContain('TỆP NÀY LÀ BÍ MẬT');
    for (const t of result.ctx.tempPasswords) {
      expect(out).toContain(t.code);
      expect(out).toContain(t.password);
    }
    expect(result.ctx.tempPasswords).toHaveLength(2);
  });

  it('mật khẩu KHÔNG lọt vào báo cáo cũng KHÔNG lọt ra màn hình', () => {
    const printed = [read(REPORT_FILE), ...summaryLines(result)].join('\n');
    for (const t of result.ctx.tempPasswords) expect(printed).not.toContain(t.password);
    // Chỉ được nói số lượng và đường dẫn.
    expect(summaryLines(result).join('\n')).toMatch(/2 tài khoản được cấp mật khẩu tạm/);
    expect(summaryLines(result).join('\n')).toMatch(/việc cần người sửa tay rồi nhập lại/);
  });
});
