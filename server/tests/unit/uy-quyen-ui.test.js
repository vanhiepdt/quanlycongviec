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
  ngayVN, laCuaToi, showUyQuyenError, docCookieCsrf, buildUyQuyenNut, buildUyQuyenPhamVi,
  taoUyQuyen,
  __uq: (ten, giaTri) => { ({
    currentUser: () => { currentUser = giaTri; },
    allStaff: () => { allStaff = giaTri; },
    allDepartments: () => { allDepartments = giaTri; },
    uyQuyenNhan: () => { uyQuyenNhan = giaTri; },
    restGhi: () => { restGhi = giaTri; },
    showToast: () => { showToast = giaTri; },
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

describe('TC-UQ-16: trạng thái «Chờ phê duyệt» và hai nút của người NHẬN (§13.4 mục 20)', () => {
  const cho = (over = {}) => ban({ status: 'pending', dang_hieu_luc: false, ...over });

  it('người nhận thấy «Chờ phê duyệt» + nút Đồng ý/Từ chối, KHÔNG có nút huỷ', () => {
    const html = window.buildUyQuyenRow(cho(), false);
    expect(html).toContain('Chờ phê duyệt');
    expect(html).toContain('class="uy-quyen-dong-y');
    expect(html).toContain('class="uy-quyen-tu-choi');
    expect(html).toContain('data-id="7"');
    expect(html).not.toContain('uy-quyen-huy');
  });

  it('người ủy quyền thấy nút «Rút lại» (cùng đường huỷ) và KHÔNG bấm hộ được hai nút kia', () => {
    const html = window.buildUyQuyenRow(cho(), true);
    expect(html).toContain('class="uy-quyen-huy');
    expect(html).toContain('Rút lại');
    expect(html).not.toContain('uy-quyen-dong-y');
    expect(html).not.toContain('uy-quyen-tu-choi');
  });

  it('bản đã hiệu lực thì người nhận không còn nút trả lời nữa (đã trả lời rồi)', () => {
    const html = window.buildUyQuyenRow(ban(), false);
    expect(html).toContain('Đang hiệu lực');
    expect(html).not.toContain('uy-quyen-dong-y');
    expect(html).not.toContain('uy-quyen-tu-choi');
  });

  it('bản bị từ chối: nhãn «Đã từ chối», không nút nào ở cả hai chiều', () => {
    for (const laGiao of [true, false]) {
      const html = window.buildUyQuyenRow(
        ban({ status: 'declined', dang_hieu_luc: false }),
        laGiao
      );
      expect(html).toContain('Đã từ chối');
      expect(html).not.toContain('<button');
    }
  });

  it('hai nút mới cũng thoát `data-nguoi`, và nhãn nút không dựng được thẻ', () => {
    window.__uq('allDepartments', [{ 'ID phòng (DB)': 11, 'Tên phòng': DON }]);
    const html = window.buildUyQuyenRow(cho({ from_user_name: DON, note: DON }), false);
    expect(html).not.toContain('<img src=x');
    // Năm chỗ: tên người, tên phòng, ghi chú, và `data-nguoi` của HAI nút trả lời.
    expect(html.split('&lt;img src=x onerror=alert(1)&gt;').length - 1).toBe(5);
  });

  it('buildUyQuyenNut: id và tên đều nằm trong dấu bao thuộc tính đã thoát', () => {
    const html = window.buildUyQuyenNut(
      'uy-quyen-dong-y',
      'text-green-700',
      'fa-check',
      'Đồng ý',
      '7" onclick="alert(1)',
      'A" onmouseover="alert(1)'
    );
    expect(html).toContain('data-id="7&quot; onclick=&quot;alert(1)"');
    expect(html).toContain('data-nguoi="A&quot; onmouseover=&quot;alert(1)"');
    expect(html).not.toMatch(/onclick="alert\(1\)"/);
  });
});

// §13.4 mục 18 — «giám đốc có thể ủy quyền cho phó giám đốc». Máy chủ BẮT Giám đốc liệt kê phòng
// (`DELEGATION_ADMIN_SCOPE_REQUIRED`), nên nếu form không có ô chọn phòng thì Giám đốc không tạo
// được bản nào từ giao diện — đúng cái lỗi bộ test này canh.
describe('TC-UQ-18: ô chọn phòng của form ủy quyền chỉ dành cho Giám đốc', () => {
  const PHONG = [
    { 'ID phòng (DB)': 11, 'Tên phòng': 'Phòng Kỹ thuật' },
    { 'ID phòng (DB)': 12, 'Tên phòng': 'Phòng Kế hoạch' },
  ];

  it('vai thường KHÔNG thấy ô phòng — phạm vi để máy chủ suy ra từ phòng đang phụ trách', () => {
    window.__uq('allDepartments', PHONG);
    expect(window.buildUyQuyenPhamVi()).toBe('');
    expect(window.createUyQuyenModal([], [])).not.toContain('name="departmentIds"');
  });

  it('Giám đốc thấy ô chọn nhiều phòng, mỗi phòng một option mang id thật', () => {
    window.__uq('currentUser', { id: 1, name: 'Giám đốc', role: 'admin' });
    window.__uq('allDepartments', PHONG);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = window.createUyQuyenModal([], []);
    const select = wrapper.querySelector('select[name="departmentIds"]');
    expect(select).not.toBeNull();
    expect(select.multiple).toBe(true);
    expect(select.required).toBe(true);
    expect([...select.options].map((o) => [o.value, o.textContent])).toEqual([
      ['11', 'Phòng Kỹ thuật'],
      ['12', 'Phòng Kế hoạch'],
    ]);
  });

  it('phòng máy chủ không gửi id thì bỏ hẳn, không sinh option value rỗng', () => {
    window.__uq('currentUser', { id: 1, role: 'admin' });
    window.__uq('allDepartments', [{ 'Tên phòng': 'Phòng thiếu id' }, ...PHONG]);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = window.buildUyQuyenPhamVi();
    expect([...wrapper.querySelectorAll('option')].map((o) => o.value)).toEqual(['11', '12']);
  });

  it('tên phòng có mã tấn công vẫn là chữ, không dựng được thẻ', () => {
    window.__uq('currentUser', { id: 1, role: 'admin' });
    window.__uq('allDepartments', [{ 'ID phòng (DB)': `11" onfocus="alert(1)`, 'Tên phòng': DON }]);
    const html = window.buildUyQuyenPhamVi();
    expect(html).toContain('value="11&quot; onfocus=&quot;alert(1)"');
    expect(html).not.toContain('<img src=x');
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    expect(wrapper.querySelectorAll('img').length).toBe(0);
  });
});

describe('TC-UQ-18b: taoUyQuyen gửi phạm vi phòng lên máy chủ', () => {
  /** Dựng form thật trong DOM rồi thay `restGhi` bằng ống ghi lại thân yêu cầu. */
  function moForm(vai) {
    window.__uq('currentUser', { id: 1, name: 'Người tạo', role: vai });
    window.__uq('allDepartments', [
      { 'ID phòng (DB)': 11, 'Tên phòng': 'Phòng Kỹ thuật' },
      { 'ID phòng (DB)': 12, 'Tên phòng': 'Phòng Kế hoạch' },
    ]);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = window.createUyQuyenModal([], []);
    document.body.appendChild(wrapper.firstElementChild);
    const goi = [];
    // Trả `ok:false` để hàm dừng ngay sau lời gọi: mọi nhánh sau đó (toast, nạp lại danh sách)
    // đều gọi mạng, mà bộ test này chỉ hỏi "thân yêu cầu có đúng không".
    window.__uq('restGhi', (method, path, body) => {
      goi.push({ method, path, body });
      return Promise.resolve({ ok: false, error: 'dừng ở đây' });
    });
    const form = document.getElementById('uy-quyen-form');
    form.querySelector('[name="to"]').value = 'pgd@congty.vn';
    form.querySelector('[name="fromDate"]').value = '2026-09-01';
    form.querySelector('[name="toDate"]').value = '2026-09-10';
    return { form, goi };
  }

  it('Giám đốc chọn hai phòng ⇒ thân có departmentIds là mảng SỐ', async () => {
    const { form, goi } = moForm('admin');
    form.querySelector('option[value="11"]').selected = true;
    form.querySelector('option[value="12"]').selected = true;
    await window.taoUyQuyen();
    expect(goi.length).toBe(1);
    expect(goi[0].method).toBe('POST');
    expect(goi[0].path).toBe('/api/v1/delegations');
    expect(goi[0].body.departmentIds).toEqual([11, 12]);
    expect(goi[0].body.toUserId).toBe('pgd@congty.vn');
  });

  it('Giám đốc quên chọn phòng ⇒ chặn ngay, KHÔNG gọi máy chủ', async () => {
    const { goi } = moForm('admin');
    await window.taoUyQuyen();
    expect(goi.length).toBe(0);
    expect(document.getElementById('uy-quyen-error').textContent).toContain('phải ghi rõ');
  });

  it('vai thường: không có ô phòng nên KHÔNG gửi khoá departmentIds', async () => {
    const { goi } = moForm('Trưởng phòng');
    await window.taoUyQuyen();
    expect(goi.length).toBe(1);
    expect('departmentIds' in goi[0].body).toBe(false);
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
