// @vitest-environment jsdom
//
// Vòng giao diện phân công lần 3 (yêu cầu 2026-08-26), cập nhật 2026-09-09:
//   • nhãn ô gán người trong form nhiệm vụ hiển thị «Người thực hiện trực tiếp»;
//   • danh sách ứng viên lấy role «Nhân viên» + «Trưởng phòng» + «Phó phòng» — ẩn Phó GĐ/admin,
//     vì hai vai đó thuộc lớp «Ban lãnh đạo phụ trách» riêng (§0.1);
//   • Trưởng/Phó phòng CHỈ hiện khi phòng của công việc đang chọn CÓ Phó Giám đốc phụ trách —
//     không có thì kết quả họ nộp lên không ai duyệt được (máy chủ chặn bằng
//     `ASSIGNEE_LEADER_NO_DEPUTY`, giao diện đừng đưa ra lựa chọn chắc chắn bị từ chối);
//   • option của hai vai lãnh đạo kèm vai trong NGOẶC, của Cán bộ thì không;
//   • option hiển thị CHỈ họ tên, KHÔNG ghép email;
//   • tên trường dữ liệu GIỮ NGUYÊN: <select name="assignee">, value = tên người.
// Test chạy app.js THẬT trong jsdom (mẫu dept-select.test.js / project-form-phan-cong.test.js).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QUYEN_UI } from '../helpers/uiPermissions.js';
const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8') + QUYEN_UI;
const EXPORTS = `;Object.assign(window, {
  COL,
  createTaskModal,
  taoFormThemNhiemVu: () => {
    pendingTaskCreate = null;
    return createTaskModal(false, null);
  },
  datNhanSu: (ds) => { allStaff = ds; },
  datCongViec: (ds) => { allProjects = ds; },
  dangNhap: (ten, vai) => {
    isAuthenticated = true;
    currentUser = { name: ten, role: vai, department_id: 1 };
    allDepartments = [{ [COL.D_DB_ID]: 1, [COL.D_NAME]: "Phòng A" }];
  },
});`;

// Mọi createTaskModal đều lập timer, kể cả ca chỉ phân tích HTML bằng DOMParser.
// Không để timer thật của ca trước mở khoá ô của ca sau khi full suite chạy chậm.
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function khoiDong() {
  new Function(APP_SRC + EXPORTS)();
}

/** Dữ liệu người dùng mẫu — khoá legacy lấy TỪ COL sau khi app.js đã chạy. */
function nhansu(C) {
  return [
    {
      [C.S_ID]: 'NV001',
      [C.S_NAME]: 'Nguyễn Văn An',
      [C.S_ROLE]: 'Nhân viên',
      [C.S_EMAIL]: 'an@test.local',
      [C.S_OBJECT_TYPE]: 'Người dùng',
    },
    {
      [C.S_ID]: 'NV002',
      [C.S_NAME]: 'Trần Thị Bình',
      [C.S_ROLE]: 'Nhân viên',
      [C.S_EMAIL]: 'binh@test.local',
      [C.S_OBJECT_TYPE]: 'Người dùng',
    },
    {
      [C.S_ID]: 'LD001',
      [C.S_NAME]: 'Lê Trưởng Phòng',
      [C.S_ROLE]: 'Trưởng phòng',
      [C.S_EMAIL]: 'letp@test.local',
      [C.S_OBJECT_TYPE]: 'Người dùng',
    },
    {
      [C.S_ID]: 'LD002',
      [C.S_NAME]: 'Phạm Phó Phòng',
      [C.S_ROLE]: 'Phó phòng',
      [C.S_EMAIL]: 'phampp@test.local',
      [C.S_OBJECT_TYPE]: 'Người dùng',
    },
    {
      [C.S_ID]: 'GD002',
      [C.S_NAME]: 'Hoàng Phó GĐ',
      [C.S_ROLE]: 'Phó Giám đốc',
      [C.S_EMAIL]: 'hoangpgd@test.local',
      [C.S_OBJECT_TYPE]: 'Người dùng',
    },
  ].map((u) => ({ ...u, [C.S_DEPT]: 'Phòng A' }));
}

const CONG_VIEC_MAU = (C) => [
  {
    [C.P_ID]: 'CV001',
    [C.P_NAME]: 'Ra mắt cổng thông tin',
    [C.P_DEPT]: 'Phòng A',
    [C.P_DEPT_ID]: 1,
    [C.P_START]: '2026-01-05',
    [C.P_END]: '2026-12-31',
    // Người mở form ở case «lãnh đạo phòng» chính là quản lý công việc này — đủ điều kiện thấy
    // toàn bộ danh sách ứng viên của phòng trước khi lọc theo ba vai được làm trực tiếp.
    [C.P_MANAGER]: 'Lê Trưởng Phòng',
  },
];

/** Dựng form với vai đăng nhập tuỳ ý rồi trả về thẻ <select> gán người. */
function moOForm(ten, vai) {
  const C = window.COL;
  window.datNhanSu(nhansu(C));
  window.datCongViec(CONG_VIEC_MAU(C));
  window.dangNhap(ten, vai);
  const html = window.taoFormThemNhiemVu();
  const tai = new DOMParser().parseFromString(html, 'text/html');
  const oGan = tai.querySelector('select[name="assignee"]');
  if (!oGan)
    throw new Error(
      'form nhiệm vụ thiếu <select name="assignee"> — trường dữ liệu phải giữ nguyên'
    );
  return { tai, oGan };
}

function moOFormTrongDom(ten, vai, task = null, coPhoGiamDoc = true) {
  const C = window.COL;
  window.datNhanSu(nhansu(C));
  window.datCongViec(CONG_VIEC_MAU(C));
  window.dangNhap(ten, vai);
  giapUngVien(coPhoGiamDoc);
  const html = task ? window.createTaskModal(true, task) : window.taoFormThemNhiemVu();
  document.body.innerHTML = html;
  const oGan = document.querySelector('select[name="assignee"]');
  if (!oGan) throw new Error('form trong DOM thiếu select[name="assignee"]');
  return oGan;
}

/**
 * Giả lập `GET /api/v1/departments/assignment-options`.
 *
 * Ô người thực hiện đọc MỘT cờ trong phản hồi đó — `coPhoGiamDocPhuTrach` — để quyết có hiện
 * Trưởng/Phó phòng hay không. `restGet` lấy `json.data`, nên bọc đúng hình dạng đó.
 */
function giapUngVien(coPhoGiamDoc) {
  const duLieu = {
    data: {
      supervisors: [],
      leaders: [],
      lanhDaoLamTrucTiep: [],
      coPhoGiamDocPhuTrach: coPhoGiamDoc === true,
    },
  };
  // Không dùng `async` — không có gì để await, và eslint `require-await` bắt đúng điều đó.
  window.fetch = vi.fn(() =>
    Promise.resolve({ status: 200, ok: true, json: () => Promise.resolve(duLieu) })
  );
}

const NHIEM_VU_MAU = (C, assignee) => ({
  [C.T_ID]: 'CV001-002',
  [C.T_NAME]: 'Nhiệm vụ thử',
  [C.T_PID]: 'CV001',
  [C.T_ASSIGNEE]: assignee,
  [C.T_LEVEL]: 3,
  [C.T_START]: '2026-01-05',
  [C.T_DUE]: '2026-12-31',
});

describe('form nhiệm vụ — nhãn «Người thực hiện trực tiếp» và danh sách ứng viên', () => {
  beforeEach(() => {
    khoiDong();
  });

  it('nhãn hiển thị là «Người thực hiện trực tiếp», trường dữ liệu vẫn name="assignee"', () => {
    const { tai, oGan } = moOForm('Quản trị Hệ thống', 'admin');
    const nhan = oGan.closest('.form-group')?.querySelector('label');
    expect(nhan && nhan.textContent).toBe('Người thực hiện trực tiếp');
    // Ô bắt buộc chọn (2026-09-09, mục 3 của đợt 8b): nhãn phải mang dấu sao như các ô required.
    expect(nhan.classList.contains('required')).toBe(true);
    // Nhãn cũ không được sót lại ở bất kỳ đâu trong form.
    expect(tai.querySelector('#task-modal').textContent).not.toContain('Cán bộ trực tiếp');
    expect(tai.querySelector('#task-modal')).toBeTruthy();
  });

  it('admin: thấy Cán bộ + Trưởng/Phó phòng — Phó GĐ vẫn bị ẩn', () => {
    const { oGan } = moOForm('Quản trị Hệ thống', 'admin');
    const giaTri = Array.from(oGan.options).map((o) => o.value);
    expect(giaTri).toContain('Nguyễn Văn An');
    expect(giaTri).toContain('Trần Thị Bình');
    // 2026-09-09: hai vai lãnh đạo phòng nay nhận việc trực tiếp được.
    expect(giaTri).toContain('Lê Trưởng Phòng');
    expect(giaTri).toContain('Phạm Phó Phòng');
    // Phó GĐ thuộc ô «Ban lãnh đạo phụ trách», không lẫn xuống đây.
    expect(giaTri).not.toContain('Hoàng Phó GĐ');
  });

  it('option của Trưởng/Phó phòng kèm vai trong NGOẶC, của Cán bộ thì không', () => {
    const { oGan } = moOForm('Quản trị Hệ thống', 'admin');
    const nhan = (ten) => Array.from(oGan.options).find((o) => o.value === ten)?.textContent;
    expect(nhan('Lê Trưởng Phòng')).toBe('Lê Trưởng Phòng (Trưởng phòng)');
    expect(nhan('Phạm Phó Phòng')).toBe('Phạm Phó Phòng (Phó phòng)');
    expect(nhan('Nguyễn Văn An')).toBe('Nguyễn Văn An');
    // value vẫn là TÊN trơn — luồng lưu/sửa đối chiếu theo tên, có nhãn trong value là vỡ.
    expect(Array.from(oGan.options).every((o) => !o.value.includes('('))).toBe(true);
  });

  it('option chỉ hiện HỌ TÊN — không có ký tự "@" (đã bỏ phần email)', () => {
    const { oGan } = moOForm('Quản trị Hệ thống', 'admin');
    for (const o of Array.from(oGan.options)) {
      expect(o.textContent.includes('@'), `option "${o.textContent}" không được chứa email`).toBe(
        false
      );
      expect(o.value.includes('@')).toBe(false);
    }
  });

  it('lãnh đạo phòng mở form: thấy cán bộ cùng phòng VÀ Phó phòng cùng phòng, không thấy Phó GĐ', () => {
    const { oGan } = moOForm('Lê Trưởng Phòng', 'Trưởng phòng');
    const giaTri = Array.from(oGan.options).map((o) => o.value);
    expect(giaTri).toEqual(expect.arrayContaining(['Nguyễn Văn An']));
    // Quyết định 2026-09-09: TP/PP CÙNG PHÒNG gán được cho nhau (và cho chính mình).
    expect(giaTri).toContain('Lê Trưởng Phòng');
    expect(giaTri).toContain('Phạm Phó Phòng');
    expect(giaTri).not.toContain('Hoàng Phó GĐ');
  });

  it('phòng CHƯA có Phó GĐ phụ trách: Trưởng/Phó phòng bị cắt, Cán bộ giữ nguyên', async () => {
    try {
      const oGan = moOFormTrongDom('Quản trị Hệ thống', 'admin', null, false);
      // HTML dựng lần đầu chưa biết phòng có Phó GĐ hay không (phải hỏi máy chủ) ⇒ vẫn còn đủ;
      // sau khi `assignment-options` về thì vẽ lại.
      await vi.advanceTimersByTimeAsync(300);
      const giaTri = Array.from(oGan.options).map((o) => o.value);
      expect(giaTri).toContain('Nguyễn Văn An');
      expect(giaTri).toContain('Trần Thị Bình');
      expect(giaTri).not.toContain('Lê Trưởng Phòng');
      expect(giaTri).not.toContain('Phạm Phó Phòng');
    } finally {
      document.body.innerHTML = '';
    }
  });

  it('phòng CÓ Phó GĐ phụ trách: giữ Trưởng/Phó phòng trong danh sách', async () => {
    try {
      const oGan = moOFormTrongDom('Quản trị Hệ thống', 'admin');
      await vi.advanceTimersByTimeAsync(300);
      const giaTri = Array.from(oGan.options).map((o) => o.value);
      expect(giaTri).toContain('Lê Trưởng Phòng');
      expect(giaTri).toContain('Phạm Phó Phòng');
      expect(giaTri).not.toContain('Hoàng Phó GĐ');
    } finally {
      document.body.innerHTML = '';
    }
  });

  it('vẽ lại danh sách KHÔNG làm mất người đang chọn nếu người đó vẫn hợp lệ', async () => {
    try {
      const C = window.COL;
      const oGan = moOFormTrongDom(
        'Quản trị Hệ thống',
        'admin',
        NHIEM_VU_MAU(C, 'Lê Trưởng Phòng')
      );
      await vi.advanceTimersByTimeAsync(300);
      expect(oGan.value).toBe('Lê Trưởng Phòng');
    } finally {
      document.body.innerHTML = '';
    }
  });

  it('người đang chọn là Trưởng phòng mà phòng mất Phó GĐ ⇒ trả về rỗng, không âm thầm đổi người', async () => {
    try {
      const C = window.COL;
      const oGan = moOFormTrongDom(
        'Quản trị Hệ thống',
        'admin',
        NHIEM_VU_MAU(C, 'Lê Trưởng Phòng'),
        false
      );
      await vi.advanceTimersByTimeAsync(300);
      expect(oGan.value).toBe('');
    } finally {
      document.body.innerHTML = '';
    }
  });

  it.each([
    ['Trưởng phòng', 'Lê Trưởng Phòng'],
    ['Phó phòng', 'Phạm Phó Phòng'],
  ])(
    'tạo mới: %s được chọn Người thực hiện trực tiếp sau khi timer phân quyền chạy',
    async (_vai, ten) => {
      try {
        const oGan = moOFormTrongDom(ten, _vai);
        await vi.advanceTimersByTimeAsync(300);
        expect(oGan.disabled).toBe(false);
        expect(oGan.value).toBe('');
      } finally {
        document.body.innerHTML = '';
      }
    }
  );

  it('Trưởng phòng chỉnh sửa nhiệm vụ của người khác vẫn đổi được Người thực hiện', async () => {
    try {
      const C = window.COL;
      const oGan = moOFormTrongDom(
        'Lê Trưởng Phòng',
        'Trưởng phòng',
        NHIEM_VU_MAU(C, 'Nguyễn Văn An')
      );
      await vi.advanceTimersByTimeAsync(300);
      expect(oGan.disabled).toBe(false);
      expect(oGan.value).toBe('Nguyễn Văn An');
    } finally {
      document.body.innerHTML = '';
    }
  });

  it('admin vẫn đổi được Người thực hiện sau timer', async () => {
    try {
      const C = window.COL;
      const oGan = moOFormTrongDom('Quản trị Hệ thống', 'admin', NHIEM_VU_MAU(C, 'Nguyễn Văn An'));
      await vi.advanceTimersByTimeAsync(300);
      expect(oGan.disabled).toBe(false);
    } finally {
      document.body.innerHTML = '';
    }
  });

  it('cán bộ tự sửa nhiệm vụ của mình vẫn bị khóa ô Người thực hiện', async () => {
    try {
      const C = window.COL;
      const oGan = moOFormTrongDom('Nguyễn Văn An', 'Nhân viên', NHIEM_VU_MAU(C, 'Nguyễn Văn An'));
      await vi.advanceTimersByTimeAsync(300);
      expect(oGan.disabled).toBe(true);
      expect(oGan.value).toBe('Nguyễn Văn An');
    } finally {
      document.body.innerHTML = '';
    }
  });
});

// Chân form TẠO (2026-09-05). Người dùng báo: bấm ⋯/Hành động rồi tạo xong không biết mình vừa
// «lưu tạm» hay «gửi đi duyệt» — vì thanh tiêu đề còn một nút submit KHÔNG mang cờ ý định nào,
// bấm vào là tạo bằng mặc định của máy chủ. Nhóm này chốt: ở chế độ TẠO chỉ còn ĐÚNG hai nút
// submit, mỗi nút mang đúng một cờ; ở chế độ SỬA nút «Cập nhật» ở thanh tiêu đề phải còn.
describe('chân form tạo — chỉ «Lưu tạm» và «Gửi đi duyệt», mỗi nút một cờ', () => {
  beforeEach(() => {
    khoiDong();
  });

  /** Dựng form TẠO nhiệm vụ (hoặc SỬA nếu truyền task) rồi trả về tài liệu đã phân tích. */
  function taiLieuForm(task = null) {
    const C = window.COL;
    window.datNhanSu(nhansu(C));
    window.datCongViec(CONG_VIEC_MAU(C));
    window.dangNhap('Quản trị Hệ thống', 'admin');
    const html = task ? window.createTaskModal(true, task) : window.taoFormThemNhiemVu();
    return new DOMParser().parseFromString(html, 'text/html');
  }

  it('TẠO: đúng 2 nút submit — data-nhap và data-gui-duyet, không nút submit trần', () => {
    const tai = taiLieuForm();
    const nut = Array.from(tai.querySelectorAll('button[type="submit"]'));
    expect(nut).toHaveLength(2);
    expect(nut.filter((b) => b.hasAttribute('data-nhap'))).toHaveLength(1);
    expect(nut.filter((b) => b.hasAttribute('data-gui-duyet'))).toHaveLength(1);
    // Không nút submit nào thiếu cả hai cờ: openModal đọc event.submitter để biết ý định.
    expect(
      nut.filter((b) => !b.hasAttribute('data-nhap') && !b.hasAttribute('data-gui-duyet'))
    ).toHaveLength(0);
    // Một nút không được mang cả hai cờ (luuNhap và guiDuyet loại trừ nhau).
    expect(
      nut.filter((b) => b.hasAttribute('data-nhap') && b.hasAttribute('data-gui-duyet'))
    ).toHaveLength(0);
  });

  it('TẠO: chân form dính đáy, có «Hủy» đóng modal, nhãn tiếng Việt đúng', () => {
    const tai = taiLieuForm();
    const chan = tai.querySelector('.chan-form-tao');
    expect(chan).not.toBeNull();
    expect(chan.className).toContain('sticky');
    expect(chan.className).toContain('bottom-0');
    // «Hủy» là type=button + close-modal: không được submit form khi người dùng muốn bỏ.
    const huy = chan.querySelector('button.close-modal');
    expect(huy).not.toBeNull();
    expect(huy.getAttribute('type')).toBe('button');
    expect(huy.textContent.trim()).toBe('Hủy');
    expect(chan.querySelector('button[data-nhap]').textContent).toContain('Lưu tạm');
    expect(chan.querySelector('button[data-gui-duyet]').textContent).toContain('Gửi đi duyệt');
    // Ba nút cùng nằm trong chân form — không còn nút submit nào lạc lên thanh tiêu đề.
    expect(chan.querySelectorAll('button[type="submit"]')).toHaveLength(2);
    expect(tai.querySelectorAll('form button[type="submit"]')).toHaveLength(2);
  });

  it('SỬA: giữ nút «Cập nhật» ở thanh tiêu đề, KHÔNG có chân form tạo', () => {
    const C = window.COL;
    const tai = taiLieuForm(NHIEM_VU_MAU(C, 'Nguyễn Văn An'));
    expect(tai.querySelector('.chan-form-tao')).toBeNull();
    const nut = Array.from(tai.querySelectorAll('button[type="submit"]'));
    expect(nut).toHaveLength(1);
    expect(nut[0].textContent).toContain('Cập nhật');
    // Chế độ sửa không có cờ ý định: handleEdit không đọc submitter.
    expect(nut[0].hasAttribute('data-nhap')).toBe(false);
    expect(nut[0].hasAttribute('data-gui-duyet')).toBe(false);
  });
});
