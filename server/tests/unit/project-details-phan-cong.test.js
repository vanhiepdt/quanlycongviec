// @vitest-environment jsdom
//
// Vòng lần 3 (yêu cầu 2026-08-26) — modal CHI TIẾT CÔNG VIỆC trong web/assets/js/project-details.js:
//   • thông tin phân công của công việc lẫn từng công việc con gộp thành MỘT HÀNG flex
//     (container .phan-cong-hang với đúng 3 nhóm .phan-cong-nhom), không còn 3 ô xếp dọc;
//   • tên công việc con nằm trong KHUNG riêng .cv-con-tieu-de, tách bạch với danh sách nhiệm vụ;
//   • icon BÚT CHỈ (svg inline) trên từng khối công việc con — HIỂN THỊ THEO QUYỀN:
//     Quản trị hệ thống · Phó GĐ trong «Ban lãnh đạo kiểm soát» của CV con đó · lãnh đạo phòng
//     của CV con đó; người thường chỉ xem. Bấm nút mở form sửa (openEditModal "task").
// Chạy app.js THẬT + project-details.js THẬT trong jsdom (mẫu project-form-phan-cong.test.js).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const DETAILS_SRC = readFileSync(
  resolve(process.cwd(), '../web/assets/js/project-details.js'),
  'utf8'
);
const STUBS = `
;veLaiPhong = () => {};
loadDepartmentContext = () => {};
showToast = (thongDiep) => { window.__toastCuoi = String(thongDiep); };
`;
const EXPORTS = `;Object.assign(window, {
  COL,
  datDuLieu: (cv, tasks) => { allProjects = cv; allTasks = tasks; },
  dangNhapTen: (ten, vai) => {
    isAuthenticated = true;
    currentUser = { name: ten, role: vai };
  },
  moChiTiet: (id, ten) => {
    showProjectDetailsModal(id, ten);
    return document.getElementById('modals-container');
  },
});`;

/** Nạp app.js + project-details.js trong MỘT lời gọi (mọi biến chia sẻ cùng phạm vi hàm). */
function khoiDong() {
  new Function(APP_SRC + STUBS + DETAILS_SRC + EXPORTS)();
}

function duLieu(C) {
  const cv = [
    {
      [C.P_ID]: 'CV001',
      [C.P_NAME]: 'Chuẩn bị hội nghị',
      [C.P_START]: '2026-08-01',
      [C.P_END]: '2026-09-30',
      [C.P_MANAGER]: 'Ông Quản lý',
      [C.P_SUP]: 'Phó GĐ Một',
      [C.P_LEADERS]: 'Trưởng phòng A',
      [C.P_DEPT]: 'Phòng A',
      [C.P_STATUS]: 'Đang thực hiện',
      [C.P_COMPLETION]: 10,
    },
  ];
  const tasks = [
    {
      [C.T_ID]: 'CV001-01',
      [C.T_PID]: 'CV001',
      [C.T_LEVEL]: '2',
      [C.T_NAME]: 'Chuẩn bị hậu cần',
      [C.T_SUP]: 'Phó GĐ Một',
      [C.T_LEADERS]: 'Trưởng phòng A, Phó phòng A',
      [C.T_STATUS]: 'Đang thực hiện',
      [C.T_PRIORITY]: 'Trung bình',
      [C.T_COMPLETION]: '40',
      [C.T_ASSIGNEE]: 'Chưa gán',
      [C.T_START]: '2026-08-02',
      [C.T_DUE]: '2026-08-20',
      [C.T_PARENT]: '',
    },
    {
      [C.T_ID]: 'CV001-02',
      [C.T_PID]: 'CV001',
      [C.T_LEVEL]: '2',
      [C.T_NAME]: '<img src=x onerror=alert(1)>Tên có HTML',
      [C.T_SUP]: 'Phó GĐ Hai',
      [C.T_LEADERS]: 'Trưởng phòng B',
      [C.T_STATUS]: 'Chưa bắt đầu',
      [C.T_PRIORITY]: 'Thấp',
      [C.T_COMPLETION]: '0',
      [C.T_ASSIGNEE]: 'Chưa gán',
      [C.T_START]: '2026-08-05',
      [C.T_DUE]: '2026-09-01',
      [C.T_PARENT]: '',
    },
  ];
  return { cv, tasks: tasks.concat(nhiemVuCapBa(C)) };
}

function nhiemVuCapBa(C) {
  return [
    {
      [C.T_ID]: 'NV001',
      [C.T_PID]: 'CV001',
      [C.T_LEVEL]: '3',
      [C.T_PARENT]: 'CV001-01',
      [C.T_NAME]: 'Đặt bàn ghế',
      [C.T_SUP]: 'Phó GĐ Một',
      [C.T_LEADERS]: 'Trưởng phòng A',
      [C.T_ASSIGNEE]: 'Nguyễn Văn An',
      [C.T_STATUS]: 'Đang thực hiện',
      [C.T_PRIORITY]: 'Trung bình',
      [C.T_COMPLETION]: '30',
      [C.T_START]: '2026-08-03',
      [C.T_DUE]: '2026-08-10',
    },
    {
      [C.T_ID]: 'NV002',
      [C.T_PID]: 'CV001',
      [C.T_LEVEL]: '3',
      [C.T_PARENT]: 'CV001-01',
      [C.T_NAME]: 'In bảng tên',
      [C.T_SUP]: 'Phó GĐ Một',
      [C.T_LEADERS]: 'Trưởng phòng A',
      [C.T_ASSIGNEE]: 'Trần Thị Bình',
      [C.T_STATUS]: 'Chưa bắt đầu',
      [C.T_PRIORITY]: 'Thấp',
      [C.T_COMPLETION]: '0',
      [C.T_START]: '2026-08-04',
      [C.T_DUE]: '2026-08-12',
    },
  ];
}

/** Vào vai một người rồi mở modal chi tiết; trả về vùng chứa DOM của modal. */
function vaiMoChiTiet(ten, vai) {
  const C = window.COL;
  const { cv, tasks } = duLieu(C);
  window.datDuLieu(cv, tasks);
  window.dangNhapTen(ten, vai);
  return window.moChiTiet('CV001', 'Chuẩn bị hội nghị');
}

describe('modal chi tiết — hàng phân công MỘT hàng + khung tên công việc con', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="modals-container"></div>';
    khoiDong();
  });

  it('khối «Phân công» của công việc là MỘT container flex với đúng 3 nhóm + 2 dấu chấm ngăn', () => {
    const goc = vaiMoChiTiet('Quản trị Hệ thống', 'admin');
    const hang = goc.querySelector('.phan-cong-hang');
    expect(hang && hang.classList.contains('flex')).toBe(true);
    expect(hang.classList.contains('flex-wrap')).toBe(true);
    const baNhom = Array.from(hang.children).filter((el) =>
      el.classList.contains('phan-cong-nhom')
    );
    expect(baNhom).toHaveLength(3);
    expect(hang.querySelectorAll('.phan-cong-cach')).toHaveLength(2);
    // Đúng thứ tự và nhãn quy định.
    expect(baNhom.map((n) => n.textContent)).toEqual([
      expect.stringContaining('Ban lãnh đạo kiểm soát'),
      expect.stringContaining('Lãnh đạo phòng phụ trách'),
      expect.stringContaining('Cán bộ thực hiện'),
    ]);
    // Cán bộ thực hiện gom từ nhiệm vụ ở các công việc con.
    expect(baNhom[2].textContent).toContain('Nguyễn Văn An');
    expect(baNhom[2].textContent).toContain('Trần Thị Bình');
  });

  it('mỗi công việc con cũng có hàng phân công riêng dạng 1 hàng 3 nhóm — hết kiểu 3 ô dọc', () => {
    const goc = vaiMoChiTiet('Quản trị Hệ thống', 'admin');
    const cacHang = goc.querySelectorAll('.phan-cong-hang');
    expect(cacHang.length).toBe(3); // 1 của công việc + 2 của hai công việc con
    for (const hang of cacHang) {
      const soNhom = Array.from(hang.children).filter((c) =>
        c.classList.contains('phan-cong-nhom')
      ).length;
      expect(soNhom).toBe(3);
    }
    // Không còn lưới xếp dọc cũ trong khối «Phân công».
    expect(goc.innerHTML.includes('grid-cols-1 sm:grid-cols-3')).toBe(false);
  });

  it('tên công việc con nằm trong KHUNG riêng .cv-con-tieu-de, nhiệm vụ ở NGOÀI khung', () => {
    const goc = vaiMoChiTiet('Quản trị Hệ thống', 'admin');
    const khungs = goc.querySelectorAll('.cv-con-tieu-de');
    expect(khungs.length).toBe(2);
    expect(khungs[0].textContent).toContain('Chuẩn bị hậu cần');
    // Danh sách nhiệm vụ KHÔNG nằm trong khung tiêu đề.
    const dsNv = goc.querySelector('#sw-tasks-CV001-01');
    expect(dsNv && khungs[0].contains(dsNv)).toBe(false);
  });

  it('tên công việc con mang HTML nguy hiểm vẫn chỉ là chữ (escape đúng, không sinh thẻ thật)', () => {
    const goc = vaiMoChiTiet('Quản trị Hệ thống', 'admin');
    expect(goc.querySelector('img')).toBeNull();
    const khungThuHai = goc.querySelectorAll('.cv-con-tieu-de')[1];
    expect(khungThuHai.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('icon bút chì sửa công việc con — hiển thị và hành động THEO QUYỀN', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="modals-container"></div>';
    khoiDong();
  });

  it('Quản trị hệ thống thấy icon ở CẢ HAI khối công việc con; icon là SVG inline tự vẽ', () => {
    const goc = vaiMoChiTiet('Quản trị Hệ thống', 'admin');
    const cacNut = goc.querySelectorAll('.edit-subwork-btn');
    expect(cacNut.length).toBe(2);
    for (const nut of cacNut) {
      expect(nut.querySelector('svg')).toBeTruthy();
      expect((nut.getAttribute('aria-label') || '').length).toBeGreaterThan(0);
    }
  });

  it('Phó GĐ nêu trong «Ban lãnh đạo kiểm soát» của CV con nào thì chỉ thấy icon CV con đó', () => {
    const goc = vaiMoChiTiet('Phó GĐ Một', 'Phó Giám đốc');
    const cacNut = goc.querySelectorAll('.edit-subwork-btn');
    expect(cacNut.length).toBe(1);
    const khoi = cacNut[0].closest('[class*="rounded-xl"]');
    expect(khoi && khoi.textContent).toContain('CV001-01');
  });

  it('lãnh đạo phòng của CV con thấy icon đúng CV con mình; người ngoài cuộc không thấy gì', () => {
    const gocTp = vaiMoChiTiet('Trưởng phòng A', 'Trưởng phòng');
    expect(gocTp.querySelectorAll('.edit-subwork-btn').length).toBe(1);
    const gocPp = vaiMoChiTiet('Phó phòng A', 'Phó phòng');
    expect(gocPp.querySelectorAll('.edit-subwork-btn').length).toBe(1);
    const gocNv = vaiMoChiTiet('Nguyễn Văn An', 'Nhân viên');
    expect(gocNv.querySelectorAll('.edit-subwork-btn').length).toBe(0);
  });

  it('bấm icon mở form SỬA nhiệm vụ/CV con đúng dòng dữ liệu (openEditModal chạy thật)', () => {
    const goc = vaiMoChiTiet('Quản trị Hệ thống', 'admin');
    const nut = goc.querySelectorAll('.edit-subwork-btn')[0];
    nut.click();
    const formEl = document.getElementById('task-modal');
    expect(formEl).toBeTruthy();
    const oMa = formEl.querySelector('input[name="id"]');
    expect(oMa && oMa.value).toBe('CV001-01');
  });
});
