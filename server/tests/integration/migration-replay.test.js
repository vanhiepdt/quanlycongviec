// Migration replay — chạy lại toàn bộ migration trên một CSDL RIÊNG có DỮ LIỆU CŨ.
//
// Vì sao cần file này: `tests/global-setup.js` dựng CSDL test bằng `DROP SCHEMA public CASCADE`
// rồi chạy migration từ con số không, nên MỌI migration đều được thử trên các bảng RỖNG. Câu
// `UPDATE ... SET hanh_dong = '<mã mới>'` vì thế trúng 0 dòng và không bao giờ bị CHECK cũ chặn —
// lỗi chỉ lộ ra trên CSDL có dữ liệu thật. Đó chính xác là điều đã xảy ra với 029 ngày 11/09/2026:
// 2020 test xanh, rồi migration nổ trên UAT bằng `23514 task_file_flow_hanh_dong_check` vì hai câu
// UPDATE đổi tên verdict đứng TRƯỚC câu `DROP CONSTRAINT` (CHECK cũ không biết mã `tp-phe-duyet`).
//
// File này dựng một CSDL tạm, chạy migration tới NGAY TRƯỚC mốc cần thử, gieo dữ liệu cũ vào, rồi
// chạy nốt migration thật bằng đúng node-pg-migrate — tức cùng con đường mà UAT và VPS đi.
//
// THÊM MỘT MỐC: migration nào ĐỔI TÊN hoặc XOÁ một giá trị đang có dữ liệu thì phải có mốc ở đây.
// Nhân bản cặp `MOC_029` + `gieo029` và đổi `nguong` thành số thứ tự của migration mới; nhiều mốc
// thì chạy tuần tự, mỗi mốc một thư mục tạm chứa các migration đứng trước nó, gieo dữ liệu cũ, rồi
// `chayMigrate` với thư mục thật để node-pg-migrate chỉ chạy đúng migration đang thử.
// Migration chỉ thêm bảng/cột thì KHÔNG cần mốc: CSDL rỗng của global-setup đã là phép thử đủ.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SERVER_DIR = path.resolve(import.meta.dirname, '../..');
const MIGRATIONS_DIR = path.join(SERVER_DIR, 'src/db/migrations');
const MIGRATE_BIN = path.join(SERVER_DIR, 'node_modules/node-pg-migrate/bin/node-pg-migrate.js');

/** Tên CSDL tạm. Bắt buộc hậu tố `_test` — cùng chốt an toàn với `global-setup.js`. */
const CSDL_TAM = 'quanlycongviec_replay_test';

/** Số thứ tự lấy từ tiền tố `NNN_` của tên file migration. */
const soThuTu = (ten) => Number.parseInt(ten.slice(0, ten.indexOf('_')), 10);

const MOC_029 = '029_dot_b_gop_hai_truc';

let urlGoc;
let tenGoc;
let thuMucTam;
let client;
let truoc = {};

/** Chạy node-pg-migrate `up` trên một CSDL, với thư mục migration tuỳ chọn. */
function chayMigrate(dirMigrations, dbUrl) {
  try {
    execFileSync(
      process.execPath,
      [MIGRATE_BIN, '--migrations-dir', dirMigrations, '--migration-file-language', 'sql', 'up'],
      {
        cwd: SERVER_DIR,
        // stdio 'pipe' để 30 dòng "Can't determine timestamp" không tràn ra kết quả test.
        env: { ...process.env, DATABASE_URL: dbUrl },
        stdio: 'pipe',
      }
    );
  } catch (err) {
    // execFileSync ném lỗi cụt; thông báo thật nằm ở stdout/stderr của tiến trình con.
    const ra = [err.stdout, err.stderr]
      .filter(Boolean)
      .map((b) => b.toString())
      .join('\n');
    throw new Error(
      `node-pg-migrate thất bại (dir=${path.basename(dirMigrations)}):\n${ra.slice(-2000)}`
    );
  }
}

const doiCsdl = (url, ten) => {
  const u = new URL(url);
  u.pathname = `/${ten}`;
  return u.toString();
};

/**
 * Dữ liệu cũ của 029: hai verdict mà ĐỢT B đổi tên, mỗi cái nằm trên một nhóm file riêng để còn
 * phân biệt được nhóm nào được điền mốc «TP/PP phê duyệt».
 */
async function gieo029(c) {
  const { rows } = await c.query(`
    WITH phong AS (
      INSERT INTO departments (code, name, sort_order) VALUES ('PH01', 'Phòng Kỹ thuật', 1) RETURNING id
    ), nguoi AS (
      INSERT INTO users (code, full_name, email, password_hash, role, department_id)
      VALUES ('NV001', 'Nguyễn Văn A', 'replay-nv@congty.vn', '$2y$10$khong-phai-bam-that', 'Nhân viên', (SELECT id FROM phong)),
             ('TP001', 'Trần Trưởng Phòng', 'replay-tp@congty.vn', '$2y$10$khong-phai-bam-that', 'Trưởng phòng', (SELECT id FROM phong))
      RETURNING id, code
    ), cong_viec AS (
      INSERT INTO works (code, name, department_id) VALUES ('RP001', 'Công việc replay', (SELECT id FROM phong)) RETURNING id
    ), viec_con AS (
      INSERT INTO work_items (code, work_id, parent_id, level, name)
      VALUES ('RP001-001', (SELECT id FROM cong_viec), NULL, 2, 'Việc con') RETURNING id
    ), nhiem_vu AS (
      INSERT INTO work_items (code, work_id, parent_id, level, name)
      VALUES ('RP001-002', (SELECT id FROM cong_viec), (SELECT id FROM viec_con), 3, 'Nhiệm vụ replay') RETURNING id
    ), nhom_a AS (
      INSERT INTO task_files (item_id, ten_goc, trang_thai)
      VALUES ((SELECT id FROM nhiem_vu), 'kết quả A.pdf', 'cho-lanh-dao') RETURNING id
    ), nhom_b AS (
      INSERT INTO task_files (item_id, ten_goc, trang_thai)
      VALUES ((SELECT id FROM nhiem_vu), 'kết quả B.pdf', 'can-sua') RETURNING id
    ), vet AS (
      INSERT INTO task_file_flow (file_id, nguoi_id, vai, hanh_dong, noi_dung, created_at)
      VALUES
        -- Nhóm A: «Trình lãnh đạo» — 029 đổi thành tp-phe-duyet và phải điền mốc từ dòng này.
        -- (Chú thích SQL ở đây KHÔNG được dùng dấu huyền: cả khối nằm trong một template literal
        -- của JS, một dấu huyền sẽ đóng chuỗi sớm và báo lỗi cú pháp ở tận dòng c.query phía trên.)
        ((SELECT id FROM nhom_a), (SELECT id FROM nguoi WHERE code = 'TP001'), 'Trưởng phòng',
         'trinh-lanh-dao', 'Kính trình Phó Giám đốc xem và cho ý kiến', '2026-09-04 09:25:00+07'),
        -- Dòng nop xen giữa để chắc mốc lấy theo id DESC chứ không phải theo thứ tự chèn.
        ((SELECT id FROM nhom_a), (SELECT id FROM nguoi WHERE code = 'NV001'), 'Nhân viên',
         'nop', 'Nộp lần đầu', '2026-09-03 08:00:00+07'),
        -- Nhóm B: «Yêu cầu sửa» — 029 gộp vào tra-ve-cbo, mốc TP/PP phải để NULL.
        ((SELECT id FROM nhom_b), (SELECT id FROM nguoi WHERE code = 'TP001'), 'Trưởng phòng',
         'yeu-cau-sua', 'Thiếu phụ lục, làm lại phần số liệu', '2026-09-05 10:00:00+07')
      RETURNING id
    )
    SELECT (SELECT id FROM nhom_a) AS nhom_a,
           (SELECT id FROM nhom_b) AS nhom_b,
           (SELECT id FROM nguoi WHERE code = 'TP001') AS tp,
           (SELECT count(*) FROM vet) AS so_vet;
  `);
  return rows[0];
}

beforeAll(async () => {
  urlGoc = process.env.TEST_DATABASE_URL;
  if (!urlGoc) throw new Error('Thiếu TEST_DATABASE_URL — xem vitest.config.js.');
  tenGoc = decodeURIComponent(new URL(urlGoc).pathname).replace(/^\//, '');
  // Cùng chốt với `global-setup.js`: không hậu tố `_test` là từ chối, vì phía sau có CREATE/DROP DATABASE.
  if (process.env.NODE_ENV !== 'test' || !tenGoc.endsWith('_test')) {
    throw new Error(`CSDL "${tenGoc}" không có hậu tố _test — không dựng CSDL replay bên cạnh nó.`);
  }
  if (CSDL_TAM === tenGoc)
    throw new Error('CSDL replay trùng CSDL test chính — đổi tên một trong hai.');

  const admin = new pg.Client({ connectionString: doiCsdl(urlGoc, 'postgres') });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${CSDL_TAM}`);
  await admin.query(`CREATE DATABASE ${CSDL_TAM}`);
  await admin.end();

  // Bản sao các migration ĐỨNG TRƯỚC mốc: chạy xong là có đúng lược đồ của UAT/VPS trước 029.
  thuMucTam = fs.mkdtempSync(path.join(os.tmpdir(), 'qlcv-migreplay-'));
  const nguong = soThuTu(MOC_029);
  for (const ten of fs.readdirSync(MIGRATIONS_DIR)) {
    if (ten.endsWith('.sql') && soThuTu(ten) < nguong) {
      fs.copyFileSync(path.join(MIGRATIONS_DIR, ten), path.join(thuMucTam, ten));
    }
  }
  const urlTam = doiCsdl(urlGoc, CSDL_TAM);
  chayMigrate(thuMucTam, urlTam);

  client = new pg.Client({ connectionString: urlTam });
  await client.connect();
  const moc = await gieo029(client);

  const dem = async (sql) => (await client.query(sql)).rows[0];
  truoc = {
    ...moc,
    tongVet: Number((await dem('SELECT count(*) AS n FROM task_file_flow')).n),
    trinhLanhDao: Number(
      (await dem("SELECT count(*) AS n FROM task_file_flow WHERE hanh_dong = 'trinh-lanh-dao'")).n
    ),
    yeuCauSua: Number(
      (await dem("SELECT count(*) AS n FROM task_file_flow WHERE hanh_dong = 'yeu-cau-sua'")).n
    ),
    daDuyetTu028: await dem(
      "SELECT count(*) AS n FROM information_schema.columns WHERE table_name = 'task_files' AND column_name IN ('tp_duyet_boi','tp_duyet_luc')"
    ).then((r) => Number(r.n)),
  };
  await client.end();
  client = null;

  // Chạy nốt migration THẬT (029) bằng đúng công cụ production dùng.
  chayMigrate(MIGRATIONS_DIR, urlTam);

  client = new pg.Client({ connectionString: urlTam });
  await client.connect();
}, 240_000);

afterAll(async () => {
  if (client) await client.end().catch(() => {});
  if (thuMucTam) fs.rmSync(thuMucTam, { recursive: true, force: true });
  const admin = new pg.Client({ connectionString: doiCsdl(urlGoc, 'postgres') });
  await admin.connect().catch(() => {});
  await admin.query(`DROP DATABASE IF EXISTS ${CSDL_TAM}`).catch(() => {});
  await admin.end().catch(() => {});
});

describe('MIG-REPLAY-029 — đổi tên verdict trên CSDL có dữ liệu cũ', () => {
  it('fixture thật sự có dữ liệu cũ để mà đổi', () => {
    // Nếu hai số này về 0 thì fixture hỏng và cả nhóm test dưới đây xanh oan — đúng cái bẫy
    // "bảng rỗng nên không lộ lỗi" mà file này sinh ra để chặn.
    expect(truoc.trinhLanhDao).toBe(1);
    expect(truoc.yeuCauSua).toBe(1);
    expect(truoc.tongVet).toBe(3);
    expect(truoc.daDuyetTu028).toBe(0);
  });

  it('đã ghi 029 vào pgmigrations', async () => {
    const { rows } = await client.query('SELECT name FROM pgmigrations ORDER BY name DESC LIMIT 1');
    expect(rows[0].name).toBe(MOC_029);
  });

  it('đổi tên hết dữ liệu cũ, không mất dòng nào', async () => {
    const { rows } = await client.query(
      'SELECT hanh_dong, count(*)::int AS n FROM task_file_flow GROUP BY hanh_dong ORDER BY hanh_dong'
    );
    const bang = Object.fromEntries(rows.map((r) => [r.hanh_dong, r.n]));
    expect(bang['tp-phe-duyet']).toBe(truoc.trinhLanhDao);
    expect(bang['tra-ve-cbo']).toBe(truoc.yeuCauSua);
    expect(bang['trinh-lanh-dao']).toBeUndefined();
    expect(bang['yeu-cau-sua']).toBeUndefined();
    expect(bang.nop).toBe(1);
    const {
      rows: [{ n }],
    } = await client.query('SELECT count(*)::int AS n FROM task_file_flow');
    expect(n).toBe(truoc.tongVet);
  });

  it('CHECK mới nhận mã mới và CHẶN mã cũ', async () => {
    const {
      rows: [{ def }],
    } = await client.query(
      "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'task_file_flow_hanh_dong_check'"
    );
    expect(def).toContain('tp-phe-duyet');
    expect(def).not.toContain('trinh-lanh-dao');
    expect(def).not.toContain('yeu-cau-sua');
    // `duyet-tu-dong` cố ý GIỮ (R6): dòng lịch sử cũ phải đọc được, chỉ là không còn ghi thêm.
    expect(def).toContain('duyet-tu-dong');

    await expect(
      client.query(
        "INSERT INTO task_file_flow (file_id, vai, hanh_dong) VALUES ($1, 'Trưởng phòng', 'trinh-lanh-dao')",
        [truoc.nhom_a]
      )
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('điền mốc «TP/PP phê duyệt» từ dòng tp-phe-duyet, và để NULL khi không có', async () => {
    const { rows } = await client.query(
      'SELECT id, tp_duyet_boi, tp_duyet_luc FROM task_files ORDER BY id'
    );
    const nhomA = rows.find((r) => String(r.id) === String(truoc.nhom_a));
    const nhomB = rows.find((r) => String(r.id) === String(truoc.nhom_b));
    expect(String(nhomA.tp_duyet_boi)).toBe(String(truoc.tp));
    expect(nhomA.tp_duyet_luc.toISOString()).toBe(new Date('2026-09-04 09:25:00+07').toISOString());
    expect(nhomB.tp_duyet_boi).toBeNull();
    expect(nhomB.tp_duyet_luc).toBeNull();
  });

  it('approval_changes nhận change_kind "ty-le" kèm file_id', async () => {
    const {
      rows: [{ def }],
    } = await client.query(
      "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'approval_changes_change_kind_check'"
    );
    expect(def).toContain('ty-le');

    const {
      rows: [{ n }],
    } = await client.query(
      "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'approval_changes' AND column_name = 'file_id'"
    );
    expect(n).toBe(1);
  });

  it('hai index pending của approval_changes có change_kind trong khoá', async () => {
    const { rows } = await client.query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN ('approval_changes_pending_work','approval_changes_pending_item') ORDER BY indexname"
    );
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.indexdef).toContain('change_kind');
    // 'index đã UNIQUE' KHÔNG phải dấu hiệu của 029: 023 tạo chúng UNIQUE sẵn rồi (bẫy §13.5).
    for (const r of rows) expect(r.indexdef).toContain('UNIQUE');
  });
});
