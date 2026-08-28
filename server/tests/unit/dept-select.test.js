// @vitest-environment jsdom
//
// Chốt bẫy 2026-08-26 LẦN 2: dropdown «Phòng» của form công việc chỉ còn «Công việc chung».
// Nguyên nhân: buildDeptIdOptions đọc `d.id`/`d.name` trong khi `allDepartments` là object khoá
// legacy (COL.D_* do cầu RPC `departmentToLegacy` trả) — hai khoá đó là undefined nên mọi option
// rỗng. Hơn nữa value option phải là ID SỐ (D_DB_ID) vì `projectFromLegacy` ép numberOrUndefined:
// gửi mã «PH01» vào là phòng bị bỏ im lặng khi lưu. Test chạy app.js THẬT trong jsdom.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL, buildDeptIdOptions, buildStaffEmailDatalist,
  datPhong: (v) => { allDepartments = v; },
  datCanBo: (v) => { allStaff = v; },
});`;

function khoiDong() {
  new Function(APP_SRC + EXPORTS)();
}

const C = {};

beforeEach(() => {
  khoiDong();
  C.D_ID = window.COL.D_ID;
  C.D_NAME = window.COL.D_NAME;
  C.D_DB_ID = window.COL.D_DB_ID;
  window.datPhong([
    { [C.D_ID]: 'PH01', [C.D_NAME]: 'Phòng Hành chính', [C.D_DB_ID]: 3 },
    { [C.D_ID]: 'PH02', [C.D_NAME]: 'Phòng Tài chính', [C.D_DB_ID]: 4 },
  ]);
});

const options = (html) =>
  Array.from(
    new DOMParser()
      .parseFromString('<select id="s">' + html + '</select>', 'text/html')
      .querySelectorAll('option')
  );

describe('buildDeptIdOptions — dropdown Phòng của form công việc (bẫy 2026-08-26 lần 2)', () => {
  it('máy chủ CŨ không gửi D_DB_ID: dòng bị bỏ hẳn, không sinh option rỗng', () => {
    window.datPhong([
      { [C.D_ID]: 'PH01', [C.D_NAME]: 'Phòng không id' },
      { [C.D_ID]: 'PH02', [C.D_NAME]: 'Phòng có id', [C.D_DB_ID]: 7 },
    ]);
    const list = options(window.buildDeptIdOptions(''));
    expect(list.map((o) => o.value)).toEqual(['', '7']);
    expect(list.map((o) => o.textContent)).toEqual(['-- Công việc chung --', 'Phòng có id']);
  });

  it('đọc khoá COL.D_DB_ID / COL.D_NAME — option có value là id số và nhãn là tên phòng', () => {
    const list = options(window.buildDeptIdOptions(''));
    // Đầu tiên luôn là «Công việc chung» với value rỗng.
    expect(list[0].value).toBe('');
    expect(list[0].textContent).toContain('Công việc chung');
    // Hai phòng theo đúng dữ liệu legacy từ getDepartmentContext (không có khoá .id/.name).
    expect(list[1].value).toBe('3');
    expect(list[1].textContent).toBe('Phòng Hành chính');
    expect(list[2].value).toBe('4');
    expect(list[2].textContent).toBe('Phòng Tài chính');
  });

  it('mọi option phòng phải mang giá trị SỐ được (projectFromLegacy ép numberOrUndefined)', () => {
    for (const o of options(window.buildDeptIdOptions(''))) {
      if (o.value === '') continue;
      expect(
        Number.isFinite(Number(o.value)),
        `option "${o.textContent}" value="${o.value}" phải là số`
      ).toBe(true);
    }
  });

  it('preselect khi SỬA: P_DEPT_ID (id số) được đánh dấu selected', () => {
    const list = options(window.buildDeptIdOptions(3));
    expect(list[1].selected).toBe(true);
    expect(list[2].selected).toBe(false);
    // Chuỗi "4" từ form cũng khớp.
    const list2 = options(window.buildDeptIdOptions('4'));
    expect(list2[2].selected).toBe(true);
  });

  it('allDepartments rỗng thì vẫn còn duy nhất option Công việc chung (không nổ)', () => {
    window.datPhong([]);
    const list = options(window.buildDeptIdOptions(''));
    expect(list).toHaveLength(1);
    expect(list[0].value).toBe('');
  });
});

// Cùng một bẫy cột «Đối tượng» đã làm ô chọn người nhận ủy quyền rỗng (2026-08-28): CSDL thật ghi
// 'Nội bộ', chỉ người tạo qua giao diện mới ghi 'Người dùng' ⇒ lọc theo === 'Người dùng' là mất hết
// gợi ý email trong modal Phòng. Chỉ được loại 'Nhà cung cấp'.
describe('buildStaffEmailDatalist — gợi ý email trong modal Phòng đọc đúng cột «Đối tượng»', () => {
  const canBo = (over) => ({
    [window.COL.S_NAME]: 'Người Mẫu',
    [window.COL.S_EMAIL]: 'nguoi@congty.vn',
    [window.COL.S_ROLE]: 'Phó Giám đốc',
    [window.COL.S_DEPT]: 'Phòng Hành chính',
    [window.COL.S_OBJECT_TYPE]: 'Nội bộ',
    ...over,
  });
  const emails = (html) =>
    Array.from(new DOMParser().parseFromString(html, 'text/html').querySelectorAll('option')).map(
      (o) => o.value
    );

  it("dòng 'Nội bộ' của dữ liệu thật vẫn được gợi ý, 'Nhà cung cấp' thì không", () => {
    window.datCanBo([
      canBo({ [window.COL.S_EMAIL]: 'noibo@congty.vn' }),
      canBo({
        [window.COL.S_EMAIL]: 'nguoidung@congty.vn',
        [window.COL.S_OBJECT_TYPE]: 'Người dùng',
      }),
      canBo({ [window.COL.S_EMAIL]: 'trong@congty.vn', [window.COL.S_OBJECT_TYPE]: '' }),
      canBo({ [window.COL.S_EMAIL]: 'ncc@congty.vn', [window.COL.S_OBJECT_TYPE]: 'Nhà cung cấp' }),
      canBo({ [window.COL.S_EMAIL]: '' }),
    ]);
    expect(emails(window.buildStaffEmailDatalist('ds-test', 'phó giám đốc')).sort()).toEqual([
      'nguoidung@congty.vn',
      'noibo@congty.vn',
      'trong@congty.vn',
    ]);
  });

  it('không ai khớp vai thì gợi ý mọi người thật (theo đúng câu chú thích của hàm)', () => {
    window.datCanBo([
      canBo({ [window.COL.S_EMAIL]: 'nv@congty.vn', [window.COL.S_ROLE]: 'Nhân viên' }),
      canBo({ [window.COL.S_EMAIL]: 'ncc@congty.vn', [window.COL.S_OBJECT_TYPE]: 'Nhà cung cấp' }),
    ]);
    expect(emails(window.buildStaffEmailDatalist('ds-test', 'trưởng phòng'))).toEqual([
      'nv@congty.vn',
    ]);
  });
});
