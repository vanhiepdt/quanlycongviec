// @vitest-environment jsdom
//
// MÀN HÌNH DUYỆT «Chờ duyệt» (2026-08-28) — vòng bổ sung UI cho luồng duyệt Phase 5:
//   • builder buildPendingApprovalRowHtml: đủ loại/mã/tên/người gửi + nút Duyệt/Từ chối, escape đủ;
//   • panel CHỈ hiện với người duyệt (admin / Phó Giám đốc) — người thường bị ẩn;
//   • bấm Duyệt/Từ chối (kể cả bắn MouseEvent thật) phải gọi đúng REST
//     /api/v1/approvals/:entity/:id/{approve,reject}; từ chối cần lý do ≥ 10 ký tự.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { QUYEN_UI } from '../helpers/uiPermissions.js';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL, buildPendingApprovalRowHtml, buildPendingDeleteRowHtml, renderChoDuyetPanel,
  renderYeuCauXoaPanel, goiNutChoDuyetPanel, capNhatTrangThaiChoDuyetLocal,
  NHAN_DUYET, nhanDuyetHtml, moPopupThayDoiChoDuyet, HANH_DONG_SUA_NOI_DUNG,
  buildChangeApprovalRowHtml, ganNutQuyetDinhDeNghi,
  __setTree: (projects, tasks) => { allProjects = projects; allTasks = tasks; },
  __tree: () => ({ projects: allProjects, tasks: allTasks }),
  __vaoVai: (ten, vai) => {
    isAuthenticated = true;
    currentUser = { name: ten, role: vai, id: 9 };
  },
  __duLieuChoDuyet: (items) => {
    restGet = async () => ({ items, total: items.length });
  },
  __duLieuTheoDuong: (map) => {
    // Tên biến toàn cục KHÁC tên hàm trả về: trong jsdom, window CHÍNH LÀ globalThis — đặt trùng
    // tên là mảng ghi đè luôn hàm và ca sau nổ «is not a function» (bẫy đã trả giá ở bộ __lopDaGoi).
    // Chú thích ở đây KHÔNG được dùng backtick: cả khối EXPORTS là một template literal.
    globalThis.__duongDaHoi = [];
    restGet = async (path) => {
      globalThis.__duongDaHoi.push(path);
      return map[path] ?? { items: [], total: 0 };
    };
  },
  __duongDaGoi: () => globalThis.__duongDaHoi || [],
  __batPost: () => {
    globalThis.__lopDaGoi = [];
    restPost = async (path, body) => {
      globalThis.__lopDaGoi.push({ path, body });
      return { row: { code: 'OK' } };
    };
  },
  __daGoi: () => globalThis.__lopDaGoi || [],
});`;

function khoiDong() {
  new Function(APP_SRC + QUYEN_UI + EXPORTS)();
}

const ITEM_WORK = {
  kind: 'work',
  id: 5,
  code: 'CV004',
  name: 'Quyết toán chi phí đào tạo quý 3',
  level: 1,
  created_by_name: 'Trần Trưởng Phòng',
};
const ITEM_SUB = {
  kind: 'item',
  id: 7,
  code: 'CV004-01',
  name: 'Hồ sơ <b>nhạy</b>',
  level: 2,
  created_by_name: 'Nguyễn Văn A',
};

beforeEach(() => {
  document.body.innerHTML =
    '<div id="approvals-panel" class="hidden">' +
    '<span id="approvals-count">0</span>' +
    '<div id="approvals-list"></div>' +
    '<button id="approvals-refresh"></button>' +
    '<div id="approvals-delete-box" class="hidden mt-3 pt-3 border-t border-red-100">' +
    '<span id="approvals-delete-count">0</span>' +
    '<div id="approvals-delete-list"></div></div></div>';
  khoiDong();
});

describe('trạng thái cây sau gửi duyệt', () => {
  it('gửi công việc con chỉ đổi con nháp/từ chối, không hạ nhiệm vụ đã duyệt', () => {
    const C = window.COL;
    window.__setTree(
      [],
      [
        { [C.T_ID]: 'SW', [C.T_APPROVAL]: 'Nháp' },
        { [C.T_ID]: 'T1', [C.T_PARENT]: 'SW', [C.T_APPROVAL]: 'Nháp' },
        { [C.T_ID]: 'T2', [C.T_PARENT]: 'SW', [C.T_APPROVAL]: 'Đã duyệt' },
        { [C.T_ID]: 'T3', [C.T_PARENT]: 'OTHER', [C.T_APPROVAL]: 'Nháp' },
      ]
    );
    window.capNhatTrangThaiChoDuyetLocal('work-item', 'SW');
    expect(window.__tree().tasks.map((t) => t[C.T_APPROVAL])).toEqual([
      'Chờ duyệt',
      'Chờ duyệt',
      'Đã duyệt',
      'Nháp',
    ]);
  });
});

describe('builder dòng «Chờ duyệt»', () => {
  it('công việc: đủ loại/mã/tên/người gửi + nút Duyệt/Từ chối + data-* để delegate', () => {
    const html = window.buildPendingApprovalRowHtml(ITEM_WORK);
    expect(html).toContain('Công việc');
    expect(html).toContain('Quyết toán chi phí đào tạo quý 3');
    expect(html).toContain('CV004');
    expect(html).toContain('Trần Trưởng Phòng');
    expect(html).toContain('approval-approve');
    expect(html).toContain('approval-reject-toggle');
    expect(html).toContain('data-entity="work"');
    expect(html).toContain('data-id="CV004"');
  });

  it('tên có HTML nguy hiểm vẫn chỉ là chữ (escape đủ)', () => {
    const html = window.buildPendingApprovalRowHtml(ITEM_SUB);
    expect(html).toContain('&lt;b&gt;nhạy&lt;/b&gt;');
    expect(html).not.toContain('<b>');
    expect(html).toContain('Công việc con');
    expect(html).toContain('data-entity="work-item"');
  });
});

// ------------------------------------------------------------------------------------------
// MỚI-3 (2026-09-12) — «thêm cột thông tin về đây là duyệt công việc mới tạo, hay sửa chữa/xóa …
// công việc cha, công việc con., nhiệm vụ, file kết quả», và nút «Xem các thay đổi» mở popup.
// Cờ `da_sua` + mốc `moc_xu_ly` do `repo.listPending` tính từ `activity_logs` (test luật ở
// `approvals-pending-da-sua.test.js`); ở đây chỉ đo GIAO DIỆN có đọc đúng hai trường đó không.
// ------------------------------------------------------------------------------------------
const ITEM_SUA = {
  kind: 'item',
  id: 11,
  code: 'CV004-02',
  name: 'Tổng hợp số liệu quý',
  level: 3,
  work_name: 'Quyết toán chi phí đào tạo quý 3',
  created_by_name: 'Trần Trưởng Phòng',
  da_sua: true,
  moc_xu_ly: '2026-09-10T02:00:00.000Z',
};
const MOC = ITEM_SUA.moc_xu_ly;
/** Ba dòng nhật ký: một SAU mốc (hiện), một TRƯỚC mốc (ẩn), một không phải sửa nội dung (ẩn). */
const NHAT_KY = {
  entries: [
    {
      action: 'works.create',
      created_at: '2026-09-11T03:00:00.000Z',
      actor_name: 'Người Lập',
      details: {},
      ref: { level: 3, code: 'CV004-02', name: 'Tổng hợp số liệu quý' },
    },
    {
      action: 'tasks.update',
      created_at: '2026-09-09T03:00:00.000Z',
      actor_name: 'Trần Trưởng Phòng',
      details: { changes: { name: { from: 'Lượt sửa TRƯỚC mốc', to: 'không được hiện' } } },
      ref: { level: 3, code: 'CV004-02', name: 'Tổng hợp số liệu quý' },
    },
    {
      action: 'tasks.update',
      created_at: '2026-09-11T03:00:00.000Z',
      actor_name: 'Trần Trưởng Phòng',
      details: { changes: { name: { from: 'Tên cũ', to: 'Tên mới sau sửa' } } },
      ref: { level: 3, code: 'CV004-02', name: 'Tổng hợp số liệu quý' },
    },
  ],
};

describe('MỚI-3 — nhãn «duyệt cái gì» và nút «Xem các thay đổi»', () => {
  it('không có `da_sua` ⇒ «Mới tạo», KHÔNG vẽ nút «Xem các thay đổi»', () => {
    const html = window.buildPendingApprovalRowHtml(ITEM_WORK);
    expect(html).toContain('Mới tạo');
    expect(html).toContain('Công việc cha');
    expect(html).not.toContain('approval-changes');
    expect(html).toContain('data-da-sua="0"');
    // `da_sua` phải xét `=== true`: máy chủ cũ chưa có cột này thì không được hứa một popup rỗng.
    expect(html).toContain('duyet-nhan');
  });

  it('`da_sua: true` ⇒ «Sửa» + nút «Xem các thay đổi» + mốc nằm trong `data-*`', () => {
    const html = window.buildPendingApprovalRowHtml(ITEM_SUA);
    expect(html).toContain('>Sửa<');
    expect(html).toContain('approval-changes');
    expect(html).toContain('Xem các thay đổi');
    expect(html).toContain('Nhiệm vụ');
    expect(html).toContain('data-da-sua="1"');
    expect(html).toContain('data-moc-xu-ly="' + MOC + '"');
    // Nút mới đặt TRƯỚC «Xem chi tiết»: người duyệt đọc phần sửa trước khi mở cả cây.
    expect(html.indexOf('approval-changes')).toBeLessThan(html.indexOf('approval-detail'));
    // Bốn nút cũ phải còn nguyên — chỉ THÊM thông tin, không đổi luồng quyết.
    for (const lop of [
      'approval-detail',
      'approval-approve',
      'approval-return-toggle',
      'approval-reject-toggle',
    ]) {
      expect(html, 'mất nút ' + lop).toContain(lop);
    }
  });

  it('cấp 2 vẫn in «Công việc con» kèm tên công việc cha trong `title`', () => {
    const html = window.buildPendingApprovalRowHtml(ITEM_SUB);
    expect(html).toContain('Công việc con');
    expect(html).toContain('Mới tạo');
  });

  it('bảng yêu cầu xoá: nhãn «Xoá» + đối tượng, vẫn giữ nền đỏ mà test cũ đã pin', () => {
    const html = window.buildPendingDeleteRowHtml(XOA_ITEM);
    expect(html).toContain('bg-red-100');
    expect(html).toContain('>Xoá<');
    expect(html).toContain('Nhiệm vụ');
    expect(window.nhanDuyetHtml('xoa')).toContain('bg-red-100');
    expect(window.nhanDuyetHtml('moi')).toContain('bg-emerald-100');
    expect(window.nhanDuyetHtml('sua')).toContain('bg-blue-100');
  });

  it('dòng đề nghị (`approval_changes`): nhãn «Sửa» + «File kết quả» khi là tỷ lệ của file', () => {
    const file = window.buildChangeApprovalRowHtml({
      kind: 'ty-le',
      id: 21,
      code: 'CV004-02',
      name: 'Tổng hợp số liệu quý',
      level: 3,
      tenFile: 'Báo cáo quý 3.xlsx',
      created_by_name: 'Cán Bộ A',
      change: { label: 'Tỷ lệ', from: '30%', to: '40%' },
    });
    expect(file).toContain('change-row');
    expect(file).toContain('>Sửa<');
    expect(file).toContain('File kết quả');
    expect(file).toContain('Đổi tỷ lệ');
    // Đề nghị của NHIỆM VỤ (không `tenFile`) thì đối tượng là nhiệm vụ, đừng in oan «File kết quả».
    const nhiemVu = window.buildChangeApprovalRowHtml({
      kind: 'gui-bld',
      id: 22,
      code: 'CV004-02',
      name: 'Tổng hợp số liệu quý',
      level: 3,
      created_by_name: 'Cán Bộ A',
      change: { label: 'Gửi BLĐ phê duyệt', from: 'không', to: 'có' },
    });
    expect(nhiemVu).toContain('>Sửa<');
    expect(nhiemVu).toContain('Nhiệm vụ');
    expect(nhiemVu).not.toContain('File kết quả');
  });

  it('popup: chỉ in lượt sửa SAU mốc, bỏ qua hành động không phải sửa nội dung', async () => {
    window.__vaoVai('Phó GĐ Một', 'Phó Giám đốc');
    window.__duLieuTheoDuong({
      '/api/v1/work-items/CV004-02/history?limit=500': NHAT_KY,
    });
    await window.moPopupThayDoiChoDuyet('work-item', 'CV004-02', 'Tổng hợp số liệu quý', MOC);
    const hop = document.getElementById('thay-doi-cho-duyet-dialog');
    expect(hop, 'popup không được dựng').toBeTruthy();
    const chu = hop.textContent;
    expect(chu).toContain('Tên mới sau sửa');
    expect(chu).not.toContain('không được hiện');
    expect(chu).not.toContain('Lập công việc');
    // Nhiệm vụ ⇒ KHÔNG `scope=tree`: dòng chờ là của đúng mục đó, nhật ký anh em không thuộc lượt này.
    expect(window.__duongDaGoi()).toContain('/api/v1/work-items/CV004-02/history?limit=500');
    // Nút «Đóng» phải gỡ popup — không thì lớp phủ nằm lì, bấm gì cũng không được.
    hop.querySelector('footer button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('thay-doi-cho-duyet-dialog')).toBeNull();
  });

  it('popup của công việc cha tải `scope=tree` — duyệt cây là duyệt cả cây', async () => {
    window.__vaoVai('Quản trị Hệ thống', 'admin');
    window.__duLieuTheoDuong({
      '/api/v1/works/CV004/history?scope=tree&limit=500': { entries: [] },
    });
    await window.moPopupThayDoiChoDuyet('work', 'CV004', 'Quyết toán chi phí đào tạo quý 3', '');
    expect(window.__duongDaGoi()).toContain('/api/v1/works/CV004/history?scope=tree&limit=500');
    const hop = document.getElementById('thay-doi-cho-duyet-dialog');
    // Mốc RỖNG (máy chủ cũ / dòng dựng từ cache) ⇒ KHÔNG lọc, thà in thừa còn hơn in rỗng rồi để
    // người duyệt tưởng «không sửa gì» mà ký. Ở đây nhật ký rỗng thật nên phải có câu báo.
    expect(hop.textContent).toContain('Không tìm thấy lượt sửa nào');
  });

  it('bấm nút «Xem các thay đổi» trong panel ⇒ mở popup đúng mã và đúng mốc', async () => {
    window.__vaoVai('Phó GĐ Một', 'Phó Giám đốc');
    window.__duLieuTheoDuong({
      '/api/v1/approvals/pending': { items: [ITEM_SUA], total: 1 },
      '/api/v1/approvals/pending-deletes': { items: [], total: 0 },
      '/api/v1/work-items/CV004-02/history?limit=500': NHAT_KY,
    });
    await window.renderChoDuyetPanel();
    window.goiNutChoDuyetPanel();
    const nut = document.querySelector('.approval-changes');
    expect(nut, 'nút không được vẽ trong panel').toBeTruthy();
    nut.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const hop = document.getElementById('thay-doi-cho-duyet-dialog');
    expect(hop).toBeTruthy();
    expect(hop.textContent).toContain('Tên mới sau sửa');
    expect(hop.textContent).toContain('CV004-02');
    // Nút phải được bật lại sau khi tải xong, không thì bấm lần hai không ăn.
    expect(nut.disabled).toBe(false);
  });
});

describe('panel «Chờ duyệt» — chỉ người duyệt thấy, hành động gọi đúng REST', () => {
  it('Phó GĐ: panel hiện, đủ dòng + con số; bấm Duyệt ⇒ POST /approve đúng mã', async () => {
    window.__vaoVai('Phó GĐ Một', 'Phó Giám đốc');
    window.__duLieuChoDuyet([ITEM_WORK, ITEM_SUB]);
    window.__batPost();
    await window.renderChoDuyetPanel();
    window.goiNutChoDuyetPanel();
    const panel = document.getElementById('approvals-panel');
    expect(panel.classList.contains('hidden')).toBe(false);
    expect(document.querySelectorAll('.approval-row').length).toBe(2);
    expect(document.getElementById('approvals-count').textContent).toBe('2');
    document
      .querySelector('.approval-approve')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    const daGoi = window.__daGoi();
    expect(daGoi.length).toBe(1);
    expect(daGoi[0].path).toBe('/api/v1/approvals/work/CV004/approve');
  });

  it('Từ chối: lý do < 10 ký tự bị chặn ở client; đủ lý do ⇒ POST /reject kèm body', async () => {
    window.__vaoVai('Quản trị Hệ thống', 'admin');
    window.__duLieuChoDuyet([ITEM_WORK]);
    window.__batPost();
    // Từ 012 «Từ chối» là XOÁ HẲN cả cây nên có một bước hỏi lại. jsdom không dựng `confirm` thật
    // (nó ném "Not implemented") ⇒ phải thay bằng hàm giả, và đây cũng là chỗ chốt rằng bước hỏi
    // lại có thật: bỏ nó đi thì `daHoi` còn 0 và test đỏ.
    let daHoi = 0;
    window.confirm = (loi) => {
      daHoi += 1;
      expect(loi).toContain('XOÁ HẲN');
      return true;
    };
    await window.renderChoDuyetPanel();
    window.goiNutChoDuyetPanel();
    const hang = document.querySelector('.approval-row');
    hang
      .querySelector('.approval-reject-toggle')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const oLyDo = hang.querySelector('.approval-reason');
    expect(oLyDo).toBeTruthy();
    oLyDo.value = 'ngắn';
    hang
      .querySelector('.approval-reject-confirm')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(window.__daGoi()).toHaveLength(0);
    expect(daHoi).toBe(0); // lý do chưa đủ thì chưa hỏi tới bước xác nhận xoá
    oLyDo.value = 'Thiếu chứng từ quyết toán, đề nghị bổ sung hồ sơ đầy đủ';
    hang
      .querySelector('.approval-reject-confirm')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(daHoi).toBe(1);
    const daGoi = window.__daGoi();
    expect(daGoi.length).toBe(1);
    expect(daGoi[0].path).toBe('/api/v1/approvals/work/CV004/reject');
    expect(daGoi[0].body).toEqual({
      reason: 'Thiếu chứng từ quyết toán, đề nghị bổ sung hồ sơ đầy đủ',
    });
  });

  it('Từ chối: bấm Huỷ ở bước hỏi lại ⇒ KHÔNG gọi REST (012 — xoá không lấy lại được)', async () => {
    window.__vaoVai('Quản trị Hệ thống', 'admin');
    window.__duLieuChoDuyet([ITEM_WORK]);
    window.__batPost();
    window.confirm = () => false;
    await window.renderChoDuyetPanel();
    window.goiNutChoDuyetPanel();
    const hang = document.querySelector('.approval-row');
    hang
      .querySelector('.approval-reject-toggle')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    hang.querySelector('.approval-reason').value = 'Trùng với công việc đã có trong kế hoạch';
    hang
      .querySelector('.approval-reject-confirm')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(window.__daGoi()).toHaveLength(0);
  });

  it('người KHÔNG phải người duyệt (Nhân viên): panel bị ẩn', async () => {
    window.__vaoVai('Nguyễn Văn An', 'Nhân viên');
    window.__duLieuChoDuyet([ITEM_WORK]);
    await window.renderChoDuyetPanel();
    expect(document.getElementById('approvals-panel').classList.contains('hidden')).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------
// Khung «YÊU CẦU XOÁ chờ duyệt» (013, Vòng 13 đợt 2) — danh sách RIÊNG với «Chờ duyệt» nội dung:
// dòng có nhãn đỏ, hai nút Đồng ý xoá/Từ chối xoá; Đồng ý xoá PHẢI qua confirm vì mất thật cả cây,
// còn Từ chối xoá KHÔNG bắt buộc lý do vì không làm mất gì.
// ------------------------------------------------------------------------------------------
const XOA_ITEM = {
  kind: 'item',
  id: 9,
  code: 'CV004-09',
  name: 'Nhiệm vụ <b>trùng</b>',
  level: 3,
  work_name: 'Quyết toán chi phí đào tạo quý 3',
  xoa_yeu_cau_ten: 'Nguyễn Văn Cán Bộ',
  xoa_ly_do: 'Nhập trùng hai lần',
};

describe('khung «Yêu cầu XOÁ chờ duyệt» (013)', () => {
  it('builder dòng yêu cầu xoá: nhãn đỏ, đủ người xin/lý do, 2 nút, escape tên', () => {
    const html = window.buildPendingDeleteRowHtml(XOA_ITEM);
    expect(html).toContain('approval-delete-row');
    expect(html).toContain('bg-red-100');
    expect(html).toContain('&lt;b&gt;trùng&lt;/b&gt;');
    expect(html).not.toContain('<b>');
    expect(html).toContain('Nhập trùng hai lần');
    expect(html).toContain('Nguyễn Văn Cán Bộ');
    expect(html).toContain('delete-approve');
    expect(html).toContain('delete-reject');
    expect(html).toContain('data-entity="work-item"');
    expect(html).toContain('data-id="CV004-09"');
  });

  it('panel nạp khung xoá riêng: ẩn khi rỗng, hiện + đếm khi có yêu cầu', async () => {
    window.__vaoVai('Phó GĐ Một', 'Phó Giám đốc');
    window.__duLieuTheoDuong({
      '/api/v1/approvals/pending': { items: [], total: 0 },
      '/api/v1/approvals/pending-deletes': { items: [XOA_ITEM], total: 1 },
    });
    await window.renderChoDuyetPanel();
    expect(document.getElementById('approvals-delete-box').classList.contains('hidden')).toBe(
      false
    );
    expect(document.querySelectorAll('.approval-delete-row').length).toBe(1);
    expect(document.getElementById('approvals-delete-count').textContent).toBe('1');
  });

  it('Đồng ý xoá phải qua confirm; Huỷ ⇒ KHÔNG gọi REST; OK ⇒ POST /approve-delete', async () => {
    window.__vaoVai('Phó GĐ Một', 'Phó Giám đốc');
    window.__duLieuTheoDuong({
      '/api/v1/approvals/pending': { items: [], total: 0 },
      '/api/v1/approvals/pending-deletes': { items: [XOA_ITEM], total: 1 },
    });
    window.__batPost();
    let daHoi = 0;
    window.confirm = () => {
      daHoi += 1;
      return false;
    };
    await window.renderChoDuyetPanel();
    window.goiNutChoDuyetPanel();
    const nut = document.querySelector('.delete-approve');
    nut.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    expect(daHoi).toBe(1);
    expect(window.__daGoi()).toHaveLength(0); // Huỷ ⇒ mục còn nguyên, không gọi gì
    window.confirm = () => true;
    nut.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    const daGoi = window.__daGoi();
    expect(daGoi.length).toBe(1);
    expect(daGoi[0].path).toBe('/api/v1/approvals/work-item/CV004-09/approve-delete');
  });

  it('Từ chối xoá: lý do KHÔNG bắt buộc ⇒ POST /reject-delete kèm body reason', async () => {
    window.__vaoVai('Quản trị Hệ thống', 'admin');
    window.__duLieuTheoDuong({
      '/api/v1/approvals/pending': { items: [], total: 0 },
      '/api/v1/approvals/pending-deletes': { items: [XOA_ITEM], total: 1 },
    });
    window.__batPost();
    await window.renderChoDuyetPanel();
    window.goiNutChoDuyetPanel();
    const hang = document.querySelector('.approval-delete-row');
    hang.querySelector('.delete-reject').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const box = hang.querySelector('.delete-reject-box');
    expect(box.classList.contains('hidden')).toBe(false);
    hang.querySelector('.delete-reject-reason').value = 'Vẫn cần cho báo cáo quý';
    hang
      .querySelector('.delete-reject-confirm')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
    const daGoi = window.__daGoi();
    expect(daGoi.length).toBe(1);
    expect(daGoi[0].path).toBe('/api/v1/approvals/work-item/CV004-09/reject-delete');
    expect(daGoi[0].body).toEqual({ reason: 'Vẫn cần cho báo cáo quý' });
  });
});

// MỚI-3 + MỚI-4 (2026-09-12) — phần HÌNH DÁNG nằm trọn ở app.css, không có dòng JS nào gác được.
// Pin thẳng vào CSS theo lệ của `tasks-results-design.test.js`: Tailwind của dự án là bản biên dịch
// ĐÓNG BĂNG nên class tuỳ ý không tồn tại, và app.css nạp SAU tailwind.min.css — ai dời cỡ chữ sang
// class Tailwind là luật chết lặng lẽ, chỉ bộ pin này bắt được.
describe('MỚI-3 + MỚI-4 — hình dáng trong app.css', () => {
  const css = readFileSync(resolve(process.cwd(), '../web/assets/css/app.css'), 'utf8');
  const luat = (selector) => {
    const i = css.indexOf(selector);
    if (i < 0) return null;
    const open = css.indexOf('{', i);
    return css.slice(open + 1, css.indexOf('}', open));
  };

  it('MỚI-4: bốn nút duyệt bé lại — luật phải phủ CẢ BA class dòng và thắng bằng ĐẶC HIỆU', () => {
    // Ba builder ba class dòng; thiếu một là bảng đó lạc lõng nút to cạnh nút bé.
    expect(css).toContain('.approval-row button,');
    expect(css).toContain('.approval-delete-row button,');
    const than = luat('.approval-row button,\n.approval-delete-row button,\n.change-row button');
    expect(than).not.toBeNull();
    expect(than).toContain('font-size: 11px');
    expect(than).toContain('padding: 3px 9px');
    // `min-height: 24px` chứ không phải 0: giữ nút bấm được và đủ chỗ cho vòng xoay `.loading::after`.
    expect(than).toContain('min-height: 24px');
    // KHÔNG `!important`: `.approval-row button` (0,1,1) đã thắng `.btn-primary` (0,1,0). Thêm
    // `!important` là giấu đi cái luật trật tự nạp CSS đã trả giá, người sau không hiểu vì sao.
    expect(than).not.toContain('!important');
    // Icon trong nút còn bé hơn chữ một nấc.
    expect(css).toContain('.approval-row button i,');
    expect(luat('.change-row button i')).toContain('font-size: 10px');
  });

  it('MỚI-3: cỡ chữ nhãn nằm ở app.css — KHÔNG dùng class arbitrary Tailwind', () => {
    const than = luat('.duyet-nhan {');
    expect(than).not.toBeNull();
    expect(than).toContain('font-size: 11px');
    // `tailwind.min.css` đóng băng (commit db382d0) KHÔNG CÓ class arbitrary dạng `text-[11px]`:
    // gắn vào thì chip render 16px chứ không phải 11px như tên class hứa — đúng lỗi của chip cũ.
    // app.js hãy còn MƯỜI MỘT chỗ `text-[11px]` nợ từ trước, ngoài phạm vi đợt này nên KHÔNG pin cả
    // file; chỉ pin đúng hai nơi MỚI-3 sinh ra: bảng màu `NHAN_DUYET` và mọi chuỗi class `duyet-nhan`.
    expect(Object.keys(window.NHAN_DUYET).length).toBe(3);
    for (const cfg of Object.values(window.NHAN_DUYET)) expect(cfg.mau).not.toMatch(/text-\[/);
    const cacNhan = APP_SRC.match(/duyet-nhan[^"'`]*/g) || [];
    expect(cacNhan.length).toBeGreaterThan(0);
    for (const cls of cacNhan) expect(cls).not.toMatch(/text-\[/);
    // Hai nhãn gom thành MỘT cụm: chỉ nhãn SAU bị kéo về trái. Bản nháp đầu đặt `margin-right` âm cho
    // mọi nhãn nên dính luôn khe từ nhãn cuối tới tên đầu việc, cụm thành không ra cụm.
    expect(css).toContain('.duyet-nhan + .duyet-nhan { margin-left: -4px; }');
    expect(css).not.toContain('.duyet-nhan { margin-right: -4px');
  });

  it('MỚI-3: popup «Xem các thay đổi» trả về bề ngang 760px của khung gốc', () => {
    // `.yk-dialog > section` bóp còn 620px; id thắng class nên không cần `!important`.
    expect(css).toContain('#thay-doi-cho-duyet-dialog > section { width: min(760px, 100%); }');
    // Chiều cao và cuộn thì khung gốc đã lo (`max-height:90vh` + `.qlcv-dialog-content{overflow:auto}`);
    // đặt thêm ở đây là hai luật giằng nhau trên cùng một hộp.
    expect(css).not.toContain('#thay-doi-cho-duyet-dialog .yk-noi-dung');
  });

  it('MỚI-3: mọi class Tailwind của nhãn phải CÓ THẬT trong bản đóng băng', () => {
    // Đây chính là cái lưới mà chip cũ thiếu: nó hứa `text-[11px]` mà `tailwind.min.css` (artifact
    // đóng băng ở commit db382d0, KHÔNG build lại) không có luật đó, nên chip lặng lẽ render 16px.
    // Class không tồn tại thì không có lỗi nào báo — chỉ màu biến mất. Tra bằng dạng ESCAPE THẬT
    // `.tên{`: selector trong file min có backslash cho ký tự đặc biệt nên grep theo biểu thức chính
    // quy dễ cho kết quả âm tính giả.
    const tailwind = readFileSync(
      resolve(process.cwd(), '../web/assets/vendor/tailwind/tailwind.min.css'),
      'utf8'
    );
    const mau = Object.values(window.NHAN_DUYET).flatMap((cfg) => cfg.mau.split(/\s+/));
    const doiTuong = ['bg-gray-100', 'text-gray-600'];
    // Nhãn «Đổi tỷ lệ» / «Gửi BLĐ» của `buildChangeApprovalRowHtml` — cũng do đợt này dựng lại.
    const deNghi = ['bg-amber-100', 'text-amber-700'];
    expect(mau.length).toBeGreaterThan(0);
    for (const cls of [...mau, ...doiTuong, ...deNghi]) {
      expect(tailwind, `thiếu class ${cls}`).toContain(`.${cls}{`);
    }
  });
});
