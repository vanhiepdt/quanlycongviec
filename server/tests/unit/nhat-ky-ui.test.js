// @vitest-environment jsdom
//
// Tab «Nhật ký» trong modal chỉnh sửa — TC-NKUI-01..10 (docs/KE-HOACH-NHAT-KY.md).
//
// Yêu cầu người dùng 2026-08-28: mỗi lần chỉnh sửa của công việc / công việc con / nhiệm vụ đều có
// nhật ký, công việc CHA hiện tất cả của con, và chỗ hiện là NGAY TRONG tab chỉnh sửa của cả 3 cấp.
// Test chạy app.js THẬT trong jsdom (mẫu task-form-candidate.test.js), `fetch` giả.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL,
  nhanHanhDongNhatKy, nhanCotNhatKy, dinhDangGiaTriNhatKy,
  buildNhatKyDong, buildNhatKyChiTiet, renderNhatKy, napNhatKy,
  chuyenTabNhatKy, buildThanhTabNhatKy, buildKhungNhatKy,
  taoFormCongViec: (isEdit, cv) => createProjectModal(isEdit, cv),
  taoFormNhiemVu: (isEdit, nv) => { pendingTaskCreate = null; return createTaskModal(isEdit, nv); },
  datNhanSu: (ds) => { allStaff = ds; },
  datCongViec: (ds) => { allProjects = ds; },
  datPhong: (ds) => { allDepartments = ds; },
  dangNhap: (ten, vai) => { isAuthenticated = true; currentUser = { name: ten, role: vai }; },
});`;

function khoiDong() {
  new Function(APP_SRC + EXPORTS)();
}

/** Một dòng nhật ký như máy chủ trả về (đã qua attachRefs ⇒ có khoá `ref`). */
const dong = (over = {}) => ({
  id: 1,
  actor_name: 'Nguyễn Văn A',
  action: 'works.update',
  entity_type: 'work',
  entity_id: 5,
  work_id: 5,
  details: {},
  created_at: '2026-08-20T03:04:00.000Z',
  ref: { kind: 'work', level: 1, code: 'CV001', name: 'Công việc gốc', deleted: false },
  ...over,
});

function datNoiChua() {
  document.body.innerHTML = '<div id="modals-container"></div><div id="toast-container"></div>';
  return document.getElementById('modals-container');
}

beforeEach(() => {
  document.body.innerHTML = '';
  window.fetch = vi.fn();
  khoiDong();
  window.dangNhap('Nguyễn Văn A', 'admin');
  window.datNhanSu([]);
  window.datCongViec([]);
  window.datPhong([]);
});

describe('TC-NKUI-01..04 — nhãn tiếng Việt và định dạng giá trị', () => {
  it('TC-NKUI-01: hành động và tên cột ra nhãn tiếng Việt, thứ lạ thì giữ nguyên tên', () => {
    expect(window.nhanHanhDongNhatKy('works.update').nhan).toBe('Sửa công việc');
    expect(window.nhanHanhDongNhatKy('subworks.create').nhan).toBe('Thêm công việc con');
    expect(window.nhanHanhDongNhatKy('tasks.update').nhan).toBe('Sửa nhiệm vụ');
    expect(window.nhanHanhDongNhatKy('reminders.create').nhan).toBe('Thêm nhắc việc');
    expect(window.nhanCotNhatKy('due_date')).toBe('Ngày hết hạn');
    expect(window.nhanCotNhatKy('assignee_name')).toBe('Cán bộ trực tiếp');
    // Hành động/cột chưa có trong bảng nhãn vẫn hiện ra, không bị bỏ mất.
    expect(window.nhanHanhDongNhatKy('abc.xyz').nhan).toBe('abc.xyz');
    expect(window.nhanCotNhatKy('cot_la')).toBe('cot_la');
  });

  it('TC-NKUI-02: giá trị rỗng ra «(trống)», mảng nối bằng dấu phẩy', () => {
    expect(window.dinhDangGiaTriNhatKy('name', null)).toBe('(trống)');
    expect(window.dinhDangGiaTriNhatKy('name', '')).toBe('(trống)');
    expect(window.dinhDangGiaTriNhatKy('leader_ids', [])).toBe('(trống)');
    expect(window.dinhDangGiaTriNhatKy('leader_ids', [3, 7])).toBe('3, 7');
    expect(window.dinhDangGiaTriNhatKy('completion', 0)).toBe('0');
  });

  it('TC-NKUI-03: cột ngày ra dd/mm/yyyy, cột _at kèm giờ', () => {
    expect(window.dinhDangGiaTriNhatKy('due_date', '2026-08-20')).toBe('20/08/2026');
    expect(window.dinhDangGiaTriNhatKy('approved_at', '2026-08-20T03:04:00.000Z')).toMatch(
      /^20\/08\/2026 \d{2}:\d{2}$/
    );
  });

  it('TC-NKUI-04: từng lần chỉnh sửa hiện «cột: cũ → mới»', () => {
    const html = window.buildNhatKyChiTiet(
      dong({
        details: {
          code: 'CV001',
          changes: {
            status: { from: 'Chưa bắt đầu', to: 'Đang thực hiện' },
            notes: { from: '', to: 'Ghi chú mới' },
          },
        },
      })
    );
    expect(html).toContain('Trạng thái');
    expect(html).toContain('Chưa bắt đầu');
    expect(html).toContain('Đang thực hiện');
    expect(html).toContain('Ghi chú');
    expect(html).toContain('(trống)');
  });
});

describe('TC-NKUI-05..07 — vẽ danh sách nhật ký', () => {
  it('TC-NKUI-05: chưa có dòng nào thì báo rõ, không để khung trắng', () => {
    document.body.innerHTML = '<div id="noi"></div>';
    window.renderNhatKy('noi', { entries: [] });
    expect(document.getElementById('noi').textContent).toContain('Chưa có lần chỉnh sửa nào');
    window.renderNhatKy('noi', null);
    expect(document.getElementById('noi').textContent).toContain('Chưa có lần chỉnh sửa nào');
  });

  it('TC-NKUI-06: gom cả 3 cấp, mới nhất lên đầu, mỗi dòng nói rõ cấp nào', () => {
    document.body.innerHTML = '<div id="noi"></div>';
    window.renderNhatKy('noi', {
      scope: 'tree',
      entries: [
        dong({ id: 1, action: 'works.create' }),
        dong({
          id: 2,
          action: 'subworks.update',
          entity_type: 'subwork',
          ref: {
            kind: 'subwork',
            level: 2,
            code: 'CV001-001',
            name: 'Công việc con A',
            deleted: false,
          },
        }),
        dong({
          id: 3,
          action: 'tasks.update',
          entity_type: 'task',
          ref: { kind: 'task', level: 3, code: 'CV001-002', name: 'Nhiệm vụ B', deleted: false },
        }),
      ],
    });
    const chu = document.getElementById('noi').textContent;
    expect(chu).toContain('Lập công việc');
    expect(chu).toContain('Công việc con CV001-001');
    expect(chu).toContain('Nhiệm vụ CV001-002');
    // Máy chủ trả cũ→mới; trên màn hình phải đảo lại mới→cũ.
    expect(chu.indexOf('Sửa nhiệm vụ')).toBeLessThan(chu.indexOf('Lập công việc'));
  });

  it('TC-NKUI-07: tên đầu việc có thẻ HTML bị thoát, dòng của đầu việc đã xoá vẫn hiện', () => {
    document.body.innerHTML = '<div id="noi"></div>';
    window.renderNhatKy('noi', {
      entries: [
        dong({
          action: 'workItems.remove',
          entity_type: 'task',
          details: { code: 'CV001-050', name: '<img src=x onerror=alert(1)>' },
          ref: {
            kind: 'task',
            level: 3,
            code: 'CV001-050',
            name: '<img src=x onerror=alert(1)>',
            deleted: true,
          },
        }),
      ],
    });
    const el = document.getElementById('noi');
    expect(el.querySelector('img')).toBeNull();
    expect(el.innerHTML).not.toContain('<img src=x');
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(el.textContent).toContain('(đã xoá)');
  });
});

describe('TC-NKUI-08..10 — tab «Nhật ký» trong modal chỉnh sửa', () => {
  const CV = (C) => ({
    [C.P_ID]: 'CV001',
    [C.P_NAME]: 'Công việc gốc',
    [C.P_MANAGER]: 'Nguyễn Văn A',
    [C.P_STATUS]: 'Đang thực hiện',
    [C.P_START]: '2026-08-01',
    [C.P_END]: '2026-12-31',
  });

  const NV = (C) => ({
    [C.T_ID]: 'CV001-002',
    [C.T_PID]: 'CV001',
    [C.T_NAME]: 'Nhiệm vụ B',
    [C.T_LEVEL]: 3,
    [C.T_ASSIGNEE]: 'Nguyễn Văn A',
    [C.T_STATUS]: 'Đang thực hiện',
    [C.T_START]: '2026-08-01',
    [C.T_DUE]: '2026-08-31',
  });

  it('TC-NKUI-08: form công việc khi SỬA có tab Nhật ký, khi TẠO thì không', () => {
    const C = window.COL;
    const noi = datNoiChua();
    noi.innerHTML = window.taoFormCongViec(true, CV(C));
    expect(document.getElementById('project-tab-nhat-ky')).not.toBeNull();
    expect(document.getElementById('project-nhat-ky-panel').dataset.ma).toBe('CV001');
    expect(document.getElementById('project-nhat-ky-panel').classList.contains('hidden')).toBe(
      true
    );

    noi.innerHTML = window.taoFormCongViec(false, null);
    expect(document.getElementById('project-tab-nhat-ky')).toBeNull();
    expect(document.getElementById('project-nhat-ky-panel')).toBeNull();
  });

  it('TC-NKUI-09: bấm tab thì đổi khung và gọi API scope=tree đúng một lần', async () => {
    const C = window.COL;
    window.datCongViec([CV(C)]);
    window.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => ({ ok: true, data: { scope: 'tree', entries: [dong()] } }),
    });
    datNoiChua().innerHTML = window.taoFormCongViec(true, CV(C));

    // app.js chạy trong `new Function` nên thuộc tính onclick không thấy hàm ⇒ kiểm hai phần: nút
    // gọi ĐÚNG hàm với đúng tham số, và hàm đó làm đúng việc.
    expect(document.getElementById('project-tab-nhat-ky').getAttribute('onclick')).toBe(
      "chuyenTabNhatKy('project', 'nhat-ky')"
    );
    window.chuyenTabNhatKy('project', 'nhat-ky');
    expect(document.getElementById('project-form').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('project-nhat-ky-panel').classList.contains('hidden')).toBe(
      false
    );
    await new Promise((r) => setTimeout(r, 0));

    const duong = window.fetch.mock.calls.map((c) => String(c[0]));
    const goi = duong.filter((u) => u.indexOf('/history') !== -1);
    expect(goi).toHaveLength(1);
    expect(goi[0]).toBe('/api/v1/works/CV001/history?scope=tree&limit=500');
    expect(document.getElementById('project-nhat-ky-noi-dung').textContent).toContain(
      'Sửa công việc'
    );

    // Quay lại tab Thông tin rồi sang lại: không gọi API lần hai.
    window.chuyenTabNhatKy('project', 'thong-tin');
    expect(document.getElementById('project-form').classList.contains('hidden')).toBe(false);
    window.chuyenTabNhatKy('project', 'nhat-ky');
    await new Promise((r) => setTimeout(r, 0));
    expect(
      window.fetch.mock.calls.map((c) => String(c[0])).filter((u) => u.indexOf('/history') !== -1)
    ).toHaveLength(1);
  });

  it('TC-NKUI-10: form nhiệm vụ khi SỬA có tab Nhật ký và gọi đường work-items', async () => {
    const C = window.COL;
    window.datCongViec([CV(C)]);
    window.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => ({ ok: true, data: { scope: 'self', entries: [] } }),
    });
    datNoiChua().innerHTML = window.taoFormNhiemVu(true, NV(C));

    // Hàng tiêu đề (có nút Cập nhật) phải Ở NGOÀI phần bị ẩn, chỉ khối 3 cột mới ẩn.
    expect(document.getElementById('task-form-body')).not.toBeNull();
    expect(document.getElementById('task-tab-nhat-ky').getAttribute('onclick')).toBe(
      "chuyenTabNhatKy('task', 'nhat-ky')"
    );
    window.chuyenTabNhatKy('task', 'nhat-ky');
    expect(document.getElementById('task-form-body').classList.contains('hidden')).toBe(true);
    expect(document.querySelector('#task-form button[type="submit"]')).not.toBeNull();
    await new Promise((r) => setTimeout(r, 0));

    const goi = window.fetch.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.indexOf('/history') !== -1);
    expect(goi).toEqual(['/api/v1/work-items/CV001-002/history?scope=tree&limit=500']);
    expect(document.getElementById('task-nhat-ky-noi-dung').textContent).toContain(
      'Chưa có lần chỉnh sửa nào'
    );
  });
});
