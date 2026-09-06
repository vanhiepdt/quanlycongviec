// @vitest-environment jsdom
//
// Bug 2 (8b) — bước 3 «test tay trên PC» của nửa WEB: ô nhập «Tiến độ (%)» phải BIẾN KHỎI form,
// thay bằng «Tỷ lệ công việc (%)» chỉ ở ĐẦU MỤC (cấp 2, hoặc cấp 3 không nằm trong công việc
// con); người có quyền «sửa tỷ lệ» (admin/PGĐ/TP/PP) mới được nhập — người khác thấy ô KHÓA và
// ô đó KHÔNG có name (không lọt FormData ⇒ update không bao giờ gửi tyLe trái quyền, né 403
// cả bản ghi ở service.js). Chạy app.js THẬT trong jsdom (mẫu task-form-candidate.test.js).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL,
  createTaskModal,
  tienDoDauMucKhach,
  datNhanSu: (ds) => { allStaff = ds; },
  datCongViec: (ds) => { allProjects = ds; },
  datNham: (d) => { pendingTaskCreate = d; },
  dangNhap: (ten, vai) => {
    isAuthenticated = true;
    currentUser = { name: ten, role: vai };
  },
});`;

function khoiDong() {
  new Function(APP_SRC + EXPORTS)();
}

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
      [C.S_ID]: 'LD001',
      [C.S_NAME]: 'Lê Trưởng Phòng',
      [C.S_ROLE]: 'Trưởng phòng',
      [C.S_EMAIL]: 'letp@test.local',
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
    [C.P_MANAGER]: 'Lê Trưởng Phòng',
  },
];

/** Mở form (tạo mới hoặc sửa) rồi trả về tài liệu đã parse. */
function moForm(ten, vai, { nham = null, task = null } = {}) {
  const C = window.COL;
  window.datNhanSu(nhansu(C));
  window.datCongViec(CONG_VIEC_MAU(C));
  window.dangNhap(ten, vai);
  window.datNham(nham);
  const html = task ? window.createTaskModal(true, task) : window.createTaskModal(false, null);
  return new DOMParser().parseFromString(html, 'text/html');
}

const NHIEM_VU_DAU_MUC = (C) => ({
  [C.T_ID]: 'CV001-009',
  [C.T_NAME]: 'Nhiệm vụ đầu mục',
  [C.T_PID]: 'CV001',
  [C.T_ASSIGNEE]: 'Nguyễn Văn An',
  [C.T_LEVEL]: 3,
  // Không T_PARENT ⇒ đầu mục (nhiệm vụ không nằm trong công việc con).
  [C.T_TY_LE]: 40,
  [C.T_COMPLETION]: 50,
  [C.T_START]: '2026-01-05',
  [C.T_DUE]: '2026-12-31',
});

const NHIEM_VU_TRONG_CON = (C) => ({
  ...NHIEM_VU_DAU_MUC(C),
  [C.T_ID]: 'CV001-010',
  [C.T_PARENT]: 'CV001-001', // nằm trong công việc con ⇒ KHÔNG phải đầu mục
});

describe('8b lỗi 2 (web) — form bỏ «Tiến độ (%)», thêm «Tỷ lệ công việc (%)» cho đầu mục', () => {
  beforeEach(() => {
    khoiDong();
  });

  it('TC-TYLE-01: tạo nhiệm vụ cấp 3 (admin) — KHÔNG còn ô nhập completion ở bất kỳ đâu', () => {
    const tai = moForm('Quản trị Hệ thống', 'admin');
    expect(tai.querySelector('input[name="completion"]')).toBeNull();
    expect(tai.body.textContent).not.toContain('Tiến độ (%)');
  });

  it('TC-TYLE-02: tạo nhiệm vụ cấp 3 KHÔNG cha — admin thấy ô tyLe nhập được, trống, «Chia đều»', () => {
    const tai = moForm('Quản trị Hệ thống', 'admin');
    const o = tai.querySelector('input[name="tyLe"]');
    expect(o).toBeTruthy();
    expect(o.disabled).toBe(false);
    expect(o.getAttribute('min')).toBe('0');
    expect(o.getAttribute('max')).toBe('100');
    expect(o.value).toBe('');
    expect(o.getAttribute('placeholder')).toContain('Chia đều');
    const nhan = o.closest('.form-group').querySelector('label');
    expect(nhan.textContent).toBe('Tỷ lệ công việc (%)');
  });

  it('TC-TYLE-03: tạo công việc con (cấp 2) — cũng là đầu mục nên có ô tyLe', () => {
    const tai = moForm('Quản trị Hệ thống', 'admin', { nham: { level: 2, projectId: 'CV001' } });
    const o = tai.querySelector('input[name="tyLe"]');
    expect(o).toBeTruthy();
    expect(o.disabled).toBe(false);
  });

  it('TC-TYLE-04: tạo nhiệm vụ TRONG công việc con — ô tyLe KHÔNG xuất hiện', () => {
    const tai = moForm('Quản trị Hệ thống', 'admin', {
      nham: { level: 3, parentId: 'CV001-001', projectId: 'CV001' },
    });
    expect(tai.querySelector('input[name="tyLe"]')).toBeNull();
    expect(tai.body.textContent).not.toContain('Tỷ lệ công việc (%)');
  });

  it('TC-TYLE-05: Nhân viên tạo đầu mục — ô tyLe hiện nhưng KHÓA và KHÔNG name (né 403 cả bản ghi)', () => {
    const tai = moForm('Nguyễn Văn An', 'Nhân viên');
    const oKhoa = tai.querySelector('.form-group input[type="number"][min="0"][max="100"]');
    expect(oKhoa).toBeTruthy();
    expect(oKhoa.disabled).toBe(true);
    expect(oKhoa.getAttribute('name')).toBeNull();
    expect(tai.querySelector('input[name="tyLe"]')).toBeNull();
  });

  it('TC-TYLE-06: admin SỬA đầu mục — ô tyLe nhập được, mang giá trị server gửi về', () => {
    const C = window.COL;
    const tai = moForm('Quản trị Hệ thống', 'admin', { task: NHIEM_VU_DAU_MUC(C) });
    const o = tai.querySelector('input[name="tyLe"]');
    expect(o).toBeTruthy();
    expect(o.disabled).toBe(false);
    expect(o.value).toBe('40');
  });

  it('TC-TYLE-07: Nhân viên SỬA đầu mục — thấy tỷ lệ nhưng ô khóa, không name', () => {
    const C = window.COL;
    const tai = moForm('Nguyễn Văn An', 'Nhân viên', { task: NHIEM_VU_DAU_MUC(C) });
    expect(tai.querySelector('input[name="tyLe"]')).toBeNull();
    const oKhoa = tai.querySelector('.form-group input[type="number"][min="0"][max="100"]');
    expect(oKhoa).toBeTruthy();
    expect(oKhoa.disabled).toBe(true);
    expect(oKhoa.value).toBe('40');
  });

  it('TC-TYLE-08: SỬA nhiệm vụ nằm trong công việc con — không vẽ ô tyLe', () => {
    const C = window.COL;
    const tai = moForm('Quản trị Hệ thống', 'admin', { task: NHIEM_VU_TRONG_CON(C) });
    expect(tai.querySelector('input[name="tyLe"]')).toBeNull();
    const oKhoa = tai.querySelector('.form-group input[type="number"][min="0"][max="100"]');
    expect(oKhoa).toBeNull();
  });
});

describe('8b lỗi 2 (web) — tienDoDauMucKhach: bình quân gia quyền như tienDo.js máy chủ', () => {
  beforeEach(() => {
    khoiDong();
  });

  const muc = (C, { level = 3, parent = '', tyLe = 0, tienDo = 0 } = {}) => ({
    [C.T_LEVEL]: level,
    [C.T_PARENT]: parent,
    [C.T_TY_LE]: tyLe,
    [C.T_COMPLETION]: tienDo,
  });

  it('TC-TYLE-09: gia quyền 60/40 — (60×50 + 40×100)/100 = 70; con của CV con không tính', () => {
    const C = window.COL;
    const dong = [
      muc(C, { level: 2, tyLe: 60, tienDo: 50 }),
      muc(C, { tyLe: 40, tienDo: 100 }),
      muc(C, { parent: 'CV001-001', tyLe: 10, tienDo: 100 }), // không phải đầu mục
    ];
    expect(window.tienDoDauMucKhach(dong)).toBe(70);
  });

  it('TC-TYLE-10: rounding khớp server — 33/67 với 100%/0% ra 33', () => {
    const C = window.COL;
    expect(
      window.tienDoDauMucKhach([muc(C, { level: 2, tyLe: 33, tienDo: 100 }), muc(C, { tyLe: 67 })])
    ).toBe(33);
  });

  it('TC-TYLE-11: không đầu mục nào có tỷ lệ (hoặc danh sách rỗng) ⇒ 0%', () => {
    const C = window.COL;
    expect(window.tienDoDauMucKhach([])).toBe(0);
    expect(window.tienDoDauMucKhach([muc(C, { level: 2 })])).toBe(0);
    expect(
      window.tienDoDauMucKhach([muc(C, { parent: 'CV001-001', tyLe: 100, tienDo: 100 })])
    ).toBe(0);
  });
});
