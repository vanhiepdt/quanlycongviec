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
  COL, buildThanhTabNhatKy, buildKhungNhatKy, buildKhoiFile, buildYKienPanel, batTatKetQua,
  buildBangLuongFile, buildNutVerdictFile, buildBanFileList, giaTriHieuLucFile,
  coTheNopFile, uploadKetQua, guiYKien, xuLyVerdictFile, createTaskModal,
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
  __tfDs: (v) => { dsBat = v; },
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

describe('TCKQ — khối «Kết quả» nằm trong tab Thông tin (Vòng 14续2)', () => {
  const APP = APP_SRC;

  it('TCKQ-01: modal NHIỆM VỤ có container danh sách file sau nhãn «Kết quả»; hết «Link kết quả»', () => {
    // Tạo nhiệm vụ ở chế độ sửa — chuỗi form phải chứa container + nhãn đã đổi.
    const form = window.createTaskModal(true, {
      'Mã nhiệm vụ': 'CV001-002',
      'Tên nhiệm vụ': 'Nhiệm vụ thử',
      'Link kết quả': '',
      'Kết quả đầu ra': '',
    });
    expect(form).toContain('task-ket-qua-danh-sach');
    expect(form).toContain('Kết quả</label>');
    expect(form).not.toContain('Link kết quả</label>');
    // Modal CÔNG VIỆC không có khối file.
    expect(APP).toContain('task-ket-qua-danh-sach');
  });

  it('TCKQ-02: tab «Kết quả & Luồng» đã gỡ — thanh tab chỉ còn Thông tin/Nhật ký/Tên theo tháng', () => {
    const thanh = window.buildThanhTabNhatKy('task', false);
    expect(thanh).not.toContain('tab-ket-qua');
    expect(window.buildKhungNhatKy('task', 'CV001-002')).not.toContain('task-ket-qua-panel');
    expect(APP).not.toContain('buildKhungKetQua');
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

  it('TCKQ-03b: mỗi file MỘT DÒNG — data-file + CHỮ «Xem ý kiến» + nút Lịch sử; khung chi tiết ẩn', () => {
    const dong = window.buildKhoiFile(
      NHOM({
        gopY: [
          {
            id: 5,
            version_id: 11,
            ten_nguoi: 'TP',
            vai: 'Trưởng phòng',
            noi_dung: 'x',
            created_at: '2026-09-01T10:05:00Z',
          },
        ],
      }),
      'CV001-002'
    );
    expect(dong).toContain('data-file="7"');
    expect(dong).toContain('>Xem ý kiến (1)</button>');
    expect(dong).toContain('>Lịch sử</button>');
    expect(dong).toContain("batTatKetQua('7', 'yk')");
    expect(dong).toContain("batTatKetQua('7', 'ls')");
    expect(dong).toContain('id="task-kq-yk-7"');
    expect(dong).toContain('id="task-kq-ls-7"');
    expect(dong).toContain('class="hidden mt-2 border-t border-gray-50 pt-2"');
  });

  it('TCKQ-16: batTatKetQua ẩn/hiện khung ý kiến và lịch sử (toggle class hidden)', () => {
    document.body.innerHTML =
      '<div id="task-kq-yk-7" class="hidden"></div><div id="task-kq-ls-7" class="hidden"></div>';
    window.batTatKetQua(7, 'yk');
    expect(document.getElementById('task-kq-yk-7').classList.contains('hidden')).toBe(false);
    window.batTatKetQua(7, 'yk');
    expect(document.getElementById('task-kq-yk-7').classList.contains('hidden')).toBe(true);
    window.batTatKetQua(7, 'ls');
    expect(document.getElementById('task-kq-ls-7').classList.contains('hidden')).toBe(false);
  });

  it('TCKQ-17: ✎ sửa trực tuyến (ONLYOFFICE) CHỈ hiện khi máy chủ đã cấu hình DS', () => {
    window.__tfDs(true);
    const co = window.buildKhoiFile(NHOM(), 'CV001-002');
    expect(co).toContain('/api/v1/task-file-versions/11/editor');
    expect(co).toContain('Sửa trực tuyến (ONLYOFFICE)');
    window.__tfDs(false);
    const khong = window.buildKhoiFile(NHOM(), 'CV001-002');
    expect(khong).not.toContain('/editor');
  });

  it('TCKQ-18: panel ý kiến — label gắn bản mới nhất + data-ban-cuoi + Gửi ý kiến', () => {
    const panel = window.buildYKienPanel(NHOM(), 'CV001-002');
    expect(panel).toContain('Ý kiến cho bản 1');
    expect(panel).toContain('id="task-y-kien-7"');
    expect(panel).toContain('data-ban-cuoi="11"');
    expect(panel).toContain("guiYKien('7', 'CV001-002')");
    expect(panel).toContain('Gửi ý kiến');
    expect(panel).toContain('Chưa có ý kiến nào.');
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

  it('TCKQ-14: ô «Ý kiến» trong khối file — gắn bản mới nhất (data-ban-cuoi) + nút Gửi ý kiến', () => {
    window.__tf('allTasks', [
      { 'Mã nhiệm vụ': 'CV001-002', 'Người thực hiện': 'Nguyễn Văn Cán Bộ' },
    ]);
    const khoi = window.buildKhoiFile(NHOM(), 'CV001-002');
    expect(khoi).toContain('Ý kiến');
    expect(khoi).toContain('id="task-y-kien-7"');
    expect(khoi).toContain('data-ban-cuoi="11"');
    expect(khoi).toContain("guiYKien('7', 'CV001-002')");
    expect(khoi).toContain('Gửi ý kiến');
    // Nút ↩ góp ý theo bản đã gỡ — ô «Ý kiến» duy nhất ở khung trên.
    expect(khoi).not.toContain('↩ góp ý');
  });

  it('TCKQ-15: verdict đọc ô «Ý kiến» trước — đủ 10 ký tự thì KHÔNG hỏi lại bằng prompt', async () => {
    document.body.innerHTML =
      '<textarea id="task-y-kien-7">Bổ sung số liệu đối chiếu hai bảng giúp tôi</textarea>';
    let promptDaGoi = 0;
    window.prompt = () => {
      promptDaGoi += 1;
      return '';
    };
    window.fetch = () => Promise.reject(new Error('không được gọi'));
    await window.xuLyVerdictFile(7, 'yeu-cau-sua', true, 'CV001-002');
    expect(promptDaGoi).toBe(0);
  });
});
