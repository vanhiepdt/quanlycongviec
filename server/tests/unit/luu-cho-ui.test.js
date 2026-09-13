// @vitest-environment jsdom
//
// Giỏ «lưu chờ» (S1–S4, 12/09/2026): nút Lưu chờ / Gửi duyệt, không đóng form khi cất giỏ,
// popup tick dựng bằng textContent (không innerHTML dữ liệu), POST {chon}, badge theo MÃ.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QUYEN_UI } from '../helpers/uiPermissions.js';

const APP = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const REVIEW = readFileSync(resolve(process.cwd(), '../web/assets/js/phase8b-review.js'), 'utf8');

const EXPORTS = `;Object.assign(window, {
  xoaCacheGioCho, dongKemGiaTriLuuCho, openModal, COL, createTaskModal, createProjectModal, handleEdit, guiGioChoDuyet, luuChoBadge,
  oCheDoLuuChoForm, napGioChoCuaToi, duongGio,
  datCongViec: (ds) => { allProjects = ds; },
  datNhiemVu: (ds) => { allTasks = ds; },
  dangNhap: (ten, vai) => {
    isAuthenticated = true;
    currentUser = { name: ten, role: vai, department_id: 1 };
    allDepartments = [{ [COL.D_DB_ID]: 1, [COL.D_NAME]: "Phòng A" }];
  },
  datToast: () => { showToast = (m, k) => { window.__toast = { m: String(m), k }; window.__toasts = (window.__toasts || []).concat([{ m: String(m), k }]); }; },
  datThuSubmit: () => {
    createTaskModal = () => '<div id="task-modal"><form id="task-form"><input name="assignee" value="A"><button type="submit" data-nhap="1">Lưu chờ</button><button type="submit" data-gui-duyet="1">Gửi duyệt</button></form></div>';
    kiemTraTyLeMoiNhat8b = async () => true;
    hienThayDoiDuyet8b = () => {};
    handleEdit = (type, row, intent) => { window.__intent = intent; };
  },
  camVe: () => { renderProjects = () => {}; renderTasks = () => {}; napLaiSauDuyet = async () => {}; },
});`;

const DON = '<img src=x onerror="window.BI_CHIEM=1">';

function congViec(C, over = {}) {
  return {
    [C.P_ID]: 'CV001',
    [C.P_NAME]: 'Ra mắt cổng',
    [C.P_DEPT]: 'Phòng A',
    [C.P_DEPT_ID]: 1,
    [C.P_START]: '2026-01-05',
    [C.P_END]: '2026-12-31',
    [C.P_APPROVAL]: 'Đã duyệt',
    [C.P_MANAGER]: 'Lê Trưởng Phòng',
    ...over,
  };
}

function nhiemVuCapHai(C, over = {}) {
  return {
    [C.T_ID]: 'CV001-01',
    [C.T_PID]: 'CV001',
    [C.T_NAME]: 'Chuẩn bị hậu cần',
    [C.T_LEVEL]: 2,
    [C.T_APPROVAL]: 'Đã duyệt',
    [C.T_START]: '2026-01-05',
    [C.T_DUE]: '2026-12-31',
    [C.T_STATUS]: 'Đang thực hiện',
    [C.T_PRIORITY]: 'Trung bình',
    ...over,
  };
}

function nhiemVuCapBa(C, over = {}) {
  return { ...nhiemVuCapHai(C, { [C.T_ID]: 'CV001-01-01', [C.T_LEVEL]: 3 }), ...over };
}

function ganRpc(ok = { success: true, luuCho: { luuCho: true, soThayDoi: 2 } }) {
  const run = {
    withSuccessHandler(fn) {
      this.ok = fn;
      return this;
    },
    withFailureHandler(fn) {
      this.fail = fn;
      return this;
    },
    updateTaskWithAuth(id, data) {
      window.__rpcCuoi = { id, data };
      this.ok(ok);
    },
    updateProjectWithAuth(id, data) {
      this.updateTaskWithAuth(id, data);
    },
  };
  vi.stubGlobal('google', { script: { run } });
}

function ganFetch(docGio, ketGui) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) => {
      const path = String(url);
      const method = (options && options.method) || 'GET';
      if (path.includes('/api/csrf')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: { csrfToken: 'tok' } }),
        });
      }
      if (method === 'POST' && path.includes('/pending-edits/submit')) {
        window.__postCuoi = { path, body: JSON.parse(options.body || '{}') };
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: ketGui }),
        });
      }
      if (path.includes('/pending-edits') && !path.includes('/submit')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: docGio }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { muc: [] } }),
      });
    })
  );
}

function formSuaTrongDom(C, row) {
  document.body.innerHTML =
    '<div id="toast-container"></div>' +
    '<div id="task-modal" class="modal active">' +
    '<form id="task-form">' +
    '<input type="hidden" name="id" value="' +
    row[C.T_ID] +
    '">' +
    '<input name="name" value="Tên mới">' +
    '<button type="submit" data-nhap="1">Lưu chờ</button>' +
    '<button type="submit" data-gui-duyet="1">Gửi duyệt</button>' +
    '</form></div>';
}

beforeEach(() => {
  document.body.innerHTML = '<div id="toast-container"></div>';
  delete window.BI_CHIEM;
  delete window.__rpcCuoi;
  delete window.__postCuoi;
  delete window.__toast;
  window.__toasts = [];
  new Function(APP + QUYEN_UI + REVIEW + EXPORTS)();
  window.datToast();
  window.camVe();
  document.cookie = 'qlcv_csrf=tok';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('nút form — S2 chỉ mục Đã duyệt của vai phải duyệt lại', () => {
  it('admin sửa Đã duyệt: một nút Cập nhật, không Lưu chờ', () => {
    const C = window.COL;
    window.datCongViec([congViec(C)]);
    window.dangNhap('Quản trị Hệ thống', 'admin');
    const html = window.createTaskModal(true, nhiemVuCapHai(C));
    const tai = new DOMParser().parseFromString(html, 'text/html');
    const nut = Array.from(tai.querySelectorAll('button[type="submit"]'));
    expect(nut).toHaveLength(1);
    expect(nut[0].textContent).toContain('Cập nhật');
    expect(nut[0].hasAttribute('data-nhap')).toBe(false);
    expect(window.oCheDoLuuChoForm(nhiemVuCapHai(C))).toBe(false);
  });

  it('Trưởng phòng sửa nhiệm vụ cấp 3 Đã duyệt: Lưu chờ + Gửi duyệt', () => {
    const C = window.COL;
    window.datCongViec([congViec(C)]);
    window.dangNhap('Lê Trưởng Phòng', 'Trưởng phòng');
    const row = nhiemVuCapBa(C);
    expect(window.oCheDoLuuChoForm(row)).toBe(true);
    const tai = new DOMParser().parseFromString(window.createTaskModal(true, row), 'text/html');
    expect(tai.querySelector('button[data-nhap]').textContent).toContain('Lưu chờ');
    expect(tai.querySelector('button[data-gui-duyet]').textContent).toContain('Gửi duyệt');
  });

  it('Trưởng phòng sửa công việc con Đã duyệt: Lưu chờ + Gửi duyệt', () => {
    const C = window.COL;
    window.datCongViec([congViec(C)]);
    window.dangNhap('Lê Trưởng Phòng', 'Trưởng phòng');
    const row = nhiemVuCapHai(C);
    expect(window.oCheDoLuuChoForm(row)).toBe(true);
    const tai = new DOMParser().parseFromString(window.createTaskModal(true, row), 'text/html');
    expect(tai.querySelector('button[data-nhap]').textContent).toContain('Lưu chờ');
    expect(tai.querySelector('button[data-gui-duyet]').textContent).toContain('Gửi duyệt');
    expect(tai.body.textContent).not.toContain('Cập nhật');
  });

  it('Trưởng phòng sửa công việc cấp 1 Đã duyệt (không ghi đè): vẫn Cập nhật — không vào giỏ', () => {
    const C = window.COL;
    const project = congViec(C);
    window.datCongViec([project]);
    window.dangNhap('Lê Trưởng Phòng', 'Trưởng phòng');
    expect(window.oCheDoLuuChoForm(project)).toBe(false);
    const tai = new DOMParser().parseFromString(
      window.createProjectModal(true, project),
      'text/html'
    );
    const nut = Array.from(tai.querySelectorAll('button[type="submit"]'));
    expect(nut.find((b) => b.hasAttribute('data-nhap'))).toBeUndefined();
    expect(nut.some((b) => b.textContent.includes('Cập nhật'))).toBe(true);
  });
});

describe('Lưu chờ — không đóng modal, cột RPC mang luuCho', () => {
  it('bấm Lưu chờ gửi RPC luuCho=true và giữ form mở', async () => {
    const C = window.COL;
    const row = nhiemVuCapHai(C);
    window.datCongViec([congViec(C)]);
    window.datNhiemVu([row]);
    window.dangNhap('Lê Trưởng Phòng', 'Trưởng phòng');
    formSuaTrongDom(C, row);
    ganRpc();
    ganFetch({ muc: [] });
    window.handleEdit('task', row, { luuNhap: true });
    await vi.waitFor(() => expect(window.__rpcCuoi).toBeTruthy());
    expect(window.__rpcCuoi.data.luuCho).toBe(true);
    expect(document.getElementById('task-modal')).not.toBeNull();
    expect(window.__toast.m).toContain('Đã lưu chờ');
    expect(window.__toast.k).toBe('success');
  });
});

describe('popup tick S4 — textContent, POST {chon}', () => {
  it('tên độc không dựng thẻ; bỏ tick thì field đó không vào chon', async () => {
    const C = window.COL;
    const row = nhiemVuCapHai(C, { [C.T_NAME]: DON });
    window.datCongViec([congViec(C)]);
    window.datNhiemVu([row]);
    window.dangNhap('Lê Trưởng Phòng', 'Trưởng phòng');
    formSuaTrongDom(C, row);
    ganFetch(
      {
        kind: 'work-item',
        code: 'CV001-01',
        name: DON,
        phaiLuuCho: true,
        tongSoThayDoi: 2,
        gio: [
          {
            id: 11,
            entity: 'work-item',
            itemId: 7,
            workId: 3,
            code: 'CV001-01',
            name: DON,
            thayDoi: [
              { field: 'name', label: 'Tên', from: 'Cũ', to: DON },
              { field: 'notes', label: 'Ghi chú', from: '', to: 'mới' },
            ],
          },
        ],
      },
      {
        daGui: [{ id: 11 }],
        canhBao: [{ code: 'CV001-01', message: 'Cảnh báo thử', field: 'name' }],
        conLai: [],
        tongSoThayDoiConLai: 1,
      }
    );
    const ket = window.guiGioChoDuyet('task', row);
    await vi.waitFor(() => expect(document.querySelector('.qlcv-dialog')).not.toBeNull());
    const hop = document.querySelector('.qlcv-dialog');
    expect(hop.querySelector('img, script')).toBeNull();
    expect(window.BI_CHIEM).toBeUndefined();
    expect(hop.textContent).toContain('onerror');
    expect(hop.textContent).toContain('Tên:');
    const o = [...hop.querySelectorAll('input[type="checkbox"]')];
    expect(o).toHaveLength(2);
    expect(o.every((cb) => cb.checked)).toBe(true);
    o.find((cb) => cb.dataset.field === 'notes').checked = false;
    [...hop.querySelectorAll('button')].find((b) => b.textContent === 'Gửi duyệt').click();
    await ket;
    expect(window.__postCuoi.path).toContain(
      '/api/v1/approvals/work-item/CV001-01/pending-edits/submit'
    );
    expect(window.__postCuoi.body).toEqual({ chon: [{ id: 11, fields: ['name'] }] });
    expect(document.querySelector('.qlcv-dialog')).toBeNull();
    expect(window.__toasts.some((t) => t.m.includes('Cảnh báo thử'))).toBe(true);
    expect(document.getElementById('task-modal')).not.toBeNull();
    expect(document.querySelector('[name="name"]').value).toBe('Tên mới');
  });

  it('failed submit retains edited form and checkbox selection', async () => {
    const C = window.COL, row = nhiemVuCapHai(C);
    window.dangNhap('Lê Trưởng Phòng', 'Trưởng phòng');
    formSuaTrongDom(C, row);
    ganFetch({gio: [{id: 1, code: row[C.T_ID], name: 'A', thayDoi: [
      {field: 'name', label: 'Tên', from: 'A', to: 'B'},
      {field: 'notes', label: 'Ghi chú', from: '', to: 'C'},
    ]}]}, null);
    const pending = window.guiGioChoDuyet('task', row);
    await vi.waitFor(() => expect(document.querySelector('.qlcv-dialog')).not.toBeNull());
    document.querySelector('[data-field="notes"]').checked = false;
    [...document.querySelectorAll('.qlcv-dialog button')].find(b => b.textContent === 'Gửi duyệt').click();
    await vi.waitFor(() => expect(window.__postCuoi).toBeTruthy());
    expect(document.querySelector('[name="name"]').value).toBe('Tên mới');
    expect(document.querySelector('[data-field="notes"]').checked).toBe(false);
    await new Promise(resolve => setTimeout(resolve, 0));
    [...document.querySelectorAll('.qlcv-dialog button')].find(b => b.textContent === 'Hủy').click();
    expect(await pending).toBe(false);
  });

  it('full submit closes stale form; cancelled popup retains inputs', async () => {
    const C = window.COL, row = nhiemVuCapHai(C);
    window.datCongViec([congViec(C)]); window.datNhiemVu([row]);
    window.dangNhap('Lê Trưởng Phòng', 'Trưởng phòng');
    const basket = { gio: [{id: 1, code: row[C.T_ID], name: 'A', thayDoi: [{field: 'name', label: 'Tên', from: 'A', to: 'B'}]}] };
    formSuaTrongDom(C, row);
    ganFetch(basket, {daGui: [{id: 1}], conLai: [], tongSoThayDoiConLai: 0});
    const cancelled = window.guiGioChoDuyet('task', row);
    await vi.waitFor(() => expect(document.querySelector('.qlcv-dialog')).not.toBeNull());
    [...document.querySelectorAll('.qlcv-dialog button')].find(b => b.textContent === 'Hủy').click();
    expect(await cancelled).toBe(false);
    expect(document.querySelector('[name="name"]').value).toBe('Tên mới');
    expect(window.__postCuoi).toBeUndefined();
    const sent = window.guiGioChoDuyet('task', row);
    await vi.waitFor(() => expect(document.querySelector('.qlcv-dialog')).not.toBeNull());
    [...document.querySelectorAll('.qlcv-dialog button')].find(b => b.textContent === 'Gửi duyệt').click();
    expect(await sent).toBe(true);
    expect(document.getElementById('task-modal')).toBeNull();
  });

  it('giỏ trống sau GET thì toast, không POST submit', async () => {
    const C = window.COL;
    const row = nhiemVuCapHai(C);
    window.datCongViec([congViec(C)]);
    window.dangNhap('Lê Trưởng Phòng', 'Trưởng phòng');
    ganFetch({ gio: [], tongSoThayDoi: 0 });
    const ket = await window.guiGioChoDuyet('task', row);
    expect(ket).toBe(false);
    expect(window.__postCuoi).toBeUndefined();
    expect(window.__toast.m).toContain('Không còn thay đổi chờ');
  });
});

describe('submit intent survives requestSubmit validation', () => {
  it('captures Gửi duyệt after asynchronous validation, never defaults to save', async () => {
    window.datThuSubmit();
    delete window.__intent;
    window.openModal('task', nhiemVuCapBa(window.COL));
    document.querySelector('[data-gui-duyet]').click();
    await vi.waitFor(() => expect(window.__intent).toEqual({ luuNhap: false, guiDuyet: true }));
  });
});

describe('reopen preserves typed draft values', () => {
  it('overlays only current row and preserves arrays, zero and empty strings', () => {
    const C = window.COL, row = nhiemVuCapBa(C);
    const draft = window.dongKemGiaTriLuuCho('task', row, { gio: [
      { code: row[C.T_ID], thayDoi: [
        { field: 'name', valueTo: DON }, { field: 'notes', valueTo: '' },
        { field: 'ty_le', valueTo: 0 }, { field: 'supervisor_ids', valueTo: [4, 7] },
      ] },
      { code: 'OTHER', thayDoi: [{ field: 'name', valueTo: 'Wrong row' }] },
    ] });
    expect(draft[C.T_NAME]).toBe(DON);
    expect(draft[C.T_NOTES]).toBe('');
    expect(draft[C.T_TY_LE]).toBe(0);
    expect(draft.supervisorIds).toEqual([4, 7]);
    expect(row[C.T_NAME]).not.toBe(DON);
  });
});

describe('napGioChoCuaToi — badge khớp theo mã', () => {
  it.each(['logout', 'switch'])('ignores stale basket responses after %s', async (action) => {
    const C = window.COL;
    window.dangNhap('A', 'Trưởng phòng');
    let finish;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { finish = resolve; })));
    const loading = window.napGioChoCuaToi();
    window.xoaCacheGioCho();
    if (action === 'switch') window.dangNhap('B', 'Trưởng phòng');
    finish({ok: true, status: 200, json: () => Promise.resolve({data: {muc: [{code: 'CV001-01'}]}})});
    await loading;
    expect(window.luuChoBadge(nhiemVuCapHai(C))).toBe('');
  });
  it('nạp giỏ rồi luuChoBadge hiện trên đúng mã', async () => {
    const C = window.COL;
    window.dangNhap('Lê Trưởng Phòng', 'Trưởng phòng');
    ganFetch({ muc: [{ code: 'CV001-01', soThayDoi: 1, fields: ['name'] }] });
    await window.napGioChoCuaToi();
    expect(window.luuChoBadge(nhiemVuCapHai(C))).toContain('có sửa chờ');
    expect(window.luuChoBadge(congViec(C))).toBe('');
  });
});
