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

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL, buildPendingApprovalRowHtml, buildPendingDeleteRowHtml, renderChoDuyetPanel,
  renderYeuCauXoaPanel, goiNutChoDuyetPanel,
  __vaoVai: (ten, vai) => {
    isAuthenticated = true;
    currentUser = { name: ten, role: vai, id: 9 };
  },
  __duLieuChoDuyet: (items) => {
    restGet = async () => ({ items, total: items.length });
  },
  __duLieuTheoDuong: (map) => {
    restGet = async (path) => map[path] ?? { items: [], total: 0 };
  },
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
  new Function(APP_SRC + EXPORTS)();
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
