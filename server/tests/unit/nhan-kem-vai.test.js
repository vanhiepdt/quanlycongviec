// Nhãn người thực hiện kèm vai (quyết định người dùng 2026-09-09: «Nhãn kèm vai ở cả ba nơi +
// cột Vai trong Excel»). Ba nơi đó — thống kê E5, Gantt nhóm theo người, Excel mẫu (b) — cùng gọi
// MỘT hàm này, nên luật chỉ có một chỗ để sai.
import { describe, expect, it } from 'vitest';

import {
  VAI_LANH_DAO_LAM_TRUC_TIEP,
  laLanhDaoLamTrucTiep,
  nhanKemVai,
} from '../../src/modules/assignments/service.js';

describe('nhanKemVai — nhãn người thực hiện kèm vai', () => {
  it('hai vai lãnh đạo phòng được kèm vai trong NGOẶC', () => {
    expect(nhanKemVai('Trần Thị Trưởng', 'Trưởng phòng')).toBe('Trần Thị Trưởng (Trưởng phòng)');
    expect(nhanKemVai('Phạm Văn Phó', 'Phó phòng')).toBe('Phạm Văn Phó (Phó phòng)');
  });

  it('Cán bộ giữ tên TRƠN — thêm vai cho cả nhóm này là làm bảng rối mà không thêm thông tin', () => {
    expect(nhanKemVai('Nguyễn Văn An', 'Nhân viên')).toBe('Nguyễn Văn An');
  });

  it('Phó GĐ / admin KHÔNG được coi là người thực hiện trực tiếp', () => {
    // Họ thuộc lớp «Ban lãnh đạo phụ trách» (`supervisor_id`) — §0.1.
    expect(VAI_LANH_DAO_LAM_TRUC_TIEP).toEqual(['Trưởng phòng', 'Phó phòng']);
    expect(laLanhDaoLamTrucTiep('Phó Giám đốc')).toBe(false);
    expect(laLanhDaoLamTrucTiep('admin')).toBe(false);
    // Nhãn vì thế cũng không đổi — hai vai này không bao giờ lọt xuống ô người thực hiện.
    expect(nhanKemVai('Lê Văn Phó', 'Phó Giám đốc')).toBe('Lê Văn Phó');
  });

  it('so khớp vai CHÍNH XÁC, không `includes` — bẫy đã ghi ở §13.5', () => {
    // 'Trưởng phòng ban khác' chứa 'Trưởng phòng' nhưng KHÔNG phải vai đó.
    expect(laLanhDaoLamTrucTiep('Trưởng phòng ban khác')).toBe(false);
    expect(nhanKemVai('Nguyễn Văn A', 'Trưởng phòng ban khác')).toBe('Nguyễn Văn A');
    expect(laLanhDaoLamTrucTiep('trưởng phòng')).toBe(false);
  });

  it('tên rỗng / vai thiếu ⇒ trả về chuỗi đã trim, không sinh nhãn «()» mồ côi', () => {
    expect(nhanKemVai('', 'Trưởng phòng')).toBe('');
    expect(nhanKemVai(null, 'Trưởng phòng')).toBe('');
    expect(nhanKemVai('  Nguyễn Văn An  ', 'Nhân viên')).toBe('Nguyễn Văn An');
    // Tên tự do nhập không dò ra `assignee_id` ⇒ vai null: giữ tên, đừng dán nhãn đoán mò.
    expect(nhanKemVai('Phạm Kế Toán', null)).toBe('Phạm Kế Toán');
    expect(nhanKemVai('Phạm Kế Toán', undefined)).toBe('Phạm Kế Toán');
  });
});
