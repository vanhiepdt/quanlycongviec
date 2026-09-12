// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QUYEN_UI } from '../helpers/uiPermissions.js';
const extra = readFileSync(resolve(process.cwd(), '../web/assets/js/phase8b-review.js'), 'utf8');
const source = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  new Function(
    source +
      QUYEN_UI +
      extra +
      ';Object.assign(window,{COL,restGet,thuGuiBldForm,luuCauHinhTienDoFile,buildBangPhanQuyenHtml,buildPendingApprovalRowHtml,uploadKetQua,guiDiDuyetFile,renderLenhSua,coTheNopFile,dsVerdictFile,buildDongChoDuyetKetQua,capNhatTabChoDuyet,moTabChoDuyet,suaTrucTuyenDuoc,createTaskModal,buildKhoiFile,veBangPhanQuyen,luuTyLeFile:typeof luuTyLeFile==="function"?luuTyLeFile:null,cauTinhTrangFile,cauTinhTrangHangCho,capNhatBangQuyen,setup8c:(role="Trưởng phòng")=>{currentUser={id:3,name:"Trưởng phòng",role,department_id:1};isAuthenticated=true;allProjects=[{[COL.P_ID]:"CV001",[COL.P_DEPT_ID]:1,[COL.P_NAME]:"Công việc",[COL.P_START]:"2026-09-01",[COL.P_END]:"2026-12-31"}];allStaff=[];allDepartments=[{[COL.D_DB_ID]:1,[COL.D_NAME]:"Phòng"}];},staff8c:ds=>{allStaff=ds;},capNhatGuiBld8c:()=>{if(typeof capNhatLuaChonGuiBld==="function")capNhatLuaChonGuiBld();},toast8c:()=>document.getElementById("toast-container")?.textContent});'
  )();
  window.setup8c();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});
it('TC-V1-UI-01: form sửa cấp 2 không gọi API file dành cho cấp 3', async () => {
  window.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: { supervisors: [], leaders: [] } }),
    })
  );
  const C = window.COL;
  document.body.innerHTML = window.createTaskModal(true, {
    [C.T_ID]: 'CV001-001',
    [C.T_PID]: 'CV001',
    [C.T_NAME]: 'Công việc con',
    [C.T_LEVEL]: 2,
    leaderIds: [3],
  });
  await vi.advanceTimersByTimeAsync(300);
  expect(
    window.fetch.mock.calls.map(([url]) => url).filter((url) => url.endsWith('/files'))
  ).toEqual([]);
});
it('TC-V1-UI-02: REST 400 hiện câu máy chủ thay vì chỉ HTTP 400', async () => {
  document.body.innerHTML = '<div id="toast-container"></div>';
  window.fetch = vi.fn(() =>
    Promise.resolve({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message: 'Câu lỗi đúng từ máy chủ' },
        }),
    })
  );
  await window.restGet('/api/v1/kiem-thu');
  expect(window.toast8c()).toContain('Câu lỗi đúng từ máy chủ');
});

it('TC-V2-UI-01: mỗi nhóm có tỷ lệ và tiến độ; quyền bị tắt thì không có nút lưu', () => {
  document.body.innerHTML =
    '<table><tbody>' +
    window.buildKhoiFile(
      {
        id: 1,
        ten_goc: 'Kết quả',
        ty_le: 50,
        tienDo: 20,
        duocSuaTyLe: true,
        bans: [],
        trang_thai: 'can-sua',
      },
      'CV001-002',
      1
    ) +
    '</tbody></table>';
  expect(document.querySelector('[data-ty-le-file]')?.value).toBe('50');
  expect(document.querySelector('.dong-kq-nhom').cells[5].textContent).toBe('20%'); // cột riêng
  document.body.innerHTML =
    '<table><tbody>' +
    window.buildKhoiFile(
      {
        id: 1,
        ten_goc: 'Kết quả',
        ty_le: 50,
        tienDo: 20,
        duocSuaTyLe: false,
        bans: [],
        trang_thai: 'can-sua',
      },
      'CV001-002',
      1
    ) +
    '</tbody></table>';
  expect(document.querySelector('[data-ty-le-file]')?.disabled).toBe(true);
  expect(document.querySelector('[data-luu-ty-le-file]')).toBeNull();
});
it('TC-V2-UI-02: tổng khác 100 hiện Sửa lại/Vẫn lưu và chỉ ghi sau xác nhận', async () => {
  document.body.innerHTML =
    '<div id="toast-container"></div><input data-ty-le-file="1" value="70">';
  window.fetch = vi.fn((url, options) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data:
            options?.method === 'PATCH'
              ? { tongTyLe: 120 }
              : url === '/api/csrf'
                ? { csrfToken: 'test' }
                : {
                    nhom: [
                      { id: 1, ty_le: 50 },
                      { id: 2, ty_le: 50 },
                    ],
                  },
        }),
    })
  );
  const request = window.luuTyLeFile(1, 'CV001-002');
  await vi.advanceTimersByTimeAsync(0);
  expect(document.body.textContent).toContain('120%');
  expect([...document.querySelectorAll('button')].map((b) => b.textContent)).toEqual(
    expect.arrayContaining(['Sửa lại', 'Vẫn lưu'])
  );
  expect(window.fetch.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false);
  [...document.querySelectorAll('button')].find((b) => b.textContent === 'Sửa lại').click();
  await request;
  expect(window.fetch.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(false);
  const again = window.luuTyLeFile(1, 'CV001-002');
  await vi.advanceTimersByTimeAsync(0);
  [...document.querySelectorAll('button')].find((b) => b.textContent === 'Vẫn lưu').click();
  await again;
  expect(window.fetch.mock.calls.find(([, options]) => options?.method === 'PATCH')[1].body).toBe(
    JSON.stringify({ tyLe: 70 })
  );
});
it('TC-V2-UI-03: admin sửa bảng mốc, vai khác chỉ đọc', async () => {
  window.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            macDinh: {},
            ghiDe: [],
            settings: { fileProgress: { canSua: 20, daDuyet: 100 } },
            fileProgressLabels: { canSua: 'Cần sửa', daDuyet: 'Đã duyệt' },
          },
        }),
    })
  );
  document.body.innerHTML = '<div id="account-permission-table"></div>';
  window.setup8c('admin');
  await window.veBangPhanQuyen();
  expect(document.querySelector('[data-moc-file="canSua"]')?.value).toBe('20');
  expect(document.querySelector('#file-progress-save')).not.toBeNull();
  window.setup8c('Nhân viên');
  await window.veBangPhanQuyen();
  expect(document.querySelector('[data-moc-file="canSua"]')?.disabled).toBe(true);
  expect(document.querySelector('#file-progress-save')).toBeNull();
});

it('TC-V3-UI-01: chọn PDF vào nhóm Word báo ngay, không upload', async () => {
  document.body.innerHTML = '<div id="toast-container"></div>';
  window.fetch = vi.fn();
  await window.uploadKetQua({
    value: '',
    dataset: { dinhDang: 'Word' },
    files: [new File(['x'], 'sai.pdf', { type: 'application/pdf' })],
  });
  expect(window.toast8c()).toContain('nhóm này khai Word, chỉ nhận .doc/.docx');
  expect(window.fetch).not.toHaveBeenCalled();
  expect(window.suaTrucTuyenDuoc('x.pdf')).toBe(false);
});

it('TC-V4-UI-01: Gửi đi duyệt có ở cả modal và hàng chờ, chỉ khi server cho phép', () => {
  const f = {
    id: 1,
    ten_goc: 'Kết quả.pdf',
    trang_thai: 'luu-tam',
    duocGuiDuyet: true,
    bans: [{ id: 2, version_no: 1, ten_goc: 'Kết quả.pdf' }],
    ban_cuoi_id: 2,
  };
  expect(window.buildKhoiFile(f, 'CV001-002', 1)).toContain('Gửi đi duyệt');
  expect(window.buildDongChoDuyetKetQua(f)).toContain('Gửi đi duyệt');
  expect(window.buildDongChoDuyetKetQua(f)).toContain('guiDiDuyetFile');
  expect(window.buildKhoiFile({ ...f, duocGuiDuyet: false }, 'CV001-002', 1)).not.toContain(
    'Gửi đi duyệt'
  );
  expect(window.buildDongChoDuyetKetQua({ ...f, duocGuiDuyet: false })).not.toContain(
    'Gửi đi duyệt'
  );
});
it('TC-V4-UI-02: Nhân viên có quyền gửi mở được tab kết quả để thấy nháp của mình', () => {
  window.setup8c('Nhân viên');
  document.body.innerHTML =
    '<button class="tab-cho-duyet" data-tab="viec"></button><button class="tab-cho-duyet" data-tab="ket-qua"></button><button class="tab-cho-duyet" data-tab="lenh-sua"></button><div id="panel-cho-duyet-ket-qua"></div><div id="panel-cho-duyet-lenh-sua"></div>';
  window.capNhatTabChoDuyet();
  expect(document.querySelector('[data-tab="ket-qua"]').classList.contains('hidden')).toBe(false);
  window.moTabChoDuyet('ket-qua');
  expect(document.getElementById('panel-cho-duyet-ket-qua').classList.contains('hidden')).toBe(
    false
  );
});

it('TC-V4-UI-03: nhãn lưu tạm nói rõ chưa gửi; cờ máy chủ chặn nộp/verdict', () => {
  const f = { id: 1, trang_thai: 'luu-tam', duocSua: false, duocVerdict: false, bans: [] };
  expect(window.buildKhoiFile(f, 'CV001-002', 1)).toContain('Lưu tạm');
  expect(window.cauTinhTrangFile(f)).toContain('chưa gửi đi duyệt');
  expect(window.coTheNopFile(f, 'CV001-002')).toBe(false);
  expect(window.dsVerdictFile({ ...f, trang_thai: 'cho-xem' })).toEqual([]);
});
it('TC-V4-UI-04: gửi đúng bản đã thấy, chống bấm lặp, tải lại hàng chờ và badge', async () => {
  document.body.innerHTML =
    '<div id="toast-container"></div><div id="cho-duyet-ket-qua-list">Bản nháp</div><a id="nav-cho-duyet"></a><span id="nav-cho-duyet-badge">1</span>';
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  window.fetch = vi.fn((url, options) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data:
            url === '/api/csrf'
              ? { csrfToken: 'test' }
              : options?.method === 'POST'
                ? { tuDong: false }
                : { items: [] },
        }),
    })
  );
  await Promise.all([
    window.guiDiDuyetFile(1, 'CV001-002', 2, true),
    window.guiDiDuyetFile(1, 'CV001-002', 2, true),
  ]);
  const posts = window.fetch.mock.calls.filter(([, o]) => o?.method === 'POST');
  expect(posts).toHaveLength(1);
  expect(posts[0][0]).toBe('/api/v1/task-files/1/gui-di-duyet');
  expect(JSON.parse(posts[0][1].body)).toEqual({ versionId: '2' });
  expect(document.getElementById('cho-duyet-ket-qua-list').textContent).toContain(
    'Không có kết quả'
  );
  expect(document.getElementById('nav-cho-duyet-badge').textContent).toBe('0');
});
it('TC-V4-UI-05: hàng quyền gửi riêng đủ ba giá trị; thu hồi quyền thì ẩn tab kết quả', async () => {
  window.setup8c('admin');
  document.body.innerHTML = '<div id="account-permission-table"></div>';
  window.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: { macDinh: {}, ghiDe: [] } }),
    })
  );
  await window.veBangPhanQuyen();
  const sel = document.querySelector(
    '[data-entity="file"][data-action="submit"][data-vai="Nhân viên"]'
  );
  expect(sel).not.toBeNull();
  expect([...sel.options].map((o) => o.value)).toEqual(
    expect.arrayContaining(['cho-phep', 'cho-duyet'])
  );
  expect([...sel.options].map((o) => o.textContent).join(' ')).toContain('✕');
  window.setup8c('Nhân viên');
  window.capNhatBangQuyen({
    macDinh: { 'Nhân viên': { task: ['read'], file: ['read'] } },
    ghiDe: [],
  });
  document.body.innerHTML = '<button class="tab-cho-duyet" data-tab="ket-qua"></button>';
  window.capNhatTabChoDuyet();
  expect(document.querySelector('[data-tab="ket-qua"]').classList.contains('hidden')).toBe(true);
});

it('TC-V5-UI-01: câu kể dùng tên người nhận đã escape và số lần trả lại từ hàng chờ', () => {
  expect(
    window.cauTinhTrangHangCho({
      trang_thai: 'can-sua',
      soTraLai: 2,
      nguoiNhan: ['Trần <b>A</b> (Trưởng phòng)'],
    })
  ).toBe('Bị trả lại lần 2 — đang đợi Trần <b>A</b> (Trưởng phòng) sửa và nộp bản mới');
  expect(
    window.buildDongChoDuyetKetQua({
      id: 1,
      trang_thai: 'can-sua',
      soTraLai: 2,
      nguoiNhan: ['Trần <b>A</b>'],
      ten_goc: 'x.pdf',
      ban_cuoi_id: 2,
      ban_cuoi_ten: 'x.pdf',
      hanhDong: [],
    })
  ).toContain('Trần &lt;b&gt;A&lt;/b&gt;');
});

it.each(['Trưởng phòng', 'Phó phòng'])(
  'TC-V5-UI-02: %s trực tiếp nhận lệnh vẫn có tab và đủ nút, bị rút quyền thì khóa',
  async (role) => {
    window.setup8c(role);
    const template = new DOMParser().parseFromString(
      readFileSync(resolve(process.cwd(), '../web/index.html'), 'utf8'),
      'text/html'
    );
    document.body.append(template.getElementById('cho-duyet-section'));
    let allowed = true;
    window.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              onlyOffice: true,
              items: [
                {
                  id: 1,
                  ban_cuoi_id: 2,
                  ban_cuoi_ten: 'bản sửa.docx',
                  trang_thai: 'can-sua',
                  lenh_sua_cho: 'can-bo',
                  duocSua: allowed,
                  duocGui: allowed,
                  nguoiNhan: ['Nguyễn Trưởng (' + role + ')'],
                  soTraLai: 1,
                },
              ],
            },
          }),
      })
    );
    await window.moTabChoDuyet('lenh-sua');
    expect(document.getElementById('panel-cho-duyet-lenh-sua').classList.contains('hidden')).toBe(
      false
    );
    expect(document.querySelector('[data-lenh="sua"]').disabled).toBe(false);
    expect(document.querySelector('[data-lenh="gui"]').disabled).toBe(false);
    allowed = false;
    await window.renderLenhSua();
    expect(document.querySelector('[data-lenh="sua"]').disabled).toBe(true);
    expect(document.querySelector('[data-lenh="gui"]').disabled).toBe(true);
  }
);

it('TC-V7-UI-01: form tạo mặc định tắt rõ ràng; NV sửa thấy tích khoá', () => {
  const C = window.COL;
  window.setup8c('Nhân viên');
  document.body.innerHTML = window.createTaskModal(false, null);
  let box = document.querySelector('#task-gui-bld');
  expect(box).not.toBeNull();
  expect(box.checked).toBe(false);
  expect(box.disabled).toBe(false);
  expect(document.body.textContent).toContain('Không tích');
  document.body.innerHTML = window.createTaskModal(true, {
    [C.T_ID]: 'CV001-001',
    [C.T_PID]: 'CV001',
    [C.T_LEVEL]: 3,
    guiBldPheDuyet: true,
  });
  box = document.querySelector('#task-gui-bld');
  expect(box.checked).toBe(true);
  expect(box.disabled).toBe(true);
});
it('TC-V7-UI-02: TP/PP trực tiếp khoá tích, đổi người thì cập nhật; quyền thu hồi khoá form đang mở', () => {
  const C = window.COL;
  window.staff8c([
    { [C.S_NAME]: 'TP', [C.S_ROLE]: 'Trưởng phòng', [C.S_DEPT]: 'Phòng' },
    { [C.S_NAME]: 'NV', [C.S_ROLE]: 'Nhân viên', [C.S_DEPT]: 'Phòng' },
  ]);
  document.body.innerHTML = window.createTaskModal(false, null);
  const assignee = document.querySelector('[name=assignee]');
  assignee.value = 'TP';
  window.capNhatGuiBld8c();
  expect(document.querySelector('#task-gui-bld')).not.toBeNull();
  expect(document.querySelector('#task-gui-bld').disabled).toBe(true);
  expect(document.getElementById('task-gui-bld-help').textContent).toContain(
    'luôn lên Phó Giám đốc'
  );
  assignee.value = 'NV';
  window.capNhatGuiBld8c();
  expect(document.querySelector('#task-gui-bld').disabled).toBe(false);
  document.body.innerHTML = window.createTaskModal(true, {
    [C.T_ID]: 'CV001-001',
    [C.T_PID]: 'CV001',
    [C.T_LEVEL]: 3,
  });
  window.capNhatBangQuyen(null);
  window.capNhatGuiBld8c();
  expect(document.querySelector('#task-gui-bld').disabled).toBe(true);
});
it('TC-V7-UI-03: ma trận có gui-bld đủ ba giá trị; Q2 chỉ admin được sửa', async () => {
  document.body.innerHTML = '<div id="account-permission-table"></div>';
  window.setup8c('admin');
  window.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            macDinh: {},
            ghiDe: [],
            settings: { fileProgress: { luuTam: 0 }, guiBldChangeRequiresApproval: true },
            fileProgressLabels: { luuTam: 'Lưu tạm' },
          },
        }),
    })
  );
  await window.veBangPhanQuyen();
  expect(document.getElementById('gui-bld-change-approval')).not.toBeNull();
  expect(document.getElementById('gui-bld-change-approval').checked).toBe(true);
  const select = document.querySelector('[data-action="gui-bld"]');
  expect(select).not.toBeNull();
  expect([...select.options].map((o) => o.value)).toContain('cho-duyet');
  window.setup8c('Phó phòng');
  await window.veBangPhanQuyen();
  expect(document.getElementById('gui-bld-change-approval').disabled).toBe(true);
});
it('TC-V7-UI-04: đề nghị ở cùng hàng chờ nhưng không có nút Xoá cây, tên/giá trị được escape', () => {
  const html = window.buildPendingApprovalRowHtml({
    kind: 'gui-bld',
    id: 12,
    code: 'CV001-001',
    name: '<img src=x onerror=alert(1)>',
    change: { from: 'Tắt', to: 'Bật' },
  });
  document.body.innerHTML = html;
  expect(document.querySelector('img')).toBeNull();
  expect(document.body.textContent).toContain('Gửi BLĐ');
  expect(document.querySelector('.approval-approve')).toBeNull();
  expect(document.querySelector('[data-change-decision="approve"]')).not.toBeNull();
  expect(document.body.textContent).not.toContain('XOÁ HẲN');
});

it('TC-V7-UI-06: đề nghị đổi TỶ LỆ (R4″) cũng nằm trong hàng chờ, có nút quyết riêng và escape tên file', () => {
  // ĐỢT B: hàng chờ nay chứa BA loại dòng. Dòng `ty-le` mà rơi xuống nhánh cây thì nó vẽ ba nút
  // Duyệt/Trả lại/Từ chối gọi SAI URL — người duyệt bấm «Duyệt» ăn 404 còn tỷ lệ vẫn treo.
  const html = window.buildPendingApprovalRowHtml({
    kind: 'ty-le',
    id: 13,
    code: 'CV001-001-002',
    name: 'Nhiệm vụ <img src=x onerror=alert(1)>',
    tenFile: 'bao-cao.png',
    created_by_name: 'Trần Thị B',
    change: { label: 'Tỷ lệ công việc của file (%)', from: '40%', to: '60%', target: 'file' },
  });
  document.body.innerHTML = html;
  expect(document.querySelector('img')).toBeNull();
  // Phải nói rõ là tỷ lệ của FILE NÀO — một nhiệm vụ có nhiều kết quả.
  expect(document.body.textContent).toContain('Tỷ lệ công việc của file (%): 40% → 60%');
  expect(document.body.textContent).toContain('bao-cao.png');
  expect(document.body.textContent).toContain('Trần Thị B');
  const dong = document.querySelector('.change-row');
  expect(dong).not.toBeNull();
  expect(dong.dataset.changeId).toBe('13');
  expect(dong.dataset.changeKind).toBe('ty-le');
  // Hai nút quyết của `approval_changes`, KHÔNG phải bộ ba của cây.
  expect(document.querySelector('.approval-approve')).toBeNull();
  expect(document.querySelector('.approval-reject-toggle')).toBeNull();
  expect(document.querySelector('[data-change-decision="approve"]')).not.toBeNull();
  expect(document.querySelector('[data-change-decision="reject"]')).not.toBeNull();
});

it('TC-V7-UI-05: form gửi boolean rõ khi tạo, không gửi lại tích khoá/không đổi khi sửa', () => {
  const C = window.COL;
  window.setup8c('Nhân viên');
  document.body.innerHTML = window.createTaskModal(false, null);
  let form = document.getElementById('task-form'),
    data = {};
  window.thuGuiBldForm(form, data);
  expect(data).toEqual({ guiBldPheDuyet: false });
  document.querySelector('#task-gui-bld').checked = true;
  data = {};
  window.thuGuiBldForm(form, data);
  expect(data).toEqual({ guiBldPheDuyet: true });
  document.body.innerHTML = window.createTaskModal(true, {
    [C.T_ID]: 'CV001-001',
    [C.T_PID]: 'CV001',
    [C.T_LEVEL]: 3,
    guiBldPheDuyet: true,
  });
  form = document.getElementById('task-form');
  data = {};
  window.thuGuiBldForm(form, data);
  expect(data).toEqual({});
  const box = document.querySelector('#task-gui-bld');
  box.disabled = false;
  window.thuGuiBldForm(form, data);
  expect(data).toEqual({});
  box.checked = false;
  window.thuGuiBldForm(form, data);
  expect(data).toEqual({ guiBldPheDuyet: false });
});
it('TC-V2V7-UI-01: không đổi cấu hình không PUT; sửa mốc không ghi đè Q2 đang cũ trên form', async () => {
  document.body.innerHTML =
    '<div id="account-permission-table"></div><div id="toast-container"></div>';
  window.setup8c('admin');
  const payloads = [];
  window.fetch = vi.fn((url, options) => {
    if (options?.method === 'PUT') payloads.push(JSON.parse(options.body));
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          data:
            url === '/api/csrf'
              ? { csrfToken: 'test' }
              : {
                  macDinh: {},
                  ghiDe: [],
                  settings: { fileProgress: { canSua: 20 }, guiBldChangeRequiresApproval: true },
                  fileProgressLabels: { canSua: 'Cần sửa' },
                },
        }),
    });
  });
  await window.veBangPhanQuyen();
  await window.luuCauHinhTienDoFile();
  expect(payloads).toEqual([]);
  document.querySelector('[data-moc-file="canSua"]').value = '25';
  await window.luuCauHinhTienDoFile();
  expect(payloads).toEqual([{ fileProgress: { canSua: 25 } }]);
  document.getElementById('gui-bld-change-approval').checked = false;
  await window.luuCauHinhTienDoFile();
  expect(payloads[1]).toEqual({ guiBldChangeRequiresApproval: false });
});
