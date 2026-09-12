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
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PERMISSIONS } from '../../src/middleware/rbac.js';
import { QUYEN_UI } from '../helpers/uiPermissions.js';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL, buildThanhTabNhatKy, buildKhungNhatKy, buildKhoiFile, buildYKienPanel, batTatKetQua,
  renderLenhSua, xuLyLenhSua, capNhatTabChoDuyet,
  buildBangLuongFile, buildNutVerdictFile, buildBanFileList, giaTriHieuLucFile,
  coTheNopFile, uploadKetQua, guiYKien, xuLyVerdictFile, createTaskModal,
  buildDongChoDuyetKetQua, moTabChoDuyet, renderChoDuyetKetQua, xuLyVerdictChoDuyet,
  buildBangChoDuyetKetQua, moChonFileChoDuyet, veTrangThaiUpload,
  khoaPhanCongVoiNhanVien,
  buildBangKetQua, buildDongBanKetQua, batTatBanKq, buildMenuHanhDongKq, batTatMenuKq,
  dongMenuKq, buildIconDinhDang,
  dinhDangCuaTen, cauTinhTrangFile, cauTinhTrangHangCho,
  buildKhungKhaiKq, batTatKhungKhaiKq, doiDinhDangKhaiKq, guiKhaiKetQua, guiBaoCaoKetQua,
  buildONhapBaoCao, dinhDangCuaNhom, laDongBaoCao, laBanBaoCaoKq, tenBanCuoiHangCho,
  buildKhungDanhSachKetQua, buildDongKhaiTam, themDongKhaiTam, thuThapDongKhaiTam,
  guiDongKhaiTam, coTheKhaiKetQua, doiDinhDangDongTam, xoaDongKhaiTam,
  danhSachYKien, yKienCuaBan, buildMotYKien, COT_BANG_KET_QUA, buildColgroupKetQua,
  buildONhapYKien, guiYKienTuPopup, moYKienKetQua, dongPopupYKien,
  __tf: (ten, giaTri) => {
    ({
      currentUser: () => { currentUser = giaTri; isAuthenticated = !!giaTri; },
      allTasks: () => { allTasks = giaTri; },
      pendingTaskCreate: () => { pendingTaskCreate = giaTri; },
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
  new Function(APP_SRC + QUYEN_UI + EXPORTS)();
  window.__tf('allTasks', []);
  window.__tf('currentUser', { name: 'Trần Thị Trưởng', role: 'Trưởng phòng', id: 2 });
  window.__tfPq(PERMISSIONS, {});
}

describe('TCKQ-LS: tab vàng dùng DOM an toàn và bốn nút', () => {
  const row = {
    id: 7,
    ten_ket_qua: '<em>Kết quả</em>',
    ten_nhiem_vu: 'Nhiệm vụ',
    ban_cuoi_id: 11,
    ban_cuoi_ten: 'ban-moi.docx',
    lenh_sua_ly_do: '<b>Bổ sung</b>',
    lenh_sua_ghi_chu: 'Đang sửa',
    duocSua: true,
    duocGui: true,
  };
  function dungHangCho() {
    const trang = new DOMParser().parseFromString(
      readFileSync(resolve(process.cwd(), '../web/index.html'), 'utf8'),
      'text/html'
    );
    document.body.append(trang.getElementById('cho-duyet-section'));
    window.fetch = vi.fn((url) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            ok: true,
            data: String(url).includes('/lenh-sua')
              ? { items: [row], onlyOffice: true }
              : { unread: 0, csrfToken: 'x' },
          }),
      })
    );
  }

  it('vẽ từ template thật: tên/lý do là chữ, bốn nút, màu hổ phách', async () => {
    dungHangCho();
    await window.renderLenhSua();
    const dong = document.querySelector('#lenh-sua-list article');
    expect(dong.querySelectorAll('button')).toHaveLength(4);
    expect(dong.querySelector('[data-lenh="ten"]').textContent).toBe(row.ten_ket_qua);
    expect(dong.querySelector('[data-lenh="ly-do"]').textContent).toBe(row.lenh_sua_ly_do);
    expect(dong.querySelector('em, b')).toBeNull();
    expect(dong.style.background).toBe('rgb(255, 251, 235)');
    expect(dong.querySelector('[data-lenh="file"]').getAttribute('href')).toBe(
      '/api/v1/task-files/11/download'
    );
    window.open = vi.fn();
    dong.querySelector('[data-lenh="sua"]').click();
    expect(window.open).toHaveBeenCalledWith(
      '/api/v1/task-file-versions/11/editor',
      '_blank',
      'noopener'
    );
  });

  it('V4: nhân viên có quyền gửi mở được nháp riêng và tab vàng, tab cây vẫn ẩn', () => {
    dungHangCho();
    window.__tf('currentUser', { role: 'Nhân viên', id: 4 });
    window.capNhatTabChoDuyet();
    expect(
      document.querySelector('.tab-cho-duyet[data-tab="viec"]').classList.contains('hidden')
    ).toBe(true);
    expect(
      document.querySelector('.tab-cho-duyet[data-tab="ket-qua"]').classList.contains('hidden')
    ).toBe(false);
    expect(
      document.querySelector('.tab-cho-duyet[data-tab="lenh-sua"]').classList.contains('hidden')
    ).toBe(false);
    window.moTabChoDuyet('lenh-sua');
    expect(document.getElementById('panel-cho-duyet-lenh-sua').classList.contains('hidden')).toBe(
      false
    );
  });

  it('lưu tạm PATCH giữ dòng và ghi chú; hủy confirm Không không gọi mạng', async () => {
    dungHangCho();
    await window.renderLenhSua();
    const dong = document.querySelector('#lenh-sua-list article');
    dong.querySelector('[data-lenh="ghi-chu"]').value = 'Ghi chú đang soạn';
    await window.xuLyLenhSua(dong, row, 'luu');
    const patch = window.fetch.mock.calls.find(([, opts]) => opts?.method === 'PATCH');
    expect(patch[0]).toBe('/api/v1/task-files/7/luu-tam');
    expect(JSON.parse(patch[1].body)).toEqual({ ghiChu: 'Ghi chú đang soạn' });
    expect(dong.isConnected).toBe(true);
    expect(dong.textContent).toContain('chưa gửi đi');
    window.confirm = () => false;
    const soLan = window.fetch.mock.calls.length;
    await window.xuLyLenhSua(dong, row, 'huy');
    expect(window.fetch.mock.calls).toHaveLength(soLan);
  });

  it.each(['gui', 'huy'])('%s thành công bỏ dòng mà không xóa nhóm file', async (action) => {
    dungHangCho();
    await window.renderLenhSua();
    const dong = document.querySelector('#lenh-sua-list article');
    await window.xuLyLenhSua(dong, row, action);
    expect(dong.isConnected).toBe(false);
    const post = window.fetch.mock.calls.find(([, opts]) => opts?.method === 'POST');
    expect(post[0]).toBe(
      '/api/v1/task-files/7/' + (action === 'gui' ? 'gui-ban-moi' : 'huy-lenh-sua')
    );
    expect(window.fetch.mock.calls.some(([, opts]) => opts?.method === 'DELETE')).toBe(false);
  });

  it('lỗi gửi giữ ghi chú và mở lại nút', async () => {
    dungHangCho();
    await window.renderLenhSua();
    const dong = document.querySelector('#lenh-sua-list article');
    window.fetch = () => Promise.reject(new Error('Mất mạng'));
    await window.xuLyLenhSua(dong, row, 'gui');
    expect(dong.isConnected).toBe(true);
    expect(dong.querySelector('[data-lenh="ghi-chu"]').value).toBe('Đang sửa');
    expect(dong.querySelector('[data-lenh="gui"]').disabled).toBe(false);
  });
});

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
    expect(form).not.toContain('name="resultLinks"');
    expect(form).not.toContain('Nhập mỗi link trên một dòng');
    expect(form).toContain('md:grid-cols-3');
    expect(form).toContain('md:col-span-2');
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

  it('TCKQ-03b: mỗi file MỘT DÒNG — data-file + CHỮ «Xem ý kiến» mở POPUP + nút Lịch sử', () => {
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
    // ĐỢT 5 (2026-09-11): «Xem ý kiến» nay MỞ POPUP `moYKienKetQua(ma, fileId, banId)`; dòng cha
    // truyền `banId` RỖNG để popup in TẤT CẢ ý kiến («còn bản đầu 1. đấy sẽ xem tất cả»).
    expect(dong).toContain("moYKienKetQua('CV001-002', '7', '')");
    expect(dong).toContain("batTatKetQua('7', 'ls')");
    // Khung Ý KIỆN ẩn dưới bảng ĐÃ BỎ — nội dung và ô nhập dời hết vào popup. Chỉ còn khung LỊCH SỬ.
    expect(dong).not.toContain('id="task-kq-yk-7"');
    expect(dong).not.toContain("batTatKetQua('7', 'yk')");
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
    // V3: PDF chỉ xem. Ca kiểm DS bật/tắt phải dùng Word, không đổi luật PDF.
    const word = NHOM({
      dinh_dang: 'Word',
      bans: [{ ...NHOM().bans[0], ten_goc: 'ket-qua.docx' }],
    });
    const co = window.buildKhoiFile(word, 'CV001-002');
    expect(co).toContain('/api/v1/task-file-versions/11/editor');
    expect(co).toContain('Sửa trực tuyến (ONLYOFFICE)');
    window.__tfDs(false);
    const khong = window.buildKhoiFile(word, 'CV001-002');
    expect(khong).not.toContain('/editor');
  });

  it('TCKQ-17b: nút ✎ mở cho Excel/PowerPoint nhưng ẨN ở ẢNH — DS không sửa được ảnh', () => {
    // Người dùng chốt 2026-09-03: bật ✎ cho Excel + PowerPoint. Ảnh thì DS không có bộ soạn thảo
    // nào (máy chủ trả 400) nên nút phải ẩn, khỏi mở ra một tab editor lỗi.
    // Đợt 2: nút ✎ nhìn `banCuoi.ten_goc` (đuôi bản mới nhất), không phải `ten_goc` của nhóm —
    // fixture phải ghi đúng tên bản, không thì PDF mặc định của NHOM() làm Ảnh vẫn hiện ✎.
    window.__tfDs(true);
    const nhomTen = (ten) => NHOM({ ten_goc: ten, bans: [{ ...NHOM().bans[0], ten_goc: ten }] });
    for (const ten of ['bang.xlsx', 'so-lieu.xls', 'slide.pptx', 'slide.ppt', 'bao-cao.docx']) {
      const co = window.buildKhoiFile(nhomTen(ten), 'CV001-002');
      expect(co, ten).toContain('/api/v1/task-file-versions/11/editor');
    }
    for (const ten of ['anh.png', 'ảnh chụp.jpg', 'anh.jpeg', 'anh.gif', 'anh.webp']) {
      const khong = window.buildKhoiFile(nhomTen(ten), 'CV001-002');
      expect(khong, ten).not.toContain('/editor');
    }
  });

  it('TCKQ-18: panel ý kiến (nay nằm TRONG POPUP) — label gắn bản mới nhất + data-ban-cuoi + Gửi ý kiến', () => {
    const panel = window.buildYKienPanel(NHOM(), 'CV001-002');
    expect(panel).toContain('Ý kiến cho bản 1');
    expect(panel).toContain('id="task-y-kien-7"');
    expect(panel).toContain('data-ban-cuoi="11"');
    // ĐỢT 5: nút «Gửi ý kiến» đi qua `guiYKienTuPopup` để ĐÓNG POPUP sau khi gửi thành công —
    // `guiYKien` đã gọi `napKetQua(ma)` vẽ lại bảng, để popup mở là nó đang kể chuyện cũ.
    expect(panel).toContain("guiYKienTuPopup('7', 'CV001-002')");
    expect(panel).not.toContain('onclick="guiYKien(\'');
    expect(panel).toContain('Gửi ý kiến');
    expect(panel).toContain('Chưa có ý kiến nào.');
  });
});

// ============================================================================
// TCKQ-23…30 — THIẾT KẾ LẠI khối «Kết quả» theo sheet «kq-modal» của người dùng (2026-09-03):
// bảng 10 cột Thời gian · Kết quả làm được · Định dạng · File đã tải lên · Người thực hiện ·
// Ghi ý kiến · Tình trạng · Hành động. Dòng cha đánh số 1., 2., 3.; mỗi BẢN là một dòng con
// 1.1, 1.2 … kèm chữ «Sửa lần N» và THU GỌN mặc định (người dùng chốt: «bấm ▸ mới bung»).
// Mọi hành động gộp vào MỘT menu ⋯ («ấn vào đây hiển thị các Hành động để chọn»).
// ============================================================================
describe('TCKQ — bảng «Kết quả» 10 cột (thiết kế lại 2026-09-03)', () => {
  /** Bản thứ n của nhóm 7 — dùng để dựng các dòng con 1.1 / 1.2. */
  const BAN = (so, over = {}) => ({
    id: 10 + so,
    file_id: 7,
    version_no: so,
    ten_luu: 'v' + so + '-abc.pdf',
    ten_goc: 'ket-qua-quy3.pdf',
    loai_mime: 'application/pdf',
    kich_thuoc: 24,
    uploaded_by: 4,
    uploaded_at: '2026-09-0' + so + 'T10:00:00Z',
    ten_nguoi_nop: 'Nguyễn Văn Cán Bộ',
    ...over,
  });

  it('TCKQ-23: bảng đủ 10 cột đúng thứ tự sheet; danh sách rỗng thì nói rõ là chưa có', () => {
    const html = window.buildBangKetQua([NHOM()], 'CV001-002');
    const cot = [
      'Thời gian',
      'Kết quả làm được',
      'Định dạng',
      'File đã tải lên',
      'Tỷ lệ công việc (%)',
      'Tiến độ',
      'Người thực hiện',
      'Ghi ý kiến',
      'Tình trạng',
      'Hành động',
    ];
    for (const t of cot) expect(html, t).toContain(t);
    // Đúng THỨ TỰ trái → phải của sheet, không chỉ «có mặt».
    let truoc = -1;
    for (const t of cot) {
      const tai = html.indexOf('>' + t + '<');
      expect(tai, t).toBeGreaterThan(truoc);
      truoc = tai;
    }
    // SỬA + danh sách rỗng: vẫn là BẢNG 10 cột, hàng «Chưa có» nằm trong tbody — đợt 2 không còn
    // trả một dòng chữ xám ngoài bảng (người dùng 2026-09-04: «tạo mới không thấy bảng kết quả»).
    const rongSua = window.buildBangKetQua([], 'CV001-002');
    expect(rongSua).toContain('bang-ket-qua');
    expect(rongSua).toContain('Chưa có kết quả nào.');
    expect(rongSua).toContain('colspan="10"');
    // TẠO MỚI (ma rỗng): một dòng khai tạm 1. với ô tên/định dạng/ý kiến, KHÔNG POST.
    const rongTao = window.buildBangKetQua([], '');
    expect(rongTao).toContain('bang-ket-qua');
    expect(rongTao).toContain('dong-kq-khai-tam');
    expect(rongTao).toContain('kq-tam-ten');
    expect(rongTao).toContain('>1.<');
    expect(rongTao).not.toContain('name="kq-tam');
  });

  it('TCKQ-24: dòng cha đánh số 1., 2., 3.; dòng bản là 1.1 / 1.2 kèm chữ «Sửa lần N»', () => {
    const html = window.buildBangKetQua(
      [NHOM({ bans: [BAN(1), BAN(2), BAN(3)] }), NHOM({ id: 8, ten_goc: 'phu-luc.docx' })],
      'CV001-002'
    );
    expect(html).toContain('>1.<');
    expect(html).toContain('>2.<');
    expect(html).toContain('>1.1<');
    expect(html).toContain('>1.2<');
    expect(html).toContain('>1.3<');
    // Bản ĐẦU TIÊN không phải lần sửa nào; bản 2 là «Sửa lần 1», bản 3 là «Sửa lần 2».
    expect(html).toContain('Sửa lần 1');
    expect(html).toContain('Sửa lần 2');
    expect(html).not.toContain('Sửa lần 3');
    // Nhóm thứ hai chỉ có một bản ⇒ dòng con của nó là 2.1.
    expect(html).toContain('>2.1<');
  });

  it('TCKQ-25: dòng bản THU GỌN mặc định — có lớp hidden + data-nhom, batTatBanKq bung/gập', () => {
    const html = window.buildBangKetQua([NHOM({ bans: [BAN(1), BAN(2)] })], 'CV001-002');
    // Người dùng chốt: «Thu gọn mặc định, bấm ▸ mới bung».
    expect((html.match(/class="dong-ban-kq hidden"/g) || []).length).toBe(2);
    expect(html).toContain('data-nhom="7"');
    expect(html).toContain("batTatBanKq('7')");

    document.body.innerHTML = '<table><tbody>' + html + '</tbody></table>';
    const dong = () => document.querySelectorAll('.dong-ban-kq[data-nhom="7"]');
    expect(dong().length).toBe(2);
    expect([...dong()].every((tr) => tr.classList.contains('hidden'))).toBe(true);
    window.batTatBanKq('7');
    expect([...dong()].some((tr) => tr.classList.contains('hidden'))).toBe(false);
    // Mũi tên đổi hướng để nhìn ra dòng nào đang mở.
    expect(document.querySelector('.kq-nut-bung i').classList.contains('fa-caret-down')).toBe(true);
    window.batTatBanKq('7');
    expect([...dong()].every((tr) => tr.classList.contains('hidden'))).toBe(true);
    expect(document.querySelector('.kq-nut-bung i').classList.contains('fa-caret-right')).toBe(
      true
    );
  });

  it('TCKQ-26: cột «Định dạng» suy từ ĐUÔI file — 12 đuôi, đuôi lạ trả «—» chứ không đoán bừa', () => {
    const cap = {
      'a.doc': 'Word',
      'a.docx': 'Word',
      'a.pdf': 'PDF',
      'a.xls': 'Excel',
      'a.xlsx': 'Excel',
      'a.ppt': 'PPT',
      'a.pptx': 'PPT',
      'a.jpg': 'Ảnh',
      'a.jpeg': 'Ảnh',
      'a.png': 'Ảnh',
      'a.gif': 'Ảnh',
      'a.webp': 'Ảnh',
    };
    for (const [ten, nhan] of Object.entries(cap)) {
      expect(window.dinhDangCuaTen(ten), ten).toBe(nhan);
      expect(window.dinhDangCuaTen(ten.toUpperCase()), ten).toBe(nhan);
    }
    for (const ten of ['a.exe', 'a.svg', 'khong-co-duoi', '', null, undefined]) {
      expect(window.dinhDangCuaTen(ten), String(ten)).toBe('—');
    }
    // Cột 3: đợt 2 ưu tiên `dinh_dang` đã khai, không có thì đuôi bản mới nhất, rồi mới `ten_goc`.
    // NHOM() mặc định có bản `ket-qua-quy3.pdf` nên ghi `ten_goc: 'bang.xlsx'` không đổi cột.
    expect(
      window.buildBangKetQua([NHOM({ ten_goc: 'bang.xlsx', bans: [] })], 'CV001-002')
    ).toContain('Excel');
    expect(window.buildBangKetQua([NHOM({ dinh_dang: 'Excel' })], 'CV001-002')).toContain('Excel');
  });

  it('TCKQ-27: cột «Tình trạng» là CÂU KỂ đọc được, kèm «Bị trả lại lần N» đếm từ bảng luồng', () => {
    // Sheet «kq-modal» đòi đọc được «đang đợi Tp/pp duyệt, Tp/pp đã duyệt đang gửi lên Phó giám
    // đốc…, bị trả lại lần 1 đang đợi cán bộ sửa» — không phải một nhãn ngắn.
    expect(window.cauTinhTrangFile({ trang_thai: 'cho-xem', luong: [] })).toBe(
      'đang đợi Trưởng phòng/Phó phòng duyệt'
    );
    expect(window.cauTinhTrangFile({ trang_thai: 'can-sua', luong: [] })).toBe(
      'đang đợi Cán bộ sửa và nộp bản mới'
    );
    // Chưa qua «TP/PP phê duyệt» thì không được nói là TP/PP đã duyệt.
    expect(window.cauTinhTrangFile({ trang_thai: 'cho-lanh-dao', luong: [] })).toBe(
      'đang đợi Phó Giám đốc/Giám đốc'
    );
    expect(
      window.cauTinhTrangFile({
        trang_thai: 'cho-lanh-dao',
        luong: [{ hanh_dong: 'tp-phe-duyet' }],
      })
    ).toBe('TP/PP đã duyệt, đang gửi lên Phó Giám đốc/Giám đốc');
    // ĐIỂM 7 (ĐỢT B): máy chủ trả tên + lúc ký thì câu kể phải KỂ ĐƯỢC AI, không chỉ «TP/PP đã
    // duyệt» chung chung. Đây chính là chỗ `trinh-lanh-dao` cũ thua — nó chỉ đổi trạng thái nên
    // không có gì để kể. Ba tên trường vì ba đường đọc trả ba dạng (GET …/files · tab Nhiệm vụ · RPC).
    for (const khoaTen of ['ten_nguoi_tp_duyet', 'tp_duyet_ten', 'tenNguoiTpDuyet']) {
      const cau = window.cauTinhTrangFile({
        trang_thai: 'cho-lanh-dao',
        luong: [],
        [khoaTen]: 'Trần Thị Trưởng Phòng',
        tp_duyet_luc: '2026-09-04T02:25:00Z',
      });
      expect(cau).toContain('đã được Trần Thị Trưởng Phòng (TP/PP) phê duyệt');
      expect(cau).toContain('lúc ');
      expect(cau).toContain('đang chờ Phó Giám đốc/Giám đốc');
    }
    // Đếm số lần trả lại: ĐIỂM 9 (ĐỢT B) gộp «Yêu cầu sửa» vào «Trả về Cán bộ» nên chỉ còn HAI mã.
    expect(
      window.cauTinhTrangFile({
        trang_thai: 'can-sua',
        luong: [{ hanh_dong: 'tra-ve-cbo' }, { hanh_dong: 'nop' }],
      })
    ).toBe('Bị trả lại lần 1 — đang đợi Cán bộ sửa và nộp bản mới');
    expect(
      window.cauTinhTrangFile({
        trang_thai: 'can-sua',
        luong: [
          { hanh_dong: 'tra-ve-cbo' },
          { hanh_dong: 'tra-ve-tp' },
          { hanh_dong: 'tra-ve-cbo' },
        ],
      })
    ).toContain('Bị trả lại lần 3');
    expect(window.cauTinhTrangFile({ trang_thai: 'da-duyet', luong: [] })).toContain(
      'Phó Giám đốc/Giám đốc đã duyệt'
    );
    // Trạng thái lạ ⇒ rơi về nhãn ngắn, KHÔNG dựng câu sai.
    expect(window.cauTinhTrangFile({ trang_thai: 'la-lam', luong: [] })).toBe('la-lam');
    // Trang hàng chờ: máy chủ KHÔNG trả bảng luồng ⇒ không đếm được lần trả lại, câu vẫn đúng.
    expect(window.cauTinhTrangHangCho({ trang_thai: 'cho-xem' })).toBe(
      'đang đợi Trưởng phòng/Phó phòng duyệt'
    );
    // Badge ngắn vẫn còn bên cạnh câu kể (giữ màu để quét nhanh).
    const html = window.buildBangKetQua([NHOM({ trang_thai: 'can-sua' })], 'CV001-002');
    expect(html).toContain('Cần sửa — nộp bản mới');
    expect(html).toContain('đang đợi Cán bộ sửa và nộp bản mới');
  });

  it('TCKQ-28: mọi hành động gộp vào MỘT menu ⋯ — không còn hàng nút rời trong bảng', () => {
    window.__tfDs(true);
    const html = window.buildBangKetQua([NHOM()], 'CV001-002');
    // Một nút mở menu cho dòng cha + một cho dòng bản; menu ẩn sẵn.
    expect(html).toContain('kq-menu-boc');
    expect(html).toContain("batTatMenuKq('kq-menu-kq-7')");
    expect(html).toContain('id="kq-menu-kq-7"');
    expect((html.match(/class="kq-menu hidden"/g) || []).length).toBe(2);
    // TP ở «cho-xem»: các hành động nằm TRONG menu dưới dạng mục, không phải nút btn-primary rời.
    expect(html).toContain('kq-menu-muc');
    // ĐIỂM 9 + ĐIỂM 7 (ĐỢT B): menu chỉ còn «Đẩy về Cán bộ» (đã gộp «Yêu cầu sửa») và
    // «TP/PP phê duyệt» (thay «Trình Phó giám đốc») — hai nút cho một việc là điểm bất hợp lý số 9.
    expect(html).toContain('Đẩy về Cán bộ');
    expect(html).toContain('TP/PP phê duyệt');
    expect(html).not.toContain('Yêu cầu sửa');
    expect(html).not.toContain('Trình Phó giám đốc');
    expect(html).toContain('Hoàn thành / Duyệt');
    expect(html).toContain('kq-menu-muc-chot');
    // Menu rỗng thì in gạch ngang chứ không để ô trống không ai hiểu.
    expect(window.buildMenuHanhDongKq('x', [])).toContain('—');

    document.body.innerHTML = '<table><tbody>' + html + '</tbody></table>';
    const menu = () => document.getElementById('kq-menu-kq-7');
    expect(menu().classList.contains('hidden')).toBe(true);
    window.batTatMenuKq('kq-menu-kq-7');
    expect(menu().classList.contains('hidden')).toBe(false);
    // Mở menu khác thì menu đang mở phải ĐÓNG — hai menu chồng nhau là bấm nhầm dòng.
    window.batTatMenuKq('kq-menu-ban-11');
    expect(menu().classList.contains('hidden')).toBe(true);
    expect(document.getElementById('kq-menu-ban-11').classList.contains('hidden')).toBe(false);
  });

  it('TCKQ-29: cột «File đã tải lên» — chưa nộp thì «Chưa có», có rồi thì tên file bấm tải được', () => {
    const co = window.buildBangKetQua([NHOM()], 'CV001-002');
    expect(co).toContain('ket-qua-quy3.pdf');
    expect(co).toContain("taiFileKetQua('11')");
    expect(co).not.toContain('Chưa có<');
    // Nhóm không có bản nào (dữ liệu cũ / lỗi) ⇒ ô ghi «Chưa có», đúng câu chú trong sheet.
    const khong = window.buildBangKetQua([NHOM({ bans: [] })], 'CV001-002');
    expect(khong).toContain('Chưa có');
    // Không có bản thì cũng không có nút ▸ (không có gì để bung).
    expect(khong).toContain('kq-nut-bung-trong');
  });

  it('TCKQ-30: tên file có HTML phải thoát ở CẢ dòng cha lẫn dòng bản của bảng mới', () => {
    const html = window.buildBangKetQua(
      [
        NHOM({
          ten_goc: '<img src=x onerror=alert(1)>.pdf',
          bans: [BAN(1, { ten_goc: '<svg onload=alert(2)>.pdf' })],
          gopY: [
            {
              id: 5,
              version_id: 11,
              ten_nguoi: '<b>TP</b>',
              vai: 'Trưởng phòng',
              noi_dung: '<script>alert(3)</script>',
              created_at: '2026-09-01T10:05:00Z',
            },
          ],
        }),
      ],
      'CV001-002'
    );
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;svg onload=alert(2)&gt;');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<svg onload');
    expect(html).not.toContain('<script>alert(3)');
    expect(html).not.toContain('<b>TP</b>');
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
  it('TCKQ-06: TP có file:approve = ✓ (mặc định) ⇒ cả «Hoàn thành / Duyệt» lẫn «TP/PP phê duyệt»', () => {
    expect(
      window.buildNutVerdictFile(
        NHOM({ trang_thai: 'can-sua', lenh_sua_cho: 'lanh-dao' }),
        'CV001-001'
      )
    ).toContain('Đẩy về Cán bộ');
    const nut = window.buildNutVerdictFile(NHOM(), 'CV001-002');
    // ĐIỂM 7 + ĐIỂM 9 (ĐỢT B): BỐN nút cũ nay còn BA. «Trình Phó giám đốc» thành «TP/PP phê duyệt»
    // (có lưu mốc người ký + lúc ký), còn «Yêu cầu sửa» gộp hẳn vào «Đẩy về Cán bộ» — hai nút cho
    // cùng một việc chính là điểm bất hợp lý số 9.
    expect(nut).toContain('TP/PP phê duyệt');
    expect(nut).toContain('Hoàn thành / Duyệt');
    expect(nut).toContain('Đẩy về Cán bộ');
    expect(nut).not.toContain('Yêu cầu sửa');
    expect(nut).not.toContain('Trình Phó giám đốc');
    expect((nut.match(/xuLyVerdictFile\(/g) || []).length).toBe(3);
  });

  it('TCKQ-07: admin đặt ⏳ ở ô «Duyệt kết quả» của TP ⇒ MẤT nút «Hoàn thành / Duyệt», còn «TP/PP phê duyệt»', () => {
    window.__tfPq(PERMISSIONS, {
      'file:approve': { 'Trưởng phòng': { gia_tri: 'cho-duyet', pham_vi: 'phong' } },
    });
    const nut = window.buildNutVerdictFile(NHOM(), 'CV001-002');
    expect(nut).not.toContain('Hoàn thành / Duyệt');
    expect(nut).toContain('TP/PP phê duyệt');
    expect(nut).toContain('Đẩy về Cán bộ');
    expect(nut).not.toContain('Yêu cầu sửa');
    expect((nut.match(/xuLyVerdictFile\(/g) || []).length).toBe(2);
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
    window.__tfPq(PERMISSIONS, {
      'file:create': { 'Nhân viên': { gia_tri: 'cho-phep', pham_vi: 'phong' } },
    });
    expect(window.giaTriHieuLucFile('Nhân viên', 'create')).toBe('cho-phep');
    window.__tf('currentUser', { name: 'Admin', role: 'admin', id: 1 });
    window.__tfPq(PERMISSIONS, {
      'file:create': { admin: { gia_tri: 'tu-choi', pham_vi: 'phong' } },
    });
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

  it('TCKQ-14: ô «Ý kiến» DỜI VÀO POPUP — khối file chỉ còn chữ «Xem ý kiến», ô nhập vẫn gắn bản mới nhất', () => {
    window.__tf('allTasks', [
      { 'Mã nhiệm vụ': 'CV001-002', 'Người thực hiện': 'Nguyễn Văn Cán Bộ' },
    ]);
    const khoi = window.buildKhoiFile(NHOM(), 'CV001-002');
    // Nhãn «Ý kiến cho bản 1» của ô nhập KHÔNG còn trong bảng (nó dời vào popup) — chữ còn lại ở ô
    // là «Xem ý kiến» của nút mở popup.
    expect(khoi).toContain('Xem ý kiến');
    expect(khoi).not.toContain('Ý kiến cho bản');
    // ĐỢT 5 (2026-09-11): bảng KHÔNG còn giữ ô nhập — nó nằm trong popup `moYKienKetQua`, và popup
    // dựng thân bằng `buildYKienPanel`. Kiểm CẢ HAI ĐẦU: bảng hết ô nhập, panel vẫn đủ dây nối.
    expect(khoi).toContain("moYKienKetQua('CV001-002', '7', '')");
    expect(khoi).not.toContain('id="task-y-kien-7"');
    expect(khoi).not.toContain('data-ban-cuoi');
    const panel = window.buildYKienPanel(NHOM(), 'CV001-002');
    expect(panel).toContain('id="task-y-kien-7"');
    expect(panel).toContain('data-ban-cuoi="11"');
    expect(panel).toContain("guiYKienTuPopup('7', 'CV001-002')");
    expect(panel).toContain('Gửi ý kiến');
    // Nút ↩ góp ý theo bản đã gỡ — ô «Ý kiến» duy nhất là ô trong popup.
    expect(khoi).not.toContain('↩ góp ý');
    expect(panel).not.toContain('↩ góp ý');
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
    await window.xuLyVerdictFile(7, 'tra-ve-cbo', true, 'CV001-002');
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
      // ĐIỂM 9 (ĐỢT B): «Yêu cầu sửa» gộp vào «Đẩy về Cán bộ» — máy chủ chỉ còn trả HAI mã trả lại.
      { ma: 'tra-ve-cbo', nhan: 'Đẩy về Cán bộ', canNoiDung: true },
      { ma: 'hoan-thanh', nhan: 'Hoàn thành', canNoiDung: false },
    ],
    ...over,
  });

  it('TCKQ-16: dòng hàng chờ có badge trạng thái, tên nhiệm vụ mở được, và ĐÚNG các nút máy chủ trả', () => {
    window.__tfDs(true);
    // 2026-09-03 (thiết kế lại theo sheet «kq-hang-cho»): bảng PHẲNG 10 cột, ba cấp cây thành ba
    // CỘT của chính dòng file — không còn hàng tiêu đề gộp. Mọi hành động nằm trong MỘT menu ⋯.
    const html = window.buildBangChoDuyetKetQua([
      DONG({ ma_cong_viec: 'CV001', ten_cong_viec: 'Chuẩn bị hội nghị' }),
    ]);
    // Badge + màu lấy từ CÙNG bảng với khối «Kết quả» — không có bảng nhãn thứ hai.
    expect(html).toContain('Chờ TP/PP xem');
    expect(html).toContain('bg-yellow-100');
    // Mở nhiệm vụ ngay từ hàng chờ (người dùng cần đọc nội dung trước khi ký). Ô «Nhiệm vụ» dựng
    // onclick trực tiếp (dấu ' là chữ tĩnh của mã), khác menu ⋯ bên dưới — nơi cả chuỗi onclick đi
    // qua escapeHtmlAttr nên ' thành &#39;.
    expect(html).toContain("openEditModal('task', 'CV001-002')");
    expect(html).toContain('Soạn quy chế thi sát hạch');
    expect(html).toContain('Phòng Kỹ thuật');
    expect(html).toContain('bản 2');
    // Chỉ những nút MÁY CHỦ cho phép; `canNoiDung` đi kèm để client biết có hỏi nội dung hay không.
    // Menu ⋯ dựng onclick trong thuộc tính nên dấu ' đã thành &#39; — kiểm ĐÚNG chuỗi đã thoát.
    expect(html).toContain('xuLyVerdictChoDuyet(&#39;7&#39;, &#39;tra-ve-cbo&#39;, true)');
    expect(html).toContain('xuLyVerdictChoDuyet(&#39;7&#39;, &#39;hoan-thanh&#39;, false)');
    expect(html).not.toContain('&#39;duyet&#39;');
    // ✎ sửa trực tuyến + ⬇ tải bản mới nhất, cùng đường với khối «Kết quả».
    expect(html).toContain('/api/v1/task-file-versions/11/editor');
    expect(html).toContain('taiFileKetQua(&#39;11&#39;)');
  });

  it('TCKQ-20: bảng PHẲNG 10 cột theo sheet «kq-hang-cho» — ba cấp cây thành ba CỘT, mỗi file MỘT dòng', () => {
    // Người dùng chốt 2026-09-03 (sheet «kq-hang-cho»): Tên kết quả · Nhiệm vụ · Công việc con ·
    // Công việc chính · Trạng thái · Bản mới nhất · Ý kiến · Nút chức năng. Hàng tiêu đề gộp cũ
    // (hang-cay-1/2/3) đã gỡ — mắt quét theo hàng, không phải nhớ đang ở dưới nhóm nào.
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
    for (const cot of [
      'Tên kết quả làm được',
      'Nhiệm vụ',
      'Công việc con',
      'Công việc chính',
      'Trạng thái',
      'Bản mới nhất',
      'Ý kiến',
      'Nút chức năng',
    ]) {
      expect(html, cot).toContain(cot);
    }
    expect(html).not.toContain('hang-cay-');
    // Ba cấp cây lặp trên TỪNG dòng (đó là cột, không phải tiêu đề nhóm).
    expect((html.match(/Chuẩn bị hội nghị/g) || []).length).toBe(2);
    expect((html.match(/Hậu cần/g) || []).length).toBe(2);
    // Hai file = hai dòng, không thêm dòng nào khác.
    expect((html.match(/dong-kq-cho-duyet/g) || []).length).toBe(2);
    expect(html).toContain('phu-luc.pdf');
    // Định dạng suy từ đuôi file, hiện dưới tên kết quả.
    expect(html).toContain('Word');
    expect(html).toContain('PDF');
  });

  it('TCKQ-21: nút «Nộp bản mới» chỉ hiện khi máy chủ trả duocNop = true', () => {
    window.__tfDs(false);
    const co = window.buildDongChoDuyetKetQua(DONG({ duocNop: true }), false);
    expect(co).toContain('moChonFileChoDuyet(&#39;7&#39;, &#39;CV001-002&#39;)');
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
    expect(html).toContain('taiFileKetQua(&#39;11&#39;)');
  });

  it('TCKQ-19: moTabChoDuyet đổi tab — chỉ MỘT panel hiện, nút đang mở mang lớp active', () => {
    // Kiểm chuyển hai tab với người có quyền duyệt cây; TP mặc định không có quyền này.
    window.__tf('currentUser', { role: 'admin', id: 1 });
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

  // ── TCKQ-31/32 — ba việc người dùng báo 2026-09-04 sau khi xem bảng thật ────────────────
  it('TCKQ-31: cột 1 hàng chờ có ICON định dạng + số bản ở dòng 1, TÊN FILE ở dòng 2', () => {
    window.__tfDs(false);
    // Người dùng chốt: «tên Tên kết quả làm được ở hàng chờ là tên Kết quả làm được khi nhập ở ô
    // kết quả của nhiệm vụ, ghi kèm icon định dạng file và bao nhiêu bản, dòng 2 sẽ ghi tên file».
    const html = window.buildDongChoDuyetKetQua(
      DONG({ so_ban: 3, ban_cuoi_ten: 'ban-sua-lan-2.docx' })
    );
    expect(html).toContain('fa-file-word');
    expect(html).toContain('3 bản');
    // Dòng 2 = tên file của BẢN MỚI NHẤT, khác tên kết quả ⇒ phải thấy CẢ HAI.
    expect(html).toContain('ket-qua-quy3.docx');
    expect(html).toContain('ban-sua-lan-2.docx');
    // Tên dài thì cắt bằng ellipsis nhưng vẫn đọc đủ khi trỏ chuột.
    expect(html).toContain('title="ban-sua-lan-2.docx"');
    // Máy chủ chưa trả tên bản (dòng cũ) ⇒ lấy tên nhóm, không để trống.
    expect(window.buildDongChoDuyetKetQua(DONG({ ban_cuoi_ten: null }))).toContain(
      'ket-qua-quy3.docx'
    );
    // Icon theo ĐÚNG định dạng, kèm chữ cho người đọc bằng trình đọc màn hình.
    const pdf = window.buildDongChoDuyetKetQua(DONG({ ten_goc: 'bao-cao.pdf' }));
    expect(pdf).toContain('fa-file-pdf');
    expect(pdf).toContain('aria-label="PDF"');
    // Đuôi lạ: biểu tượng tệp chung + nhãn «—», không gán bừa một loại.
    const la = window.buildDongChoDuyetKetQua(DONG({ ten_goc: 'khong-duoi' }));
    expect(la).toContain('fa-file text-gray-400');
    expect(la).toContain('aria-label="—"');
    // Tên file chứa HTML vẫn phải thoát ở CẢ hai dòng lẫn trong title.
    const xau = window.buildDongChoDuyetKetQua(
      DONG({ ban_cuoi_ten: '"><img src=x onerror=alert(1)>.pdf' })
    );
    expect(xau).not.toContain('<img src=x');
    expect(xau).toContain('&lt;img src=x');
  });

  it('TCKQ-32: menu ⋯ DỜI ra <body> khi mở để vươn khỏi hộp bị overflow, đóng thì trả về chỗ cũ', () => {
    // Người dùng chốt 2026-09-04: «Nút chức năng khi ấn thì bị vấn trong hộp nên phải kéo chuột
    // xuống mới thấy, cho nó vươn ra khỏi hộp để dễ chọn». `.glass-card`/`.modal-content` vừa
    // `overflow` cắt vừa có `backdrop-filter` (= khối chứa của cả `position: fixed`), nên cách duy
    // nhất chắc chắn là dời thẻ menu ra ngoài hộp.
    window.__tfDs(false);
    document.body.innerHTML =
      '<div id="hop" style="overflow:hidden"><table><tbody>' +
      window.buildBangChoDuyetKetQua([DONG()]) +
      '</tbody></table></div>';
    const menu = () => document.getElementById('kq-menu-hc-7');
    const hop = document.getElementById('hop');
    expect(hop.contains(menu())).toBe(true);
    expect(menu().classList.contains('hidden')).toBe(true);

    window.batTatMenuKq('kq-menu-hc-7');
    // Ra khỏi hộp, thành con TRỰC TIẾP của <body> và định vị fixed (không còn bị cắt).
    expect(menu().parentElement).toBe(document.body);
    expect(hop.contains(menu())).toBe(false);
    expect(menu().classList.contains('hidden')).toBe(false);

    // Bấm lại đúng nút đó = gập, và thẻ TRẢ VỀ trong hộp — không để rác tích lại ở <body>.
    window.batTatMenuKq('kq-menu-hc-7');
    expect(menu().classList.contains('hidden')).toBe(true);
    expect(hop.contains(menu())).toBe(true);
    expect(menu().getAttribute('style')).toBe(null);

    // Bấm ra ngoài cũng gập + trả về chỗ cũ (listener «bấm ngoài» gắn một lần).
    window.batTatMenuKq('kq-menu-hc-7');
    expect(menu().parentElement).toBe(document.body);
    document.body.click();
    expect(menu().classList.contains('hidden')).toBe(true);
    expect(hop.contains(menu())).toBe(true);
  });

  it('TCKQ-32b: bấm nút thật giữ menu mở phía trên modal và bấm lại thì đóng', () => {
    document.body.innerHTML =
      '<div id="task-modal" style="z-index:70;overflow:hidden">' +
      window.buildMenuHanhDongKq('modal', ['<button type="button">Tải file</button>']) +
      '</div>';
    const nut = document.querySelector('.kq-menu-nut');
    const menu = document.getElementById('kq-menu-modal');
    nut.getBoundingClientRect = () => ({
      left: 400,
      right: 440,
      top: 100,
      bottom: 130,
      width: 40,
      height: 30,
    });
    // jsdom không tự chạy onclick nội tuyến: gắn đúng mã đã sinh rồi phát sự kiện có bubble.
    nut.onclick = (event) =>
      new Function('event', 'batTatMenuKq', nut.getAttribute('onclick'))(
        event,
        window.batTatMenuKq
      );
    nut.click();
    expect(menu.parentElement).toBe(document.body);
    expect(menu.classList.contains('hidden')).toBe(false);
    expect(menu.style.position).toBe('fixed');
    expect(Number(menu.style.zIndex)).toBeGreaterThan(70);
    nut.click();
    expect(menu.classList.contains('hidden')).toBe(true);
    expect(document.getElementById('task-modal').contains(menu)).toBe(true);
  });

  it('TCKQ-33: vẽ lại bảng khi menu đang mở thì KHÔNG để lại thẻ mồ côi ở <body>', async () => {
    // Vẽ lại làm chỗ cũ của menu rụng khỏi DOM; nếu chỉ «trả về chỗ cũ» thì thẻ nằm mãi ở <body>,
    // chồng lên giao diện. `renderChoDuyetKetQua` phải gập menu TRƯỚC khi ghi innerHTML.
    window.__tfDs(false);
    document.body.innerHTML =
      '<div id="cho-duyet-ket-qua-list"></div><span id="tab-ket-qua-count"></span>';
    const listEl = document.getElementById('cho-duyet-ket-qua-list');
    listEl.innerHTML = window.buildBangChoDuyetKetQua([DONG()]);
    window.batTatMenuKq('kq-menu-hc-7');
    expect(document.getElementById('kq-menu-hc-7').parentElement).toBe(document.body);

    // fetch bị stub để REJECT ⇒ restGet trả null ⇒ hàm dừng sớm, nhưng phải gập menu trước đó.
    await window.renderChoDuyetKetQua();
    expect(document.getElementById('kq-menu-hc-7')).toBe(null);
    expect([...document.body.children].some((el) => el.classList.contains('kq-menu'))).toBe(false);
  });
});

// ============================================================================
// TCKQ-34… — ĐỢT 2 (016): khai kết quả TRƯỚC khi có file + form TẠO hiện bảng 10 cột
// (người dùng 2026-09-04: «khi tạo mới không thấy bảng kết quả»; «dòng đầu 1. 2. 3.
// điền Kết quả làm được, Định dạng, Ghi ý kiến»; «Báo cáo» = bản không có file).
// ============================================================================
describe('TCKQ — đợt 2: khai trước + form tạo hiện bảng (016)', () => {
  it('TCKQ-34: form TẠO NHIỆM VỤ (cấp 3) nhúng bảng 10 cột + dòng khai tạm + nút ＋ ngay trong HTML', () => {
    const form = window.createTaskModal(false);
    expect(form).toContain('Tạo nhiệm vụ mới');
    expect(form).toContain('task-ket-qua-danh-sach');
    expect(form).toContain('bang-ket-qua');
    expect(form).toContain('dong-kq-khai-tam');
    expect(form).toContain('themDongKhaiTam()');
    expect(form).toContain('Thêm kết quả');
    const cot = [
      'Thời gian',
      'Kết quả làm được',
      'Định dạng',
      'File đã tải lên',
      'Tỷ lệ công việc (%)',
      'Tiến độ',
      'Người thực hiện',
      'Ghi ý kiến',
      'Tình trạng',
      'Hành động',
    ];
    for (const t of cot) expect(form, t).toContain(t);
    // Ô khai tạm KHÔNG có name= — FormData của #task-form không được nuốt chúng.
    expect(form).not.toContain('name="kq-tam');
    expect(form).not.toContain("name='kq-tam");
    // Form mới không còn ô nhập link nhiều dòng; từng kết quả nằm trên một dòng của bảng.
    expect(form).not.toContain('name="resultLinks"');
    expect(form).not.toContain('Nhập mỗi link trên một dòng');
    expect(form).toContain('md:grid-cols-3');
    expect(form).toContain('md:col-span-2');
    // Nút ＋ form tạo KHÔNG mở ô chọn file (đó là lỗi đợt 1 còn sót).
    expect(form).not.toContain('moChonFileKetQua(null)');
  });

  it('TCKQ-35: form TẠO CÔNG VIỆC CON (cấp 2) KHÔNG có bảng kết quả — mustFindNhiemVu chỉ cấp 3', () => {
    window.__tf('pendingTaskCreate', { level: 2, parentId: 'CV001', projectId: 'P1' });
    const form = window.createTaskModal(false);
    expect(form).toContain('Tạo công việc con');
    expect(form).toContain('task-ket-qua-danh-sach');
    expect(form).not.toContain('bang-ket-qua');
    expect(form).not.toContain('dong-kq-khai-tam');
  });

  it('TCKQ-36: ＋ trên form tạo thêm dòng 2. ngay trong bảng, không gọi máy chủ', () => {
    document.body.innerHTML =
      '<div id="task-ket-qua-danh-sach">' + window.buildKhungDanhSachKetQua([], '') + '</div>';
    expect(document.querySelectorAll('tr.dong-kq-khai-tam')).toHaveLength(1);
    let fetchGoi = 0;
    window.fetch = () => {
      fetchGoi += 1;
      return Promise.reject(new Error('KHONG DUOC GOI'));
    };
    window.themDongKhaiTam();
    expect(document.querySelectorAll('tr.dong-kq-khai-tam')).toHaveLength(2);
    const so = [...document.querySelectorAll('.kq-tam-so')].map((el) => el.textContent);
    expect(so).toEqual(['1.', '2.']);
    expect(fetchGoi).toBe(0);
  });

  it('TCKQ-37: thuThapDongKhaiTam bỏ dòng chưa đặt tên; chọn Báo cáo thì hiện ô nội dung', () => {
    document.body.innerHTML =
      '<div id="task-ket-qua-danh-sach">' + window.buildKhungDanhSachKetQua([], '') + '</div>';
    window.themDongKhaiTam();
    const dong = document.querySelectorAll('tr.dong-kq-khai-tam');
    dong[0].querySelector('.kq-tam-ten').value = 'Báo cáo quý 3';
    dong[0].querySelector('.kq-tam-dinh-dang').value = 'Word';
    dong[0].querySelector('.kq-tam-y-kien').value = 'Nộp trước 15/9';
    // Dòng 2 để trống tên → bị bỏ.
    dong[1].querySelector('.kq-tam-ten').value = '   ';
    const ra = window.thuThapDongKhaiTam();
    // `tyLe: null` là KHAI BÁO tỷ lệ của R4/R4'' — bỏ trống thì máy chủ tự chia, không phải là 0.
    expect(ra).toEqual([
      {
        tenKetQua: 'Báo cáo quý 3',
        dinhDang: 'Word',
        yKien: 'Nộp trước 15/9',
        noiDung: '',
        tyLe: null,
      },
    ]);
    // Đổi dòng 1 sang «Báo cáo» → ô nội dung hiện.
    const sel = dong[0].querySelector('.kq-tam-dinh-dang');
    sel.value = 'Báo cáo';
    window.doiDinhDangDongTam(sel);
    expect(dong[0].nextElementSibling.classList.contains('kq-tam-noi-dung-hang')).toBe(true);
    expect(dong[0].nextElementSibling.classList.contains('hidden')).toBe(false);
    expect(dong[0].children).toHaveLength(10);
    expect(dong[0].lastElementChild.querySelector('textarea')).toBe(null);
    const noiDung = dong[0].nextElementSibling;
    expect(noiDung.firstElementChild.colSpan).toBe(10);
    noiDung.querySelector('textarea').value = 'Nội dung báo cáo tiếng Việt';
    expect(window.thuThapDongKhaiTam()[0]).toEqual({
      tenKetQua: 'Báo cáo quý 3',
      dinhDang: 'Báo cáo',
      yKien: 'Nộp trước 15/9',
      noiDung: 'Nội dung báo cáo tiếng Việt',
      tyLe: null,
    });
    sel.value = 'Word';
    window.doiDinhDangDongTam(sel);
    expect(noiDung.classList.contains('hidden')).toBe(true);
    // R4 (ĐỢT B): ô «Tỷ lệ (%)» nằm NGAY TRONG KHUNG KHAI — lần gửi đầu chỉ có khai báo đi theo cây.
    // Sai kiểu hoặc ngoài 0–100 thì trả `null` để máy chủ tự chia, chứ không âm thầm gửi số bậy.
    const oTyLe = dong[0].querySelector('.kq-tam-ty-le');
    expect(oTyLe).not.toBeNull();
    oTyLe.value = '40';
    expect(window.thuThapDongKhaiTam()[0].tyLe).toBe(40);
    oTyLe.value = '0';
    expect(window.thuThapDongKhaiTam()[0].tyLe).toBe(0);
    for (const sai of ['150', '-5', 'abc', '']) {
      oTyLe.value = sai;
      expect(window.thuThapDongKhaiTam()[0].tyLe).toBeNull();
    }
  });

  it('TCKQ-37b: xoá dòng khai xoá cả hàng báo cáo và đánh lại số', () => {
    document.body.innerHTML =
      '<div id="task-ket-qua-danh-sach">' + window.buildKhungDanhSachKetQua([], '') + '</div>';
    window.themDongKhaiTam();
    const dong = document.querySelector('tr.dong-kq-khai-tam');
    const noiDung = dong.nextElementSibling;
    window.xoaDongKhaiTam(dong.querySelector('button'));
    expect(dong.isConnected).toBe(false);
    expect(noiDung.isConnected).toBe(false);
    expect(document.querySelectorAll('.kq-tam-noi-dung-hang')).toHaveLength(1);
    expect(document.querySelector('.kq-tam-so').textContent).toBe('1.');
    window.xoaDongKhaiTam(document.querySelector('tr.dong-kq-khai-tam button'));
    expect(document.querySelectorAll('tr.dong-kq-khai-tam')).toHaveLength(1);
    expect(document.querySelectorAll('.kq-tam-noi-dung-hang')).toHaveLength(1);
  });

  it('TCKQ-38: nhóm 0 bản in «Chưa có»; định dạng lấy cột khai; Báo cáo có ô nhập chữ ở Hành động', () => {
    const chua = window.buildKhoiFile(
      NHOM({ bans: [], ten_ket_qua: 'Quy chế thi', dinh_dang: 'Word', ten_goc: 'Quy chế thi' }),
      'CV001-002'
    );
    expect(chua).toContain('Chưa có');
    expect(chua).toContain('Quy chế thi');
    expect(chua).toContain('fa-file-word');
    expect(chua).not.toContain('kq-nut-bung"'); // không có ▸ khi 0 bản
    const bc = window.buildKhoiFile(
      NHOM({
        bans: [],
        ten_ket_qua: 'Báo cáo tháng',
        dinh_dang: 'Báo cáo',
        laBaoCao: true,
        ten_goc: 'Báo cáo tháng',
      }),
      'CV001-002'
    );
    expect(bc).toContain('Báo cáo tháng');
    expect(bc).toContain('fa-file-lines');
    expect(bc).toContain('task-kq-bc-7');
    expect(bc).toContain('Nộp báo cáo');
    expect(bc).not.toContain('moChonFileKetQua');
  });

  it('TCKQ-39: hàng chờ dòng 1 = ten_ket_qua đã khai; Báo cáo dòng 2 = «Báo cáo (nhập chữ)»', () => {
    const hang = (over = {}) => ({
      id: 7,
      ten_goc: 'ket-qua-quy3.docx',
      trang_thai: 'cho-xem',
      ma_nhiem_vu: 'CV001-002',
      ten_nhiem_vu: 'Soạn quy chế thi sát hạch',
      so_ban: 2,
      ban_cuoi_id: 11,
      ban_cuoi_ten: 'ban-sua.docx',
      hanhDong: [],
      ...over,
    });
    const html = window.buildDongChoDuyetKetQua(
      hang({ ten_ket_qua: 'Quy chế thi sát hạch', dinh_dang: 'Word' })
    );
    expect(html).toContain('Quy chế thi sát hạch');
    expect(html).toContain('ban-sua.docx');
    expect(html).toContain('fa-file-word');
    const bc = window.buildDongChoDuyetKetQua(
      hang({
        ten_ket_qua: 'Báo cáo tuần',
        dinh_dang: 'Báo cáo',
        laBaoCao: true,
        ten_goc: 'Báo cáo tuần',
        ban_cuoi_ten: null,
      })
    );
    expect(bc).toContain('Báo cáo tuần');
    expect(bc).toContain('Báo cáo (nhập chữ)');
    expect(window.tenBanCuoiHangCho({ laBaoCao: true })).toBe('Báo cáo (nhập chữ)');
  });

  it('TCKQ-40: ten_ket_qua / noi_dung / option định dạng chứa HTML phải thoát', () => {
    const html = window.buildBangKetQua(
      [
        NHOM({
          ten_ket_qua: '<img src=x onerror=alert(1)>',
          dinh_dang: 'PDF',
          ten_goc: 'an-toan.pdf',
          bans: [
            {
              id: 11,
              file_id: 7,
              version_no: 1,
              ten_luu: null,
              ten_goc: 'an-toan.pdf',
              loai_mime: null,
              kich_thuoc: null,
              noi_dung: '<svg onload=alert(2)>đủ mười ký tự</svg>',
              uploaded_by: 4,
              uploaded_at: '2026-09-01T10:00:00Z',
              ten_nguoi_nop: 'Nguyễn Văn Cán Bộ',
            },
          ],
        }),
      ],
      'CV001-002'
    );
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
    expect(html).not.toContain('<svg onload=alert(2)>');
    expect(html).toContain('&lt;svg onload=alert(2)&gt;');
    const khung = window.buildKhungKhaiKq('CV001-002');
    expect(khung).toContain('task-kq-khai-ten');
    expect(khung).toContain('value="Báo cáo"');
    expect(khung).not.toContain('moChonFileKetQua(null)');
    const tam = window.buildDongKhaiTam(3);
    expect(tam).toContain('>3.<');
    expect(tam).toContain('value="Word"');
    expect(tam).not.toContain('name=');
  });
});

// ============================================================================
// ĐỢT 4 (2026-09-10) — người dùng, nguyên văn: «Trang sửa nhiệm vụ chỉnh lại giao diện phần file
// kết quả, Tỷ lệ công việc (%) Tiến độ, độ rộng bé đi.. sửa để cân đối hơn. sửa chức năng: Ghi ý
// kiến là các ý kiến mỗi lần sửa hoặc từ chối hoặc ... có ghi ý kiến vào».
//
// Hai việc, hai bản chất KHÁC NHAU:
//  · BỀ RỘNG CỘT là việc trình bày. Bảng `bang-ket-qua` trước đây KHÔNG có colgroup và không
//    `table-layout:fixed` nên trình duyệt tự chia theo NỘI DUNG — hai cột chỉ chứa MỘT CON SỐ
//    («Tỷ lệ», «Tiến độ») phình ra bằng cột chữ chỉ vì TIÊU ĐỀ của chúng dài.
//  · «GHI Ý KIẾN» là THIẾU DỮ LIỆU HIỂN THỊ, không phải thiếu chỗ ghi. Lý do người duyệt gõ khi
//    «Đẩy về Cán bộ» / «Trả về» / «Từ chối» được `taskFiles/service.js verdict()` ghi vào
//    `task_file_flow` qua `repo.themLuong`, KHÔNG ghi vào `task_file_comments`. Cột «Ghi ý kiến»
//    trước đợt 4 chỉ đọc `gopY` (= `task_file_comments`) nên đúng những câu đó biến mất khỏi cột,
//    chỉ còn trong bảng «Lịch sử» phải bấm mới ra. Sửa bằng cách GỘP hai nguồn khi HIỂN THỊ
//    (`danhSachYKien`) — ghi thêm một dòng vào bảng góp ý chỉ nhân đôi dữ liệu và làm lệch mọi
//    phép đếm góp ý đang có.
// ============================================================================
describe('TCKQ — đợt 4: cân đối cột bảng «Kết quả» + gộp ý kiến mỗi lần sửa/trả về', () => {
  const CSS = readFileSync(resolve(process.cwd(), '../web/assets/css/app.css'), 'utf8');
  const beRong = (cot) =>
    Number(CSS.match(new RegExp(`col\\.${cot}\\s*\\{\\s*width:\\s*(\\d+)%`))?.[1]);
  /** Lý do verdict nằm ở `task_file_flow` — fixture phải đúng hình dạng `repo.listLuongByFile` trả. */
  const LUONG = (id, hanh, noi, over = {}) => ({
    id,
    hanh_dong: hanh,
    version_id: 11,
    version_no: 1,
    ten_nguoi: 'Trần Thị Trưởng',
    vai: 'Trưởng phòng',
    noi_dung: noi,
    created_at: '2026-09-0' + id + 'T09:00:00Z',
    ...over,
  });

  it('TCKQ-40: bảng có colgroup và `table-layout:fixed` — bề rộng là SỐ, không để trình duyệt tự chia', () => {
    window.__tfDs(false);
    const html = window.buildBangKetQua([NHOM()], 'CV001-002');
    expect(html).toContain('<colgroup>');
    expect(CSS).toMatch(/\.bang-ket-qua\s*\{[^}]*table-layout:\s*fixed/);
    // colgroup phải nằm TRƯỚC thead, không thì trình duyệt bỏ qua.
    expect(html.indexOf('<colgroup>')).toBeLessThan(html.indexOf('<thead'));
  });

  it('TCKQ-41: colgroup đúng 10 cột theo thứ tự, khớp mọi chỗ colspan="10"', () => {
    window.__tfDs(false);
    const html = window.buildBangKetQua([NHOM()], 'CV001-002');
    const cols = [...html.matchAll(/<col class="([^"]+)"/g)].map((m) => m[1]);
    expect(cols).toEqual([...window.COT_BANG_KET_QUA]);
    expect(window.COT_BANG_KET_QUA).toHaveLength(10);
    // Dòng panel (khung Ý kiến + Lịch sử) và dòng «Chưa có kết quả nào» đều tràn đúng 10 ô.
    expect(html).toContain('colspan="10"');
    expect(window.buildBangKetQua([], 'CV001-002')).toContain('colspan="10"');
    expect(window.buildDongKhaiTam(1)).toContain('colspan="10"');
  });

  it('TCKQ-42: «Tỷ lệ công việc (%)» và «Tiến độ» HẸP hơn mọi cột chữ, cột tên ăn phần còn lại', () => {
    expect(beRong('c-kq-ty-le')).toBeLessThanOrEqual(8);
    expect(beRong('c-kq-tien-do')).toBeLessThanOrEqual(6);
    for (const cot of ['c-kq-file', 'c-kq-y-kien', 'c-kq-trang-thai', 'c-kq-thoi-gian']) {
      expect(beRong('c-kq-ty-le'), cot).toBeLessThan(beRong(cot));
      expect(beRong('c-kq-tien-do'), cot).toBeLessThan(beRong(cot));
    }
    // `c-kq-ten` KHÔNG được khai bề rộng: nó là cột auto ăn phần còn lại. Khai % cho nó là cả bảng
    // mất khả năng co giãn theo bề rộng modal.
    expect(CSS).not.toMatch(/col\.c-kq-ten\s*\{/);
    // Tổng chín cột số phải chừa chỗ cho cột tên: quá 85% là cột tên còn dưới 15%, không đọc được.
    const tong = [
      'c-kq-thoi-gian',
      'c-kq-dinh-dang',
      'c-kq-file',
      'c-kq-ty-le',
      'c-kq-tien-do',
      'c-kq-nguoi',
      'c-kq-y-kien',
      'c-kq-trang-thai',
      'c-kq-hanh-dong',
    ].reduce((s, c) => s + beRong(c), 0);
    expect(tong).toBeGreaterThan(60);
    expect(tong).toBeLessThanOrEqual(85);
    // Tiêu đề «Tỷ lệ công việc (%)» dài hơn cột 8%: phải cho XUỐNG DÒNG, không được đẩy cột phình ra.
    expect(CSS).toMatch(/\.bang-ket-qua thead th\s*\{[^}]*white-space:\s*normal/);
    // Ô tỷ lệ: input và nút «Lưu tỷ lệ» XẾP DỌC — cột 8% không đủ chỗ xếp ngang.
    expect(CSS).toMatch(/\.kq-o-ty-le-trong\s*\{[^}]*flex-direction:\s*column/);
    const o = window.buildKhoiFile(NHOM({ duocSuaTyLe: true }), 'CV001-002');
    expect(o).toContain('kq-o-ty-le-trong');
    expect(o).toContain('kq-nut-luu-ty-le');
    expect(o).not.toContain('class="form-input w-20"');
  });

  it('TCKQ-43: danhSachYKien GỘP góp ý với lý do verdict, LOẠI trùng `gom-y`, sắp CŨ → MỚI', () => {
    const n = NHOM({
      gopY: [
        {
          id: 5,
          version_id: 11,
          ten_nguoi: 'Trần Thị Trưởng',
          vai: 'Trưởng phòng',
          noi_dung: 'Thiếu chữ ký',
          created_at: '2026-09-03T11:00:00Z',
        },
      ],
      luong: [
        // `gomY()` ghi CẢ HAI bảng (themGopY rồi themLuong) — lấy cả là in cùng một câu hai lần.
        LUONG(3, 'gom-y', 'Thiếu chữ ký', { created_at: '2026-09-03T11:00:00Z' }),
        // ĐIỂM 9 (ĐỢT B): «Yêu cầu sửa» đã gộp vào «Trả về Cán bộ», 029 đổi tên toàn bộ dòng cũ nên
        // bảng luồng chỉ còn HAI mã trả lại. Đổi sang `tra-ve-tp` cho dòng kia để ba nhãn vẫn phân
        // biệt được nhau — nhãn trùng nhau thì câu assert dưới không còn bắt được lỗi.
        LUONG(4, 'tra-ve-cbo', 'Làm lại trang 3'),
        LUONG(5, 'tra-ve-tp', 'Số liệu lệch', { ten_nguoi: 'Ngô Văn Phó', vai: 'Phó Giám đốc' }),
        // Không có nội dung thì chỉ là một MỐC TRẠNG THÁI, không phải ý kiến.
        LUONG(2, 'nop', ''),
        LUONG(6, 'gui-duyet', '   '),
      ],
    });
    const ds = window.danhSachYKien(n);
    expect(ds.map((y) => y.noi_dung)).toEqual(['Thiếu chữ ký', 'Làm lại trang 3', 'Số liệu lệch']);
    // NHÃN hành động là thứ làm đọc ra ý kiến này của lần «Trả về Cán bộ» hay một câu góp ý thường.
    expect(ds.map((y) => y.nhan)).toEqual(['Góp ý', 'Trả về Cán bộ', 'Trả về TP/PP']);
    expect(ds.every((y) => Number(y.version_id) === 11)).toBe(true);
    // Thiếu khoá vẫn phải trả mảng rỗng, không ném — bảng gọi hàm này cho MỌI nhóm kể cả nhóm mới khai.
    expect(window.danhSachYKien({})).toEqual([]);
    expect(window.danhSachYKien(null)).toEqual([]);
    expect(window.yKienCuaBan({}, null)).toEqual([]);
  });

  it('TCKQ-44: cột «Ghi ý kiến» của dòng cha CHỈ CÒN chữ «Xem ý kiến» (N) mở popup in TẤT CẢ', () => {
    window.__tfDs(false);
    const dong = window.buildKhoiFile(
      NHOM({ luong: [LUONG(4, 'tra-ve-cbo', 'Làm lại trang 3')] }),
      'CV001-002'
    );
    // ĐỢT 5 (2026-09-11) — người dùng: «phần ghi ý kiến sẽ là hiển thị chữ "xem ý kiến", click vào
    // đấy sẽ hiển thị popup … còn bản đầu 1. đấy sẽ xem tất cả». Vậy Ô TRONG BẢNG KHÔNG in nội dung
    // nữa (đợt 4 in tại chỗ, đợt 5 dời hết ra popup cho bảng khỏi cao).
    // SOI ĐÚNG Ô `.kq-o-y-kien`, KHÔNG soi cả dòng: khung «Lịch sử» (`buildBangLuongFile`) vẫn in
    // `noi_dung` của luồng — đó là BẢNG LUỒNG, một tính năng khác, bắt nó im là phá khung Lịch sử.
    const oY = (html) => {
      document.body.innerHTML = '<table><tbody>' + html + '</tbody></table>';
      return [...document.querySelectorAll('.kq-o-y-kien')];
    };
    const cacO = oY(dong);
    expect(cacO.length).toBeGreaterThan(0);
    for (const o of cacO) {
      expect(o.textContent).not.toContain('Làm lại trang 3');
      expect(o.innerHTML).not.toContain('y-kien-nhan');
    }
    // Nút mở popup, `banId` RỖNG ⇒ popup in tất cả ý kiến của nhóm.
    expect(dong).toContain('>Xem ý kiến (1)</button>');
    expect(dong).toContain("moYKienKetQua('CV001-002', '7', '')");
    expect(dong).toContain('>Lịch sử</button>');
    // Con số vẫn đếm theo danh sách GỘP (`danhSachYKien`), không chỉ `gopY` — bẫy đợt 4 giữ nguyên.
    const gop = window.buildKhoiFile(
      NHOM({
        gopY: [
          {
            id: 5,
            version_id: 11,
            ten_nguoi: 'TP',
            vai: 'Trưởng phòng',
            noi_dung: 'Câu gõ tay',
            created_at: '2026-09-01T10:05:00Z',
          },
        ],
        luong: [LUONG(4, 'tra-ve-cbo', 'Làm lại trang 3')],
      }),
      'CV001-002'
    );
    expect(gop).toContain('>Xem ý kiến (2)</button>');
    // Không có ý kiến nào thì chữ vẫn hiện (không đếm), không để ô trống không.
    const rong = window.buildKhoiFile(NHOM(), 'CV001-002');
    expect(rong).toContain('>Xem ý kiến</button>');
    expect(rong).not.toContain('>Xem ý kiến (');
  });

  it('TCKQ-45: dòng bản 1.1/1.2 mở popup CỦA ĐÚNG BẢN ĐÓ, đếm đúng ý kiến của bản đó', () => {
    window.__tfDs(false);
    const n = NHOM({
      bans: [
        { ...NHOM().bans[0] },
        { ...NHOM().bans[0], id: 12, version_no: 2, uploaded_at: '2026-09-05T10:00:00Z' },
      ],
      luong: [
        LUONG(4, 'tra-ve-cbo', 'Làm lại trang 3'),
        LUONG(6, 'duyet', 'Ổn rồi', {
          version_id: 12,
          version_no: 2,
          ten_nguoi: 'Ngô Văn Phó',
          vai: 'Phó Giám đốc',
        }),
      ],
    });
    const d1 = window.buildDongBanKetQua(n, n.bans[0], 0, 1, 'CV001-002');
    const d2 = window.buildDongBanKetQua(n, n.bans[1], 1, 1, 'CV001-002');
    // `banId` = id của ĐÚNG bản đó ⇒ popup chỉ in ý kiến của bản đó («popup xem ý kiến của bản đấy»).
    expect(d1).toContain("moYKienKetQua('CV001-002', '7', '11')");
    expect(d2).toContain("moYKienKetQua('CV001-002', '7', '12')");
    // Nội dung KHÔNG in tại chỗ nữa — cách ly nằm ở `banId` truyền vào popup.
    expect(d1).not.toContain('Làm lại trang 3');
    expect(d2).not.toContain('Ổn rồi');
    expect(d1).toContain('>Xem ý kiến (1)</button>');
    expect(d2).toContain('>Xem ý kiến (1)</button>');
    expect(d2).toContain('Sửa lần 1');
    // Bản không có ý kiến nào vẫn hiện CHỮ «Xem ý kiến» (không đếm), không để ô rỗng không đọc được.
    const d3 = window.buildDongBanKetQua(NHOM(), { ...NHOM().bans[0], id: 99 }, 0, 1, 'CV001-002');
    expect(d3).toContain('>Xem ý kiến</button>');
    expect(d3).toContain("moYKienKetQua('CV001-002', '7', '99')");
    // Luật LỌC theo bản vẫn đúng ở tầng dữ liệu — popup chỉ là chỗ in ra, đừng để nó tự lọc lại.
    expect(window.yKienCuaBan(n, n.bans[0]).map((y) => y.noi_dung)).toEqual(['Làm lại trang 3']);
    expect(window.yKienCuaBan(n, n.bans[1]).map((y) => y.noi_dung)).toEqual(['Ổn rồi']);
    // Thiếu `ma` (lời gọi cũ bốn tham số) thì KHÔNG được ném — popup chỉ không mở, bảng vẫn vẽ.
    const khongMa = window.buildDongBanKetQua(n, n.bans[0], 0, 1);
    expect(khongMa).toContain("moYKienKetQua('', '7', '11')");
  });

  it('TCKQ-46: ý kiến gộp từ luồng chứa HTML phải THOÁT — không dựng được thẻ', () => {
    const y = window.buildMotYKien({
      ten_nguoi: '<img src=x onerror=alert(1)>',
      vai: '"><script>alert(2)</script>',
      noi_dung: '<svg onload=alert(3)>',
      nhan: 'Trả về Cán bộ',
      created_at: '2026-09-04T09:00:00Z',
      version_no: 1,
    });
    expect(y).not.toContain('<img src=x');
    expect(y).toContain('&lt;img src=x');
    expect(y).not.toContain('<script>');
    expect(y).not.toContain('<svg onload');
    expect(y).toContain('Trả về Cán bộ');
    // Đường đi dài nhất SAU ĐỢT 5: luồng → `danhSachYKien` → `buildYKienPanel` (thân popup của dòng
    // cha). Trước đợt 5 đường này kết thúc ở cột «Ghi ý kiến» của `buildKhoiFile` — nay ô đó không còn
    // in nội dung nên phải kiểm ở panel, nếu không là bỏ lọt đúng chỗ popup sắp innerHTML.
    window.__tfDs(false);
    const panel = window.buildYKienPanel(
      NHOM({ luong: [LUONG(4, 'tra-ve-cbo', '<img src=x onerror=alert(9)>')] }),
      'CV001-002'
    );
    expect(panel).not.toContain('<img src=x');
    expect(panel).toContain('&lt;img src=x');
    // Bảng vẫn không được lọt THẺ THẬT vào ô «Ghi ý kiến» (ô nay chỉ có nút). SOI ĐÚNG Ô đó, không
    // soi cả dòng: khung «Lịch sử» in `noi_dung` của luồng và nó ĐÃ THOÁT (`&lt;img…`) — đó là đúng,
    // bắt nó «không chứa &lt;img» là bắt nó im luôn cả bảng luồng.
    const dong = window.buildKhoiFile(
      NHOM({ luong: [LUONG(4, 'tra-ve-cbo', '<img src=x onerror=alert(9)>')] }),
      'CV001-002'
    );
    expect(dong).not.toContain('<img src=x');
    document.body.innerHTML = '<table><tbody>' + dong + '</tbody></table>';
    for (const o of document.querySelectorAll('.kq-o-y-kien')) {
      expect(o.textContent).not.toContain('<img src=x');
      expect(o.textContent).not.toContain('alert(9)');
    }
  });
});

// ============================================================================
// TCKQ — ĐỢT 5 (2026-09-11): POPUP «XEM Ý KIẾN» + tiêu đề cột CĂN GIỮA +
// «Người thực hiện» CĂN GIỮA. Người dùng: «phần ghi ý kiến sẽ là hiển thị chữ "xem ý kiến",
// click vào đấy sẽ hiển thị popup xem ý kiến của bản đấy, còn bản đầu 1. đấy sẽ xem tất cả,
// tiêu đề cột căn giữa, Người thực hiện cũng sẽ căn giữa».
// ============================================================================
describe('TCKQ — đợt 5: popup «Xem ý kiến» + căn giữa tiêu đề cột và người thực hiện', () => {
  const CSS = readFileSync(resolve(process.cwd(), '../web/assets/css/app.css'), 'utf8');
  const LUONG = (id, hanh, noi, over = {}) => ({
    id,
    hanh_dong: hanh,
    version_id: 11,
    version_no: 1,
    ten_nguoi: 'Trần Thị Trưởng',
    vai: 'Trưởng phòng',
    noi_dung: noi,
    created_at: '2026-09-0' + id + 'T09:00:00Z',
    ...over,
  });
  const HAI_BAN = () =>
    NHOM({
      bans: [
        { ...NHOM().bans[0] },
        { ...NHOM().bans[0], id: 12, version_no: 2, uploaded_at: '2026-09-05T10:00:00Z' },
      ],
      luong: [
        LUONG(4, 'tra-ve-cbo', 'Làm lại trang 3'),
        LUONG(6, 'duyet', 'Ổn rồi', {
          version_id: 12,
          version_no: 2,
          ten_nguoi: 'Ngô Văn Phó',
          vai: 'Phó Giám đốc',
        }),
      ],
    });
  /**
   * Máy chủ trả `bans` chứ KHÔNG phải `ban` — bẫy đợt 4, fixture phải chép đúng tên khoá của
   * `taskFiles/service.js doc()`, không đặt theo trí nhớ.
   *
   * Một mock cho CẢ BA đường mà popup đi qua: GET danh sách file, GET `/api/csrf` (POST nào cũng
   * hỏi token trước), và POST góp ý. Trả lẫn nhau là popup mở ra rỗng mà test vẫn tưởng xanh.
   */
  const mockFiles = (nhom) => {
    // KHÔNG dùng `async` ở đây: mock chỉ trả giá trị có sẵn, gắn `async` vào là eslint bắt lỗi
    // `require-await` (hàm async không có await nào). `Promise.resolve` là đủ và đúng nghĩa hơn.
    window.fetch = (path, opts) => {
      const method = (opts && opts.method) || 'GET';
      const tra = (data) =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data }),
        });
      if (method === 'POST') return tra({ id: 1 });
      if (String(path).indexOf('/api/csrf') === 0) return tra({ csrfToken: 'tk' });
      return tra({ nhom: [nhom] });
    };
  };
  const popup = () => document.getElementById('y-kien-dialog');

  it('TCKQ-47: popup của DÒNG CHA (banId rỗng) in TẤT CẢ ý kiến và CÓ ô nhập để ghi tiếp', async () => {
    mockFiles(HAI_BAN());
    await window.moYKienKetQua('CV001-002', 7, '');
    const p = popup();
    expect(p).toBeTruthy();
    expect(p.getAttribute('role')).toBe('dialog');
    expect(p.getAttribute('aria-modal')).toBe('true');
    // «còn bản đầu 1. đấy sẽ xem tất cả» — cả hai ý kiến của hai bản đều phải có mặt.
    expect(p.querySelector('h3').textContent).toContain('Toàn bộ ý kiến');
    expect(p.textContent).toContain('Làm lại trang 3');
    expect(p.textContent).toContain('Ổn rồi');
    // Nhãn hành động phải đọc ra ý kiến này của lần «Trả về Cán bộ» hay «Duyệt» (giữ từ đợt 4).
    expect(p.querySelectorAll('.y-kien-nhan')).toHaveLength(2);
    // Ô NHẬP dời theo popup: cột tên «Ghi ý kiến» nên đọc và viết phải ở cùng một chỗ, bỏ ô nhập đi
    // là mất luôn chức năng ghi.
    expect(p.querySelector('#task-y-kien-7')).toBeTruthy();
    expect(p.querySelector('#task-y-kien-7').dataset.banCuoi).toBe('12');
    expect(p.textContent).toContain('Gửi ý kiến');
    expect(p.querySelector('footer button')).toBeTruthy();
  });

  it('TCKQ-48: popup của DÒNG BẢN chỉ in ý kiến CỦA BẢN ĐÓ và CHỈ ĐỌC', async () => {
    mockFiles(HAI_BAN());
    await window.moYKienKetQua('CV001-002', 7, 12);
    const p = popup();
    expect(p.querySelector('h3').textContent).toContain('Ý kiến của bản 2');
    expect(p.textContent).toContain('Ổn rồi');
    // «popup xem ý kiến của bản đấy» — ý kiến của bản 1 KHÔNG được lẫn sang.
    expect(p.textContent).not.toContain('Làm lại trang 3');
    // CHỈ ĐỌC: máy chủ chỉ cho ghi góp ý vào BẢN MỚI NHẤT (`guiYKien` POST theo `data-ban-cuoi`),
    // để ô nhập ở popup của bản cũ là mời người dùng viết vào một chỗ rồi chữ chạy sang bản khác.
    expect(p.querySelector('#task-y-kien-7')).toBeNull();
    expect(p.querySelector('.yk-chu-thich')).toBeTruthy();
    expect(p.textContent).toContain('chỉ để ĐỌC');
  });

  it('TCKQ-49: đóng popup bằng nút Đóng, bằng Escape, bằng bấm nền — và KHÔNG chồng hai lớp phủ', async () => {
    mockFiles(HAI_BAN());
    await window.moYKienKetQua('CV001-002', 7, '');
    popup().querySelector('footer button').click();
    expect(popup()).toBeNull();

    await window.moYKienKetQua('CV001-002', 7, '');
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(popup()).toBeNull();

    await window.moYKienKetQua('CV001-002', 7, '');
    popup().dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    expect(popup()).toBeNull();

    // Mở LIÊN TIẾP hai dòng mà không gỡ cái cũ là chồng hai lớp phủ và Escape phải bấm hai lần.
    await window.moYKienKetQua('CV001-002', 7, '');
    await window.moYKienKetQua('CV001-002', 7, 12);
    expect(document.querySelectorAll('#y-kien-dialog')).toHaveLength(1);
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelectorAll('#y-kien-dialog')).toHaveLength(0);
  });

  it('TCKQ-50: tiêu đề cột CĂN GIỮA, «Người thực hiện» CĂN GIỮA ở cả dòng cha lẫn dòng bản', () => {
    window.__tfDs(false);
    const bang = window.buildBangKetQua([HAI_BAN()], 'CV001-002');
    // Đếm BẰNG DOM, không đếm bằng regex: chuỗi trả về còn chứa bảng luồng của khung «Lịch sử»
    // (`<th>` riêng) và cả thẻ `<thead>` — `/<th[^>]*>/` bắt nhầm `<thead>` nên ra 17 chứ không 10.
    document.body.innerHTML = bang;
    const th = [...document.querySelectorAll('.bang-ket-qua > thead > tr > th')];
    // «tiêu đề cột căn giữa» — MỌI <th> của bảng chính, kể cả «Hành động» (đợt 4 còn để text-right).
    expect(th).toHaveLength(10);
    for (const o of th) {
      expect(o.className).toContain('text-center');
      expect(o.className).not.toContain('text-left');
      expect(o.className).not.toContain('text-right');
    }
    // Bảng luồng trong khung «Lịch sử» cũng căn giữa cho nhất quán cùng trang.
    const thLuong = [...document.querySelectorAll('.dong-kq-panel th')];
    expect(thLuong.length).toBeGreaterThan(0);
    for (const o of thLuong) expect(o.className).toContain('text-center');
    // Không dựa một mình vào class Tailwind: `app.css` cũng phải ép, đúng bẫy đợt 4 về bản vendor
    // biên dịch sẵn (class arbitrary như `text-[11px]` không hề tồn tại trong đó).
    expect(CSS).toMatch(/\.bang-ket-qua thead th\s*\{[^}]*text-align:\s*center/);
    // «Người thực hiện cũng sẽ căn giữa» — cả dòng cha lẫn dòng bản 1.1/1.2, cùng MỘT cột.
    const dongCha = window.buildKhoiFile(HAI_BAN(), 'CV001-002');
    expect(dongCha).toContain('kq-o-nguoi');
    const dongBan = window.buildDongBanKetQua(HAI_BAN(), HAI_BAN().bans[1], 1, 1, 'CV001-002');
    expect(dongBan).toContain('kq-o-nguoi');
    expect(CSS).toMatch(/\.kq-o-nguoi\s*\{\s*text-align:\s*center/);
  });

  it('TCKQ-51: gửi ý kiến từ popup — THÀNH CÔNG thì đóng, ô còn chữ (thất bại) thì GIỮ popup', async () => {
    mockFiles(HAI_BAN());
    await window.moYKienKetQua('CV001-002', 7, '');
    const o = popup().querySelector('#task-y-kien-7');
    o.value = 'Ý kiến đủ dài để gửi được';
    // POST thành công ⇒ `guiYKien` xoá ô nhập ⇒ lấy đúng dấu hiệu đó làm điều kiện đóng.
    await window.guiYKienTuPopup(7, 'CV001-002');
    expect(popup()).toBeNull();

    // Thất bại: `guiYKien` GIỮ nguyên chữ trong ô và chỉ toast — đóng popup lúc đó là mất chữ người
    // dùng vừa gõ. (`data-ban-cuoi` rỗng ⇒ không POST ⇒ ô còn nguyên chữ.)
    await window.moYKienKetQua('CV001-002', 7, '');
    const o2 = popup().querySelector('#task-y-kien-7');
    o2.value = 'Còn nguyên đây';
    o2.dataset.banCuoi = '';
    await window.guiYKienTuPopup(7, 'CV001-002');
    expect(popup()).toBeTruthy();
    expect(popup().querySelector('#task-y-kien-7').value).toBe('Còn nguyên đây');
  });
});
