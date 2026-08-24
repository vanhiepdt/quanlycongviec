// Test tích hợp cho công cụ nhập dữ liệu — nhóm D của §8.4 (TC-IMP-01..14).
//
// BẢO MẬT: mọi test ở đây dùng bản chụp GIẢ ở `tests/fixtures/snapshot.js`. Không test nào được
// đọc `data/snapshot-*.json` vì tệp đó có email và mật khẩu văn bản thuần của người thật.
import { beforeAll, describe, expect, it } from 'vitest';
import { runImport } from '../../src/modules/import/importer.js';
import { createReport, renderReport, reportTotals } from '../../src/modules/import/report.js';
import { hashPassword, verifyPassword } from '../../src/modules/auth/password.js';
import { AppError } from '../../src/utils/errors.js';
import {
  buildSnapshot,
  EXPECTED,
  notifySheet,
  sheetOf,
  USER_HEADERS,
} from '../fixtures/snapshot.js';
import { BUSINESS_TABLES, pool, resetTables } from '../helpers/db.js';

/**
 * Nhập một bản chụp trong MỘT transaction, đúng như `cli.js` làm: `dryRun` thì ROLLBACK.
 * Trả cả báo cáo, ngữ cảnh (có danh sách mật khẩu tạm) và số liệu tổng.
 */
async function importSnapshot(snapshot, { dryRun = false } = {}) {
  const report = createReport({
    sourceFile: 'tests/fixtures/snapshot.js',
    dryRun,
    snapshotMeta: snapshot.meta,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ctx = await runImport({ client, snapshot, report });
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    return { report, ctx, totals: reportTotals(report) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const countRows = async (table) => {
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${table}`);
  return rows[0].n;
};

const one = async (sql, params) => (await pool.query(sql, params)).rows[0] ?? null;

/** Số dòng của mọi bảng nghiệp vụ — dùng để chứng minh lần chạy thứ hai không thêm gì. */
async function snapshotOfCounts() {
  const out = {};
  for (const table of BUSINESS_TABLES) out[table] = await countRows(table);
  return out;
}

/** Gộp mọi lý do + ghi chú của một thực thể thành một chuỗi để tìm câu chữ trong báo cáo. */
const notesOf = (report, key) => {
  const c = report.entity(key);
  return [...c.reasons, ...c.notes].join('\n');
};

// Một lần nhập duy nhất cho cả nhóm test dưới đây: chạy lại 14 lần rất chậm vì mỗi người dùng
// mới đều phải băm bcrypt. Các test chỉ ĐỌC, không sửa dữ liệu, nên dùng chung được.
describe('nhập bản chụp đầy đủ', () => {
  let run;

  beforeAll(async () => {
    await resetTables();
    run = await importSnapshot(buildSnapshot());
  }, 60_000);

  it('TC-IMP-01: số dòng từng thực thể khớp báo cáo, và báo cáo khớp CSDL', async () => {
    for (const [key, want] of Object.entries(EXPECTED)) {
      expect(run.totals.byEntity[key], `thực thể ${key}`).toMatchObject(want);
    }
    // Số dòng trong CSDL phải bằng số đã báo cáo là "chèn" — báo cáo không được nói dối.
    for (const [key, want] of Object.entries(EXPECTED)) {
      if (key === 'department_managers') continue;
      expect(await countRows(key), `bảng ${key}`).toBe(want.inserted);
    }
    expect(await countRows('department_managers')).toBe(EXPECTED.department_managers.inserted);
  });

  it('TC-IMP-14: tổng nhiệm vụ, nhắc việc, đề nghị khớp Sheets', async () => {
    expect(await countRows('work_items')).toBe(4);
    expect(await countRows('reminders')).toBe(2);
    expect(await countRows('proposals')).toBe(2);
    // 4 phần tử đọc được + 1 ô hỏng bị bỏ = đúng những gì Sheets có, không thừa không thiếu.
    expect(run.totals.byEntity.work_items.sheetRows).toBe(4);
    expect(run.totals.byEntity.work_items.skipped).toBe(1);
  });

  it('sheet Thông báo không có trong tệp tải về: nhập 0 dòng, KHÔNG phải lỗi', async () => {
    expect(run.report.missingSheets.join()).toContain('Thông báo');
    expect(await countRows('notifications')).toBe(0);
  });

  it('TC-IMP-03: ô Nhiệm vụ JSON hỏng chỉ mất nhiệm vụ của DA002, không mất gì khác', async () => {
    // Bản thân DA002 vẫn vào CSDL...
    expect(await one('SELECT name FROM works WHERE code = $1', ['DA002'])).not.toBeNull();
    // ...nhật ký của chính DA002 cũng vào được (ô Nhật ký JSON là ô khác, không hỏng)...
    const logs = await pool.query(
      `SELECT action FROM activity_logs
       WHERE work_id = (SELECT id FROM works WHERE code = 'DA002')`
    );
    expect(logs.rows.map((r) => r.action)).toEqual(['Cập nhật dự án']);
    // ...và nhiệm vụ của DA001 không bị ảnh hưởng.
    expect(await countRows("work_items WHERE code LIKE 'DA002%'")).toBe(0);
    expect(run.report.entity('work_items').reasons.join()).toMatch(
      /DA002\.Nhiệm vụ JSON hỏng \(JSON không đọc được/
    );
    expect(run.report.needsHumanFix.join('\n')).toMatch(/DA002.*Nhiệm vụ JSON.*không đọc được/);
  });

  it('TC-IMP-04: "Mã cha" không tồn tại ⇒ parent_id NULL và dòng VẪN CÒN', async () => {
    const orphan = await one(
      'SELECT code, level, parent_id, name FROM work_items WHERE code = $1',
      ['DA001-01-02']
    );
    expect(orphan).not.toBeNull();
    expect(orphan.parent_id).toBeNull();
    expect(orphan.level).toBe(3);
    expect(notesOf(run.report, 'work_items')).toMatch(
      /DA001-01-02: "Mã cha" = "DA001-99" không tồn tại ⇒ parent_id = NULL/
    );
  });

  it('lượt 2 nối đúng cha thật, và không nối cha cho dòng cấp 2', async () => {
    const child = await one(
      `SELECT c.parent_id, p.code AS parent_code, p.level AS parent_level
       FROM work_items c JOIN work_items p ON p.id = c.parent_id WHERE c.code = $1`,
      ['DA001-01-01']
    );
    expect(child.parent_code).toBe('DA001-01');
    expect(child.parent_level).toBe(2);
    const lvl2 = await one('SELECT parent_id, level FROM work_items WHERE code = $1', ['DA001-01']);
    expect(lvl2).toMatchObject({ level: 2, parent_id: null });
  });

  it('TC-IMP-05: tên trùng hai người ⇒ id NULL nhưng TÊN vẫn được giữ', async () => {
    const item = await one('SELECT assignee_id, assignee_name FROM work_items WHERE code = $1', [
      'DA001-01-01',
    ]);
    expect(item).toMatchObject({ assignee_id: null, assignee_name: 'Trần Thị B' });
    expect(notesOf(run.report, 'work_items')).toMatch(/trùng 2 người \(NV002, NV004\)/);
  });

  it('TC-IMP-06: tên không có trong Người dùng ⇒ id NULL, tên còn nguyên', async () => {
    const item = await one('SELECT assignee_id, assignee_name FROM work_items WHERE code = $1', [
      'DA001-01-02',
    ]);
    expect(item).toMatchObject({ assignee_id: null, assignee_name: 'Lê Văn Huy' });
    const proposal = await one('SELECT creator_id, creator_name FROM proposals WHERE code = $1', [
      'DN002',
    ]);
    expect(proposal).toMatchObject({ creator_id: null, creator_name: 'Lê Văn Huy' });
    expect(notesOf(run.report, 'proposals')).toMatch(/không có người tên "Lê Văn Huy"/);
  });

  it('tên trùng ở cột quản lý được chữa bằng "Email quản lý", chữ đã nhập giữ nguyên', async () => {
    const admin = await one('SELECT id FROM users WHERE code = $1', ['NV001']);
    const work = await one('SELECT manager_id, manager_name FROM works WHERE code = $1', ['DA002']);
    expect(work).toMatchObject({ manager_id: admin.id, manager_name: 'Trần Thị B' });
    expect(notesOf(run.report, 'works')).toMatch(/DA002:.*dò ra theo "Email quản lý"/);
  });

  it('TC-IMP-07: mật khẩu được BĂM, ai cũng phải đổi, người rỗng có mật khẩu tạm', async () => {
    const u = await one('SELECT password_hash, must_change_password FROM users WHERE code = $1', [
      'NV001',
    ]);
    expect(u.must_change_password).toBe(true);
    expect(u.password_hash).toMatch(/^\$2[aby]\$/); // đúng dạng bcrypt
    expect(u.password_hash).not.toContain('matkhau1'); // không còn văn bản thuần
    expect(await verifyPassword('matkhau1', u.password_hash)).toBe(true);
    expect(await verifyPassword('matkhau2', u.password_hash)).toBe(false);

    // Hai người có ô Mật khẩu rỗng: mỗi người một mật khẩu tạm ngẫu nhiên, đăng nhập được.
    expect(run.ctx.tempPasswords.map((t) => t.code).sort()).toEqual(['NV005', 'NV006']);
    const temp = run.ctx.tempPasswords.find((t) => t.code === 'NV005');
    expect(temp.password.length).toBe(20);
    const nv005 = await one('SELECT password_hash FROM users WHERE code = $1', ['NV005']);
    expect(await verifyPassword(temp.password, nv005.password_hash)).toBe(true);
    const nv006 = await one('SELECT password_hash FROM users WHERE code = $1', ['NV006']);
    expect(await verifyPassword(temp.password, nv006.password_hash)).toBe(false);
  });

  it('mật khẩu tạm KHÔNG lọt vào báo cáo', () => {
    const printed = renderReport(run.report);
    for (const t of run.ctx.tempPasswords) expect(printed).not.toContain(t.password);
    expect(printed).toMatch(/NV005: mật khẩu rỗng ⇒ đã sinh mật khẩu tạm/);
  });

  it('TC-IMP-08: 31/12 và 01/01 KHÔNG bị lệch một ngày', async () => {
    // `pool.js` giữ cột DATE là chuỗi, nên so được đúng từng chữ; nếu ai bỏ parser đó đi, múi giờ
    // Asia/Ho_Chi_Minh sẽ đẩy 2026-01-01 về 2025-12-31 và test này đổ.
    expect(await one('SELECT start_date, end_date FROM works WHERE code = $1', ['DA001'])).toEqual({
      start_date: '2025-12-31',
      end_date: '2026-01-01',
    });
    expect(
      await one('SELECT start_date, due_date FROM work_items WHERE code = $1', ['DA001-01-01'])
    ).toEqual({ start_date: '2025-12-31', due_date: '2026-01-01' });
  });

  it('TC-IMP-09: 29/02/2024 là ngày có thật, phải nhập được', async () => {
    const item = await one('SELECT start_date FROM work_items WHERE code = $1', ['DA001-01-02']);
    expect(item.start_date).toBe('2024-02-29');
  });

  it('TC-IMP-09: 29/02/2026 KHÔNG có thật ⇒ để NULL và nói ra, không đoán', async () => {
    const work = await one('SELECT approved_at FROM works WHERE code = $1', ['DA003']);
    expect(work.approved_at).toBeNull();
    expect(notesOf(run.report, 'works')).toMatch(/DA003.Ngày duyệt: ngày không có thật/);
  });

  it('TC-IMP-10: ô ngày rỗng và mốc 30/12/1899 đều thành NULL', async () => {
    expect(await one('SELECT start_date, end_date FROM works WHERE code = $1', ['DA003'])).toEqual({
      start_date: null,
      end_date: null,
    });
    expect(
      await one('SELECT due_date, report_date FROM work_items WHERE code = $1', ['DA001-01-02'])
    ).toEqual({ due_date: null, report_date: null });
    const legacy = await one('SELECT start_date FROM work_items WHERE code = $1', [
      'ID260824081007935',
    ]);
    expect(legacy.start_date).toBeNull();
    expect(notesOf(run.report, 'work_items')).toMatch(/mốc 30\/12\/1899 của Excel = ô rỗng/);
  });

  it('TC-IMP-11: giá trị lạ KHÔNG bị đoán — vai trò lạ thì bỏ dòng và in ra để sửa tay', async () => {
    expect(await one('SELECT code FROM users WHERE code = $1', ['NV007'])).toBeNull();
    expect(run.report.entity('users').reasons.join('\n')).toMatch(
      /NV007: Phân quyền lạ "Trợ lý admin" ⇒ không đoán vai trò, bỏ dòng/
    );
    expect(run.report.needsHumanFix.join('\n')).toMatch(/NV007 \(Hoàng Văn E\).*Phân quyền/);
  });

  it('TC-IMP-11: hoa/thường và từ vựng cũ thì SỬA được, và in ra từng dòng đã đổi', async () => {
    expect((await one('SELECT role FROM users WHERE code = $1', ['NV001'])).role).toBe('admin');
    expect((await one('SELECT role FROM users WHERE code = $1', ['NV002'])).role).toBe(
      'Quản lý công việc'
    );
    const notes = notesOf(run.report, 'users');
    expect(notes).toMatch(/NV001: Phân quyền "Admin" → "admin"/);
    expect(notes).toMatch(/NV002: Phân quyền "Quản lý dự án" → "Quản lý công việc"/);
  });

  it('hai phòng cùng tên: dòng sau bị bỏ có lý do, câu INSERT không đổ giữa đường', async () => {
    expect(await one('SELECT code FROM departments WHERE code = $1', ['PH04'])).toBeNull();
    expect(run.report.entity('departments').reasons.join()).toMatch(
      /PH04: tên phòng "Kế toán" đã là của PH02 \(departments.name là UNIQUE\)/
    );
  });

  it('người không có email vẫn nhập được bằng địa chỉ giữ chỗ .invalid', async () => {
    const u = await one('SELECT email, department_id, dept_role FROM users WHERE code = $1', [
      'NV006',
    ]);
    expect(u.email).toBe('nv006@khong-co-email.invalid');
    // Phòng lạ và vai trò phòng lạ đều để NULL — không đoán, chỉ ghi chú.
    expect(u).toMatchObject({ department_id: null, dept_role: null });
    const notes = notesOf(run.report, 'users');
    expect(notes).toMatch(/NV006.*không có email ⇒ dùng địa chỉ giữ chỗ/);
    expect(notes).toMatch(/không có phòng tên "Phòng Không Tồn Tại"/);
    expect(notes).toMatch(/NV006: Vai trò phòng lạ "Chức lạ" ⇒ để NULL/);
  });

  it('ba cột email của sheet Phòng thành ba vai trò, so email không phân biệt hoa/thường', async () => {
    const { rows } = await pool.query(
      `SELECT d.code AS dept, u.code AS usr, m.role FROM department_managers m
       JOIN departments d ON d.id = m.department_id JOIN users u ON u.id = m.user_id
       ORDER BY d.code, m.role`
    );
    expect(rows).toEqual([
      { dept: 'PH01', usr: 'NV001', role: 'deputy_director' }, // admin@ ⇄ ADMIN@ (citext)
      { dept: 'PH01', usr: 'NV002', role: 'head' },
      { dept: 'PH02', usr: 'NV005', role: 'vice' },
    ]);
    expect(run.report.entity('department_managers').reasons.join()).toMatch(
      /không có người dùng nào mang email "khong-co-ai@vidu.test"/
    );
  });

  it('nhiệm vụ kiểu cũ (không có "Cấp") vào cấp 2, và quyết định đó được ghi lại', async () => {
    const legacy = await one('SELECT level, parent_id FROM work_items WHERE code = $1', [
      'ID260824081007935',
    ]);
    expect(legacy).toMatchObject({ level: 2, parent_id: null });
    expect(run.report.decisions.join('\n')).toMatch(
      /không có khoá "Cấp" và "Mã cha".*nhập thành CẤP 2.*ID260824081007935/s
    );
  });

  it('nhắc việc của một dòng cấp 2 bị bỏ có lý do, nhưng nhiệm vụ đó KHÔNG mất', async () => {
    expect(run.report.entity('reminders').reasons.join()).toMatch(
      /ID260824081007935: 1 nhắc việc thuộc một dòng cấp 2/
    );
    expect(run.report.needsHumanFix.join('\n')).toMatch(/ID260824081007935: nhiệm vụ này vào CSDL/);
    const { rows } = await pool.query(
      `SELECT r.remind_date, r.content, i.code FROM reminders r
       JOIN work_items i ON i.id = r.work_item_id ORDER BY r.remind_date`
    );
    expect(rows).toEqual([
      { code: 'DA001-01-01', remind_date: '2026-01-05', content: 'Nhắc lần 1' },
      { code: 'DA001-01-01', remind_date: '2026-01-10', content: '' },
    ]);
  });

  it('nhiệm vụ giữ đúng % tiến độ, mục tiêu và danh sách link kết quả', async () => {
    const item = await one(
      'SELECT completion, target, output, result_links FROM work_items WHERE code = $1',
      ['DA001-01-01']
    );
    expect(item).toEqual({
      completion: 50,
      target: 'Xong trước Tết',
      output: 'Báo cáo',
      result_links: ['https://vidu.test/a', 'https://vidu.test/b'],
    });
    // '120%' bị kẹp về 100 và phải nói ra, không được lặng lẽ sửa.
    const orphan = await one('SELECT completion FROM work_items WHERE code = $1', ['DA001-01-02']);
    expect(orphan.completion).toBe(100);
    expect(notesOf(run.report, 'work_items')).toMatch(/DA001-01-02: tiến độ 120 → 100/);
  });

  it('đề nghị trỏ vào công việc không tồn tại vẫn nhập được, ba khoá ngoại để NULL', async () => {
    const dn002 = await one(
      'SELECT work_id, work_item_id, creator_id, type, status FROM proposals WHERE code = $1',
      ['DN002']
    );
    expect(dn002).toEqual({
      work_id: null,
      work_item_id: null,
      creator_id: null,
      type: 'Trong kế hoạch',
      status: 'Đề xuất mới',
    });
    const notes = notesOf(run.report, 'proposals');
    expect(notes).toMatch(/DN002: "Mã dự án" = "DA010" không tồn tại ⇒ work_id = NULL/);
    expect(notes).toMatch(/DN002: "Mã nhiệm vụ" = "DA010-01" không tồn tại/);
    expect(notes).toMatch(/DN002: Loại lạ "Loại lạ" ⇒ "Trong kế hoạch"/);
    expect(notes).toMatch(/DN002: Trạng thái lạ "Trạng thái lạ"/);
  });

  it('đề nghị hợp lệ nối đúng công việc, nhiệm vụ và người đề nghị', async () => {
    const dn001 = await one(
      `SELECT w.code AS work, i.code AS item, u.code AS creator, p.proposal_date
       FROM proposals p LEFT JOIN works w ON w.id = p.work_id
       LEFT JOIN work_items i ON i.id = p.work_item_id LEFT JOIN users u ON u.id = p.creator_id
       WHERE p.code = $1`,
      ['DN001']
    );
    expect(dn001).toEqual({
      work: 'DA001',
      item: 'DA001-01-01',
      creator: 'NV001',
      proposal_date: '2025-12-29',
    });
  });

  it('Phân quyền của App: chuẩn hoá được thì lấy, giá trị lạ thì bỏ kèm ghi chú', async () => {
    const app = await one('SELECT allowed_roles, created_by FROM apps WHERE code = $1', ['APP001']);
    expect(app.allowed_roles).toEqual(['admin', 'Quản lý công việc']);
    expect(app.created_by).not.toBeNull();
    expect(notesOf(run.report, 'apps')).toMatch(/APP001: Phân quyền có vai trò lạ "Chức lạ"/);
    const app2 = await one('SELECT allowed_roles FROM apps WHERE code = $1', ['APP002']);
    expect(app2.allowed_roles).toEqual([]);
  });

  it('một ô Chat JSON thành nhiều tin, giờ HH:MM ghép với cột Ngày', async () => {
    const { rows } = await pool.query(
      `SELECT c.user_name, c.message, u.code AS usr,
              to_char(c.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS at
       FROM chat_messages c LEFT JOIN users u ON u.id = c.user_id ORDER BY c.created_at`
    );
    expect(rows).toEqual([
      {
        user_name: 'Lê Văn Huy',
        message: 'tin của người không có trong Người dùng',
        usr: null,
        at: '2026-08-23 03:02',
      },
      {
        user_name: 'Nguyễn Quản Trị',
        message: 'tin của người dò ra được',
        usr: 'NV001',
        at: '2026-08-23 08:15',
      },
    ]);
  });

  it('nhật ký dò người theo EMAIL, không dò ra thì giữ nguyên chữ trong ô', async () => {
    const { rows } = await pool.query(
      `SELECT l.action, l.actor_name, u.code AS actor, l.entity_type, l.details->>'text' AS detail,
              w.code AS work
       FROM activity_logs l LEFT JOIN users u ON u.id = l.actor_id
       LEFT JOIN works w ON w.id = l.work_id ORDER BY l.created_at`
    );
    expect(rows).toEqual([
      {
        action: 'Cập nhật dự án',
        actor_name: 'ADMIN@vidu.test',
        actor: 'NV001',
        entity_type: 'work',
        detail: 'ID: DA002',
        work: 'DA002',
      },
      {
        action: 'Cập nhật nhiệm vụ',
        actor_name: 'ADMIN@vidu.test',
        actor: 'NV001',
        entity_type: 'work',
        detail: 'ID: DA001-01-01, Tên: Nhiệm vụ có cha thật',
        work: 'DA001',
      },
      {
        action: 'Tạo dự án',
        actor_name: 'khong-ai@vidu.test',
        actor: null,
        entity_type: 'work',
        detail: 'ID: DA001',
        work: 'DA001',
      },
    ]);
  });

  it('ô "Trạng thái duyệt" rỗng ⇒ "Đã duyệt", và quyết định đó được ghi lại', async () => {
    const { rows } = await pool.query('SELECT code, approval_status FROM works ORDER BY code');
    expect(rows).toEqual([
      { code: 'DA001', approval_status: 'Đã duyệt' },
      { code: 'DA002', approval_status: 'Chờ duyệt' },
      { code: 'DA003', approval_status: 'Từ chối' },
    ]);
    expect(run.report.decisions.join('\n')).toMatch(
      /"Trạng thái duyệt" rỗng ở DA001 ⇒ lấy "Đã duyệt"/
    );
  });
});

describe('TC-IMP-02: chạy lại lần thứ hai ghi 0 dòng mới', () => {
  let second;
  let before;

  beforeAll(async () => {
    await resetTables();
    await importSnapshot(buildSnapshot());
    before = await snapshotOfCounts();
    second = await importSnapshot(buildSnapshot());
  }, 90_000);

  it('không thực thể nào chèn thêm dòng ở lần chạy thứ hai', () => {
    for (const [key, counts] of Object.entries(second.totals.byEntity)) {
      expect(counts.inserted, `${key} phải chèn 0 dòng ở lần 2`).toBe(0);
    }
  });

  it('số dòng của mọi bảng y nguyên như sau lần chạy thứ nhất', async () => {
    expect(await snapshotOfCounts()).toEqual(before);
  });

  it('cha–con vẫn nối đúng sau lần chạy thứ hai (lượt 2 chạy lại được)', async () => {
    const child = await one(
      `SELECT p.code AS parent FROM work_items c JOIN work_items p ON p.id = c.parent_id
       WHERE c.code = $1`,
      ['DA001-01-01']
    );
    expect(child.parent).toBe('DA001-01');
  });

  it('KHÔNG ghi đè mật khẩu người dùng đã tự đổi, và không sinh lại mật khẩu tạm', async () => {
    // Giả lập: sau lần nhập đầu, NV001 tự đổi mật khẩu. Lần nhập sau không được kéo về mật khẩu
    // cũ trong Sheets — nếu không, đổi mật khẩu là vô nghĩa mỗi khi ai đó nhập lại dữ liệu.
    const changed = await hashPassword('matkhau-tu-doi');
    await pool.query('UPDATE users SET password_hash = $1 WHERE code = $2', [changed, 'NV001']);
    const third = await importSnapshot(buildSnapshot());
    const u = await one('SELECT password_hash FROM users WHERE code = $1', ['NV001']);
    expect(await verifyPassword('matkhau-tu-doi', u.password_hash)).toBe(true);
    expect(await verifyPassword('matkhau1', u.password_hash)).toBe(false);
    expect(third.ctx.tempPasswords).toEqual([]);
  }, 60_000);
});

describe('TC-IMP-12: dữ liệu không thể chữa bằng cách đoán thì DỪNG cả lần nhập', () => {
  beforeAll(resetTables);

  it('hai dòng Người dùng trùng email ⇒ báo lỗi rõ hai mã nào, không ghi nửa vời', async () => {
    const rows = [
      { 'Mã NV': 'NV001', 'Họ tên': 'Người Một', Email: 'trung@vidu.test', 'Phân quyền': 'admin' },
      // Khác hoa/thường nhưng `users.email` là citext ⇒ vẫn là cùng một địa chỉ.
      { 'Mã NV': 'NV002', 'Họ tên': 'Người Hai', Email: 'TRUNG@vidu.test', 'Phân quyền': 'admin' },
    ];
    const snapshot = buildSnapshot({ 'Người dùng': sheetOf(USER_HEADERS, rows) });

    const err = await importSnapshot(snapshot).then(
      () => null,
      (e) => e
    );
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toMatch(/email "trung@vidu.test" \(NV001 và NV002\)/);
    expect(err.message).toMatch(/Sửa Google Sheets rồi nhập lại/);
    // Cả lần nhập đã ROLLBACK: phòng của bước trước cũng không được sót lại.
    expect(await countRows('users')).toBe(0);
    expect(await countRows('departments')).toBe(0);
  });

  it('thiếu sheet BẮT BUỘC thì báo lỗi ngay, khác với sheet không bắt buộc', async () => {
    const err = await importSnapshot(buildSnapshot({ 'Người dùng': null })).then(
      () => null,
      (e) => e
    );
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toMatch(/Người dùng/);
  });
});

describe('TC-IMP-13: --dry-run không ghi một dòng nào', () => {
  let run;

  beforeAll(async () => {
    await resetTables();
    run = await importSnapshot(buildSnapshot(), { dryRun: true });
  }, 60_000);

  it('mọi bảng nghiệp vụ vẫn rỗng sau khi chạy thử', async () => {
    const counts = await snapshotOfCounts();
    for (const table of BUSINESS_TABLES) expect(counts[table], `bảng ${table}`).toBe(0);
  });

  it('nhưng báo cáo vẫn đủ số liệu như chạy thật — vì đã đi qua đúng những câu SQL đó', () => {
    for (const [key, want] of Object.entries(EXPECTED)) {
      expect(run.totals.byEntity[key], `thực thể ${key}`).toMatchObject(want);
    }
    expect(renderReport(run.report)).toContain('KHÔNG ghi một dòng nào');
  });
});

describe('sheet Thông báo khi CÓ trong tệp tải về', () => {
  let run;

  beforeAll(async () => {
    await resetTables();
    run = await importSnapshot(buildSnapshot({ 'Thông báo': notifySheet() }));
  }, 60_000);

  it('dò ra người nhận thì nhập; không dò ra thì buộc phải bỏ vì user_id là NOT NULL', async () => {
    const { rows } = await pool.query(
      `SELECT n.content, n.type, u.code AS usr,
              to_char(n.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS at
       FROM notifications n JOIN users u ON u.id = n.user_id`
    );
    expect(rows).toEqual([
      { content: 'Có việc mới', type: 'info', usr: 'NV001', at: '2026-08-20 02:00' },
    ]);
    expect(run.totals.byEntity.notifications).toMatchObject({
      sheetRows: 2,
      inserted: 1,
      skipped: 1,
    });
    expect(run.report.entity('notifications').reasons.join()).toMatch(
      /không dò ra người nhận "Lê Văn Huy".*user_id là NOT NULL/
    );
    expect(run.report.missingSheets.join()).not.toContain('Thông báo');
  });
});
