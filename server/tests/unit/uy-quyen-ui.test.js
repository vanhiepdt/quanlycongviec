// @vitest-environment jsdom
//
// TC-UQ-15 — modal «Ủy quyền của tôi» + nhãn «đang được ủy quyền» (§6 `docs/KE-HOACH-UY-QUYEN.md`).
//
// Ba câu hỏi:
//   1. Bảng có chia ĐÚNG hai chiều? Chia theo `id` của phiên, không theo họ tên — hai người trùng
//      tên là chuyện thường ở đơn vị đông người, mà chia sai chiều thì hiện nút «Huỷ» cho bản ghi
//      của người khác.
//   2. Mọi giá trị có qua hàm thoát? Tên người, tên phòng, ghi chú đều là chữ người dùng gõ.
//   3. Nhãn cạnh tên người dùng chỉ sáng khi TÔI ĐANG NHẬN ủy quyền còn hiệu lực, và tooltip nói rõ
//      mượn quyền của ai đến ngày nào.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL, buildUyQuyenRow, buildUyQuyenBang, createUyQuyenModal, veNhanUyQuyen, tenPhongTheoIds,
  ngayVN, laCuaToi, showUyQuyenError, docCookieCsrf,
  __uq: (ten, giaTri) => { ({
    currentUser: () => { currentUser = giaTri; },
    allStaff: () => { allStaff = giaTri; },
    allDepartments: () => { allDepartments = giaTri; },
    uyQuyenNhan: () => { uyQuyenNhan = giaTri; },
  })[ten](); }
});`;

const DON = '<img src=x onerror=alert(1)>';

/** Một dòng ủy quyền như máy chủ trả (`repo.listForUser`). */
function ban(over = {}) {
  return {
    id: 7,
    from_user_id: 200,
    to_user_id: 300,
    from_user_name: 'Phạm Phó Giám Đốc',
    to_user_name: 'Trần Thị Nhân Viên',
    department_ids: [11],
    from_date: '2026-08-27',
    to_date: '2026-09-07',
    status: 'active',
    note: 'đi công tác',
    dang_hieu_luc: true,
    ...over,
  };
}

beforeEach(() => {
  document.body.innerHTML = '<span id="uy-quyen-badge" class="hidden"></span>';
  new Function(APP_SRC + EXPORTS)();
  window.__uq('currentUser', { id: 300, name: 'Trần Thị Nhân Viên', role: 'Nhân viên' });
  window.__uq('allStaff', []);
  window.__uq('allDepartments', [{ 'ID phòng (DB)': 11, 'Tên phòng': 'Phòng Kỹ thuật' }]);
  window.__uq('uyQuyenNhan', []);
});

describe('TC-UQ-15a: hai chiều của bảng chia theo id, không theo tên', () => {
  it('người nhận thấy dòng ở phần «tôi nhận» và KHÔNG có nút huỷ', () => {
    const html = window.buildUyQuyenBang([ban()], false);
    expect(html).toContain('Phạm Phó Giám Đốc'); // cột hiện NGƯỜI ỦY QUYỀN
    expect(html).toContain('Người ủy quyền');
    expect(html).not.toContain('uy-quyen-huy');
  });

  it('người ủy quyền thấy dòng ở phần «tôi giao» và CÓ nút huỷ mang data-id', () => {
    const html = window.buildUyQuyenBang([ban()], true);
    expect(html).toContain('Người nhận');
    expect(html).toContain('Trần Thị Nhân Viên');
    expect(html).toContain('class="uy-quyen-huy');
    expect(html).toContain('data-id="7"');
  });

  it('bản đã huỷ không còn nút huỷ, và nhãn trạng thái nói đúng ba trạng thái', () => {
    expect(
      window.buildUyQuyenRow(ban({ status: 'cancelled', dang_hieu_luc: false }), true)
    ).not.toContain('uy-quyen-huy');
    expect(
      window.buildUyQuyenRow(ban({ status: 'cancelled', dang_hieu_luc: false }), true)
    ).toContain('Đã huỷ');
    expect(window.buildUyQuyenRow(ban(), true)).toContain('Đang hiệu lực');
    expect(window.buildUyQuyenRow(ban({ dang_hieu_luc: false }), true)).toContain(
      'Chưa/hết hiệu lực'
    );
  });

  it('laCuaToi so theo id của phiên: người TRÙNG TÊN nhưng khác id không nhận nhầm bản ghi', () => {
    window.__uq('currentUser', { id: 999, name: 'Trần Thị Nhân Viên' });
    expect(window.laCuaToi(ban(), 'to_user_id')).toBe(false);
    window.__uq('currentUser', { id: '300', name: 'Ai Đó Khác' }); // id dạng chuỗi vẫn khớp
    expect(window.laCuaToi(ban(), 'to_user_id')).toBe(true);
  });

  it('bảng rỗng nói rõ là rỗng, khác nhau theo chiều', () => {
    expect(window.buildUyQuyenBang([], true)).toContain('Bạn chưa ủy quyền cho ai.');
    expect(window.buildUyQuyenBang([], false)).toContain('Chưa ai ủy quyền cho bạn.');
    expect(window.buildUyQuyenBang([], true)).not.toContain('<table');
  });
});

describe('TC-UQ-15b: mọi giá trị đi qua hàm thoát', () => {
  it('tên người, ghi chú và tên phòng có mã tấn công đều bị vô hiệu', () => {
    window.__uq('allDepartments', [{ 'ID phòng (DB)': 11, 'Tên phòng': DON }]);
    const html = window.buildUyQuyenRow(ban({ to_user_name: DON, note: DON }), true);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('onerror=alert(1)>');
    // Bốn chỗ, không phải ba: tên người hiện ở cả ô tên VÀ `data-nguoi` của nút huỷ, cộng tên
    // phòng và ghi chú. Đếm để không chỗ nào lọt — và để lần sau thêm cột thì con số này đỏ.
    expect(html.split('&lt;img src=x onerror=alert(1)&gt;').length - 1).toBe(4);
  });

  it('data-nguoi của nút huỷ cũng thoát (giá trị nằm trong dấu bao thuộc tính)', () => {
    const html = window.buildUyQuyenRow(ban({ to_user_name: 'A" onmouseover="alert(1)' }), true);
    expect(html).toContain('data-nguoi="A&quot; onmouseover=&quot;alert(1)"');
    expect(html).not.toMatch(/data-nguoi="A" onmouseover=/);
  });

  it('câu lỗi của MÁY CHỦ cũng thoát — chuỗi từ máy chủ vẫn là chuỗi ngoài', () => {
    document.body.innerHTML += '<div id="uy-quyen-error" class="hidden"></div>';
    window.showUyQuyenError(DON);
    const el = document.getElementById('uy-quyen-error');
    expect(el.classList.contains('hidden')).toBe(false);
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain(DON);
    window.showUyQuyenError('');
    expect(el.classList.contains('hidden')).toBe(true);
    expect(el.innerHTML).toBe('');
  });

  it('modal đầy đủ: có tiêu đề, ô ngày kiểu date, nút huỷ, và không có mã tấn công nào sống', () => {
    const html = window.createUyQuyenModal(
      [ban({ to_user_name: DON })],
      [ban({ from_user_name: DON })]
    );
    expect(html).toContain('id="uy-quyen-modal"');
    expect(html).toContain('id="uy-quyen-form"');
    expect(html).toContain('fa-user-shield');
    expect(html).toContain('Tôi ủy quyền cho');
    expect(html).toContain('Tôi được ủy quyền');
    // Hai ô ngày dùng `<input type="date">` để gửi lên đúng YYYY-MM-DD (§6).
    expect(html.match(/<input type="date"/g).length).toBe(2);
    expect(html).toMatch(/name="fromDate"/);
    expect(html).toMatch(/name="toDate"/);
    expect(html).not.toContain('<img src=x');
    // Dựng thật trong DOM: không có thẻ img nào sinh ra từ dữ liệu.
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    expect(wrapper.querySelectorAll('img').length).toBe(0);
  });
});

describe('TC-UQ-15c: nhãn «đang được ủy quyền» cạnh tên người dùng', () => {
  const nhan = () => document.getElementById('uy-quyen-badge');

  it('không nhận ủy quyền nào thì nhãn vẫn ẩn và không có tooltip', () => {
    window.veNhanUyQuyen();
    expect(nhan().classList.contains('hidden')).toBe(true);
    expect(nhan().getAttribute('title')).toBeNull();
  });

  it('đang nhận thì nhãn hiện, tooltip nói rõ mượn quyền của ai đến ngày nào (dd/mm/yyyy)', () => {
    window.__uq('uyQuyenNhan', [ban()]);
    window.veNhanUyQuyen();
    expect(nhan().classList.contains('hidden')).toBe(false);
    expect(nhan().textContent).toBe('đang được ủy quyền');
    expect(nhan().getAttribute('title')).toBe(
      'Bạn đang dùng quyền của Phạm Phó Giám Đốc đến 07/09/2026'
    );
  });

  it('nhận từ nhiều người: mỗi bản một dòng tooltip', () => {
    window.__uq('uyQuyenNhan', [
      ban(),
      ban({ id: 8, from_user_name: 'Lê Trưởng Phòng', to_date: '2026-09-30' }),
    ]);
    window.veNhanUyQuyen();
    expect(nhan().getAttribute('title').split('\n').length).toBe(2);
    expect(nhan().getAttribute('title')).toContain('Lê Trưởng Phòng đến 30/09/2026');
  });

  it('tooltip là textContent của thuộc tính title — mã tấn công trong tên không dựng được thẻ', () => {
    window.__uq('uyQuyenNhan', [ban({ from_user_name: DON })]);
    window.veNhanUyQuyen();
    expect(nhan().getAttribute('title')).toContain(DON); // nằm trong title, không phải HTML
    expect(document.querySelectorAll('img').length).toBe(0);
  });
});

describe('TC-UQ-15d: hai hàm phụ mà cả khối dựa vào', () => {
  it('tenPhongTheoIds: rỗng = «tất cả phòng tôi phụ trách»; id lạ hiện #id chứ không im lặng', () => {
    expect(window.tenPhongTheoIds([])).toBe('Tất cả phòng tôi phụ trách');
    expect(window.tenPhongTheoIds(null)).toBe('Tất cả phòng tôi phụ trách');
    expect(window.tenPhongTheoIds([11])).toBe('Phòng Kỹ thuật');
    expect(window.tenPhongTheoIds([11, 99])).toBe('Phòng Kỹ thuật, #99');
  });

  it('ngayVN: `YYYY-MM-DD` → `dd/mm/yyyy`; chuỗi lạ trả nguyên văn, không đoán', () => {
    expect(window.ngayVN('2026-09-07')).toBe('07/09/2026');
    expect(window.ngayVN('')).toBe('');
    expect(window.ngayVN(null)).toBe('');
    expect(window.ngayVN('hôm nay')).toBe('hôm nay');
  });

  it('docCookieCsrf: đọc đúng cookie có đuôi `_csrf`, bỏ qua cookie khác', () => {
    document.cookie = 'qlcv_sid=abc';
    document.cookie = 'qlcv_sid_csrf=mot-hai-ba';
    expect(window.docCookieCsrf()).toBe('mot-hai-ba');
  });
});
