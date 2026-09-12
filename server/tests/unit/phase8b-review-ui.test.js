// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QUYEN_UI } from '../helpers/uiPermissions.js';
const APP = readFileSync(resolve('../web/assets/js/app.js'), 'utf8');
const DETAILS = readFileSync(resolve('../web/assets/js/project-details.js'), 'utf8');
const REVIEW = readFileSync(resolve('../web/assets/js/phase8b-review.js'), 'utf8');
let items;
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="modals-container"></div><div id="toast-container"></div>';
  new Function(
    APP +
      QUYEN_UI +
      DETAILS +
      REVIEW +
      '; Object.assign(window,{napDuLieuDauViec8b,moSuaMoiNhat8b,__open: fn => {openModal=fn;},COL,handleEdit,showProjectDetailsModal,ganNutDuyetChiTiet8b,kiemTraTyLeMoiNhat8b,taoDauViecVaNapLai,xacNhanTyLe8b,hienThayDoiDuyet8b,ganTienIchForm8b,createTaskModal,refreshData, __setup: () => { currentUser={id:2,name:"Người gửi",role:"Phó phòng",department_id:1}; isAuthenticated=true; allProjects=[{[COL.P_ID]:"CV001",[COL.P_DEPT_ID]:1}]; allTasks=[{[COL.T_ID]:"SW1",[COL.T_LEVEL]:2,[COL.T_NAME]:"Việc con"},{[COL.T_ID]:"T1",[COL.T_LEVEL]:3,[COL.T_PARENT]:"SW1",[COL.T_PID]:"CV001",[COL.T_TY_LE]:60},{[COL.T_ID]:"T2",[COL.T_LEVEL]:3,[COL.T_PARENT]:"SW1",[COL.T_PID]:"CV001",[COL.T_TY_LE]:60}]; }, __login: fn => {handleSuccessfulLogin=fn;}, __reviewSetup: (projects,tasks,refresh) => { currentUser={id:9,role:"admin"}; allProjects=projects; allTasks=tasks; refreshData=refresh; napLaiSauDuyet=() => Promise.resolve(); }, __reviewTarget: target => {cheDoDuyetChiDoc=true;dauViecDangDuyet8b=target;} });'
  )();
  window.__setup();
  items = [
    {
      id: 1,
      entity_code: 'T1',
      entity_name: '<img src=x onerror=alert(1)>',
      editor_name: 'Người duyệt',
      changes: [{ label: 'Tên', from: 'Cũ', to: '<script>mới</script>' }],
    },
  ];
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: url.includes('acknowledge') ? ((items = []), { acknowledged: true }) : { items },
          }),
      })
    )
  );
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('tổng vượt hoặc thiếu 100 có lựa chọn tiếp tục hoặc sửa lại', async () => {
  let result = window.xacNhanTyLe8b('project', { id: 'CV001' }, null, 'gửi đi');
  expect(document.querySelector('.qlcv-dialog').textContent).toContain('120%');
  [...document.querySelectorAll('.qlcv-dialog button')]
    .find((b) => b.textContent === 'Sửa lại')
    .click();
  expect(await result).toBe(false);
  result = window.xacNhanTyLe8b(
    'task',
    { parent: 'SW1', tyLe: 10 },
    { [window.COL.T_ID]: 'T1', [window.COL.T_PARENT]: 'SW1' },
    'lưu tạm'
  );
  expect(document.querySelector('.qlcv-dialog').textContent).toContain('70%');
  [...document.querySelectorAll('.qlcv-dialog button')]
    .find((b) => b.textContent === 'Vẫn lưu tạm')
    .click();
  expect(await result).toBe(true);
});

it('popup thay đổi thoát dữ liệu; OK mở lại còn hiện, Đã biết gửi xác nhận rồi hết nhắc', async () => {
  let host = document.createElement('section');
  document.body.append(host);
  await window.hienThayDoiDuyet8b('project', 'CV001', host);
  expect(
    document.querySelector('.approval-changes-dialog img, .approval-changes-dialog script')
  ).toBeNull();
  expect(document.querySelector('.approval-changes-dialog').textContent).toContain(
    '<script>mới</script>'
  );
  [...document.querySelectorAll('.approval-changes-dialog button')]
    .find((b) => b.textContent === 'OK')
    .click();
  expect(fetch.mock.calls.some(([url]) => url.includes('acknowledge'))).toBe(false);
  await window.hienThayDoiDuyet8b('project', 'CV001', host);
  expect(document.querySelector('.approval-changes-dialog')).toBeNull();
  host.remove();
  host = document.createElement('section');
  document.body.append(host);
  await window.hienThayDoiDuyet8b('project', 'CV001', host);
  expect(document.querySelector('.approval-changes-dialog')).not.toBeNull();
  [...document.querySelectorAll('.approval-changes-dialog button')]
    .find((b) => b.textContent === 'Đã biết')
    .click();
  await vi.advanceTimersByTimeAsync(0);
  await window.hienThayDoiDuyet8b('project', 'CV001', host);
  expect(document.querySelector('.approval-changes-dialog')).toBeNull();
});
it('refreshData chỉ báo hoàn tất sau khi cập nhật dữ liệu đăng nhập đã xong', async () => {
  let done;
  window.__login(
    () =>
      new Promise((resolve) => {
        done = resolve;
      })
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
      this.ok({ success: true });
    },
  };
  vi.stubGlobal('google', { script: { run } });
  let finished = false;
  const result = window.refreshData().then((value) => {
    finished = true;
    return value;
  });
  await Promise.resolve();
  expect(finished).toBe(false);
  done();
  expect(await result).toBe(true);
});
it('form nhiệm vụ có tỷ lệ cả dưới công việc con và bắt buộc chọn người thực hiện', () => {
  const C = window.COL;
  const html = window.createTaskModal(true, {
    [C.T_ID]: 'T1',
    [C.T_PID]: 'CV001',
    [C.T_PARENT]: 'SW1',
    [C.T_LEVEL]: 3,
    [C.T_TY_LE]: 60,
  });
  const form = new DOMParser().parseFromString(html, 'text/html');
  expect(form.querySelector('[name="tyLe"]').value).toBe('60');
  expect(form.querySelector('[name="assignee"]').required).toBe(true);
});

it.each([
  ['project', 1],
  ['task', 2],
  ['task', 3],
])('form %s cấp %s gửi đúng nội dung sửa trong một yêu cầu phê duyệt', async (type, level) => {
  const C = window.COL;
  const row = {
    [C.P_ID]: 'CV001',
    [C.T_ID]: 'T1',
    [C.T_PID]: 'CV001',
    [C.T_LEVEL]: level,
    [C.P_APPROVAL]: 'Chờ duyệt',
  };
  window.__reviewSetup(
    type === 'project' ? [row] : [{ [C.P_ID]: 'CV001' }],
    type === 'task' ? [row] : [],
    () => Promise.resolve(true)
  );
  const order = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url, options) => {
      if (url.endsWith('/approve')) {
        order.push('approve');
        expect(JSON.parse(options.body).edit).toMatchObject({
          name: 'Nội dung vừa sửa',
          projectId: 'CV001',
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { items: [], row: {}, csrfToken: 'test' } }),
      });
    })
  );
  const run = {
    withSuccessHandler(fn) {
      this.ok = fn;
      return this;
    },
    withFailureHandler() {
      return this;
    },
    updateProjectWithAuth(ref, data) {
      order.push('save');
      expect(data.name).toBe('Nội dung vừa sửa');
      this.ok({ success: true });
    },
    updateTaskWithAuth(ref, data) {
      this.updateProjectWithAuth(ref, data);
    },
  };
  vi.stubGlobal('google', { script: { run } });
  const host = document.createElement('div');
  host.className = 'modal';
  document.body.append(host);
  host.innerHTML =
    '<form id="' +
    type +
    '-form"><input name="id" value="' +
    (type === 'project' ? 'CV001' : 'T1') +
    '"><input name="projectId" value="CV001"><input name="name" value="Nội dung vừa sửa"><select name="assignee"><option selected>Cán bộ A</option></select><button type="submit">Lưu</button></form>';
  const form = host.querySelector('form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    window.handleEdit(type, row);
  });
  window.ganTienIchForm8b(type, row, form);
  expect(form.querySelectorAll('[data-review-action]')).toHaveLength(3);
  form.querySelector('[data-review-action="approve"]').click();
  await vi.advanceTimersByTimeAsync(0);
  expect(order).toEqual(['approve']);
  expect(host.isConnected).toBe(false);
});

it('giữ form khi lưu và duyệt thất bại, hủy cảnh báo thì xóa ý định duyệt', async () => {
  const C = window.COL,
    row = {
      [C.T_ID]: 'T1',
      [C.T_PID]: 'CV001',
      [C.T_PARENT]: 'S1',
      [C.T_LEVEL]: 3,
      [C.P_APPROVAL]: 'Chờ duyệt',
    };
  window.__reviewSetup([{ [C.P_ID]: 'CV001' }], [row], () => Promise.resolve(true));
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      calls.push(url);
      if (url.endsWith('/approve'))
        return Promise.resolve({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ error: { message: 'Không thể phê duyệt bản chỉnh sửa' } }),
        });
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              csrfToken: 'x',
              items: url.includes('work-items?')
                ? [
                    { id: 1, code: 'S1', level: 2, name: 'Việc con' },
                    { id: 2, code: 'T1', level: 3, parent_id: 1, ty_le: 100, ty_le_tu_dong: true },
                  ]
                : [],
            },
          }),
      });
    })
  );
  const run = {
    withSuccessHandler(fn) {
      this.ok = fn;
      return this;
    },
    withFailureHandler() {
      return this;
    },
    updateTaskWithAuth() {
      calls.push('save');
      this.ok({ success: false, error: 'Không lưu được' });
    },
  };
  vi.stubGlobal('google', { script: { run } });
  document.body.insertAdjacentHTML(
    'beforeend',
    '<div class="modal"><form id="task-form"><input name="id" value="T1"><input name="projectId" value="CV001"><input name="name" value="Sửa"><input name="tyLe" value="70"><select name="assignee"><option>A</option></select><button type="submit">Lưu</button></form></div>'
  );
  const form = document.getElementById('task-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    window.handleEdit('task', row);
  });
  window.ganTienIchForm8b('task', row, form);
  form.querySelector('[data-review-action="approve"]').click();
  await vi.advanceTimersByTimeAsync(0);
  expect(document.querySelector('.qlcv-dialog').textContent).toContain('70%');
  expect(document.querySelector('.qlcv-dialog').textContent).toContain('Vẫn lưu và phê duyệt');
  [...document.querySelectorAll('.qlcv-dialog button')]
    .find((b) => b.textContent === 'Sửa lại')
    .click();
  await vi.advanceTimersByTimeAsync(0);
  expect(form.dataset.quyetDinh).toBeUndefined();
  expect(calls).not.toContain('save');
  form.querySelector('[name="tyLe"]').value = '100';
  form.querySelector('[data-review-action="approve"]').click();
  await vi.advanceTimersByTimeAsync(0);
  expect(calls).not.toContain('save');
  expect(calls.some((url) => url.endsWith('/approve'))).toBe(true);
  expect(form.isConnected).toBe(true);
});

it('tạo cha chờ bootstrap xong mới hiện chi tiết, thông tin và nút thêm hai cấp', async () => {
  const C = window.COL;
  let done;
  const row = {
    [C.P_ID]: 'CVNEW',
    [C.P_NAME]: 'Công việc vừa lưu',
    [C.P_DESC]: 'Mô tả không bị trống',
    [C.P_APPROVAL]: 'Nháp',
  };
  window.__reviewSetup(
    [],
    [],
    () =>
      new Promise((resolve) => {
        done = () => {
          window.__reviewSetup([row], [], () => Promise.resolve(true));
          resolve(true);
        };
      })
  );
  const run = {
    withSuccessHandler(fn) {
      this.ok = fn;
      return this;
    },
    withFailureHandler() {
      return this;
    },
    addProjectWithAuth() {
      this.ok({ success: true, projectId: 'CVNEW' });
    },
  };
  vi.stubGlobal('google', { script: { run } });
  items = [];
  document.body.insertAdjacentHTML(
    'beforeend',
    '<div class="modal"><form id="project-form"><button type="submit">Lưu tạm</button></form></div>'
  );
  const form = document.getElementById('project-form');
  const result = window.taoDauViecVaNapLai(
    'project',
    { name: row[C.P_NAME] },
    { guiDuyet: false, dongKhaiTam: [], form }
  );
  await Promise.resolve();
  await Promise.resolve();
  expect(document.getElementById('project-details-modal')).toBeNull();
  done();
  await result;
  const modal = document.getElementById('project-details-modal');
  expect(modal.textContent).toContain('Mô tả không bị trống');
  expect(modal.querySelector('.add-subwork-from-work-btn')).not.toBeNull();
  expect(modal.querySelector('.add-task-from-project-btn')).not.toBeNull();
});
it('Lưu tạm ở chi tiết cha cảnh báo tổng mới nhất, Sửa lại giữ màn hình mở', async () => {
  const C = window.COL,
    row = { [C.P_ID]: 'CV001', [C.P_NAME]: 'Cha', [C.P_APPROVAL]: 'Nháp' };
  window.__reviewSetup([row], [], () => Promise.resolve(true));
  vi.stubGlobal(
    'fetch',
    vi.fn((url) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              items: url.includes('work-items?')
                ? [
                    { id: 1, code: 'S1', name: 'Việc con', level: 2 },
                    { id: 2, code: 'T1', level: 3, parent_id: 1, ty_le: 70 },
                  ]
                : [],
            },
          }),
      })
    )
  );
  window.showProjectDetailsModal('CV001', 'Cha');
  document.querySelector('.draft-close-btn').click();
  await vi.advanceTimersByTimeAsync(0);
  expect(document.querySelector('.qlcv-dialog').textContent).toContain('70%');
  [...document.querySelectorAll('.qlcv-dialog button')]
    .find((b) => b.textContent === 'Sửa lại')
    .click();
  await vi.advanceTimersByTimeAsync(0);
  expect(document.getElementById('project-details-modal')).not.toBeNull();
  expect(document.querySelector('.draft-close-btn').disabled).toBe(false);
});

it('tạo cha mới tiếp tục lần lưu đầu ở lượt sự kiện sau, không gọi lại submit đang chạy', async () => {
  document.body.insertAdjacentHTML(
    'beforeend',
    '<form id="project-form"><input name="name" value="Cha mới"><button type="submit">Lưu tạm</button></form>'
  );
  const form = document.getElementById('project-form');
  const saved = vi.fn((event) => event.preventDefault());
  form.addEventListener('submit', saved);
  window.ganTienIchForm8b('project', null, form);
  const repeatSubmit = vi.spyOn(form, 'requestSubmit');
  form.querySelector('button').click();
  await Promise.resolve();
  await Promise.resolve();
  expect(repeatSubmit).not.toHaveBeenCalled();
  expect(saved).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(0);
  expect(repeatSubmit).toHaveBeenCalledTimes(1);
  expect(saved).toHaveBeenCalledTimes(1);
  expect(form.dataset.tyLeConfirmed).toBeUndefined();
});

it('tạo nhiệm vụ từ cây vẫn đọc tỷ lệ mới nhất khi ô công việc cha bị khóa', async () => {
  items = [
    { id: 1, code: 'SW1', name: 'Công việc con', level: 2 },
    { id: 2, code: 'T1', parent_id: 1, level: 3, ty_le: 80, ty_le_tu_dong: false },
  ];
  document.body.insertAdjacentHTML(
    'beforeend',
    '<form id="task-form"><input name="level" value="3"><input name="parent" value="SW1"><select name="projectId" disabled><option value="CV001" selected>Cha</option></select><input name="assignee" value="Cán bộ A"><input name="tyLe" value="50"><button type="submit">Lưu tạm</button></form>'
  );
  const form = document.getElementById('task-form');
  const saved = vi.fn((event) => event.preventDefault());
  form.addEventListener('submit', saved);
  window.ganTienIchForm8b('task', null, form);
  form.querySelector('button').click();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch.mock.calls.some(([url]) => url.includes('/work-items?workRef=CV001'))).toBe(true);
  expect(document.querySelector('.qlcv-dialog').textContent).toContain('130%');
  expect(saved).not.toHaveBeenCalled();
  document.querySelector('.qlcv-dialog button').click();
  await vi.advanceTimersByTimeAsync(0);
  expect(form.isConnected).toBe(true);
  expect(saved).not.toHaveBeenCalled();
});

it('mở chi tiết lấy trạng thái và nội dung mới, không thay form đang nhập ở phía trên', async () => {
  const C = window.COL;
  const oldRow = {
    [C.P_ID]: 'CV001',
    [C.P_NAME]: 'Cha',
    [C.P_DESC]: 'Cũ',
    [C.P_APPROVAL]: 'Chờ duyệt',
  };
  const newRow = { ...oldRow, [C.P_DESC]: 'Đã được sửa và duyệt', [C.P_APPROVAL]: 'Đã duyệt' };
  window.__reviewSetup([oldRow], [], () => Promise.resolve(true));
  items = [];
  let done;
  const run = {
    withSuccessHandler(fn) {
      done = fn;
      return this;
    },
    withFailureHandler() {
      return this;
    },
    getDataForUser() {},
  };
  vi.stubGlobal('google', { script: { run } });
  window.showProjectDetailsModal('CV001', 'Cha');
  document.body.insertAdjacentHTML(
    'beforeend',
    '<form id="editing"><input value="Đang nhập chưa lưu"></form>'
  );
  const editing = document.getElementById('editing');
  done({ success: true, user: { id: 9 }, projects: [newRow], tasks: [] });
  await vi.advanceTimersByTimeAsync(0);
  expect(document.querySelector('.project-metadata').textContent).toContain('Đã được sửa và duyệt');
  expect(document.querySelector('.project-metadata').textContent).toContain('Đã duyệt');
  expect(document.getElementById('editing')).toBe(editing);
  expect(editing.querySelector('input').value).toBe('Đang nhập chưa lưu');
});

it('form sửa mở từ dữ liệu mới nhất và bỏ phản hồi của phiên cũ', async () => {
  const C = window.COL,
    open = vi.fn();
  window.__reviewSetup([], [], () => Promise.resolve(true));
  window.__open(open);
  let done;
  const run = {
    withSuccessHandler(fn) {
      done = fn;
      return this;
    },
    withFailureHandler() {
      return this;
    },
    getDataForUser() {},
  };
  vi.stubGlobal('google', { script: { run } });
  const row = { [C.P_ID]: 'CV001', [C.P_NAME]: 'Nội dung mới' };
  const first = window.moSuaMoiNhat8b('project', 'CV001');
  expect(open).not.toHaveBeenCalled();
  done({ success: true, user: { id: 9 }, projects: [row], tasks: [] });
  await first;
  expect(open).toHaveBeenCalledWith('project', row);
  open.mockClear();
  const second = window.moSuaMoiNhat8b('project', 'CV001');
  window.__setup();
  done({ success: true, user: { id: 9 }, projects: [row], tasks: [] });
  await second;
  expect(open).not.toHaveBeenCalled();
});

it('mở sửa giữ nguyên mức ưu tiên Thấp', () => {
  const C = window.COL;
  document.body.innerHTML = window.createTaskModal(true, {
    [C.T_ID]: 'T1',
    [C.T_LEVEL]: 3,
    [C.T_PID]: 'CV001',
    [C.T_PRIORITY]: 'Thấp',
  });
  expect(document.querySelector('[name="priority"]').value).toBe('Thấp');
});
