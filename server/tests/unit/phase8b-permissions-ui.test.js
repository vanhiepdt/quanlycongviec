// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS } from '../../src/middleware/rbac.js';
const APP = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS =
  ";\nshowToast = () => {};\nObject.assign(window, {\n  COL, capNhatBangQuyen, coQuyenTrongPhamVi, coQuyenTaiDong, buildBangPhanQuyenHtml, buildDeptIdOptions,\n  createTaskModal, canUserCreateTask, canUserCreateSubwork, giaTriHieuLucFile,\n  napPhanQuyenHienTai, batDauHoiLaiQuyen, veLaiQuyenHienTai, luuPhanQuyen, veBangPhanQuyen,\n  handleAdd, handleEdit, handleSuccessfulLogin,\n  __init: (role, dept = 1) => {\n    currentUser = { id: 7, name: 'Cán bộ A', role, department_id: dept };\n    isAuthenticated = true;\n    allDepartments = [1,2].map(id => ({ [COL.D_DB_ID]: id, [COL.D_NAME]: 'Phòng ' + id }));\n    allProjects = [1,2].map(id => ({ [COL.P_ID]: 'CV00' + id, [COL.P_DEPT_ID]: id, [COL.P_DEPT]: 'Phòng ' + id, [COL.P_NAME]: 'Công việc ' + id, supervisorId: 2 }));\n    allStaff = [{ [COL.S_NAME]: 'Cán bộ A', [COL.S_ROLE]: 'Nhân viên', [COL.S_DEPT]: 'Phòng 1' }];\n    allTasks = [{ [COL.T_ID]: 'CV001-01', [COL.T_PID]: 'CV001', [COL.T_LEVEL]: 3, [COL.T_ASSIGNEE]: 'Cán bộ A', supervisorId: 2, leaderIds: [3] }];\n    return { projects: allProjects, tasks: allTasks };\n  },\n  __draft: p => { pendingTaskCreate = p; },\n  __capture: fn => { taoDauViecVaNapLai = (type, data) => fn(data); },\n  __setGhi: fn => { restGhi = fn; },\n  __user: () => currentUser,\n  __stop: () => { dungHoiLaiQuyen(); isAuthenticated = false; },\n});";
let data, bundle, options;
const permission = (vai, entity_type, action, gia_tri, pham_vi = 'phong') => ({
  vai,
  entity_type,
  action,
  gia_tri,
  pham_vi,
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  document.body.innerHTML =
    '<a id="projects-nav"></a><button id="add-project-standalone"></button><button id="add-task-standalone"></button>';
  new Function(APP + EXPORTS)();
  bundle = window.__init('Phó phòng');
  data = { macDinh: PERMISSIONS, ghiDe: [] };
  options = {
    supervisors: [
      { id: 1, name: 'Giám đốc' },
      { id: 2, name: 'Phó Giám đốc' },
    ],
    leaders: [{ id: 3, name: 'Trưởng phòng' }],
    defaultSupervisorId: 2,
    defaultLeaderId: 3,
  };
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: String(url).includes('assignment-options')
              ? options
              : String(url).includes('/files')
                ? { nhom: [] }
                : data,
          }),
      })
    )
  );
  const run = {
    withSuccessHandler(fn) {
      this.ok = fn;
      return this;
    },
    withFailureHandler() {
      return this;
    },
    getDataForUser() {
      this.ok({ success: true, ...bundle });
    },
  };
  vi.stubGlobal('google', { script: { run } });
});
afterEach(() => {
  window.__stop();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('quyền động trong phiên trình duyệt', () => {
  it('chưa tải quyền thì không tự cấp từ vai; nhận bảng xong PP thấy tab và nút', async () => {
    expect(window.canUserCreateTask()).toBe(false);
    await window.napPhanQuyenHienTai();
    window.veLaiQuyenHienTai();
    expect(window.canUserCreateTask()).toBe(true);
    expect(document.getElementById('projects-nav').style.display).toBe('flex');
    expect(document.getElementById('add-task-standalone').style.display).toBe('');
  });
  it('poll 15 giây thu hồi và mở lại tab/nút, giữ nguyên phiên', async () => {
    await window.napPhanQuyenHienTai();
    window.batDauHoiLaiQuyen();
    data.ghiDe = [
      permission('Phó phòng', 'task', 'create', 'tu-choi'),
      permission('Phó phòng', 'work', 'read', 'tu-choi'),
    ];
    await vi.advanceTimersByTimeAsync(15000);
    expect(window.canUserCreateTask()).toBe(false);
    expect(document.getElementById('projects-nav').style.display).toBe('none');
    data.ghiDe = [];
    await vi.advanceTimersByTimeAsync(15000);
    expect(window.canUserCreateTask()).toBe(true);
    expect(document.getElementById('projects-nav').style.display).toBe('flex');
  });
  it('quay lại cửa sổ kiểm quyền ngay; tab ẩn không tự hỏi', async () => {
    await window.napPhanQuyenHienTai();
    window.batDauHoiLaiQuyen();
    const vis = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    fetch.mockClear();
    await vi.advanceTimersByTimeAsync(15000);
    expect(fetch).not.toHaveBeenCalled();
    data.ghiDe = [permission('Phó phòng', 'task', 'create', 'tu-choi')];
    vis.mockReturnValue('visible');
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);
    expect(window.canUserCreateTask()).toBe(false);
  });
  it('lỗi tải quyền đóng nút ghi; lần hỏi sau thành công mở lại', async () => {
    await window.napPhanQuyenHienTai();
    fetch.mockResolvedValueOnce({ ok: false });
    await window.napPhanQuyenHienTai(true);
    expect(window.canUserCreateTask()).toBe(false);
    await window.napPhanQuyenHienTai(true);
    expect(window.canUserCreateTask()).toBe(true);
  });
  it.each(['Trưởng phòng', 'Phó phòng', 'Nhân viên'])(
    '%s chỉ có phòng/cha mình dù create tat-ca',
    (role) => {
      window.__init(role);
      data.ghiDe = ['work', 'subwork', 'task'].map((e) =>
        permission(role, e, 'create', 'cho-phep', role === 'Nhân viên' ? 'phong' : 'tat-ca')
      );
      window.capNhatBangQuyen(data);
      const dom = new DOMParser().parseFromString(
        '<select>' + window.buildDeptIdOptions('') + '</select>',
        'text/html'
      );
      expect([...dom.querySelectorAll('option:not([disabled])')].map((o) => o.value)).toEqual([
        '1',
      ]);
      const form = new DOMParser().parseFromString(
        window.createTaskModal(false, null),
        'text/html'
      );
      expect([...form.querySelectorAll('[name="projectId"] option')].map((o) => o.value)).toEqual([
        '',
        'CV001',
      ]);
      expect(window.canUserCreateTask('CV002')).toBe(false);
      expect(window.canUserCreateSubwork('CV002')).toBe(false);
    }
  );
  it('Cán bộ bị tắt tạo vẫn không được tạo, chưa có phòng không thấy cha nào', () => {
    window.__init('Nhân viên', null);
    window.capNhatBangQuyen(data);
    expect(window.canUserCreateTask()).toBe(false);
    const form = new DOMParser().parseFromString(window.createTaskModal(false, null), 'text/html');
    expect(form.querySelectorAll('[name="projectId"] option').length).toBe(1);
    window.__init('Nhân viên');
    data.ghiDe = [permission('Nhân viên', 'task', 'create', 'tu-choi')];
    window.capNhatBangQuyen(data);
    expect(window.canUserCreateTask()).toBe(false);
  });
  it('quyền mượn có phạm vi đã được máy chủ kiểm vẫn được giữ', () => {
    data.phamVi = {
      vai: 'Phó phòng',
      departmentId: 1,
      managedDepartmentIds: [],
      delegations: [{ fromRole: 'Phó Giám đốc', departmentIds: [2] }],
    };
    window.capNhatBangQuyen(data);
    expect(window.canUserCreateTask('CV002')).toBe(true);
    data.phamVi.delegations = [];
    window.capNhatBangQuyen(data);
    expect(window.canUserCreateTask('CV002')).toBe(false);
  });
  it('cache file đổi mảng REST sang chỉ số: thu hồi nộp và chờ duyệt hiệu lực đúng', () => {
    data.ghiDe = [
      permission('Phó phòng', 'file', 'create', 'tu-choi'),
      permission('Phó phòng', 'file', 'approve', 'cho-duyet'),
    ];
    window.capNhatBangQuyen(data);
    expect(window.giaTriHieuLucFile('Phó phòng', 'create')).toBe('tu-choi');
    expect(window.giaTriHieuLucFile('Phó phòng', 'approve')).toBe('cho-duyet');
    expect(window.giaTriHieuLucFile('admin', 'create')).toBe('cho-phep');
  });
});

describe('biểu mẫu phân công đúng ba cấp', () => {
  it('nhiệm vụ trực tiếp có Ban lãnh đạo riêng; mở sửa giữ cả hai lựa chọn', async () => {
    window.capNhatBangQuyen(data);
    const task = bundle.tasks[0];
    document.body.innerHTML = window.createTaskModal(true, task);
    expect(document.getElementById('task-supervisor-group').style.display).toBe('');
    // Đợt A (028): nhãn thống nhất thành «Ban lãnh đạo kiểm soát» ở CẢ BA cấp — bản cũ cấp 3 ghi
    // «Ban lãnh đạo phụ trách — Phó Giám đốc hoặc Giám đốc» vì chỉ cấp 1/cấp 2 mới có ô này.
    expect(document.getElementById('task-supervisor-group').textContent).toContain(
      'Ban lãnh đạo kiểm soát'
    );
    await vi.advanceTimersByTimeAsync(250);
    expect(document.getElementById('task-supervisor-select').value).toBe('2');
    expect(document.getElementById('task-leader-select').value).toBe('3');
    expect(
      [...document.getElementById('task-leader-select').options].map((o) => o.value)
    ).not.toContain('2');
  });
  it('mở sửa lựa chọn trống không bị mặc định ghi đè', async () => {
    window.capNhatBangQuyen(data);
    document.body.innerHTML = window.createTaskModal(true, {
      ...bundle.tasks[0],
      supervisorId: '',
      leaderIds: [],
    });
    await vi.advanceTimersByTimeAsync(250);
    expect(document.getElementById('task-supervisor-select').value).toBe('');
    expect(document.getElementById('task-leader-select').value).toBe('');
  });
  it('nhiệm vụ dưới cấp2 hỏi parentRef, ô BLĐ chỉ chứa người cấp2 đã chọn (D2)', async () => {
    window.capNhatBangQuyen(data);
    // Đợt A: máy chủ lọc `supervisors` theo `parentRef` = `supervisor_ids` của CÔNG VIỆC CON, chứ
    // không còn trả rỗng như bản cấm cấp 3 có người kiểm soát riêng.
    options = {
      supervisors: [{ id: 2, name: 'Phó Giám đốc' }],
      leaders: [{ id: 4, name: 'Phó phòng của cấp2' }],
      defaultSupervisorId: 2,
    };
    window.__draft({ level: 3, parentId: 'CV001-02', projectId: 'CV001' });
    document.body.innerHTML = window.createTaskModal(false, null);
    await vi.advanceTimersByTimeAsync(250);
    // Luật trước 028 ẨN hẳn ô và disable select. Nay cấp 3 được chọn ĐÚNG MỘT người TRONG tập của
    // cấp 2 ⇒ ô phải hiện và phải bật; còn ràng buộc «trong tập cấp 2» do danh sách options đảm nhiệm.
    expect(document.getElementById('task-supervisor-group').style.display).toBe('');
    expect(document.getElementById('task-supervisor-select').disabled).toBe(false);
    expect(
      [...document.getElementById('task-supervisor-select').options].map((o) => o.value)
    ).toEqual(['', '2']);
    // Cấp 3 vẫn là Ô CHỌN MỘT: ô chọn nhiều chỉ dành cho cấp 2, nên nó ẩn và hidden input của nó
    // KHÔNG mang `name` — để cả hai cùng gửi thì FormData chỉ giữ giá trị của ô người dùng không thấy.
    expect(document.getElementById('task-supervisors-multi').style.display).toBe('none');
    expect(document.getElementById('task-supervisors-input').hasAttribute('name')).toBe(false);
    expect(fetch.mock.calls.some(([url]) => url.includes('parentRef=CV001-02'))).toBe(true);
    expect([...document.getElementById('task-leader-select').options].map((o) => o.value)).toEqual([
      '',
      '4',
    ]);
  });
  it('Cán bộ gửi form thực: giữ cha bị khóa, để trống ô duyệt thì không gửi khoá nào', async () => {
    window.__init('Nhân viên');
    window.capNhatBangQuyen(data);
    window.__draft({ level: 3, projectId: 'CV001' });
    document.body.innerHTML = window.createTaskModal(false, null);
    await vi.advanceTimersByTimeAsync(250);
    // MỚI-5 (12/09/2026): người dùng báo «nhân viên khi được phép tạo nhiệm vụ cấp 3, nhưng không
    // chọn được Ban lãnh đạo kiểm soát, Người thực hiện trực tiếp». Nay cả hai ô đều MỞ khi lập mới.
    const nguoi = document.querySelector('#task-modal select[name="assignee"]');
    expect(document.getElementById('task-supervisor-select').disabled).toBe(false);
    expect(nguoi.disabled).toBe(false);
    // Ô mở nhưng KHÔNG điền sẵn tên mình — cùng luật 2026-09-09 của Trưởng/Phó phòng, tránh một mặc
    // định sai lọt qua mắt. Để trống thì client vẫn xoá khoá `supervisorIds`, máy chủ tự lấy người đầu
    // của cấp 2 (Q12): không bao giờ sinh ra nhiệm vụ cấp 3 mồ côi người duyệt.
    expect(nguoi.value).toBe('');
    const captured = vi.fn();
    window.__capture(captured);
    window.handleAdd('task');
    expect(captured).toHaveBeenCalledOnce();
    const payload = captured.mock.calls[0][0];
    expect(payload).toMatchObject({ projectId: 'CV001' });
    expect(payload).not.toHaveProperty('supervisorIds');
    expect(payload).not.toHaveProperty('supervisorId');
    expect(payload).not.toHaveProperty('leaderIds');
  });
  it('MỚI-5: Cán bộ lập mới cấp 3 chọn BLĐKS và người thực hiện thì gửi cả hai', async () => {
    window.__init('Nhân viên');
    window.capNhatBangQuyen(data);
    window.__draft({ level: 3, parentId: 'CV001-02', projectId: 'CV001' });
    document.body.innerHTML = window.createTaskModal(false, null);
    await vi.advanceTimersByTimeAsync(250);
    document.getElementById('task-supervisor-select').value = '2';
    // Ứng viên «Người thực hiện trực tiếp» nay là NHÂN VIÊN CÙNG PHÒNG chứ không phải chỉ chính mình.
    // Danh sách bó lại theo phòng là đủ cho giao diện: máy chủ còn RBAC `create` (cùng phòng + đã có
    // việc trong cây) và `assertSupervisorsByLevel` (BLĐKS cấp 3 phải nằm trong tập của công việc con).
    const nguoi = document.querySelector('#task-modal select[name="assignee"]');
    expect([...nguoi.options].map((o) => o.value)).toEqual(['', 'Cán bộ A']);
    nguoi.value = 'Cán bộ A';
    const captured = vi.fn();
    window.__capture(captured);
    window.handleAdd('task');
    const payload = captured.mock.calls[0][0];
    expect(payload).toMatchObject({
      projectId: 'CV001',
      assignee: 'Cán bộ A',
      supervisorIds: '2',
    });
    // «Lãnh đạo phòng phụ trách» VẪN khoá và vẫn bị xoá — người dùng chỉ yêu cầu mở hai ô kia.
    expect(document.getElementById('task-leader-select').disabled).toBe(true);
    expect(payload).not.toHaveProperty('leaderIds');
  });
  it('MỚI-5: SỬA nhiệm vụ có sẵn thì cán bộ vẫn không mở được ô BLĐKS', async () => {
    window.__init('Nhân viên');
    window.capNhatBangQuyen(data);
    document.body.innerHTML = window.createTaskModal(true, bundle.tasks[0]);
    await vi.advanceTimersByTimeAsync(250);
    // Lý do khoá cũ vẫn còn nguyên giá trị khi SỬA: cán bộ không được tự chỉ định người duyệt cho
    // việc của chính mình. Chỉ lúc LẬP MỚI (chưa có «việc của mình» nào) thì hai ô mới mở.
    expect(document.getElementById('task-supervisor-select').disabled).toBe(true);
  });
  it('thu hồi update khóa nút lưu của form đang mở', async () => {
    window.capNhatBangQuyen(data);
    document.body.innerHTML = window.createTaskModal(true, bundle.tasks[0]);
    await vi.advanceTimersByTimeAsync(250);
    data.ghiDe = [permission('Phó phòng', 'task', 'update', 'tu-choi')];
    await window.napPhanQuyenHienTai(true);
    expect(document.querySelector('#task-form button[type="submit"]').disabled).toBe(true);
  });
  it('admin lưu bảng không làm mất các ô ghi đè đã lưu trước đó', async () => {
    window.__init('admin');
    data.ghiDe = [permission('Phó phòng', 'task', 'create', 'cho-phep')];
    document.body.innerHTML = '<div id="account-permission-table"></div>';
    await window.veBangPhanQuyen();
    const select = document.querySelector(
      '[data-gd][data-vai="Phó phòng"][data-entity="task"][data-action="create"]'
    );
    expect(select.value).toBe('cho-phep');
    const save = vi.fn((method, url, body) =>
      Promise.resolve({ ghiDe: body.thayDoi.filter((g) => g.giaTri !== 'mac-dinh') })
    );
    window.__setGhi(save);
    await window.luuPhanQuyen();
    expect(save.mock.calls[0][2].thayDoi).toContainEqual(
      expect.objectContaining({
        vai: 'Phó phòng',
        entityType: 'task',
        action: 'create',
        giaTri: 'cho-phep',
      })
    );
    const normal = new DOMParser().parseFromString(
      window.buildBangPhanQuyenHtml({}, PERMISSIONS, true),
      'text/html'
    );
    expect(
      normal.querySelector(
        '[data-gd][data-vai="Phó phòng"][data-entity="task"][data-action="create"]'
      ).selectedOptions[0].textContent
    ).toBe('✓ Cho phép');
    expect(
      normal.querySelector(
        '[data-gd][data-vai="Phó phòng"][data-entity="subwork"][data-action="update"]'
      ).selectedOptions[0].textContent
    ).toBe('⏳ Chờ duyệt');
  });
});

describe('phản hồi quyền không vượt qua ranh giới phiên', () => {
  it('đổi người đang đăng nhập bỏ phản hồi cũ và tải đúng quyền của người mới', async () => {
    let finishOld;
    fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishOld = resolve;
        })
    );
    const old = window.napPhanQuyenHienTai();
    window.__init('Nhân viên');
    data.ghiDe = [permission('Nhân viên', 'task', 'create', 'tu-choi')];
    expect(await window.napPhanQuyenHienTai()).toBe(true);
    finishOld({
      ok: true,
      json: () => Promise.resolve({ data: { macDinh: PERMISSIONS, ghiDe: [] } }),
    });
    expect(await old).toBe(false);
    expect(window.canUserCreateTask()).toBe(false);
  });
  it('đăng xuất trong lúc bootstrap chờ quyền không bị đăng nhập trở lại', async () => {
    let finish;
    fetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const login = window.handleSuccessfulLogin({
      user: { id: 12, role: 'Phó phòng', department_id: 1 },
    });
    window.__stop();
    finish({ ok: true, json: () => Promise.resolve({ data }) });
    await expect(login).resolves.toBeUndefined();
    expect(window.canUserCreateTask()).toBe(false);
  });
  it('request quyền treo bị hủy sau 10 giây, lần sau vẫn tải được', async () => {
    fetch.mockImplementationOnce(
      (url, opts) =>
        new Promise((resolve, reject) => {
          opts.signal.addEventListener('abort', () => reject(new Error('hủy request test')));
        })
    );
    const request = window.napPhanQuyenHienTai();
    await vi.advanceTimersByTimeAsync(10000);
    expect(await request).toBe(false);
    expect(await window.napPhanQuyenHienTai()).toBe(true);
  });
});
