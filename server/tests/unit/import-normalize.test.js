// Unit test cho phần chuyển đổi kiểu của công cụ nhập — chỗ dễ sai nhất của Phase 2.
// Không cần Postgres: mọi hàm ở `normalize.js` là hàm thuần.
import { describe, expect, it } from 'vitest';
import {
  VALID_ROLES,
  combineDateAndClock,
  isPlaceholderEmail,
  looksLikeEmail,
  normalizeApproval,
  normalizeDeptRole,
  normalizeRole,
  parseDate,
  parseJsonArrayCell,
  parsePercent,
  parseResultLinks,
  parseTimestamp,
  placeholderEmail,
  randomTempPassword,
  splitEmailList,
  text,
  textOrNull,
} from '../../src/modules/import/normalize.js';
import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from '../../src/modules/auth/password.js';

describe('ô chữ', () => {
  it('cắt trắng hai đầu, null/undefined thành chuỗi rỗng', () => {
    expect(text('  a  ')).toBe('a');
    expect(text(null)).toBe('');
    expect(text(undefined)).toBe('');
    expect(textOrNull('   ')).toBeNull();
    expect(textOrNull(' x ')).toBe('x');
  });
});

describe('TC-IMP-08: ngày 31/12 và 01/01 không lệch một ngày', () => {
  it('giữ đúng ngày của bản chụp, không đi qua múi giờ máy', () => {
    expect(parseDate('2025-12-31').date).toBe('2025-12-31');
    expect(parseDate('2026-01-01').date).toBe('2026-01-01');
  });

  it('ô ngày+giờ chỉ lấy phần ngày UTC, giờ 23:59 vẫn là ngày cũ', () => {
    expect(parseDate('2025-12-31T23:59:59.999Z').date).toBe('2025-12-31');
    expect(parseDate('2026-01-01T00:00:00.000Z').date).toBe('2026-01-01');
  });

  it('nhận cả dạng người Việt gõ tay dd/mm/yyyy', () => {
    expect(parseDate('31/12/2025').date).toBe('2025-12-31');
    expect(parseDate('1/1/2026').date).toBe('2026-01-01');
  });
});

describe('TC-IMP-09: ngày 29/02', () => {
  it('năm nhuận thì nhập đúng', () => {
    expect(parseDate('2024-02-29').date).toBe('2024-02-29');
    expect(parseDate('29/02/2024').date).toBe('2024-02-29');
  });

  it('năm KHÔNG nhuận thì để NULL và nói lý do, không tự đẩy sang 01/03', () => {
    const r = parseDate('2025-02-29');
    expect(r.date).toBeNull();
    expect(r.problem).toMatch(/không có thật/);
  });

  it('2100 không nhuận (chia hết 100, không chia hết 400)', () => {
    expect(parseDate('2100-02-29').date).toBeNull();
    expect(parseDate('2000-02-29').date).toBe('2000-02-29');
  });
});

describe('TC-IMP-10: ô ngày rỗng', () => {
  it('rỗng thành NULL, không thành 30/12/1899', () => {
    expect(parseDate('').date).toBeNull();
    expect(parseDate('   ').date).toBeNull();
    expect(parseDate(null).date).toBeNull();
    expect(parseDate('').problem).toBeNull();
  });

  it('mốc 30/12/1899 của Excel cũng thành NULL và được ghi vào báo cáo', () => {
    const r = parseDate('1899-12-30');
    expect(r.date).toBeNull();
    expect(r.problem).toMatch(/1899/);
  });

  it('chữ không phải ngày thì NULL kèm lý do, không ném lỗi', () => {
    const r = parseDate('chưa có');
    expect(r.date).toBeNull();
    expect(r.problem).toMatch(/không đọc được/);
  });
});

describe('mốc thời gian và giờ của Chat', () => {
  it('ISO đầy đủ giữ nguyên văn cho timestamptz', () => {
    expect(parseTimestamp('2026-08-24T01:20:08.782Z').at).toBe('2026-08-24T01:20:08.782Z');
  });

  it('ô chỉ có ngày thành 00:00Z', () => {
    expect(parseTimestamp('2026-08-24').at).toBe('2026-08-24T00:00:00.000Z');
    expect(parseTimestamp('').at).toBeNull();
  });

  it('ghép Ngày + timestamp "03:02" của Chat JSON', () => {
    expect(combineDateAndClock('2026-08-23T03:02:28.971Z', '03:02').at).toBe(
      '2026-08-23T03:02:00.000Z'
    );
  });

  it('giờ hỏng thì vẫn giữ được ngày và ghi lý do — mất giờ còn hơn mất tin nhắn', () => {
    const r = combineDateAndClock('2026-08-23', 'sáng');
    expect(r.at).toBe('2026-08-23T00:00:00.000Z');
    expect(r.problem).toMatch(/giờ không đọc được/);
    expect(combineDateAndClock('2026-08-23', '25:00').problem).toMatch(/không có thật/);
  });
});

describe('TC-IMP-11: cột Phân quyền', () => {
  it('"Admin" chữ A hoa của dữ liệu thật thành "admin" và bị ghi là đã đổi', () => {
    const r = normalizeRole('Admin');
    expect(r.role).toBe('admin');
    expect(r.changed).toBe(true);
    expect(r.unknown).toBe(false);
  });

  it('6 vai trò viết đúng thì giữ nguyên, không bị đánh dấu đã đổi', () => {
    for (const role of VALID_ROLES) {
      expect(normalizeRole(role)).toEqual({ role, changed: false, unknown: false });
    }
  });

  it('chỉ bỏ qua hoa/thường và khoảng trắng, KHÔNG bỏ qua dấu tiếng Việt', () => {
    expect(normalizeRole('  nhân   viên ').role).toBe('Nhân viên');
    expect(normalizeRole('Nhan vien').unknown).toBe(true);
  });

  it('"Quản lý dự án" là từ vựng cũ của cùng vai trò ⇒ dịch sang "Quản lý công việc"', () => {
    expect(normalizeRole('Quản lý dự án')).toEqual({
      role: 'Quản lý công việc',
      changed: true,
      unknown: false,
    });
  });

  it('giá trị lạ KHÔNG được đoán: trả null để chỗ gọi in ra cho người sửa tay', () => {
    for (const bad of ['Trợ lý admin', 'Giám đốc', 'admin2']) {
      expect(normalizeRole(bad)).toEqual({ role: null, changed: false, unknown: true });
    }
  });

  it('ô rỗng lấy mặc định "Nhân viên" của lược đồ và ghi lại là đã điền', () => {
    expect(normalizeRole('')).toEqual({ role: 'Nhân viên', changed: true, unknown: false });
  });
});

describe('Vai trò phòng', () => {
  it('khớp CHECK dept_role, lạ thì null + unknown', () => {
    expect(normalizeDeptRole('Nhân viên').deptRole).toBe('Nhân viên');
    expect(normalizeDeptRole('trưởng phòng').deptRole).toBe('Trưởng phòng');
    expect(normalizeDeptRole('').deptRole).toBeNull();
    expect(normalizeDeptRole('Tổ trưởng').unknown).toBe(true);
  });
});

describe('TC-IMP-03: ô JSON hỏng', () => {
  it('ô rỗng là hợp lệ — mảng rỗng, không phải lỗi', () => {
    expect(parseJsonArrayCell('')).toEqual({ ok: true, items: [], empty: true });
  });

  it('mảng object đọc ra đủ phần tử', () => {
    const r = parseJsonArrayCell('[{"a":1},{"a":2}]');
    expect(r.ok).toBe(true);
    expect(r.items).toHaveLength(2);
  });

  it('JSON hỏng trả ok:false kèm lý do, KHÔNG ném lỗi làm dừng lần nhập', () => {
    const r = parseJsonArrayCell('[{"a":1},');
    expect(r.ok).toBe(false);
    expect(r.items).toEqual([]);
    expect(r.error).toMatch(/JSON không đọc được/);
  });

  it('JSON đúng cú pháp nhưng không phải mảng cũng là hỏng', () => {
    expect(parseJsonArrayCell('{"a":1}').ok).toBe(false);
    expect(parseJsonArrayCell('"chuỗi"').ok).toBe(false);
  });

  it('mảng lẫn phần tử rác thì lấy phần dùng được và nói ra phần đã bỏ', () => {
    const r = parseJsonArrayCell('[{"a":1}, 5, null]');
    expect(r.ok).toBe(true);
    expect(r.items).toHaveLength(1);
    expect(r.error).toMatch(/bỏ 2 phần tử/);
  });
});

describe('tiến độ, link, email', () => {
  it('tiến độ rỗng là 0, ngoài khoảng thì kẹp lại và ghi báo cáo', () => {
    expect(parsePercent('').percent).toBe(0);
    expect(parsePercent('50').percent).toBe(50);
    expect(parsePercent(0).percent).toBe(0);
    expect(parsePercent('120').percent).toBe(100);
    expect(parsePercent('120').problem).toMatch(/100/);
    expect(parsePercent('-5').percent).toBe(0);
    expect(parsePercent('70%').percent).toBe(70);
    expect(parsePercent('abc').problem).toMatch(/không phải số/);
  });

  it('Link kết quả nhiều dòng trong một ô thành mảng', () => {
    expect(parseResultLinks('a\nb\n\nc')).toEqual(['a', 'b', 'c']);
    expect(parseResultLinks('')).toEqual([]);
    expect(parseResultLinks(['x', ' ', 'y'])).toEqual(['x', 'y']);
  });

  it('cột email nhiều người tách bằng ; hoặc , và bỏ trùng', () => {
    expect(splitEmailList('a@x.vn; b@x.vn , a@X.vn')).toEqual(['a@x.vn', 'b@x.vn']);
    expect(splitEmailList('')).toEqual([]);
  });

  it('phân biệt được ô email và ô họ tên', () => {
    expect(looksLikeEmail('admin@gmail.com')).toBe(true);
    expect(looksLikeEmail('Phạm Văn Hiệp')).toBe(false);
  });
});

describe('trạng thái duyệt', () => {
  it('ô rỗng của DA001/DA002 thành "Đã duyệt" và được đánh dấu là đã điền mặc định', () => {
    expect(normalizeApproval('')).toEqual({
      status: 'Đã duyệt',
      filledDefault: true,
      unknown: false,
    });
  });

  it('giá trị hợp lệ giữ nguyên, giá trị lạ về "Đã duyệt" + unknown để báo cáo', () => {
    expect(normalizeApproval('Chờ duyệt').status).toBe('Chờ duyệt');
    expect(normalizeApproval('từ chối').status).toBe('Từ chối');
    expect(normalizeApproval('Đang xem').unknown).toBe(true);
  });
});

describe('mật khẩu tạm và email giữ chỗ', () => {
  it('mật khẩu tạm dùng được với bcrypt: đủ dài, dưới 72 byte, ASCII', () => {
    const pw = randomTempPassword();
    expect(pw.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH);
    expect(Buffer.byteLength(pw, 'utf8')).toBeLessThanOrEqual(MAX_PASSWORD_BYTES);
    expect(pw).toMatch(/^[\x21-\x7e]+$/);
  });

  it('hai lần sinh không ra cùng một chuỗi', () => {
    const many = new Set(Array.from({ length: 50 }, () => randomTempPassword()));
    expect(many.size).toBe(50);
  });

  it('email giữ chỗ sinh từ mã, nhận lại được, và ở tên miền .invalid', () => {
    expect(placeholderEmail('NV004')).toBe('nv004@khong-co-email.invalid');
    expect(isPlaceholderEmail(placeholderEmail('NV005'))).toBe(true);
    expect(isPlaceholderEmail('admin@gmail.com')).toBe(false);
  });
});
