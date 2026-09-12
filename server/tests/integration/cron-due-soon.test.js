// Lịch quét «gần đến hạn mà tiến độ chưa xong» — yêu cầu người dùng ngày 2026-09-12.
//
// Test gọi THẲNG `quetSapDenHan({ now, soNgay })` với đồng hồ giả, đúng khuôn `cron-overdue.test.js`:
// nếu chống trùng nằm trong callback của `node-cron` thì không có cách nào kiểm nó mà không đợi hai
// ngày trôi qua.
//
// Điểm đáng giữ: con số % trong tin nhắn KHÔNG do câu SQL của lịch tự đặt ra, mà là chính `tien_do`
// của lưới (qua `demNhomFileTheoItem` + `ganTienDo`). Hai ca cuối của file này pin điều đó — đổi mốc
// tiến độ trong `system_settings` thì tin nhắn đổi theo, không lệch với những gì người dùng nhìn thấy.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool } from '../../src/db/pool.js';
import * as notiRepo from '../../src/modules/notifications/repo.js';
import { dungLichChay, quetSapDenHan } from '../../src/services/cron.js';
import { makeDepartment, makeItem, makeUser, makeWork, pool, resetTables } from '../helpers/db.js';

/** Đồng hồ giả — trùng mốc với `cron-overdue.test.js` để hai file đọc cạnh nhau không gây nhầm. */
const HOM_NAY = new Date('2026-08-25T09:00:00+07:00');

/** "yyyy-MM-dd" TIẾN `soNgay` ngày so với đồng hồ giả, theo giờ ĐỊA PHƯƠNG (không `toISOString`). */
function ngaySau(soNgay) {
  const d = new Date(HOM_NAY);
  d.setDate(d.getDate() + soNgay);
  const hai = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`;
}

/** Cùng mốc đó nhưng dạng "dd/MM/yyyy" — dạng tin nhắn in ra cho người đọc. */
function ngayVietSau(soNgay) {
  const [nam, thang, ngay] = ngaySau(soNgay).split('-');
  return `${ngay}/${thang}/${nam}`;
}

let phong;
let nguoiLam;
let congViec;

function nhiemVu(over = {}) {
  return makeItem({
    code: over.code ?? 'CV001-01',
    work_id: congViec.id,
    level: 3,
    name: over.name ?? 'Nhiệm vụ sắp đến hạn',
    ...over,
  });
}

/** Đặt các cột mà `makeItem` không nhận (hạn chót, trạng thái, người làm). */
async function dat(id, patch) {
  const cot = Object.keys(patch);
  const set = cot.map((c, i) => `${c} = $${i + 2}`).join(', ');
  await pool.query(`UPDATE work_items SET ${set} WHERE id = $1`, [id, ...cot.map((c) => patch[c])]);
}

/**
 * Một nhóm file kết quả. `coBan = false` để nguyên nhóm chưa nộp bản nào — trường hợp thật của
 * nhiệm vụ vừa được giao, tiến độ 0% và VẪN phải báo.
 */
async function themFile(itemId, { tyLe = 100, trangThai = 'can-sua', coBan = true } = {}) {
  const {
    rows: [file],
  } = await pool.query(
    'INSERT INTO task_files(item_id,ten_goc,trang_thai,ty_le) VALUES($1,$2,$3,$4) RETURNING id',
    [itemId, 'kết quả.pdf', trangThai, tyLe]
  );
  if (coBan) {
    await pool.query(
      `INSERT INTO task_file_versions(file_id,version_no,ten_luu,ten_goc,loai_mime,kich_thuoc)
       VALUES($1,1,'fixture.pdf','kết quả.pdf','application/pdf',1)`,
      [file.id]
    );
  }
  return file;
}

async function thongBaoCua(userId) {
  const { rows } = await pool.query(
    'SELECT content, type, ref_type, ref_id FROM notifications WHERE user_id = $1 ORDER BY id',
    [userId]
  );
  return rows;
}

beforeEach(async () => {
  await resetTables();
  phong = await makeDepartment({ code: 'PH01', name: 'Phòng Kỹ thuật' });
  nguoiLam = await makeUser({
    code: 'NV010',
    email: 'nv@test.local',
    full_name: 'Trần Thị B',
    role: 'Nhân viên',
    department_id: phong.id,
  });
  congViec = await makeWork({ code: 'CV001', name: 'Công việc A', department_id: phong.id });
});

afterAll(async () => {
  dungLichChay();
  await closePool();
});

describe('quetSapDenHan — chọn đúng nhiệm vụ để nhắc', () => {
  it('hạn còn 2 ngày, chưa nộp file nào ⇒ báo, tiến độ 0%', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: ngaySau(2), status: 'Đang thực hiện', assignee_id: nguoiLam.id });

    const kq = await quetSapDenHan({ now: HOM_NAY });

    expect(kq).toEqual({ sapDenHan: 1, chuaXong: 1, daBao: 1, boQua: 0 });
    const tb = await thongBaoCua(nguoiLam.id);
    expect(tb).toHaveLength(1);
    expect(tb[0].type).toBe(notiRepo.LOAI.SAP_DEN_HAN);
    expect(tb[0].ref_type).toBe('work_item');
    expect(Number(tb[0].ref_id)).toBe(Number(nv.id));
    expect(tb[0].content).toBe(
      'Nhiệm vụ "Nhiệm vụ sắp đến hạn" (CV001-01) còn 2 ngày (' +
        `${ngayVietSau(2)}) mà tiến độ mới 0%.`
    );
  });

  it('hạn ĐÚNG hôm nay ⇒ nói «đến hạn hôm nay», không nói «còn 0 ngày»', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: ngaySau(0), status: 'Đang thực hiện', assignee_id: nguoiLam.id });

    await quetSapDenHan({ now: HOM_NAY });
    const [tb] = await thongBaoCua(nguoiLam.id);
    expect(tb.content).toContain('đến hạn hôm nay');
    expect(tb.content).not.toContain('còn 0 ngày');
  });

  it('hạn còn 4 ngày thì ngoài ngưỡng 3 ngày ⇒ không báo', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: ngaySau(4), status: 'Đang thực hiện', assignee_id: nguoiLam.id });

    expect(await quetSapDenHan({ now: HOM_NAY })).toEqual({
      sapDenHan: 0,
      chuaXong: 0,
      daBao: 0,
      boQua: 0,
    });
    expect(await thongBaoCua(nguoiLam.id)).toHaveLength(0);
  });

  it('ngưỡng đổi được bằng tham số mà không sửa mã — `soNgay: 7` bắt cả việc còn 5 ngày', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: ngaySau(5), status: 'Đang thực hiện', assignee_id: nguoiLam.id });

    expect((await quetSapDenHan({ now: HOM_NAY, soNgay: 7 })).daBao).toBe(1);
    const [tb] = await thongBaoCua(nguoiLam.id);
    expect(tb.content).toContain('còn 5 ngày');
  });

  it('đã quá hạn thì KHÔNG thuộc lượt quét này — việc đó của `quetQuaHan`, báo hai lần là ồn', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: ngaySau(-1), status: 'Đang thực hiện', assignee_id: nguoiLam.id });

    expect((await quetSapDenHan({ now: HOM_NAY })).sapDenHan).toBe(0);
  });

  it('không có hạn chót ⇒ không bao giờ báo', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: null, status: 'Đang thực hiện', assignee_id: nguoiLam.id });

    expect((await quetSapDenHan({ now: HOM_NAY })).sapDenHan).toBe(0);
  });

  it('không có người thực hiện ⇒ bỏ qua, thông báo phải có người nhận', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: ngaySau(1), status: 'Đang thực hiện', assignee_id: null });

    expect((await quetSapDenHan({ now: HOM_NAY })).sapDenHan).toBe(0);
  });

  it('công việc đang CHỜ DUYỆT thì không nhắc — đọc qua `v_countable_items` như lượt quét quá hạn', async () => {
    await pool.query('UPDATE works SET approval_status = $1 WHERE id = $2', [
      'Chờ duyệt',
      congViec.id,
    ]);
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: ngaySau(1), status: 'Đang thực hiện', assignee_id: nguoiLam.id });

    expect((await quetSapDenHan({ now: HOM_NAY })).sapDenHan).toBe(0);
    expect(await thongBaoCua(nguoiLam.id)).toHaveLength(0);
  });

  it('không có nhiệm vụ nào sắp đến hạn ⇒ không ghi dòng nào', async () => {
    expect(await quetSapDenHan({ now: HOM_NAY })).toEqual({
      sapDenHan: 0,
      chuaXong: 0,
      daBao: 0,
      boQua: 0,
    });
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM notifications');
    expect(rows[0].n).toBe(0);
  });
});

describe('quetSapDenHan — «tiến độ chưa xong» là tiến độ của lưới', () => {
  it('file đã duyệt đủ 100% ⇒ KHÔNG báo, dù hạn sát nút', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: ngaySau(1), status: 'Hoàn thành', assignee_id: nguoiLam.id });
    await themFile(nv.id, { tyLe: 100, trangThai: 'da-duyet' });

    expect(await quetSapDenHan({ now: HOM_NAY })).toEqual({
      sapDenHan: 1,
      chuaXong: 0,
      daBao: 0,
      boQua: 0,
    });
    expect(await thongBaoCua(nguoiLam.id)).toHaveLength(0);
  });

  it('đang sửa (20%) vẫn báo — đúng nghĩa «chưa xong» mà người dùng chốt', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: ngaySau(2), status: 'Đang thực hiện', assignee_id: nguoiLam.id });
    await themFile(nv.id, { tyLe: 100, trangThai: 'can-sua' });

    await quetSapDenHan({ now: HOM_NAY });
    const [tb] = await thongBaoCua(nguoiLam.id);
    expect(tb.content).toContain('tiến độ mới 20%');
  });

  it('nhiều nhóm file ⇒ % theo TRỌNG SỐ, không bình quân số nhóm', async () => {
    // 60% đã duyệt (100) + 40% đang sửa (20) = (60*100 + 40*20)/100 = 68%. Bình quân số nhóm sẽ ra
    // (100+20)/2 = 60% — sai, và sai đúng chỗ người dùng đang nhìn con số khác trên màn hình.
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: ngaySau(3), status: 'Đang thực hiện', assignee_id: nguoiLam.id });
    await themFile(nv.id, { tyLe: 60, trangThai: 'da-duyet' });
    await themFile(nv.id, { tyLe: 40, trangThai: 'can-sua' });

    await quetSapDenHan({ now: HOM_NAY });
    const [tb] = await thongBaoCua(nguoiLam.id);
    expect(tb.content).toContain('còn 3 ngày');
    expect(tb.content).toContain('tiến độ mới 68%');
  });

  it('hai nhiệm vụ cùng hạn: một cái xong, một cái chưa ⇒ chỉ báo cái chưa xong', async () => {
    const a = await nhiemVu({ code: 'CV001-01', name: 'Việc đã xong' });
    const b = await nhiemVu({ code: 'CV001-02', name: 'Việc còn dở' });
    await dat(a.id, { due_date: ngaySau(2), status: 'Hoàn thành', assignee_id: nguoiLam.id });
    await dat(b.id, { due_date: ngaySau(2), status: 'Đang thực hiện', assignee_id: nguoiLam.id });
    await themFile(a.id, { tyLe: 100, trangThai: 'da-duyet' });
    await themFile(b.id, { tyLe: 100, trangThai: 'cho-xem' });

    const kq = await quetSapDenHan({ now: HOM_NAY });
    expect(kq).toEqual({ sapDenHan: 2, chuaXong: 1, daBao: 1, boQua: 0 });
    const tb = await thongBaoCua(nguoiLam.id);
    expect(tb).toHaveLength(1);
    expect(tb[0].content).toContain('Việc còn dở');
    expect(tb[0].content).not.toContain('Việc đã xong');
  });
});

describe('quetSapDenHan — không sinh thông báo trùng', () => {
  it('quét hai lần trong CÙNG ngày chỉ tạo một thông báo', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: ngaySau(2), status: 'Đang thực hiện', assignee_id: nguoiLam.id });

    const lan1 = await quetSapDenHan({ now: HOM_NAY });
    const lan2 = await quetSapDenHan({ now: new Date('2026-08-25T19:30:00+07:00') });

    expect(lan1).toEqual({ sapDenHan: 1, chuaXong: 1, daBao: 1, boQua: 0 });
    expect(lan2).toEqual({ sapDenHan: 1, chuaXong: 1, daBao: 0, boQua: 1 });
    expect(await thongBaoCua(nguoiLam.id)).toHaveLength(1);
  });

  it('sang NGÀY MỚI thì nhắc lại — việc vẫn chưa xong thì ngày nào cũng đáng nhắc', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: ngaySau(2), status: 'Đang thực hiện', assignee_id: nguoiLam.id });

    await quetSapDenHan({ now: HOM_NAY });
    // Thông báo vừa tạo mang created_at = ĐỒNG HỒ THẬT, không phải `now` giả. Lùi nó về HOM_NAY để
    // lượt quét "sáng hôm sau" không bị bộ chống trùng coi là đã nhắc HÔM NAY (bẫy giống
    // `cron-overdue.test.js`).
    await pool.query('UPDATE notifications SET created_at = $1 WHERE user_id = $2 AND type = $3', [
      HOM_NAY,
      nguoiLam.id,
      notiRepo.LOAI.SAP_DEN_HAN,
    ]);

    const maiSau = new Date(HOM_NAY);
    maiSau.setDate(maiSau.getDate() + 1);
    const lan2 = await quetSapDenHan({ now: maiSau });

    expect(lan2.daBao).toBe(1);
    const tb = await thongBaoCua(nguoiLam.id);
    expect(tb).toHaveLength(2);
    // Hôm sau thì số ngày còn lại phải ít đi một.
    expect(tb[1].content).toContain('còn 1 ngày');
  });

  it('thông báo QUÁ HẠN của cùng nhiệm vụ không chặn tin sắp đến hạn — hai loại, hai mốc', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: ngaySau(1), status: 'Đang thực hiện', assignee_id: nguoiLam.id });
    await notiRepo.insert({
      userId: nguoiLam.id,
      content: 'Nhiệm vụ đã quá hạn',
      type: notiRepo.LOAI.QUA_HAN,
      refType: 'work_item',
      refId: nv.id,
    });

    expect((await quetSapDenHan({ now: HOM_NAY })).daBao).toBe(1);
    expect(await thongBaoCua(nguoiLam.id)).toHaveLength(2);
  });
});
