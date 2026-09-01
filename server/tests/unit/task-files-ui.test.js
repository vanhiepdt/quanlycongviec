// @vitest-environment jsdom
//
// TCKQ — tab «Kết quả & Luồng» trong modal nhiệm vụ (014, 2026-09-01). Chạy app.js THẬT trong
// jsdom, bốn điều test này canh:
//  1. Tab chỉ hiện ở modal NHIỆM VỤ (không đụng modal công việc) và khung render đủ khối.
//  2. Badge trạng thái đúng màu 5 mức; BẢNG LUỒNG đủ 5 cột, dòng «Tự động» hiện được.
//  3. Nút verdict ẩn/hiện THEO VAI + GIÁ TRỊ HIỆU LỰC (khớp giaTriHieuLuc máy chủ từng chữ):
//     TP có file:approve = ✓ ⇒ «Hoàn thành / Duyệt» hiện; admin đặt ⏳ ⇒ mất nút chốt.
//  4. Tên file chứa HTML phải thoát; chặn sai đuôi file ngay ở client (không gọi máy chủ).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL, buildThanhTabNhatKy, buildKhungNhatKy, buildKhungKetQua, buildKhoiFile,
  buildBangLuongFile, buildNutVerdictFile, buildBanFileList, giaTriHieuLucFile,
  coTheNopFile, uploadKetQua,
  __tf: (ten, giaTri) => {
    ({
      currentUser: () => { currentUser = giaTri; },
      allTasks: () => { allTasks = giaTri; },
    })[ten]();
  },
  __tfPq: (macDinh, ghiDe) => {
    phanQuyenFile.macDinh = macDinh;
    phanQuyenFile.ghiDe = ghiDe;
  },
});`;

function khoiDong() {
  document.body.innerHTML = `
    <div id="task-modal"></div>
    <div id="toast-container"></div>
    <input type="file" id="task-file-input" accept=".doc,.docx,.pdf" class="hidden">`;
  window.fetch = () => Promise.reject(new Error('KHONG DUOC GOI MAY CHU trong test UI nay'));
  window.confirm = () => true;
  window.prompt = () => 'nội dung đủ dài';
  new Function(APP_SRC + EXPORTS)();
  window.__tf('allTasks', []);
  window.__tf('currentUser', { name: 'Trần Thị Trưởng', role: 'Trưởng phòng', id: 2 });
  window.__tfPq(null, {});
}

const NHOM = (over = {}) => ({
  id: 7,
  item_id: 3,
  ten_goc: 'ket-qua-quy3.pdf',
  trang_thai: 'cho-xem',
  created_by: 4,
  ten_nguoi_tao: 'Nguyễn Văn Cán Bộ',
  bans: [
    {
      id: 11,
      file_id: 7,
      version_no: 1,
      ten_luu: 'v1-abc.pdf',
      ten_goc: 'ket-qua-quy3.pdf',
      loai_mime: 'application/pdf',
      kich_thuoc: 24,
      uploaded_by: 4,
      uploaded_at: '2026-09-01T10:00:00Z',
      ten_nguoi_nop: 'Nguyễn Văn Cán Bộ',
    },
  ],
  gopY: [],
  luong: [],
  ...over,
});

beforeEach(() => {
  khoiDong();
});

describe('TCKQ — khung và tab «Kết quả & Luồng»', () => {
  it('TCKQ-01: khung có id riêng + data-ma + chữ đang tải — cùng khuôn khung nhật ký', () => {
    const khung = window.buildKhungKetQua('CV001-002');
    expect(khung).toContain('id="task-ket-qua-panel"');
    expect(khung).toContain('id="task-ket-qua-noi-dung"');
    expect(khung).toContain('data-ma="CV001-002"');
    expect(khung).toContain('Đang tải kết quả…');
    expect(khung).toContain('class="hidden"');
  });

  it('TCKQ-02: nút tab «Kết quả & Luồng» CHỈ ở modal nhiệm vụ', () => {
    const thanhTask = window.buildThanhTabNhatKy('task', false);
    expect(thanhTask).toContain('task-tab-ket-qua');
    expect(thanhTask).toContain('Kết quả &amp; Luồng');
    const thanhProject = window.buildThanhTabNhatKy('project', false);
    expect(thanhProject).not.toContain('project-tab-ket-qua');
    // Khung cũng chỉ đính vào modal nhiệm vụ.
    expect(window.buildKhungNhatKy('task', 'CV001-002')).toContain('task-ket-qua-panel');
    expect(window.buildKhungNhatKy('project', 5)).not.toContain('project-ket-qua-panel');
  });

  it('TCKQ-03: badge 5 trạng thái đúng màu — da-duyet xanh đậm, cho-xem vàng, can-sua đỏ nhạt', () => {
    const choXem = window.buildKhoiFile(NHOM(), 'CV001-002');
    expect(choXem).toContain('bg-yellow-100 text-yellow-700');
    expect(choXem).toContain('Chờ TP/PP xem');
    const canSua = window.buildKhoiFile(NHOM({ trang_thai: 'can-sua' }), 'CV001-002');
    expect(canSua).toContain('bg-red-100 text-red-600');
    const choLanhDao = window.buildKhoiFile(NHOM({ trang_thai: 'cho-lanh-dao' }), 'CV001-002');
    expect(choLanhDao).toContain('bg-purple-100 text-purple-700');
    const hoanThanh = window.buildKhoiFile(NHOM({ trang_thai: 'hoan-thanh' }), 'CV001-002');
    expect(hoanThanh).toContain('bg-green-100 text-green-700');
    const daDuyet = window.buildKhoiFile(NHOM({ trang_thai: 'da-duyet' }), 'CV001-002');
    expect(daDuyet).toContain('bg-green-800 text-white');
    expect(daDuyet).toContain('Đã duyệt');
  });
});

describe('TCKQ — bảng luồng và danh sách bản', () => {
  const LUONG = [
    {
      id: 3,
      version_id: 11,
      hanh_dong: 'duyet-tu-dong',
      noi_dung: 'Tự động — phân quyền không yêu cầu duyệt',
      ten_nguoi: 'Nguyễn Văn Cán Bộ',
      vai: 'Nhân viên',
      version_no: 1,
      created_at: '2026-09-01T10:01:00Z',
    },
    {
      id: 1,
      version_id: 11,
      hanh_dong: 'nop',
      noi_dung: 'Bản đầu tiên',
      ten_nguoi: 'Nguyễn Văn Cán Bộ',
      vai: 'Nhân viên',
      version_no: 1,
      created_at: '2026-09-01T10:00:00Z',
    },
  ];

  it('TCKQ-04: bảng luồng đủ 5 cột, dòng «Tự động» hiện, mỗi dòng có người + vai + bản', () => {
    const bang = window.buildBangLuongFile(NHOM({ luong: LUONG }));
    for (const cot of ['Thời điểm', 'Người (vai)', 'Hành động', 'Bản', 'Nội dung']) {
      expect(bang).toContain(cot);
    }
    expect(bang).toContain('Tự động — phân quyền không yêu cầu duyệt');
    expect(bang).toContain('Phê duyệt tự động');
    expect(bang).toContain('Nguyễn Văn Cán Bộ');
    expect(bang).toContain('Nhân viên');
    expect(bang).toContain('bản 1');
    expect(bang).toContain('Bản đầu tiên');
    // Mới nhất trên đầu: dòng «Tự động» (id 3) phải đứng trước dòng «nop» (id 1).
    expect(bang.indexOf('Tự động — phân quyền không yêu cầu duyệt')).toBeLessThan(
      bang.indexOf('Bản đầu tiên')
    );
  });

  it('TCKQ-05: danh sách BẢN — v1 + người nộp + nút ⬇ tải và 👁 xem cho PDF', () => {
    const bans = window.buildBanFileList(NHOM(), 'CV001-002');
    expect(bans).toContain('bản 1');
    expect(bans).toContain('Nguyễn Văn Cán Bộ');
    expect(bans).toContain("taiFileKetQua('11')");
    expect(bans).toContain("xemFileKetQua('11')");
    // DOCX KHÔNG có nút xem (chỉ PDF xem bằng iframe).
    const docx = window.buildBanFileList(
      NHOM({ bans: [{ ...NHOM().bans[0], loai_mime: 'application/msword' }] }),
      'CV001-002'
    );
    expect(docx).not.toContain('xemFileKetQua');
    // Nhãn hiển thị KHÔNG kèm mã nhiệm vụ (quy ước Vòng 7) — mã chỉ được nằm trong onclick
    // (cần để nạp lại tab sau hành động).
    expect(bans.replace(/onclick="[^"]*"/g, '')).not.toContain('CV0');
  });
});

describe('TCKQ — nút verdict theo VAI + GIÁ TRỊ HIỆU LỰC', () => {
  it('TCKQ-06: TP có file:approve = ✓ (mặc định) ⇒ cả «Hoàn thành / Duyệt» lẫn «Trình Phó giám đốc»', () => {
    const nut = window.buildNutVerdictFile(NHOM(), 'CV001-002');
    expect(nut).toContain('Yêu cầu sửa');
    expect(nut).toContain('Trình Phó giám đốc');
    expect(nut).toContain('Hoàn thành / Duyệt');
    expect(nut).toContain('Đẩy về Cán bộ');
  });

  it('TCKQ-07: admin đặt ⏳ ở ô «Duyệt kết quả» của TP ⇒ MẤT nút «Hoàn thành / Duyệt», còn «Trình»', () => {
    window.__tfPq(null, {
      'file:approve': { 'Trưởng phòng': { gia_tri: 'cho-duyet', pham_vi: 'phong' } },
    });
    const nut = window.buildNutVerdictFile(NHOM(), 'CV001-002');
    expect(nut).not.toContain('Hoàn thành / Duyệt');
    expect(nut).toContain('Trình Phó giám đốc');
    expect(nut).toContain('Yêu cầu sửa');
  });

  it('TCKQ-08: PGD ở «cho-lanh-dao» thấy «Trả về TP/PP» + «Duyệt»; trạng thái khác thì không', () => {
    window.__tf('currentUser', { name: 'Lê Văn Phó', role: 'Phó Giám đốc', id: 3 });
    const nut = window.buildNutVerdictFile(NHOM({ trang_thai: 'cho-lanh-dao' }), 'CV001-002');
    expect(nut).toContain('Trả về TP/PP');
    expect(nut).toContain('>Duyệt<');
    const khongPhaiLuc = window.buildNutVerdictFile(NHOM({ trang_thai: 'cho-xem' }), 'CV001-002');
    expect(khongPhaiLuc).toBe('');
  });

  it('TCKQ-09: Cán bộ không có nút verdict nào; nộp được ở cho-xem, không ở cho-lanh-dao/da-duyet', () => {
    window.__tf('currentUser', { name: 'Nguyễn Văn Cán Bộ', role: 'Nhân viên', id: 4 });
    expect(window.buildNutVerdictFile(NHOM(), 'CV001-002')).toBe('');
    window.__tf('allTasks', [
      { 'Mã nhiệm vụ': 'CV001-002', 'Người thực hiện': 'Nguyễn Văn Cán Bộ' },
    ]);
    expect(window.coTheNopFile({ trang_thai: 'cho-xem' }, 'CV001-002')).toBe(true);
    expect(window.coTheNopFile({ trang_thai: 'cho-lanh-dao' }, 'CV001-002')).toBe(false);
    expect(window.coTheNopFile({ trang_thai: 'da-duyet' }, 'CV001-002')).toBe(false);
  });

  it('TCKQ-10: giaTriHieuLucFile khớp server — mặc định theo vai, ghi đè thắng, admin không chịu ghi đè', () => {
    expect(window.giaTriHieuLucFile('Nhân viên', 'create')).toBe('cho-duyet');
    expect(window.giaTriHieuLucFile('Phó Giám đốc', 'create')).toBe('cho-phep');
    expect(window.giaTriHieuLucFile('Phó Giám đốc', 'approve')).toBe('cho-phep');
    window.__tfPq(null, {
      'file:create': { 'Nhân viên': { gia_tri: 'cho-phep', pham_vi: 'phong' } },
    });
    expect(window.giaTriHieuLucFile('Nhân viên', 'create')).toBe('cho-phep');
    window.__tf('currentUser', { name: 'Admin', role: 'admin', id: 1 });
    window.__tfPq(null, { 'file:create': { admin: { gia_tri: 'tu-choi', pham_vi: 'phong' } } });
    expect(window.giaTriHieuLucFile('admin', 'create')).toBe('cho-phep');
  });
});

describe('TCKQ — escape và chặn phía client', () => {
  it('TCKQ-11: tên file chứa HTML phải thoát — không dựng được thẻ', () => {
    const khoi = window.buildKhoiFile(NHOM({ ten_goc: '<b>xấu</b>.pdf' }), 'CV001-002');
    expect(khoi).toContain('&lt;b&gt;xấu&lt;/b&gt;.pdf');
    expect(khoi).not.toContain('<b>xấu</b>');
  });

  it('TCKQ-12: nội dung góp ý chứa thẻ phải thoát', () => {
    const khoi = window.buildKhoiFile(
      NHOM({
        gopY: [
          {
            id: 5,
            version_id: 11,
            ten_nguoi: 'Trần Thị Trưởng',
            vai: 'Trưởng phòng',
            noi_dung: '<img src=x onerror=alert(1)>',
            created_at: '2026-09-01T10:05:00Z',
          },
        ],
      }),
      'CV001-002'
    );
    expect(khoi).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(khoi).not.toContain('<img src=x');
  });

  it('TCKQ-13: sai đuôi file bị chặn NGAY ở client — không gọi máy chủ', async () => {
    let fetchDaGoi = 0;
    window.fetch = () => {
      fetchDaGoi += 1;
      return Promise.reject(new Error('không được gọi'));
    };
    const file = new File(['MZ'], 'virus.exe', { type: 'application/octet-stream' });
    const input = document.getElementById('task-file-input');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await window.uploadKetQua(input);
    expect(fetchDaGoi).toBe(0);
  });
});
