// Bộ dữ liệu test MỚI của Vòng 14 (`dev-vong14.sql`): người dùng yêu cầu «xoá data cũ, tạo lại
// theo quy trình mới», nên file seed đó là một phần của sản phẩm — phải có test canh, không thì
// vài vòng nữa đổi tên cột là seed đổ mà không ai biết cho tới lúc bấm thử tay.
//
// Chạy THẲNG runSeed (không spawn như seed-guard.test.js): hai chốt an toàn chỉ `process.exit`
// khi bị TỪ CHỐI, mà ở đây NODE_ENV='test' và CSDL là `quanlycongviec_test` nên không chốt nào bật.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import runSeed from '../../src/db/seeds/run.js';
import { pool, resetTables } from '../helpers/db.js';

const dem = async (sql, params = []) => Number((await pool.query(sql, params)).rows[0].n);

describe('dữ liệu test Vòng 14 — dev-vong14.sql', () => {
  let ketQua;

  beforeAll(async () => {
    await resetTables();
    ketQua = await runSeed('dev-vong14.sql');
  }, 60_000);

  // Seed này TRUNCATE sạch rồi nạp bộ của nó; dọn lại để file test sau không thấy dữ liệu lạ.
  afterAll(async () => {
    await resetTables();
  });

  it('TC-SEED-V14-01: nạp được và trả đúng con số tóm tắt (2 phòng, 7 người, 1+1+5 dòng việc)', () => {
    expect(Number(ketQua.departments)).toBe(2);
    expect(Number(ketQua.users)).toBe(7);
    expect(Number(ketQua.managers)).toBe(4);
    expect(Number(ketQua.works)).toBe(1);
    expect(Number(ketQua.subworks)).toBe(1);
    expect(Number(ketQua.tasks)).toBe(5);
  });

  it('TC-SEED-V14-02: chạy LẠI được nhiều lần — TRUNCATE đầu file nên không sinh bản trùng', async () => {
    const lan2 = await runSeed('dev-vong14.sql');
    expect(Number(lan2.users)).toBe(7);
    expect(Number(lan2.tasks)).toBe(5);
    expect(await dem('SELECT count(*) AS n FROM task_files')).toBe(4);
  }, 60_000);

  it('TC-SEED-V14-03: đủ 4 trạng thái luồng file, mỗi nhiệm vụ một trạng thái khác nhau', async () => {
    const { rows } = await pool.query(
      `SELECT i.code, tf.trang_thai
         FROM task_files tf JOIN work_items i ON i.id = tf.item_id
        ORDER BY i.code`
    );
    expect(rows).toEqual([
      { code: 'CV001-003', trang_thai: 'cho-xem' },
      { code: 'CV001-004', trang_thai: 'can-sua' },
      { code: 'CV001-005', trang_thai: 'cho-lanh-dao' },
      { code: 'CV001-006', trang_thai: 'da-duyet' },
    ]);
    // NV-01 cố ý TRỐNG: đó là chỗ bấm «Tải file lên» để chạy luồng đầy đủ (có file thật trên đĩa).
    expect(
      await dem(
        `SELECT count(*) AS n FROM task_files tf
           JOIN work_items i ON i.id = tf.item_id WHERE i.code = 'CV001-002'`
      )
    ).toBe(0);
  });

  it('TC-SEED-V14-04: bản/ý kiến/bảng luồng gắn đúng nhóm, số bản khớp mô tả', async () => {
    const { rows } = await pool.query(
      `SELECT i.code,
              (SELECT count(*) FROM task_file_versions v WHERE v.file_id = tf.id)   AS ban,
              (SELECT count(*) FROM task_file_comments c
                 JOIN task_file_versions v2 ON v2.id = c.version_id
                WHERE v2.file_id = tf.id)                                           AS y_kien,
              (SELECT count(*) FROM task_file_flow f WHERE f.file_id = tf.id)        AS luong
         FROM task_files tf JOIN work_items i ON i.id = tf.item_id
        ORDER BY i.code`
    );
    const map = Object.fromEntries(
      rows.map((r) => [r.code, [Number(r.ban), Number(r.y_kien), Number(r.luong)]])
    );
    expect(map['CV001-003']).toEqual([1, 0, 1]); // vừa nộp, chờ TP/PP xem
    expect(map['CV001-004']).toEqual([2, 1, 4]); // nộp → góp ý → yêu cầu sửa → nộp lại
    expect(map['CV001-005']).toEqual([2, 2, 4]); // TP tự sửa bản 2 rồi trình lãnh đạo
    expect(map['CV001-006']).toEqual([1, 1, 3]); // nộp → trình → duyệt
  });

  it('TC-SEED-V14-05: TP/PP có thông báo chờ xem, Phó GĐ phụ trách có thông báo được trình lên', async () => {
    const { rows } = await pool.query(
      `SELECT u.code, nt.type, nt.ref_type, nt.content
         FROM notifications nt JOIN users u ON u.id = nt.user_id
        ORDER BY u.code, nt.created_at`
    );
    const cua = (code) => rows.filter((r) => r.code === code);
    // Lỗi người dùng báo: TP không nhận thông báo phê duyệt. Seed phải có sẵn để thấy ngay.
    expect(cua('NV003').length).toBeGreaterThanOrEqual(2);
    expect(cua('NV004').length).toBeGreaterThanOrEqual(2);
    for (const code of ['NV003', 'NV004']) {
      expect(
        cua(code).some((r) => r.type === 'approval_pending' && r.ref_type === 'work_item')
      ).toBe(true);
      expect(
        cua(code).some((r) => r.type === 'approval_pending' && r.ref_type === 'task_file')
      ).toBe(true);
    }
    // Phó GĐ phụ trách phòng = người nhận «Trình lãnh đạo».
    expect(cua('NV002').some((r) => r.content.includes('trình Phó GĐ phụ trách'))).toBe(true);
    // Người NGOÀI phòng (NV007) không nhận gì.
    expect(cua('NV007')).toHaveLength(0);
  });

  it('TC-SEED-V14-06: cây việc đúng cấp và đã duyệt, nhiệm vụ giao cho Cán bộ NV005', async () => {
    const { rows } = await pool.query(
      `SELECT i.code, i.level, i.approval_status, u.code AS nguoi, p.code AS cha
         FROM work_items i
         LEFT JOIN users u ON u.id = i.assignee_id
         LEFT JOIN work_items p ON p.id = i.parent_id
        WHERE i.level = 3 ORDER BY i.code`
    );
    expect(rows).toHaveLength(5);
    for (const r of rows) {
      expect(r.approval_status).toBe('Đã duyệt');
      expect(r.nguoi).toBe('NV005');
      expect(r.cha).toBe('CV001-001');
    }
    // Bảng phân quyền để TRỐNG ⇒ dùng mặc định của Vòng 14 (Cán bộ nộp file = ⏳ chờ duyệt).
    expect(await dem('SELECT count(*) AS n FROM permission_overrides')).toBe(0);
  });
});
