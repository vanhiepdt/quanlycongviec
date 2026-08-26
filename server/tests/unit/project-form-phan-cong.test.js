// @vitest-environment jsdom
//
// Simulation form «Tạo công việc mới» với dữ liệu THẬT của UAT (fetch giả trả đúng phản hồi
// đã xác minh bằng tools/_kiem-tra-phong.mjs): mở modal → đổi phòng → supervisor phải tự chọn
// Phó GĐ phụ trách, leaders phải hiện checkbox (và tick mặc định Trưởng phòng).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');

/** Phản hồi thật của GET /departments/assignment-options (UAT, 2026-08-26). */
const OPTIONS = {
  '': {
    supervisors: [
      { id: 1, name: 'Quản trị Hệ thống' },
      { id: 2, name: 'Phó GĐ Một' },
      { id: 3, name: 'Phó GĐ Hai' },
    ],
    leaders: [],
    defaultSupervisorId: 1,
    defaultLeaderId: null,
  },
  1: {
    supervisors: [
      { id: 2, name: 'Phó GĐ Một' },
      { id: 1, name: 'Quản trị Hệ thống' },
    ],
    leaders: [
      { id: 4, name: 'Trưởng phòng Đào tạo' },
      { id: 5, name: 'Phó phòng Đào tạo' },
    ],
    defaultSupervisorId: 2,
    defaultLeaderId: 4,
  },
  3: {
    supervisors: [
      { id: 3, name: 'Phó GĐ Hai' },
      { id: 1, name: 'Quản trị Hệ thống' },
    ],
    leaders: [{ id: 6, name: 'Trưởng phòng Kế toán' }],
    defaultSupervisorId: 3,
    defaultLeaderId: 6,
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function khoiDong() {
  globalThis.fetch = (path) => {
    const m = String(path).match(/departmentId=(\d+)/);
    const data = OPTIONS[m ? Number(m[1]) : ''] ?? {
      supervisors: [],
      leaders: [],
      defaultSupervisorId: null,
      defaultLeaderId: null,
    };
    return { ok: true, status: 200, json: () => Promise.resolve({ ok: true, data }) };
  };
  const EXPORTS = `;Object.assign(window, {
    COL, openModal, closeModal,
    datPhong: (v) => { allDepartments = v; },
    __admin: () => { isAuthenticated = true; currentUser = { name: 'Quản trị Hệ thống', role: 'admin' }; },
  });`;
  new Function(APP_SRC + EXPORTS)();
  window.__admin();
  const C = window.COL;
  const PHONG = [
    { [C.D_ID]: 'PH01', [C.D_NAME]: 'Quản lý Đào tạo', [C.D_DB_ID]: 1 },
    { [C.D_ID]: 'PH02', [C.D_NAME]: 'Nghiên cứu Khoa học', [C.D_DB_ID]: 2 },
    { [C.D_ID]: 'PH03', [C.D_NAME]: 'Kế toán', [C.D_DB_ID]: 3 },
  ];
  window.datPhong(PHONG);
  // Stub google.script.run cho loadDepartmentContext (trả context ngay khi được gọi).
  globalThis.google = {
    script: {
      run: {
        withSuccessHandler: (ok) => ({
          withFailureHandler: () => ({
            getDepartmentContext: () =>
              ok({
                success: true,
                departments: PHONG,
                departmentNames: [],
                visibleDepartments: [],
                myDepartment: '',
                myDeptRole: '',
                isDeputyDirector: true,
                isDepartmentHead: false,
              }),
          }),
        }),
      },
    },
  };
}

const mo = () => document.getElementById('project-modal');
const supChon = () => document.getElementById('project-supervisor-select');
const leadersBox = () => document.getElementById('project-leaders-box');

async function moVaChonPhong(id) {
  window.openModal('project', null);
  await sleep(320); // setTimeout(…, 250) nối sự kiện + nạp lần đầu
  if (id != null) {
    const sel = document.getElementById('project-dept-select');
    sel.value = String(id);
    sel.dispatchEvent(new Event('change'));
    await sleep(60); // chờ fetch giả
  }
}

beforeEach(() => {
  document.body.innerHTML = '';
  khoiDong();
});

describe('Simulation form tạo công việc — dữ liệu thật UAT', () => {
  it('mở modal: đủ 3 phòng + đúng MỘT «Công việc chung» (bẫy trùng option)', async () => {
    await moVaChonPhong(null);
    const opts = Array.from(mo().querySelectorAll('#project-dept-select option'));
    const nChung = opts.filter((o) => o.textContent.includes('Công việc chung')).length;
    expect(nChung).toBe(1);
    expect(opts.map((o) => o.textContent)).toEqual([
      '-- Công việc chung --',
      'Quản lý Đào tạo',
      'Nghiên cứu Khoa học',
      'Kế toán',
    ]);
    expect(opts[0].value).toBe('');
    expect(opts[1].value).toBe('1');
  });

  it('chọn PH01: supervisor tự chọn «Phó GĐ Một», leaders tick sẵn «Trưởng phòng Đào tạo»', async () => {
    await moVaChonPhong(1);
    const sup = supChon();
    const chon = sup.options[sup.selectedIndex];
    expect(chon.textContent).toBe('Phó GĐ Một');
    expect(chon.value).toBe('2');
    const boxes = Array.from(leadersBox().querySelectorAll('.leader-opt'));
    expect(boxes.map((b) => b.nextSibling.textContent)).toEqual([
      'Trưởng phòng Đào tạo',
      'Phó phòng Đào tạo',
    ]);
    const tick = boxes.filter((b) => b.checked).map((b) => b.value);
    expect(tick).toEqual(['4']);
    expect(document.getElementById('project-leaders-input').value).toBe('4');
  });

  it('chọn PH03: supervisor tự chọn «Phó GĐ Hai», leaders tick «Trưởng phòng Kế toán»', async () => {
    await moVaChonPhong(3);
    const sup = supChon();
    expect(sup.options[sup.selectedIndex].textContent).toBe('Phó GĐ Hai');
    const tick = Array.from(leadersBox().querySelectorAll('.leader-opt:checked')).map(
      (b) => b.value
    );
    expect(tick).toEqual(['6']);
  });

  it('quay lại «Công việc chung»: supervisors = admin + 2 Phó GĐ, không tick leader nào', async () => {
    await moVaChonPhong(1);
    await moVaChonPhong('');
    const sup = supChon();
    const opts = Array.from(sup.options).map((o) => o.textContent);
    expect(opts).toContain('Quản trị Hệ thống');
    expect(opts).toContain('Phó GĐ Một');
    expect(Array.from(leadersBox().querySelectorAll('.leader-opt:checked'))).toHaveLength(0);
  });

  it('mở form TRƯỚC khi danh sách phòng nạp xong: context về là select có phòng + phân công nạp', async () => {
    window.datPhong([]); // giả lập: bối cảnh phòng chưa về lúc mở modal
    window.openModal('project', null);
    await sleep(320); // wiring chạy, thấy allDepartments rỗng → tự gọi loadDepartmentContext
    await sleep(60); // stub google.script trả context
    const opts = Array.from(mo().querySelectorAll('#project-dept-select option'));
    expect(opts.filter((o) => o.textContent.includes('Công việc chung'))).toHaveLength(1);
    expect(opts.map((o) => o.textContent)).toContain('Quản lý Đào tạo');
    // phân công vẫn được nạp cho lựa chọn mặc định («Công việc chung»)
    expect(supChon().options.length).toBeGreaterThan(1);
  });
});
