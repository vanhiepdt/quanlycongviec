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
  buildDongChoDuyetKetQua, moTabChoDuyet, renderChoDuyetKetQua, xuLyVerdictChoDuyet,
  buildBangChoDuyetKetQua, buildHangCayChoDuyet, moChonFileChoDuyet, veTrangThaiUpload,
  khoaPhanCongVoiNhanVien,
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
    <input type="file" id="task-file-input" class="hidden"
      accept=".doc,.docx,.pdf,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp">`;
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

  it('TCKQ-17b: nút ✎ mở cho Excel/PowerPoint nhưng ẨN ở ẢNH — DS không sửa được ảnh', () => {
    // Người dùng chốt 2026-09-03: bật ✎ cho Excel + PowerPoint. Ảnh thì DS không có bộ soạn thảo
    // nào (máy chủ trả 400) nên nút phải ẩn, khỏi mở ra một tab editor lỗi.
    window.__tfDs(true);
    for (const ten of ['bang.xlsx', 'so-lieu.xls', 'slide.pptx', 'slide.ppt', 'bao-cao.docx']) {
      const co = window.buildKhoiFile(NHOM({ ten_goc: ten }), 'CV001-002');
      expect(co, ten).toContain('/api/v1/task-file-versions/11/editor');
    }
    for (const ten of ['anh.png', 'ảnh chụp.jpg', 'anh.jpeg', 'anh.gif', 'anh.webp']) {
      const khong = window.buildKhoiFile(NHOM({ ten_goc: ten }), 'CV001-002');
      expect(khong, ten).not.toContain('/editor');
    }
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

  it('TCKQ-05b: ẢNH cũng có nút 👁 xem; Excel/PowerPoint chỉ có ⬇ tải (chốt 2026-09-03)', () => {
    // Người dùng chốt: mở thêm ppt/excel/ảnh, và ẢNH mở xem inline được như PDF. Excel/PowerPoint
    // thì không — trình duyệt không hiển thị được, để attachment cho khỏi tải về file rác.
    for (const mime of ['image/png', 'image/jpeg', 'image/gif', 'image/webp']) {
      const anh = window.buildBanFileList(
        NHOM({ bans: [{ ...NHOM().bans[0], loai_mime: mime, ten_luu: 'v1-abc.png' }] }),
        'CV001-002'
      );
      expect(anh, mime).toContain("xemFileKetQua('11')");
    }
    for (const mime of [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint',
    ]) {
      const office = window.buildBanFileList(
        NHOM({ bans: [{ ...NHOM().bans[0], loai_mime: mime, ten_luu: 'v1-abc.xlsx' }] }),
        'CV001-002'
      );
      expect(office, mime).not.toContain('xemFileKetQua');
      expect(office, mime).toContain("taiFileKetQua('11')");
    }
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
    const input = document.getElementById('task-file-input');
    const nop = async (ten, mime, noiDung = 'MZ') => {
      const file = new File([noiDung], ten, { type: mime });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      await window.uploadKetQua(input);
    };
    await nop('virus.exe', 'application/octet-stream');
    // `.svg` bị chặn CÓ Ý dù trông như ảnh: SVG chạy được <script> ⇒ lỗ XSS lưu trữ nếu mở inline.
    await nop('hinh.svg', 'image/svg+xml', '<svg onload=alert(1)>');
    await nop('kho.zip', 'application/zip');
    expect(fetchDaGoi).toBe(0);
  });

  it('TCKQ-13b: đuôi ppt/excel/ảnh ĐI QUA cửa kiểm client (chốt 2026-09-03)', async () => {
    // Chặn quá tay cũng là lỗi: sau khi mở thêm định dạng, 9 đuôi mới phải tới được máy chủ.
    // `fetch` trả 401 để `restUpload` dừng gọn — ở đây chỉ cần biết nó CÓ gọi.
    let fetchDaGoi = 0;
    window.fetch = () => {
      fetchDaGoi += 1;
      return Promise.resolve({ status: 401, ok: false, json: () => Promise.resolve({}) });
    };
    window.showLoginModal = () => {};
    const input = document.getElementById('task-file-input');
    const DS = [
      ['bang.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['so-lieu.xls', 'application/vnd.ms-excel'],
      ['slide.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
      ['slide.ppt', 'application/vnd.ms-powerpoint'],
      ['ảnh chụp.jpg', 'image/jpeg'],
      ['anh.jpeg', 'image/jpeg'],
      ['anh.png', 'image/png'],
      ['anh.gif', 'image/gif'],
      ['anh.webp', 'image/webp'],
    ];
    for (const [ten, mime] of DS) {
      const truoc = fetchDaGoi;
      const file = new File(['noi dung'], ten, { type: mime });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      await window.uploadKetQua(input);
      // Mỗi lần nộp gọi 2 lần fetch: lấy token CSRF rồi POST FormData.
      expect(fetchDaGoi, ten).toBeGreaterThan(truoc);
    }
  });

  it('TCKQ-13c: quá 50 MB bị chặn ở client; đúng 50 MB thì đi qua', async () => {
    let fetchDaGoi = 0;
    window.fetch = () => {
      fetchDaGoi += 1;
      return Promise.resolve({ status: 401, ok: false, json: () => Promise.resolve({}) });
    };
    window.showLoginModal = () => {};
    const input = document.getElementById('task-file-input');
    // File giả: `size` là thuộc tính chỉ-đọc của File nên đặt lại bằng defineProperty, khỏi phải
    // cấp phát 50 MB thật trong test.
    const nopVoiKichThuoc = async (size) => {
      const file = new File(['x'], 'to.pdf', { type: 'application/pdf' });
      Object.defineProperty(file, 'size', { value: size, configurable: true });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      await window.uploadKetQua(input);
    };
    await nopVoiKichThuoc(50 * 1024 * 1024 + 1);
    expect(fetchDaGoi).toBe(0);
    await nopVoiKichThuoc(50 * 1024 * 1024);
    expect(fetchDaGoi).toBeGreaterThan(0);
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

describe('TCKQ — trang «Hàng chờ phê duyệt», tab «Phê duyệt kết quả» (2026-09-02)', () => {
  /** Một dòng như MÁY CHỦ trả (repo.listChoDuyetKetQua + service.choDuyetKetQua). */
  const DONG = (over = {}) => ({
    id: 7,
    item_id: 3,
    ten_goc: 'ket-qua-quy3.docx',
    trang_thai: 'cho-xem',
    created_at: '2026-09-01T10:00:00Z',
    ten_nguoi_tao: 'Nguyễn Văn Cán Bộ',
    ma_nhiem_vu: 'CV001-002',
    ten_nhiem_vu: 'Soạn quy chế thi sát hạch',
    department_id: 1,
    ten_phong: 'Phòng Kỹ thuật',
    ban_cuoi_id: 11,
    ban_cuoi_so: 2,
    ban_cuoi_luc: '2026-09-02T08:00:00Z',
    ban_cuoi_nguoi: 'Nguyễn Văn Cán Bộ',
    hanhDong: [
      { ma: 'yeu-cau-sua', nhan: 'Yêu cầu sửa', canNoiDung: true },
      { ma: 'hoan-thanh', nhan: 'Hoàn thành', canNoiDung: false },
    ],
    ...over,
  });

  it('TCKQ-16: dòng hàng chờ có badge trạng thái, tên nhiệm vụ mở được, và ĐÚNG các nút máy chủ trả', () => {
    window.__tfDs(true);
    // 2026-09-02 (người dùng chốt bảng dạng CÂY): dòng file giờ là một <tr> của bảng; tên + mã nhiệm
    // vụ nằm ở HÀNG TIÊU ĐỀ cấp 3 (`buildHangCayChoDuyet`) nên kiểm cả hai phần qua bảng đầy đủ.
    // Tên phòng nằm ở hàng tiêu đề CẤP 1 (mỗi công việc cha in một lần) ⇒ phải có `ma_cong_viec`.
    const html = window.buildBangChoDuyetKetQua([
      DONG({ ma_cong_viec: 'CV001', ten_cong_viec: 'Chuẩn bị hội nghị' }),
    ]);
    // Badge + màu lấy từ CÙNG bảng với khối «Kết quả» — không có bảng nhãn thứ hai.
    expect(html).toContain('Chờ TP/PP xem');
    expect(html).toContain('bg-yellow-100');
    // Mở nhiệm vụ ngay từ hàng chờ (người dùng cần đọc nội dung trước khi ký).
    expect(html).toContain("openEditModal('task', 'CV001-002')");
    expect(html).toContain('Soạn quy chế thi sát hạch');
    expect(html).toContain('Phòng Kỹ thuật');
    expect(html).toContain('bản 2');
    // Chỉ những nút MÁY CHỦ cho phép; `canNoiDung` đi kèm để client biết có hỏi nội dung hay không.
    expect(html).toContain("xuLyVerdictChoDuyet('7', 'yeu-cau-sua', true)");
    expect(html).toContain("xuLyVerdictChoDuyet('7', 'hoan-thanh', false)");
    expect(html).not.toContain("'duyet'");
    // ✎ sửa trực tuyến + ⬇ tải bản mới nhất, cùng đường với khối «Kết quả».
    expect(html).toContain('/api/v1/task-file-versions/11/editor');
    expect(html).toContain("taiFileKetQua('11')");
  });

  it('TCKQ-20: bảng xếp theo CÂY — công việc cha → công việc con → nhiệm vụ, mỗi nhóm MỘT hàng tiêu đề', () => {
    // Người dùng chốt 2026-09-02: «hiển thị công việc cha, bên dưới là công việc con (nếu có),
    // Nhiệm vụ có file sửa đấy, sau đó là tên file». Hai file cùng nhiệm vụ ⇒ tiêu đề KHÔNG lặp.
    window.__tfDs(false);
    const html = window.buildBangChoDuyetKetQua([
      DONG({
        ma_cong_viec: 'CV001',
        ten_cong_viec: 'Chuẩn bị hội nghị',
        ma_cv_con: 'CV001-A',
        ten_cv_con: 'Hậu cần',
      }),
      DONG({
        id: 8,
        ten_goc: 'phu-luc.pdf',
        ma_cong_viec: 'CV001',
        ten_cong_viec: 'Chuẩn bị hội nghị',
        ma_cv_con: 'CV001-A',
        ten_cv_con: 'Hậu cần',
      }),
    ]);
    expect(html).toContain('hang-cay-1');
    expect(html).toContain('hang-cay-2');
    expect(html).toContain('hang-cay-3');
    // Mỗi cấp đúng MỘT hàng tiêu đề dù có hai file.
    expect((html.match(/hang-cay-1/g) || []).length).toBe(1);
    expect((html.match(/hang-cay-2/g) || []).length).toBe(1);
    expect((html.match(/hang-cay-3/g) || []).length).toBe(1);
    expect(html).toContain('Chuẩn bị hội nghị');
    expect(html).toContain('Hậu cần');
    // Hai dòng file, thụt sâu hơn vì có công việc con ở giữa.
    expect((html.match(/dong-kq-cho-duyet/g) || []).length).toBe(2);
    expect(html).toContain('pl-16');
    expect(html).toContain('phu-luc.pdf');
  });

  it('TCKQ-21: nút «Nộp bản mới» chỉ hiện khi máy chủ trả duocNop = true', () => {
    window.__tfDs(false);
    const co = window.buildDongChoDuyetKetQua(DONG({ duocNop: true }), false);
    expect(co).toContain("moChonFileChoDuyet('7', 'CV001-002')");
    const khong = window.buildDongChoDuyetKetQua(DONG(), false);
    expect(khong).not.toContain('moChonFileChoDuyet');
  });

  it('TCKQ-22: cột «Ý kiến» chỉ hiện chữ + số, bấm mới mở nhiệm vụ (độ rộng bảng có hạn)', () => {
    window.__tfDs(false);
    const co = window.buildDongChoDuyetKetQua(DONG({ so_y_kien: 3 }), false);
    expect(co).toContain('Xem ý kiến (3)');
    // Không nhồi nội dung ý kiến vào bảng.
    const khong = window.buildDongChoDuyetKetQua(DONG({ so_y_kien: 0 }), false);
    expect(khong).not.toContain('Xem ý kiến');
  });

  it('TCKQ-18: tên file / tên nhiệm vụ chứa HTML phải thoát — không dựng được thẻ', () => {
    window.__tfDs(true);
    const html = window.buildBangChoDuyetKetQua([
      DONG({
        ten_goc: '<img src=x onerror=alert(1)>.docx',
        ten_nhiem_vu: '<script>alert(2)</script>',
        ten_phong: '<b>Phòng</b>',
      }),
    ]);
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(2)');
    expect(html).not.toContain('<b>Phòng</b>');
  });

  it('TCKQ-17: ONLYOFFICE tắt ⇒ KHÔNG hiện nút ✎; hanhDong rỗng ⇒ không có nút verdict nào', () => {
    window.__tfDs(false);
    const html = window.buildDongChoDuyetKetQua(DONG({ hanhDong: [] }));
    expect(html).not.toContain('/editor');
    expect(html).not.toContain('xuLyVerdictChoDuyet');
    // Vẫn tải được bản mới nhất để đọc — xem không phụ thuộc ONLYOFFICE.
    expect(html).toContain("taiFileKetQua('11')");
  });

  it('TCKQ-19: moTabChoDuyet đổi tab — chỉ MỘT panel hiện, nút đang mở mang lớp active', () => {
    document.body.innerHTML = `
      <div id="cho-duyet-section">
        <button class="tab-cho-duyet active" data-tab="viec"></button>
        <button class="tab-cho-duyet" data-tab="ket-qua"></button>
        <div id="panel-cho-duyet-viec"></div>
        <div id="panel-cho-duyet-ket-qua" class="hidden"></div>
        <div id="cho-duyet-ket-qua-list"></div>
      </div>`;
    const nut = (t) => document.querySelector(`.tab-cho-duyet[data-tab="${t}"]`);
    const panel = (t) => document.getElementById(`panel-cho-duyet-${t}`);

    window.moTabChoDuyet('ket-qua');
    expect(nut('ket-qua').classList.contains('active')).toBe(true);
    expect(nut('viec').classList.contains('active')).toBe(false);
    expect(panel('ket-qua').classList.contains('hidden')).toBe(false);
    expect(panel('viec').classList.contains('hidden')).toBe(true);

    window.moTabChoDuyet('viec');
    expect(nut('viec').classList.contains('active')).toBe(true);
    expect(panel('viec').classList.contains('hidden')).toBe(false);
    expect(panel('ket-qua').classList.contains('hidden')).toBe(true);
  });
});
