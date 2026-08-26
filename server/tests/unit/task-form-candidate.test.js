// @vitest-environment jsdom
//
// Vòng giao diện phân công lần 3 (yêu cầu 2026-08-26):
//   • nhãn ô gán người trong form nhiệm vụ hiển thị «Cán bộ trực tiếp»;
//   • danh sách ứng viên CHỈ lấy role «Nhân viên» — ẩn Trưởng/Phó phòng/Phó GĐ/admin;
//   • option hiển thị CHỈ họ tên, KHÔNG ghép email;
//   • tên trường dữ liệu GIỮ NGUYÊN: <select name="assignee">, value = tên người.
// Test chạy app.js THẬT trong jsdom (mẫu dept-select.test.js / project-form-phan-cong.test.js).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL,
  taoFormThemNhiemVu: () => {
    pendingTaskCreate = null;
    return createTaskModal(false, null);
  },
  datNhanSu: (ds) => { allStaff = ds; },
  datCongViec: (ds) => { allProjects = ds; },
  dangNhap: (ten, vai) => {
    isAuthenticated = true;
    currentUser = { name: ten, role: vai };
  },
});`;

function khoiDong() {
  new Function(APP_SRC + EXPORTS)();
}

/** Dữ liệu người dùng mẫu — khoá legacy lấy TỪ COL sau khi app.js đã chạy. */
function nhansu(C) {
  return [
    {
      [C.S_ID]: 'NV001',
      [C.S_NAME]: 'Nguyễn Văn An',
      [C.S_ROLE]: 'Nhân viên',
      [C.S_EMAIL]: 'an@test.local',
      [C.S_OBJECT_TYPE]: 'Người dùng',
    },
    {
      [C.S_ID]: 'NV002',
      [C.S_NAME]: 'Trần Thị Bình',
      [C.S_ROLE]: 'Nhân viên',
      [C.S_EMAIL]: 'binh@test.local',
      [C.S_OBJECT_TYPE]: 'Người dùng',
    },
    {
      [C.S_ID]: 'LD001',
      [C.S_NAME]: 'Lê Trưởng Phòng',
      [C.S_ROLE]: 'Trưởng phòng',
      [C.S_EMAIL]: 'letp@test.local',
      [C.S_OBJECT_TYPE]: 'Người dùng',
    },
    {
      [C.S_ID]: 'LD002',
      [C.S_NAME]: 'Phạm Phó Phòng',
      [C.S_ROLE]: 'Phó phòng',
      [C.S_EMAIL]: 'phampp@test.local',
      [C.S_OBJECT_TYPE]: 'Người dùng',
    },
    {
      [C.S_ID]: 'GD002',
      [C.S_NAME]: 'Hoàng Phó GĐ',
      [C.S_ROLE]: 'Phó Giám đốc',
      [C.S_EMAIL]: 'hoangpgd@test.local',
      [C.S_OBJECT_TYPE]: 'Người dùng',
    },
  ];
}

const CONG_VIEC_MAU = (C) => [
  {
    [C.P_ID]: 'CV001',
    [C.P_NAME]: 'Ra mắt cổng thông tin',
    [C.P_START]: '2026-01-05',
    [C.P_END]: '2026-12-31',
    // Người mở form ở case «lãnh đạo phòng» chính là quản lý công việc này — đủ điều kiện thấy
    // toàn bộ danh sách ứng viên của phòng trước khi lọc chỉ còn role Nhân viên.
    [C.P_MANAGER]: 'Lê Trưởng Phòng',
  },
];

/** Dựng form với vai đăng nhập tuỳ ý rồi trả về thẻ <select> gán người. */
function moOForm(ten, vai) {
  const C = window.COL;
  window.datNhanSu(nhansu(C));
  window.datCongViec(CONG_VIEC_MAU(C));
  window.dangNhap(ten, vai);
  const html = window.taoFormThemNhiemVu();
  const tai = new DOMParser().parseFromString(html, 'text/html');
  const oGan = tai.querySelector('select[name="assignee"]');
  if (!oGan)
    throw new Error(
      'form nhiệm vụ thiếu <select name="assignee"> — trường dữ liệu phải giữ nguyên'
    );
  return { tai, oGan };
}

describe('form nhiệm vụ — nhãn «Cán bộ trực tiếp» và danh sách ứng viên chỉ Nhân viên', () => {
  beforeEach(() => {
    khoiDong();
  });

  it('nhãn hiển thị là «Cán bộ trực tiếp», trường dữ liệu vẫn name="assignee"', () => {
    const { tai, oGan } = moOForm('Quản trị Hệ thống', 'admin');
    const nhan = oGan.closest('.form-group')?.querySelector('label');
    expect(nhan && nhan.textContent).toBe('Cán bộ trực tiếp');
    // Ô gán người KHÔNG còn nhãn cũ nào.
    expect(oGan.closest('.form-group').textContent).not.toContain('Người thực hiện');
    expect(tai.querySelector('#task-modal')).toBeTruthy();
  });

  it('admin: chỉ thấy cán bộ role Nhân viên — Trưởng/Phó phòng/Phó GĐ bị ẩn', () => {
    const { oGan } = moOForm('Quản trị Hệ thống', 'admin');
    const giaTri = Array.from(oGan.options).map((o) => o.value);
    expect(giaTri).toContain('Nguyễn Văn An');
    expect(giaTri).toContain('Trần Thị Bình');
    expect(giaTri).not.toContain('Lê Trưởng Phòng');
    expect(giaTri).not.toContain('Phạm Phó Phòng');
    expect(giaTri).not.toContain('Hoàng Phó GĐ');
  });

  it('option chỉ hiện HỌ TÊN — không có ký tự "@" (đã bỏ phần email)', () => {
    const { oGan } = moOForm('Quản trị Hệ thống', 'admin');
    for (const o of Array.from(oGan.options)) {
      expect(o.textContent.includes('@'), `option "${o.textContent}" không được chứa email`).toBe(
        false
      );
      expect(o.value.includes('@')).toBe(false);
    }
  });

  it('lãnh đạo phòng mở form: bản thân là Trưởng phòng cũng KHÔNG vào danh sách ứng viên', () => {
    const { oGan } = moOForm('Lê Trưởng Phòng', 'Trưởng phòng');
    const giaTri = Array.from(oGan.options).map((o) => o.value);
    expect(giaTri).toEqual(expect.arrayContaining(['Nguyễn Văn An']));
    expect(giaTri).not.toContain('Lê Trưởng Phòng');
    expect(giaTri).not.toContain('Hoàng Phó GĐ');
  });
});
