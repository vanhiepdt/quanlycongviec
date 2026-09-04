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
  buildBangChoDuyetKetQua, moChonFileChoDuyet, veTrangThaiUpload,
  khoaPhanCongVoiNhanVien,
  buildBangKetQua, buildDongBanKetQua, batTatBanKq, buildMenuHanhDongKq, batTatMenuKq,
  dongMenuKq, buildIconDinhDang,
  dinhDangCuaTen, cauTinhTrangFile, cauTinhTrangHangCho,
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

// ============================================================================
// TCKQ-23…30 — THIẾT KẾ LẠI khối «Kết quả» theo sheet «kq-modal» của người dùng (2026-09-03):
// bảng 8 cột Thời gian · Kết quả làm được · Định dạng · File đã tải lên · Người thực hiện ·
// Ghi ý kiến · Tình trạng · Hành động. Dòng cha đánh số 1., 2., 3.; mỗi BẢN là một dòng con
// 1.1, 1.2 … kèm chữ «Sửa lần N» và THU GỌN mặc định (người dùng chốt: «bấm ▸ mới bung»).
// Mọi hành động gộp vào MỘT menu ⋯ («ấn vào đây hiển thị các Hành động để chọn»).
// ============================================================================
describe('TCKQ — bảng «Kết quả» 8 cột (thiết kế lại 2026-09-03)', () => {
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

  it('TCKQ-23: bảng đủ 8 cột đúng thứ tự sheet; danh sách rỗng thì nói rõ là chưa có', () => {
    const html = window.buildBangKetQua([NHOM()], 'CV001-002');
    const cot = [
      'Thời gian',
      'Kết quả làm được',
      'Định dạng',
      'File đã tải lên',
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
    expect(window.buildBangKetQua([], 'CV001-002')).toContain('Chưa có kết quả nào.');
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
    // Cột 3 của bảng dùng đúng hàm này.
    expect(window.buildBangKetQua([NHOM({ ten_goc: 'bang.xlsx' })], 'CV001-002')).toContain(
      'Excel'
    );
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
    // Chưa qua «Trình lãnh đạo» thì không được nói là TP/PP đã duyệt.
    expect(window.cauTinhTrangFile({ trang_thai: 'cho-lanh-dao', luong: [] })).toBe(
      'đang đợi Phó Giám đốc/Giám đốc'
    );
    expect(
      window.cauTinhTrangFile({
        trang_thai: 'cho-lanh-dao',
        luong: [{ hanh_dong: 'trinh-lanh-dao' }],
      })
    ).toBe('TP/PP đã duyệt, đang gửi lên Phó Giám đốc/Giám đốc');
    // Đếm số lần trả lại: yeu-cau-sua + tra-ve-tp + tra-ve-cbo.
    expect(
      window.cauTinhTrangFile({
        trang_thai: 'can-sua',
        luong: [{ hanh_dong: 'yeu-cau-sua' }, { hanh_dong: 'nop' }],
      })
    ).toBe('Bị trả lại lần 1 — đang đợi Cán bộ sửa và nộp bản mới');
    expect(
      window.cauTinhTrangFile({
        trang_thai: 'can-sua',
        luong: [
          { hanh_dong: 'yeu-cau-sua' },
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
    expect(html).toContain('Yêu cầu sửa');
    expect(html).toContain('Trình Phó giám đốc');
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
    // 2026-09-03 (thiết kế lại theo sheet «kq-hang-cho»): bảng PHẲNG 8 cột, ba cấp cây thành ba
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
    expect(html).toContain('xuLyVerdictChoDuyet(&#39;7&#39;, &#39;yeu-cau-sua&#39;, true)');
    expect(html).toContain('xuLyVerdictChoDuyet(&#39;7&#39;, &#39;hoan-thanh&#39;, false)');
    expect(html).not.toContain('&#39;duyet&#39;');
    // ✎ sửa trực tuyến + ⬇ tải bản mới nhất, cùng đường với khối «Kết quả».
    expect(html).toContain('/api/v1/task-file-versions/11/editor');
    expect(html).toContain('taiFileKetQua(&#39;11&#39;)');
  });

  it('TCKQ-20: bảng PHẲNG 8 cột theo sheet «kq-hang-cho» — ba cấp cây thành ba CỘT, mỗi file MỘT dòng', () => {
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
