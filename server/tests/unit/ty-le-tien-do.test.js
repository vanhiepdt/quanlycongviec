// Phase 8b lỗi 2 — luật chia TỶ LỆ CÔNG VIỆC và TIẾN ĐỘ tính từ file kết quả.
//
// Hai module thuần (không đụng CSDL) server/src/modules/workItems/tyLe.js và tienDo.js.
// Bất biến sống còn: tổng tỷ lệ của một công việc luôn ĐÚNG 100 (số nguyên) qua cả ba biến động
// thêm / xoá / sửa tay; tiến độ của mục không có nhóm kết quả nào là 0% (chốt của người dùng).
import { describe, expect, it } from 'vitest';
import {
  TONG,
  chiaDeu,
  chiaKhiSua,
  chiaKhiThem,
  chiaKhiXoa,
  coGiuTyLe,
  laDauMuc,
} from '../../src/modules/workItems/tyLe.js';
import { ganTienDo, tienDoWork } from '../../src/modules/workItems/tienDo.js';

const tongLa = (mang) => mang.reduce((a, b) => a + b, 0);

describe('8b lỗi 2 — chia tỷ lệ công việc (tyLe.js)', () => {
  it('TC-TYLE-01: chiaDeu tổng luôn đúng 100, phần dư dồn mục đứng đầu', () => {
    expect(chiaDeu(0)).toEqual([]);
    expect(chiaDeu(1)).toEqual([100]);
    expect(chiaDeu(2)).toEqual([50, 50]);
    expect(chiaDeu(3)).toEqual([34, 33, 33]);
    expect(chiaDeu(4)).toEqual([25, 25, 25, 25]);
    expect(chiaDeu(7)).toEqual([15, 15, 14, 14, 14, 14, 14]);
    for (let n = 1; n <= 30; n += 1) expect(tongLa(chiaDeu(n))).toBe(TONG);
  });

  it('TC-TYLE-02: coGiuTyLe giữ tỷ lệ, làm tròn số dư lớn nhất, tổng khớp đích', () => {
    expect(coGiuTyLe([34, 33, 33], 75)).toEqual([25, 25, 25]);
    expect(coGiuTyLe([70, 30], 50)).toEqual([35, 15]);
    expect(coGiuTyLe([100], 100)).toEqual([100]);
    // Tổng 0 ⇒ lối thoát chia đều (không khoá cứng ở toàn số 0).
    expect(coGiuTyLe([0, 0, 0], 100)).toEqual([34, 33, 33]);
    expect(coGiuTyLe([40, 60], 0)).toEqual([0, 0]);
    expect(coGiuTyLe([], 100)).toEqual([]);
    for (const cu of [
      [10, 20, 30, 40],
      [1, 1, 1, 1, 1, 1, 1],
      [99, 1],
      [0, 100],
    ]) {
      expect(tongLa(coGiuTyLe(cu, 100))).toBe(TONG);
    }
  });

  it('TC-TYLE-03: thêm mục — mục mới nhận phần đều 100/n, mục cũ co theo tỷ lệ', () => {
    // Công việc 3 mục đều 34/33/33 thêm mục thứ tư ⇒ về đều 25.
    expect(chiaKhiThem([34, 33, 33], 3)).toEqual([25, 25, 25, 25]);
    expect(chiaKhiThem([34, 33, 33], 0)).toEqual([25, 25, 25, 25]);
    // Giữ chỉnh tay: 70/30 thêm một mục ⇒ mới 33, hai mục cũ co về 47/20 (70:30).
    const ketQua = chiaKhiThem([70, 30], 1);
    expect(ketQua).toEqual([47, 33, 20]);
    expect(tongLa(ketQua)).toBe(TONG);
    // Mục đầu tiên của công việc mới.
    expect(chiaKhiThem([], 0)).toEqual([100]);
    // Vị trí ngoài rìa được kẹp vào đầu/cuối mảng.
    expect(chiaKhiThem([100], -5)).toEqual([50, 50]);
    expect(chiaKhiThem([100], 99)).toEqual([50, 50]);
    for (let n = 1; n <= 12; n += 1) {
      const cu = chiaDeu(n);
      for (let viTri = 0; viTri <= n; viTri += 1) {
        expect(tongLa(chiaKhiThem(cu, viTri))).toBe(TONG);
      }
    }
  });

  it('TC-TYLE-04: xoá mục — phần còn lại co về đúng 100 theo tỷ lệ', () => {
    expect(chiaKhiXoa([25, 25, 25])).toEqual([34, 33, 33]);
    expect(chiaKhiXoa([33])).toEqual([100]);
    expect(chiaKhiXoa([])).toEqual([]);
    // Toàn 0 (dữ liệu lệch) ⇒ chia đều thay vì chết dí ở 0.
    expect(chiaKhiXoa([0, 0])).toEqual([50, 50]);
    // Mục giữ chỉnh tay vẫn giữ ưu thế tương đối; mục 0 giữ 0.
    expect(chiaKhiXoa([70, 30, 0])).toEqual([70, 30, 0]);
    expect(tongLa(chiaKhiXoa([10, 20, 30]))).toBe(TONG);
  });

  it('TC-TYLE-05: sửa tay — ô mới kẹp 0..100, các ô còn lại co về 100 − giá trị', () => {
    expect(chiaKhiSua([34, 33, 33], 0, 50)).toEqual([50, 25, 25]);
    expect(chiaKhiSua([34, 33, 33], 0, 100)).toEqual([100, 0, 0]);
    expect(chiaKhiSua([34, 33, 33], 0, 0)).toEqual([0, 50, 50]);
    // Kẹp ngoài biên: âm ⇒ 0; quá 100 ⇒ 100.
    expect(chiaKhiSua([50, 50], 0, -20)).toEqual([0, 100]);
    expect(chiaKhiSua([50, 50], 0, 150)).toEqual([100, 0]);
    // Chỉ một mục thì luôn gánh cả 100 dù đặt số gì.
    expect(chiaKhiSua([100], 0, 30)).toEqual([100]);
    // Các ô khác đang 0 ⇒ chia đều phần còn lại.
    expect(chiaKhiSua([0, 0, 0], 0, 40)).toEqual([40, 30, 30]);
    for (let v = 0; v <= 100; v += 7) {
      expect(tongLa(chiaKhiSua([34, 33, 33], 1, v))).toBe(TONG);
    }
  });

  it('TC-TYLE-06: laDauMuc — đúng hai dạng dòng mang tỷ lệ', () => {
    expect(laDauMuc({ level: 2, parent_id: null })).toBe(true);
    expect(laDauMuc({ level: '2', parent_id: null })).toBe(true);
    expect(laDauMuc({ level: 3, parent_id: null })).toBe(true);
    expect(laDauMuc({ level: 3, parent_id: 7 })).toBe(false);
    expect(laDauMuc({ level: 3, parent_id: '7' })).toBe(false);
    expect(laDauMuc(null)).toBe(false);
  });
});

const muc = (id, { level = 3, parentId = null, tyLe = 0, tienDo = 0 } = {}) => ({
  id,
  level,
  parent_id: parentId,
  ty_le: tyLe,
  tien_do: tienDo,
});

describe('8b lỗi 2 — tiến độ tính từ file kết quả (tienDo.js)', () => {
  it('TC-TIENDO-01: nhiệm vụ cấp 3 — xong/mẫu của chính nó; không nhóm nào ⇒ 0%', () => {
    const items = [muc(1), muc(2), muc(3)];
    const dem = new Map([
      ['1', { tong: 2, xong: 1 }],
      ['2', { tong: 3, xong: 3 }],
      // Mục 3 không có nhóm kết quả nào.
    ]);
    ganTienDo(items, dem);
    expect(items[0].tien_do).toBe(50);
    expect(items[1].tien_do).toBe(100);
    expect(items[2].tien_do).toBe(0);
  });

  it('TC-TIENDO-02: việc con cấp 2 lấy tỷ lệ nhiệm vụ, độc lập số nhóm kết quả của mỗi nhiệm vụ', () => {
    const items = [
      muc(10, { level: 2 }),
      muc(11, { parentId: 10, tyLe: 70 }),
      muc(12, { parentId: 10, tyLe: 30 }),
      muc(13), // nhiệm vụ độc lập, không nằm trong việc con
    ];
    const dem = new Map([
      ['10', { tong: 1, xong: 1 }], // chính việc con khai 1 kết quả, đã xong
      ['11', { tong: 2, xong: 0 }],
      ['12', { tong: 1, xong: 1 }],
      ['13', { tong: 4, xong: 1 }],
    ]);
    ganTienDo(items, dem);
    // Cấp 2: 70% × 0 + 30% × 100 = 30; không gộp nhóm của cấp 2.
    expect(items[0].tien_do).toBe(30);
    items[1].ty_le = 60;
    items[2].ty_le = 60;
    ganTienDo(items, dem);
    expect(items[0].tien_do).toBe(50);
    items[1].ty_le = 0;
    items[2].ty_le = 0;
    ganTienDo(items, dem);
    expect(items[0].tien_do).toBe(0);
    expect(items[1].tien_do).toBe(0);
    expect(items[2].tien_do).toBe(100);
    expect(items[3].tien_do).toBe(25);
  });

  it('TC-TIENDO-03: tienDoWork — bình quân gia quyền theo tỷ lệ, chỉ đếm mục thuộc diện', () => {
    // Hai mục thuộc diện 60/40 với tiến độ 50/100 ⇒ (60*50 + 40*100)/100 = 70.
    const items = [
      muc(1, { level: 2, tyLe: 60, tienDo: 50 }),
      muc(2, { tyLe: 40, tienDo: 100 }),
      // Nhiệm vụ nằm trong việc con: KHÔNG thuộc diện, không đếm trực tiếp.
      muc(3, { parentId: 1, tyLe: 0, tienDo: 0 }),
    ];
    expect(tienDoWork(items)).toBe(70);
    // Tỷ lệ 0 hết ⇒ 0, không chia cho 0.
    expect(tienDoWork([muc(1, { level: 2 }), muc(2)])).toBe(0);
    // Không mục thuộc diện ⇒ 0.
    expect(tienDoWork([muc(3, { parentId: 1, tienDo: 80 })])).toBe(0);
    expect(tienDoWork([])).toBe(0);
    // Làm tròn: 33/67 với 100/0 ⇒ 33.
    expect(tienDoWork([muc(1, { tyLe: 33, tienDo: 100 }), muc(2, { tyLe: 67, tienDo: 0 })])).toBe(
      33
    );
  });

  it('TC-TIENDO-04: ganTienDo chịu danh sách rỗng / bản đồ rỗng, không ném lỗi', () => {
    expect(ganTienDo([], new Map())).toEqual([]);
    const items = [muc(1)];
    ganTienDo(items, null);
    expect(items[0].tien_do).toBe(0);
  });
});
