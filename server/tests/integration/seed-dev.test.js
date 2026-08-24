// Dữ liệu mẫu §13.7 phải NHẬP ĐƯỢC THẬT. Test này tồn tại vì bảng §13.7 trong kế hoạch từng ghi
// vai trò "Quản lý dự án" — sai từ vựng và vi phạm CHECK `users_role_valid`; nếu không có test
// này thì lỗi chỉ hiện ra lúc người dùng chạy `npm run seed:dev` trên máy họ.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, pool } from '../../src/db/pool.js';
import { runSeed } from '../../src/db/seeds/run.js';
import { verifyPassword } from '../../src/modules/auth/password.js';
import { resetTables } from '../helpers/db.js';

beforeEach(async () => {
  await resetTables();
});

afterAll(async () => {
  await closePool();
});

/** Số dòng mong đợi của dev.sql. Đổi dữ liệu mẫu thì sửa Ở ĐÂY, một chỗ duy nhất. */
const EXPECTED = Object.freeze({
  departments: 4,
  users: 12,
  managers: 7,
  works: 8,
  subworks: 12,
  tasks: 13,
  reminders: 5,
  proposals: 5,
  apps: 4,
  chats: 5,
  notifications: 6,
  logs: 8,
});

const numbers = (r) => Object.fromEntries(Object.keys(EXPECTED).map((k) => [k, Number(r[k])]));

describe('dữ liệu mẫu dev.sql', () => {
  it('nhập được và đúng số lượng của §13.7', async () => {
    expect(numbers(await runSeed('dev.sql'))).toEqual(EXPECTED);
  });

  it('chạy hai lần không sinh bản trùng', async () => {
    await runSeed('dev.sql');
    // Bảng nhắc việc, chat, thông báo, nhật ký KHÔNG có khoá tự nhiên nên không dùng được
    // ON CONFLICT — chống trùng bằng WHERE NOT EXISTS. Lần chạy thứ hai là chỗ duy nhất phát
    // hiện được nếu điều kiện đó viết sai.
    expect(numbers(await runSeed('dev.sql'))).toEqual(EXPECTED);
  });

  it('mật khẩu mẫu đăng nhập được và mọi người đều bị bắt đổi lần đầu', async () => {
    await runSeed('dev.sql');
    const { rows } = await pool.query(
      'SELECT code, password_hash, must_change_password, is_active FROM users ORDER BY code'
    );
    expect(rows).toHaveLength(EXPECTED.users);
    for (const u of rows) {
      expect(u.must_change_password, u.code).toBe(true);
      expect(u.is_active, u.code).toBe(true);
    }
    // Kiểm băm thật của một người: hằng băm trong dev.sql phải khớp mật khẩu ghi trong tài liệu.
    await expect(verifyPassword('Test@12345', rows[0].password_hash)).resolves.toBe(true);
  });

  it('hai Phó Giám đốc phụ trách HAI nhóm phòng khác nhau — điều kiện của TC-RBAC-05', async () => {
    await runSeed('dev.sql');
    const { rows } = await pool.query(
      `SELECT u.code, array_agg(d.code ORDER BY d.code) AS depts
         FROM department_managers dm
         JOIN users u ON u.id = dm.user_id
         JOIN departments d ON d.id = dm.department_id
        WHERE dm.role = 'deputy_director'
        GROUP BY u.code ORDER BY u.code`
    );
    expect(rows).toEqual([
      { code: 'TEST002', depts: ['PH01', 'PH02'] },
      { code: 'TEST003', depts: ['PH03', 'PH04'] },
    ]);
  });

  it('có người KHÔNG thuộc phòng nào cho TC-RBAC-09', async () => {
    await runSeed('dev.sql');
    const { rows } = await pool.query(
      `SELECT code, object_type FROM users
        WHERE department_id IS NULL AND role = 'Nhân viên' ORDER BY code`
    );
    // TEST010 là nhân viên nội bộ chưa được xếp phòng; TEST012 là nhà cung cấp, ngoài cơ quan
    // nên KHÔNG bao giờ có phòng. Hai lý do khác nhau, cần cả hai để phân biệt.
    expect(rows).toEqual([
      { code: 'TEST010', object_type: 'Nội bộ' },
      { code: 'TEST012', object_type: 'Nhà cung cấp' },
    ]);
  });

  it('đủ 6 vai trò hợp lệ xuất hiện trong dữ liệu mẫu', async () => {
    await runSeed('dev.sql');
    const { rows } = await pool.query('SELECT DISTINCT role FROM users ORDER BY role');
    expect(rows.map((r) => r.role).sort()).toEqual(
      [
        'admin',
        'Nhân viên',
        'Phó Giám đốc',
        'Phó phòng',
        'Quản lý công việc',
        'Trưởng phòng',
      ].sort()
    );
  });
});

// Phần nghiệp vụ: mỗi test dưới đây khẳng định MỘT điều kiện mà API Phase 3 sẽ dựa vào. Thiếu
// điều kiện nào thì test của Phase 3 sẽ xanh giả — nó chạy đúng nhưng chẳng đi qua nhánh nào.
describe('dữ liệu nghiệp vụ mẫu đủ để chạy Phase 3', () => {
  beforeEach(async () => {
    await runSeed('dev.sql');
  });

  const list = async (sql, params) => (await pool.query(sql, params)).rows;

  it('công việc trải đủ 3 trạng thái duyệt và có việc bị từ chối kèm lý do', async () => {
    const rows = await list(
      `SELECT approval_status, count(*)::int AS n FROM works GROUP BY 1 ORDER BY 1`
    );
    expect(rows).toEqual([
      { approval_status: 'Chờ duyệt', n: 2 },
      { approval_status: 'Từ chối', n: 1 },
      { approval_status: 'Đã duyệt', n: 5 },
    ]);
    // Từ chối mà không nói lý do thì người bị trả lại không biết sửa gì.
    const rejected = await list(
      `SELECT code, reject_reason FROM works WHERE approval_status = 'Từ chối'`
    );
    expect(rejected[0].reject_reason).not.toBe('');
  });

  it('công việc trải đủ 4 phòng và có việc CHƯA phân người phụ trách', async () => {
    const depts = await list(
      `SELECT DISTINCT d.code FROM works w JOIN departments d ON d.id = w.department_id
        ORDER BY d.code`
    );
    expect(depts.map((r) => r.code)).toEqual(['PH01', 'PH02', 'PH03', 'PH04']);
    const orphan = await list(`SELECT code FROM works WHERE manager_id IS NULL`);
    expect(orphan.map((r) => r.code)).toEqual(['CV005']);
  });

  it('cây 3 cấp đúng luật: cấp 2 không có cha, cấp 3 có cha cấp 2 cùng công việc', async () => {
    const lvl2WithParent = await list(
      `SELECT code FROM work_items WHERE level = 2 AND parent_id IS NOT NULL`
    );
    expect(lvl2WithParent).toEqual([]);

    const lvl3NoParent = await list(
      `SELECT code FROM work_items WHERE level = 3 AND parent_id IS NULL`
    );
    expect(lvl3NoParent).toEqual([]);

    // Cha khác công việc là lỗi nặng nhất của cây: con hiện ra dưới công việc không phải của nó.
    const crossWork = await list(
      `SELECT c.code FROM work_items c JOIN work_items p ON p.id = c.parent_id
        WHERE c.work_id <> p.work_id OR p.level <> 2`
    );
    expect(crossWork).toEqual([]);
  });

  it('có công việc con RỖNG (chưa có nhiệm vụ) để thử tính tiến độ chia cho 0', async () => {
    const empty = await list(
      `SELECT p.code FROM work_items p
        WHERE p.level = 2 AND NOT EXISTS (SELECT 1 FROM work_items c WHERE c.parent_id = p.id)
        ORDER BY p.code`
    );
    expect(empty.map((r) => r.code)).toContain('CV001-008');
  });

  it('nhiệm vụ trải đủ 4 trạng thái và có nhiệm vụ QUÁ HẠN cho TC-STAT-03', async () => {
    const byStatus = await list(
      `SELECT status, count(*)::int AS n FROM work_items WHERE level = 3 GROUP BY 1 ORDER BY 1`
    );
    expect(byStatus.map((r) => r.status).sort()).toEqual(
      ['Chưa bắt đầu', 'Hoàn thành', 'Tạm dừng', 'Đang thực hiện'].sort()
    );

    // Quá hạn = hạn chót đã qua mà chưa Hoàn thành. Mốc so là 24/08/2026 (ngày chốt dữ liệu mẫu),
    // viết cứng để test không đổi kết quả theo ngày chạy.
    const overdue = await list(
      `SELECT code, status FROM work_items
        WHERE level = 3 AND due_date < DATE '2026-08-24' AND status <> 'Hoàn thành'
        ORDER BY code`
    );
    expect(overdue.map((r) => r.code)).toEqual(['CV001-007', 'CV003-015']);
    // Hai trạng thái KHÁC nhau: quá hạn không chỉ xảy ra với việc chưa bắt đầu.
    expect(new Set(overdue.map((r) => r.status)).size).toBe(2);

    // Việc đã Hoàn thành thì không được tính quá hạn, kể cả khi xong sau hạn.
    const doneLate = await list(
      `SELECT code FROM work_items
        WHERE level = 3 AND status = 'Hoàn thành' AND report_date > due_date`
    );
    expect(doneLate).toEqual([]);
  });

  it('có nhiệm vụ và công việc con KHÔNG dò ra người phụ trách nhưng vẫn còn tên', async () => {
    const rows = await list(
      `SELECT code, assignee_name FROM work_items
        WHERE assignee_id IS NULL ORDER BY code`
    );
    expect(rows.map((r) => r.code)).toEqual(['CV001-007', 'CV005-019']);
    for (const r of rows) expect(r.assignee_name, r.code).not.toBe('');
  });

  it('nhắc việc CHỈ nằm trên nhiệm vụ cấp 3, và một nhiệm vụ có thể có nhiều nhắc', async () => {
    const wrongLevel = await list(
      `SELECT r.id FROM reminders r JOIN work_items wi ON wi.id = r.work_item_id
        WHERE wi.level <> 3`
    );
    expect(wrongLevel).toEqual([]);

    const many = await list(
      `SELECT wi.code, count(*)::int AS n FROM reminders r
         JOIN work_items wi ON wi.id = r.work_item_id
        GROUP BY wi.code HAVING count(*) > 1`
    );
    expect(many).toEqual([{ code: 'CV006-022', n: 2 }]);
  });

  it('đề nghị đủ 2 loại, đủ 4 trạng thái, và có dòng không gắn công việc nào', async () => {
    const types = await list(`SELECT DISTINCT type FROM proposals ORDER BY type`);
    expect(types.map((r) => r.type).sort()).toEqual(['Ngoài kế hoạch', 'Trong kế hoạch']);

    const statuses = await list(`SELECT DISTINCT status FROM proposals`);
    expect(statuses.map((r) => r.status).sort()).toEqual(
      ['Chờ duyệt', 'Từ chối', 'Đã duyệt', 'Đề xuất mới'].sort()
    );

    const loose = await list(`SELECT code FROM proposals WHERE work_id IS NULL`);
    expect(loose.map((r) => r.code)).toEqual(['DN005']);

    // Gắn nhiệm vụ thì phải gắn cả công việc chứa nhiệm vụ đó, không được lệch.
    const mismatch = await list(
      `SELECT p.code FROM proposals p JOIN work_items wi ON wi.id = p.work_item_id
        WHERE p.work_id IS DISTINCT FROM wi.work_id`
    );
    expect(mismatch).toEqual([]);
  });

  it('allowed_roles của app chỉ chứa tên vai trò HỢP LỆ, và có app cho mọi người', async () => {
    // Viết sai một chữ trong mảng này thì lọc app theo vai trò lặng lẽ trả về rỗng.
    const bad = await list(
      `SELECT a.code, r AS role FROM apps a, unnest(a.allowed_roles) AS r
        WHERE r NOT IN ('admin','Phó Giám đốc','Trưởng phòng','Phó phòng',
                        'Quản lý công việc','Nhân viên')`
    );
    expect(bad).toEqual([]);

    const open = await list(
      `SELECT code FROM apps WHERE allowed_roles = '{}'::text[] ORDER BY code`
    );
    expect(open.map((r) => r.code)).toEqual(['APP001', 'APP004']);
  });

  it('chat và nhật ký có dòng của người đã xoá: id NULL nhưng tên còn để đối chiếu', async () => {
    const chat = await list(`SELECT user_name FROM chat_messages WHERE user_id IS NULL`);
    expect(chat).toHaveLength(1);
    expect(chat[0].user_name).not.toBe('');

    const log = await list(`SELECT actor_name FROM activity_logs WHERE actor_id IS NULL`);
    expect(log).toHaveLength(1);
  });

  it('thông báo có cả đã đọc và chưa đọc, và có dòng không trỏ tới bản ghi nào', async () => {
    const rows = await list(
      `SELECT is_read, count(*)::int AS n FROM notifications GROUP BY 1 ORDER BY 1`
    );
    expect(rows).toEqual([
      { is_read: false, n: 4 },
      { is_read: true, n: 2 },
    ]);

    const general = await list(`SELECT id FROM notifications WHERE ref_type = ''`);
    expect(general).toHaveLength(1);

    // ref_type có chữ thì bắt buộc phải có ref_id, nếu không màn hình bấm vào sẽ đi đâu?
    const dangling = await list(
      `SELECT id FROM notifications WHERE ref_type <> '' AND ref_id IS NULL`
    );
    expect(dangling).toEqual([]);
  });

  it('nhật ký dùng đúng dạng action `<nhóm>.<việc>` như middleware/audit.js sinh ra', async () => {
    const rows = await list(`SELECT DISTINCT action FROM activity_logs ORDER BY action`);
    expect(rows.length).toBeGreaterThan(3);
    for (const r of rows) expect(r.action, r.action).toMatch(/^[a-z][a-zA-Z]*\.[a-zA-Z]+$/);
  });

  it('sequence sinh mã đã vượt qua dữ liệu mẫu — mã mới không đụng mã có sẵn', async () => {
    // Không đẩy sequence thì API Phase 3 tạo công việc đầu tiên sinh ra 'CV001' và đổ vì trùng
    // UNIQUE. Đây là bẫy chỉ hiện khi bấm tạo mới, không test nào khác chạm tới.
    const [gen] = await list(
      `SELECT next_code('CV', 'seq_work_code')      AS work,
              next_code('CV', 'seq_work_item_code') AS item,
              next_code('DN', 'seq_proposal_code')  AS proposal,
              next_code('APP','seq_app_code')       AS app,
              next_code('NV', 'seq_user_code')      AS usr,
              next_code('PH', 'seq_department_code', 2) AS dept`
    );
    expect(gen).toEqual({
      work: 'CV009',
      item: 'CV026',
      proposal: 'DN006',
      app: 'APP005',
      usr: 'NV013',
      dept: 'PH05',
    });

    const clash = await list(
      `SELECT $1::text AS code WHERE EXISTS (SELECT 1 FROM works WHERE code = $1)
        UNION ALL
       SELECT $2::text WHERE EXISTS (SELECT 1 FROM work_items WHERE code = $2)`,
      [gen.work, gen.item]
    );
    expect(clash).toEqual([]);
  });

  it('seed chạy lại KHÔNG kéo lùi sequence đã đi xa hơn', async () => {
    // Phase 3 tạo mã tới CV050 rồi ai đó chạy lại seed: setval thẳng về 8 sẽ làm mã mới trùng.
    await pool.query(`SELECT setval('seq_work_code', 50)`);
    await runSeed('dev.sql');
    const [{ code }] = await list(`SELECT next_code('CV', 'seq_work_code') AS code`);
    expect(code).toBe('CV051');
  });
});
