// @vitest-environment jsdom
//
// CHUÔNG THÔNG BÁO phía TRÌNH DUYỆT (2026-09-06 — §13.4 mục 16, việc A của
// `docs/KE-HOACH-THONG-BAO.md`). Chạy app.js THẬT trong jsdom, `fetch` giả.
//
// Bốn điều bộ test này canh, đều là chỗ đã hỏng ở tính năng khác trước đây:
//   1. **Nội dung thông báo được thoát.** Nội dung do máy chủ dựng từ TÊN ĐẦU VIỆC người dùng gõ
//      («Nhiệm vụ "<tên>" đang chờ bạn duyệt»), nên nó là dữ liệu người dùng đi qua hai tầng —
//      đúng loại đường dễ bị bỏ escape nhất.
//   2. **Badge 0 thì ẩn hẳn**, không hiện số 0 (bẫy badge trắng-trên-trắng của Vòng 14续10 là ở
//      cùng chỗ này).
//   3. **Bấm dòng mở đúng mục** — `ref_id` là id CSDL, còn giao diện tra theo MÃ, nên phải dò lại.
//      Không dò ra thì KHÔNG bịa mã để mở.
//   4. **Vòng hỏi lại không chạy khi tab ẩn** — chat đang bỏ sót điều này, một tab để quên vẫn nã
//      request suốt ngày.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL, buildMotThongBao, buildDanhSachThongBao, capNhatBadgeThongBao, napThongBao,
  napSoThongBaoChuaDoc, danhDauThongBaoDaDoc, moThongBao, goiNutThongBao,
  batDauHoiLaiThongBao, dungHoiLaiThongBao, dinhDangGioThongBao, THONG_BAO_POLL_MS,
  datDangNhap: (v) => { isAuthenticated = v; },
  datDuLieu: (cv, nv) => { allProjects = cv; allTasks = nv; },
  datHamMo: (moCv, suaNv) => { showProjectDetailsModal = moCv; openEditModal = suaNv; },
});`;

/** Mỗi lần gọi trả phản hồi kế tiếp trong hàng đợi; ghi lại (method, path, body) để soi. */
function datFetch(hangDoi) {
  const daGoi = [];
  window.fetch = vi.fn((path, opt) => {
    daGoi.push({ path: String(path), method: (opt && opt.method) || 'GET', body: opt && opt.body });
    const item = hangDoi.shift();
    if (item === undefined)
      return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve(null) });
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true, data: item }),
    });
  });
  return daGoi;
}

const tb = (over = {}) => ({
  id: 7,
  content: 'Công việc "Hội nghị" đang chờ bạn duyệt',
  type: 'approval_pending',
  is_read: false,
  ref_type: '',
  ref_id: null,
  created_at: '2026-09-06T02:05:00.000Z',
  ...over,
});

beforeEach(() => {
  document.body.innerHTML = `
    <button id="thong-bao-nut"><span id="thong-bao-badge" class="hidden">0</span></button>
    <button id="thong-bao-doc-het"></button>
    <div id="thong-bao-danh-sach"></div>
    <div id="toast-container"></div>`;
  new Function(APP_SRC + EXPORTS)();
  window.datDangNhap(true);
  window.datDuLieu([], []);
});

describe('TC-TBUI-01: nội dung thông báo được thoát, không thành thẻ', () => {
  it('<img src=x onerror> trong nội dung hiện thành CHỮ', () => {
    const khung = document.getElementById('thong-bao-danh-sach');
    khung.innerHTML = window.buildDanhSachThongBao([
      tb({ content: 'Nhiệm vụ "<img src=x onerror=alert(1)>" chờ duyệt' }),
    ]);
    expect(khung.querySelectorAll('img')).toHaveLength(0);
    expect(khung.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(khung.innerHTML).toContain('&lt;img');
  });

  it('type lạ không làm vỡ dòng, và không nội suy thẳng vào lớp CSS', () => {
    const khung = document.getElementById('thong-bao-danh-sach');
    khung.innerHTML = window.buildDanhSachThongBao([tb({ type: 'loai-la" onload="alert(1)' })]);
    const nut = khung.querySelector('.tb-dong');
    expect(nut).not.toBeNull();
    expect(nut.getAttribute('onload')).toBeNull();
    // Khoá lạ ⇒ rơi về hình chuông xám, không để ô icon trống.
    expect(khung.querySelector('i.fas').className).toContain('fa-bell');
  });

  it('ref_id chứa dấu nháy không phá được thuộc tính data-*', () => {
    const khung = document.getElementById('thong-bao-danh-sach');
    khung.innerHTML = window.buildDanhSachThongBao([
      tb({ ref_type: 'work', ref_id: '5" data-mo="1' }),
    ]);
    const nut = khung.querySelector('.tb-dong');
    expect(nut.getAttribute('data-ref-id')).toBe('5" data-mo="1');
    expect(khung.querySelectorAll('.tb-dong')).toHaveLength(1);
  });
});

describe('TC-TBUI-02: danh sách rỗng và badge', () => {
  it('rỗng ⇒ nói rõ «Chưa có thông báo nào», không để hộp trắng', () => {
    expect(window.buildDanhSachThongBao([])).toContain('Chưa có thông báo nào');
    expect(window.buildDanhSachThongBao(null)).toContain('Chưa có thông báo nào');
  });

  it('badge 0 ⇒ ẩn hẳn; >0 ⇒ hiện số; >99 ⇒ «99+»', () => {
    const badge = document.getElementById('thong-bao-badge');
    window.capNhatBadgeThongBao(0);
    expect(badge.classList.contains('hidden')).toBe(true);
    window.capNhatBadgeThongBao(3);
    expect(badge.classList.contains('hidden')).toBe(false);
    expect(badge.textContent).toBe('3');
    window.capNhatBadgeThongBao(150);
    expect(badge.textContent).toBe('99+');
    window.capNhatBadgeThongBao(undefined);
    expect(badge.classList.contains('hidden')).toBe(true);
  });

  it('dòng chưa đọc đậm hơn dòng đã đọc và có dấu chấm xanh', () => {
    const khung = document.getElementById('thong-bao-danh-sach');
    khung.innerHTML = window.buildDanhSachThongBao([tb({ id: 1 }), tb({ id: 2, is_read: true })]);
    const dong = khung.querySelectorAll('.tb-dong');
    expect(dong[0].querySelector('p').className).toContain('font-semibold');
    expect(dong[1].querySelector('p').className).not.toContain('font-semibold');
    expect(dong[0].querySelector('span.bg-blue-500')).not.toBeNull();
    expect(dong[1].querySelector('span.bg-blue-500')).toBeNull();
  });
});

describe('TC-TBUI-03: napThongBao / đánh dấu đã đọc gọi đúng đường REST', () => {
  it('napThongBao gọi GET có limit, vẽ danh sách và đặt badge theo `unread` của máy chủ', async () => {
    const daGoi = datFetch([{ items: [tb(), tb({ id: 8, is_read: true })], unread: 1, total: 2 }]);
    const so = await window.napThongBao();
    expect(daGoi[0].path).toContain('/api/v1/notifications?limit=');
    expect(daGoi[0].method).toBe('GET');
    expect(so).toBe(1);
    expect(document.querySelectorAll('.tb-dong')).toHaveLength(2);
    expect(document.getElementById('thong-bao-badge').textContent).toBe('1');
  });

  it('mạng lỗi ⇒ KHÔNG xoá danh sách đang có, KHÔNG đổi badge (restGetIm im lặng)', async () => {
    datFetch([{ items: [tb()], unread: 1 }]);
    await window.napThongBao();
    datFetch([]); // lượt sau trả ok:false
    const so = await window.napThongBao();
    expect(so).toBe(0);
    expect(document.querySelectorAll('.tb-dong')).toHaveLength(1);
    expect(document.getElementById('thong-bao-badge').textContent).toBe('1');
  });

  it('napSoThongBaoChuaDoc chỉ gọi /unread-count, không nạp danh sách', async () => {
    const daGoi = datFetch([{ unread: 4 }]);
    await window.napSoThongBaoChuaDoc();
    expect(daGoi).toHaveLength(1);
    expect(daGoi[0].path).toContain('/api/v1/notifications/unread-count');
    expect(document.getElementById('thong-bao-badge').textContent).toBe('4');
    expect(document.querySelectorAll('.tb-dong')).toHaveLength(0);
  });

  it('«đọc hết» gửi PATCH với ids rỗng rồi nạp lại — không tự trừ số ở trình duyệt', async () => {
    // 1: GET /api/csrf (restGhi lấy token) · 2: PATCH read · 3: GET danh sách sau khi nạp lại
    const daGoi = datFetch([
      { csrfToken: 'x' },
      { changed: 3, unread: 0 },
      { items: [], unread: 0 },
    ]);
    window.goiNutThongBao();
    document.getElementById('thong-bao-doc-het').click();
    await vi.waitFor(() => expect(daGoi.length).toBeGreaterThanOrEqual(2));
    const patch = daGoi.find((g) => g.method === 'PATCH');
    expect(patch).toBeTruthy();
    expect(patch.path).toBe('/api/v1/notifications/read');
    expect(JSON.parse(patch.body)).toEqual({ ids: [] });
    await vi.waitFor(() =>
      expect(document.getElementById('thong-bao-badge').classList.contains('hidden')).toBe(true)
    );
  });
});

describe('TC-TBUI-04: bấm một dòng — đánh dấu đã đọc rồi mở đúng mục', () => {
  it('ref_type=work ⇒ mở modal chi tiết đúng MÃ công việc (dò từ id CSDL)', async () => {
    const C = window.COL;
    const moCv = vi.fn();
    window.datHamMo(moCv, vi.fn());
    window.datDuLieu([{ id: 12, [C.P_ID]: 'CV003', [C.P_NAME]: 'Hội nghị quý 3' }], []);
    datFetch([{ csrfToken: 'x' }, { changed: 1, unread: 0 }, { items: [], unread: 0 }]);
    document.getElementById('thong-bao-danh-sach').innerHTML = window.buildDanhSachThongBao([
      tb({ ref_type: 'work', ref_id: 12 }),
    ]);
    await window.moThongBao(document.querySelector('.tb-dong'));
    expect(moCv).toHaveBeenCalledWith('CV003', 'Hội nghị quý 3');
  });

  it('ref_type=work_item ⇒ mở form sửa đúng mã nhiệm vụ', async () => {
    const C = window.COL;
    const suaNv = vi.fn();
    window.datHamMo(vi.fn(), suaNv);
    window.datDuLieu([], [{ id: 44, [C.T_ID]: 'CV003-002', [C.T_NAME]: 'Đặt bàn ghế' }]);
    datFetch([{ csrfToken: 'x' }, { changed: 1, unread: 0 }, { items: [], unread: 0 }]);
    document.getElementById('thong-bao-danh-sach').innerHTML = window.buildDanhSachThongBao([
      tb({ ref_type: 'work_item', ref_id: 44 }),
    ]);
    await window.moThongBao(document.querySelector('.tb-dong'));
    expect(suaNv).toHaveBeenCalledWith('task', 'CV003-002');
  });

  it('không dò ra mục trong bộ nhớ ⇒ KHÔNG bịa mã để mở, chỉ báo tải lại trang', async () => {
    const moCv = vi.fn();
    window.datHamMo(moCv, vi.fn());
    window.datDuLieu([], []);
    datFetch([{ csrfToken: 'x' }, { changed: 1, unread: 0 }, { items: [], unread: 0 }]);
    document.getElementById('thong-bao-danh-sach').innerHTML = window.buildDanhSachThongBao([
      tb({ ref_type: 'work', ref_id: 999 }),
    ]);
    await window.moThongBao(document.querySelector('.tb-dong'));
    expect(moCv).not.toHaveBeenCalled();
  });

  it('thông báo KHÔNG có ref ⇒ chỉ đánh dấu đã đọc, không mở gì', async () => {
    const moCv = vi.fn();
    const suaNv = vi.fn();
    window.datHamMo(moCv, suaNv);
    const daGoi = datFetch([
      { csrfToken: 'x' },
      { changed: 1, unread: 0 },
      { items: [], unread: 0 },
    ]);
    document.getElementById('thong-bao-danh-sach').innerHTML = window.buildDanhSachThongBao([tb()]);
    const nut = document.querySelector('.tb-dong');
    expect(nut.getAttribute('data-mo')).toBe('');
    await window.moThongBao(nut);
    expect(moCv).not.toHaveBeenCalled();
    expect(suaNv).not.toHaveBeenCalled();
    expect(daGoi.some((g) => g.method === 'PATCH')).toBe(true);
  });
});

describe('TC-TBUI-05: vòng hỏi lại — 60 giây và CHỈ khi tab đang hiện', () => {
  it('tab ẩn ⇒ không gọi mạng lần nào; hiện lại ⇒ gọi /unread-count', () => {
    vi.useFakeTimers();
    try {
      const daGoi = datFetch([{ unread: 2 }, { unread: 2 }]);
      const doiTrangThai = (v) =>
        Object.defineProperty(document, 'visibilityState', { value: v, configurable: true });

      doiTrangThai('hidden');
      window.batDauHoiLaiThongBao();
      vi.advanceTimersByTime(window.THONG_BAO_POLL_MS * 3);
      expect(daGoi).toHaveLength(0);

      doiTrangThai('visible');
      vi.advanceTimersByTime(window.THONG_BAO_POLL_MS);
      expect(daGoi).toHaveLength(1);
      expect(daGoi[0].path).toContain('/unread-count');

      window.dungHoiLaiThongBao();
      vi.advanceTimersByTime(window.THONG_BAO_POLL_MS * 3);
      expect(daGoi).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('chưa đăng nhập ⇒ vòng hỏi lại không gọi mạng', () => {
    vi.useFakeTimers();
    try {
      const daGoi = datFetch([{ unread: 1 }]);
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      window.datDangNhap(false);
      window.batDauHoiLaiThongBao();
      vi.advanceTimersByTime(window.THONG_BAO_POLL_MS * 2);
      expect(daGoi).toHaveLength(0);
      window.dungHoiLaiThongBao();
    } finally {
      vi.useRealTimers();
    }
  });

  it('nhịp hỏi lại là 60 giây — thưa hơn chat 10 giây có chủ ý', () => {
    expect(window.THONG_BAO_POLL_MS).toBe(60000);
  });
});

describe('TC-TBUI-06: mốc thời gian đọc được, không phải ISO', () => {
  it('hôm nay / hôm qua / ngày cũ ra ba dạng khác nhau; giá trị rác ⇒ chuỗi rỗng', () => {
    const homNay = new Date();
    homNay.setHours(14, 5, 0, 0);
    expect(window.dinhDangGioThongBao(homNay.toISOString())).toBe('14:05 hôm nay');
    const homQua = new Date(homNay.getTime() - 86400000);
    expect(window.dinhDangGioThongBao(homQua.toISOString())).toContain('hôm qua');
    expect(window.dinhDangGioThongBao('2020-03-04T01:02:00.000Z')).toMatch(/\d{2}\/\d{2}\/2020$/);
    expect(window.dinhDangGioThongBao('không phải ngày')).toBe('');
    expect(window.dinhDangGioThongBao(null)).toBe('');
  });
});
