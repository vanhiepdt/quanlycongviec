// TÊN THEO THÁNG — phần thuần (TC-TENTHANG-01..12).
//
// Không cần CSDL: `src/utils/monthNames.js` chỉ nhận dữ liệu bày sẵn. Điều đáng kiểm nhất:
//  · dữ liệu ngày thiếu/ngược KHÔNG sinh vòng lặp và KHÔNG đoán bừa;
//  · `works` id 5 không lẫn với `work_items` id 5 (đúng bài học của `historyRefs.js`);
//  · tháng ĐẦU không nằm trong danh sách sửa được — người dùng nói «các tháng TIẾP THEO».
import { describe, expect, it } from 'vitest';
import {
  banDoTenThang,
  ganTenThang,
  khoaThang,
  nhieuThangHonMot,
  tenGocNeuDaDoi,
  tenTheoThang,
  thangCua,
  thangCuaKhoang,
  thangSuaDuoc,
} from '../../src/utils/monthNames.js';

describe('TC-TENTHANG-01..05 — khoảng tháng', () => {
  it('TC-TENTHANG-01: liệt kê đủ tháng, kể cả khi vắt qua năm', () => {
    expect(thangCuaKhoang('2026-11-20', '2027-02-03')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
  });

  it('TC-TENTHANG-02: cùng một tháng ⇒ một phần tử, và KHÔNG phải "nhiều hơn một tháng"', () => {
    expect(thangCuaKhoang('2026-08-01', '2026-08-31')).toEqual(['2026-08']);
    expect(nhieuThangHonMot('2026-08-01', '2026-08-31')).toBe(false);
    expect(nhieuThangHonMot('2026-08-25', '2026-09-02')).toBe(true);
  });

  it('TC-TENTHANG-03: thiếu một đầu ngày ⇒ rỗng, không đoán', () => {
    expect(thangCuaKhoang('2026-08-01', null)).toEqual([]);
    expect(thangCuaKhoang(null, '2026-08-01')).toEqual([]);
    expect(thangCuaKhoang('', '')).toEqual([]);
    expect(nhieuThangHonMot(null, null)).toBe(false);
  });

  it('TC-TENTHANG-04: ngày kết thúc trước ngày bắt đầu ⇒ rỗng, không lặp ngược', () => {
    expect(thangCuaKhoang('2026-09-10', '2026-07-01')).toEqual([]);
  });

  it('TC-TENTHANG-05: nhận cả Date của pg lẫn chuỗi của JSON; năm sai không treo', () => {
    expect(thangCua(new Date(2026, 7, 15))).toBe('2026-08');
    expect(thangCua('2026-08-15T00:00:00.000Z')).toBe('2026-08');
    expect(thangCua('rác')).toBe('');
    // Chặn trên 240 tháng: nhập lệch năm thành 9999 vẫn trả về trong tầm kiểm soát.
    expect(thangCuaKhoang('2026-01-01', '9999-12-31')).toHaveLength(240);
  });
});

describe('TC-TENTHANG-06 — tháng sửa được', () => {
  it('TC-TENTHANG-06: bỏ tháng ĐẦU, giữ các tháng tiếp theo', () => {
    expect(thangSuaDuoc('2026-08-20', '2026-11-05')).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(thangSuaDuoc('2026-08-01', '2026-08-31')).toEqual([]);
    expect(thangSuaDuoc(null, null)).toEqual([]);
  });
});

describe('TC-TENTHANG-07..09 — bản đồ và gắn vào dòng', () => {
  const ROWS = [
    { work_id: 5, item_id: null, month: '2026-09', name: 'CV tháng 9' },
    { work_id: 5, item_id: null, month: '2026-10', name: 'CV tháng 10' },
    { work_id: null, item_id: 5, month: '2026-09', name: 'Việc con tháng 9' },
  ];

  it('TC-TENTHANG-07: work id 5 và item id 5 là hai khoá khác nhau', () => {
    const banDo = banDoTenThang(ROWS);
    expect(banDo.get(khoaThang('work', 5))).toEqual({
      '2026-09': 'CV tháng 9',
      '2026-10': 'CV tháng 10',
    });
    expect(banDo.get(khoaThang('item', 5))).toEqual({ '2026-09': 'Việc con tháng 9' });
  });

  it('TC-TENTHANG-08: ganTenThang trả bản sao, dòng gốc không bị sửa', () => {
    const goc = { id: 5, name: 'Tên gốc' };
    const [ra] = ganTenThang([goc], banDoTenThang(ROWS), 'work');
    expect(ra.month_names).toEqual({ '2026-09': 'CV tháng 9', '2026-10': 'CV tháng 10' });
    expect(goc.month_names).toBeUndefined();
  });

  it('TC-TENTHANG-09: dòng chưa đặt tên tháng nào vẫn nhận {} chứ không undefined', () => {
    const [ra] = ganTenThang([{ id: 99, name: 'X' }], banDoTenThang(ROWS), 'work');
    expect(ra.month_names).toEqual({});
  });
});

describe('TC-TENTHANG-10..12 — tên hiển thị và tên gốc', () => {
  const BAN_DO = { '2026-09': 'Tên tháng 9', '2026-10': '   ' };

  it('TC-TENTHANG-10: có tên riêng thì dùng, không có thì tên gốc', () => {
    expect(tenTheoThang('Tên gốc', BAN_DO, '2026-09')).toBe('Tên tháng 9');
    expect(tenTheoThang('Tên gốc', BAN_DO, '2026-11')).toBe('Tên gốc');
    expect(tenTheoThang('Tên gốc', BAN_DO, '')).toBe('Tên gốc');
    expect(tenTheoThang('Tên gốc', undefined, '2026-09')).toBe('Tên gốc');
  });

  it('TC-TENTHANG-11: tên riêng chỉ có khoảng trắng ⇒ vẫn tên gốc', () => {
    expect(tenTheoThang('Tên gốc', BAN_DO, '2026-10')).toBe('Tên gốc');
  });

  it('TC-TENTHANG-12: tên gốc chỉ hiện khi tháng đó ĐÃ đổi tên', () => {
    expect(tenGocNeuDaDoi('Tên gốc', BAN_DO, '2026-09')).toBe('Tên gốc');
    expect(tenGocNeuDaDoi('Tên gốc', BAN_DO, '2026-11')).toBe('');
    expect(tenGocNeuDaDoi('Tên gốc', BAN_DO, '2026-10')).toBe('');
  });
});
