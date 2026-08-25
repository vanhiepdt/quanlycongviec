// Việc 5.8 — lịch quét nhiệm vụ quá hạn (§7, J2, thay `setupDailyTrigger` của Apps Script).
//
// Test gọi THẲNG `quetQuaHan({ now })` với đồng hồ giả thay vì chờ 07:00 hoặc giả lập `node-cron`.
// Đó chính là lý do hàm quét được tách khỏi lịch: nếu chống trùng nằm bên trong callback của cron
// thì không có cách nào kiểm nó mà không đợi hai ngày trôi qua.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool } from '../../src/db/pool.js';
import * as notiRepo from '../../src/modules/notifications/repo.js';
import { batLichChay, dungLichChay, quetQuaHan } from '../../src/services/cron.js';
import { makeDepartment, makeItem, makeUser, makeWork, pool, resetTables } from '../helpers/db.js';

/** Đồng hồ giả: mọi mốc trong file này tính từ đây, không phụ thuộc hôm nay là ngày nào. */
const HOM_NAY = new Date('2026-08-25T09:00:00+07:00');

/**
 * "yyyy-MM-dd" lùi `soNgay` ngày so với đồng hồ giả, tính theo giờ ĐỊA PHƯƠNG.
 *
 * Không `toISOString()`: nó đổi sang UTC trước nên ở +07 mọi mốc trước 07:00 rơi về ngày hôm
 * trước. Chính bẫy này đã làm lượt quét lệch một ngày ở bản nháp đầu.
 */
function ngayTruoc(soNgay) {
  const d = new Date(HOM_NAY);
  d.setDate(d.getDate() - soNgay);
  const hai = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${hai(d.getMonth() + 1)}-${hai(d.getDate())}`;
}

let phong;
let nguoiLam;
let congViec;

function nhiemVu(over = {}) {
  return makeItem({
    code: over.code ?? 'CV001-01',
    work_id: congViec.id,
    level: 3,
    name: over.name ?? 'Nhiệm vụ quá hạn',
    ...over,
  });
}

/** Đặt các cột mà `makeItem` không nhận (hạn chót, trạng thái, người làm, khoá duyệt). */
async function dat(id, patch) {
  const cot = Object.keys(patch);
  const set = cot.map((c, i) => `${c} = $${i + 2}`).join(', ');
  await pool.query(`UPDATE work_items SET ${set} WHERE id = $1`, [id, ...cot.map((c) => patch[c])]);
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

describe('quetQuaHan — chọn đúng nhiệm vụ để nhắc', () => {
  it('nhiệm vụ quá hạn chưa xong ⇒ tạo đúng 1 thông báo cho người thực hiện', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, {
      due_date: ngayTruoc(3),
      status: 'Đang thực hiện',
      assignee_id: nguoiLam.id,
    });

    const kq = await quetQuaHan({ now: HOM_NAY });

    expect(kq).toEqual({ quaHan: 1, daBao: 1, boQua: 0 });
    const tb = await thongBaoCua(nguoiLam.id);
    expect(tb).toHaveLength(1);
    expect(tb[0].type).toBe(notiRepo.LOAI.QUA_HAN);
    expect(tb[0].ref_type).toBe('work_item');
    expect(Number(tb[0].ref_id)).toBe(Number(nv.id));
    // Nội dung phải nêu tên, mã và hạn chót dạng người đọc được.
    expect(tb[0].content).toContain('Nhiệm vụ quá hạn');
    expect(tb[0].content).toContain('CV001-01');
    expect(tb[0].content).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it('nhiệm vụ ĐÃ hoàn thành thì không nhắc, dù hạn chót lùi rất xa', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, {
      due_date: ngayTruoc(100),
      status: 'Hoàn thành',
      assignee_id: nguoiLam.id,
    });

    expect(await quetQuaHan({ now: HOM_NAY })).toEqual({ quaHan: 0, daBao: 0, boQua: 0 });
    expect(await thongBaoCua(nguoiLam.id)).toHaveLength(0);
  });

  it('hạn chót ĐÚNG hôm nay chưa phải quá hạn — còn cả ngày để làm', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, {
      due_date: ngayTruoc(0),
      status: 'Đang thực hiện',
      assignee_id: nguoiLam.id,
    });

    expect((await quetQuaHan({ now: HOM_NAY })).quaHan).toBe(0);
  });

  it('hạn chót hôm qua thì quá hạn', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, {
      due_date: ngayTruoc(1),
      status: 'Đang thực hiện',
      assignee_id: nguoiLam.id,
    });

    expect((await quetQuaHan({ now: HOM_NAY })).quaHan).toBe(1);
  });

  it('quét lúc nửa đêm vẫn tính đúng NGÀY địa phương, không lùi một ngày vì UTC', async () => {
    // Bẫy đã gặp thật: `toISOString()` đổi sang UTC nên 00:30 giờ Việt Nam là 17:30 HÔM TRƯỚC.
    // Nếu mốc so sánh lấy theo UTC thì việc hạn chót hôm qua bị coi là "hạn hôm nay" ⇒ không nhắc.
    const nv = await nhiemVu();
    await dat(nv.id, {
      due_date: ngayTruoc(1),
      status: 'Đang thực hiện',
      assignee_id: nguoiLam.id,
    });

    const nuaDem = new Date(HOM_NAY);
    nuaDem.setHours(0, 30, 0, 0);
    expect((await quetQuaHan({ now: nuaDem })).quaHan).toBe(1);
  });

  it('không có hạn chót ⇒ không bao giờ quá hạn', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: null, status: 'Đang thực hiện', assignee_id: nguoiLam.id });

    expect((await quetQuaHan({ now: HOM_NAY })).quaHan).toBe(0);
  });

  it('không có người thực hiện ⇒ bỏ qua, thông báo phải có người nhận', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, { due_date: ngayTruoc(5), status: 'Đang thực hiện', assignee_id: null });

    expect((await quetQuaHan({ now: HOM_NAY })).quaHan).toBe(0);
  });
});

describe('quetQuaHan — không sinh thông báo trùng', () => {
  it('quét hai lần trong CÙNG ngày chỉ tạo một thông báo', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, {
      due_date: ngayTruoc(2),
      status: 'Đang thực hiện',
      assignee_id: nguoiLam.id,
    });

    const lan1 = await quetQuaHan({ now: HOM_NAY });
    const lan2 = await quetQuaHan({ now: new Date('2026-08-25T19:30:00+07:00') });

    expect(lan1).toEqual({ quaHan: 1, daBao: 1, boQua: 0 });
    expect(lan2).toEqual({ quaHan: 1, daBao: 0, boQua: 1 });
    expect(await thongBaoCua(nguoiLam.id)).toHaveLength(1);
  });

  it('sang NGÀY MỚI thì nhắc lại — việc quá hạn tuần thứ ba vẫn cần nhắc', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, {
      due_date: ngayTruoc(2),
      status: 'Đang thực hiện',
      assignee_id: nguoiLam.id,
    });

    await quetQuaHan({ now: HOM_NAY });
    const maiSau = new Date('2026-08-26T07:00:00+07:00');
    const lan2 = await quetQuaHan({ now: maiSau });

    expect(lan2.daBao).toBe(1);
    expect(await thongBaoCua(nguoiLam.id)).toHaveLength(2);
  });

  it('thông báo LOẠI KHÁC cho cùng nhiệm vụ không chặn thông báo quá hạn', async () => {
    const nv = await nhiemVu();
    await dat(nv.id, {
      due_date: ngayTruoc(2),
      status: 'Đang thực hiện',
      assignee_id: nguoiLam.id,
    });
    await notiRepo.insert({
      userId: nguoiLam.id,
      content: 'Việc của bạn đã được duyệt',
      type: notiRepo.LOAI.DA_DUYET,
      refType: 'work_item',
      refId: nv.id,
    });

    expect((await quetQuaHan({ now: HOM_NAY })).daBao).toBe(1);
    expect(await thongBaoCua(nguoiLam.id)).toHaveLength(2);
  });
});

describe('quetQuaHan — chỉ nhắc việc đã qua cửa duyệt (đọc qua v_countable_items)', () => {
  it('nhiệm vụ nằm trong CÔNG VIỆC đang chờ duyệt thì không nhắc', async () => {
    await pool.query('UPDATE works SET approval_status = $1 WHERE id = $2', [
      'Chờ duyệt',
      congViec.id,
    ]);
    const nv = await nhiemVu();
    await dat(nv.id, {
      due_date: ngayTruoc(5),
      status: 'Đang thực hiện',
      assignee_id: nguoiLam.id,
    });

    expect((await quetQuaHan({ now: HOM_NAY })).quaHan).toBe(0);
    expect(await thongBaoCua(nguoiLam.id)).toHaveLength(0);
  });

  it('nhiệm vụ nằm dưới một CÔNG VIỆC CON đang chờ duyệt thì không nhắc', async () => {
    const con = await makeItem({
      code: 'CV001-01',
      work_id: congViec.id,
      level: 2,
      name: 'Công việc con',
    });
    await pool.query('UPDATE work_items SET approval_status = $1 WHERE id = $2', [
      'Chờ duyệt',
      con.id,
    ]);
    const nv = await makeItem({
      code: 'CV001-02',
      work_id: congViec.id,
      parent_id: con.id,
      level: 3,
      name: 'Nhiệm vụ dưới việc chờ duyệt',
    });
    await dat(nv.id, {
      due_date: ngayTruoc(5),
      status: 'Đang thực hiện',
      assignee_id: nguoiLam.id,
    });

    expect((await quetQuaHan({ now: HOM_NAY })).quaHan).toBe(0);
  });

  it('duyệt xong công việc thì lượt quét kế tiếp nhắc bình thường', async () => {
    await pool.query('UPDATE works SET approval_status = $1 WHERE id = $2', [
      'Chờ duyệt',
      congViec.id,
    ]);
    const nv = await nhiemVu();
    await dat(nv.id, {
      due_date: ngayTruoc(5),
      status: 'Đang thực hiện',
      assignee_id: nguoiLam.id,
    });
    expect((await quetQuaHan({ now: HOM_NAY })).daBao).toBe(0);

    await pool.query('UPDATE works SET approval_status = $1 WHERE id = $2', [
      'Đã duyệt',
      congViec.id,
    ]);
    expect((await quetQuaHan({ now: HOM_NAY })).daBao).toBe(1);
  });

  it('mục bị TỪ CHỐI vẫn được nhắc — nó đã có quyết định, chỉ Chờ duyệt mới bị loại', async () => {
    await pool.query('UPDATE works SET approval_status = $1 WHERE id = $2', [
      'Từ chối',
      congViec.id,
    ]);
    const nv = await nhiemVu();
    await dat(nv.id, {
      due_date: ngayTruoc(5),
      status: 'Đang thực hiện',
      assignee_id: nguoiLam.id,
    });

    expect((await quetQuaHan({ now: HOM_NAY })).daBao).toBe(1);
  });
});

describe('quetQuaHan — nhiều nhiệm vụ, nhiều người', () => {
  it('mỗi người chỉ nhận thông báo của chính mình', async () => {
    const nguoiKhac = await makeUser({
      code: 'NV011',
      email: 'nv2@test.local',
      full_name: 'Lê Văn C',
      role: 'Nhân viên',
      department_id: phong.id,
    });
    const a = await nhiemVu({ code: 'CV001-01', name: 'Việc của B' });
    const b = await nhiemVu({ code: 'CV001-02', name: 'Việc của C' });
    await dat(a.id, { due_date: ngayTruoc(1), status: 'Đang thực hiện', assignee_id: nguoiLam.id });
    await dat(b.id, {
      due_date: ngayTruoc(9),
      status: 'Đang thực hiện',
      assignee_id: nguoiKhac.id,
    });

    expect(await quetQuaHan({ now: HOM_NAY })).toEqual({ quaHan: 2, daBao: 2, boQua: 0 });
    expect((await thongBaoCua(nguoiLam.id))[0].content).toContain('Việc của B');
    expect((await thongBaoCua(nguoiKhac.id))[0].content).toContain('Việc của C');
  });

  it('không có nhiệm vụ nào quá hạn ⇒ không ghi dòng nào', async () => {
    expect(await quetQuaHan({ now: HOM_NAY })).toEqual({ quaHan: 0, daBao: 0, boQua: 0 });
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM notifications');
    expect(rows[0].n).toBe(0);
  });
});

describe('Cờ CRON_ENABLED', () => {
  it('mặc định TẮT trong môi trường test ⇒ batLichChay() trả null, không đăng ký việc nào', () => {
    // Cờ mặc định `false` là cố ý (§7 việc 5.8): staging và máy dev nối cùng CSDL bản sao, hai
    // chỗ cùng bật là mỗi người nhận hai lượt thông báo.
    expect(batLichChay()).toBeNull();
  });
});
