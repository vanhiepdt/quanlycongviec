// @vitest-environment jsdom
//
// «Hoạt động gần đây» ở trang Tổng quan (TC-HD-01..10, 2026-08-29, mở rộng 2026-09-12):
//  - hành động ra NHÃN tiếng Việt + icon (bản đồ NHAT_KY_HANH_DONG dùng chung với tab Nhật ký);
//  - hết dòng rác "{}" và hết mã «CV003 — …» trong mô tả tên theo tháng;
//  - hành động lạ vẫn hiện nguyên tên, mọi chuỗi đều thoát HTML;
//  - `details` dịch theo KHOÁ, không bao giờ in JSON thô (`{"revokedSessions":0}`);
//  - bản dịch của máy chủ (`activityToLegacy`, đường RPC) khớp TỪNG CHỮ bản của giao diện
//    (`moTaChiTietHoatDong`, đường REST) — hai chuỗi đó hiện trên cùng một panel.
// Test chạy app.js THẬT trong jsdom (mẫu nhat-ky-ui.test.js), `fetch` giả. Quy ước gọi hàm đã
// xuất qua `window.` — eslint chỉ mở global trình duyệt cho nhóm file này.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COL as COL_MAY_CHU, activityToLegacy } from '../../src/rpc/legacyFields.js';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  COL,
  renderActivity, hoatDongSangLegacy, moTaChiTietHoatDong, nhanHanhDongNhatKy, nhanThangVN,
});`;

function khoiDung() {
  new Function(APP_SRC + EXPORTS)();
}

/** Một dòng hoạt động như giao diện nhận được (khoá COL.A_*). */
const dong = (over = {}) => ({
  [window.COL.A_ACTION]: 'works.setMonthName',
  [window.COL.A_DETAILS]: 'Quyết toán Q3 · Tháng 8/2026 · tên mới: Tháng 8',
  [window.COL.A_USER]: 'Phó GD Một',
  [window.COL.A_TIME]: '2026-08-29T05:00:00.000Z',
  ...over,
});

beforeEach(() => {
  document.body.innerHTML = '<div id="recent-activity"></div>';
  window.fetch = vi.fn();
  khoiDung();
});

describe('TC-HD — «Hoạt động gần đây» đọc được bằng tiếng Việt', () => {
  it('TC-HD-01: works.setMonthName → nhãn «Đặt tên theo tháng» + icon, KHÔNG còn chữ action thô', () => {
    window.renderActivity([dong()]);
    const html = document.getElementById('recent-activity').innerHTML;
    expect(html).toContain('Đặt tên theo tháng');
    expect(html).toContain('fa-calendar-day');
    expect(html).not.toContain('works.setMonthName');
  });

  it('TC-HD-02: mô tả rỗng ⇒ bỏ hẳn dòng phụ (hết "{}"); người + giờ vẫn hiện', () => {
    window.renderActivity([dong({ [window.COL.A_DETAILS]: '' })]);
    const html = document.getElementById('recent-activity').innerHTML;
    expect(html).not.toContain('{}');
    expect(html).not.toContain('text-gray-600 mt-1');
    expect(html).toContain('Phó GD Một');
    expect(html).toContain('•');
  });

  it('TC-HD-03: hành động lạ giữ nguyên tên nhưng vẫn thoát HTML', () => {
    window.renderActivity([dong({ [window.COL.A_ACTION]: 'xu.lang<script>alert(1)</script>' })]);
    const html = document.getElementById('recent-activity').innerHTML;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('xu.lang');
  });

  it('TC-HD-04: hoatDongSangLegacy — details {} ⇒ rỗng; tháng ⇒ tên đầu việc + Tháng n/YYYY, hết mã', () => {
    const rows = window.hoatDongSangLegacy([
      {
        created_at: '2026-08-29T05:00:00.000Z',
        action: 'works.setMonthName',
        actor_name: 'Phó GD Một',
        details: {},
      },
      {
        created_at: '2026-08-29T05:00:00.000Z',
        action: 'works.setMonthName',
        actor_name: 'Phó GD Một',
        details: {
          code: 'CV003',
          workName: 'Quyết toán Q3',
          month: '2026-08',
          name: 'Tháng 8',
          previousName: '',
        },
      },
    ]);
    expect(rows[0][window.COL.A_DETAILS]).toBe('');
    expect(rows[1][window.COL.A_DETAILS]).toContain('Quyết toán Q3');
    expect(rows[1][window.COL.A_DETAILS]).toContain('Tháng 8/2026');
    expect(rows[1][window.COL.A_DETAILS]).toContain('tên mới: Tháng 8');
    expect(rows[1][window.COL.A_DETAILS]).not.toContain('CV003');
  });

  it('TC-HD-05: details.changes ⇒ «Cập nhật N trường» với nhãn cột tiếng Việt', () => {
    const moTa = window.moTaChiTietHoatDong({
      code: 'CV003',
      changes: { status: { from: 'a', to: 'b' }, completion: { from: '10', to: '90' } },
    });
    expect(moTa).toBe('Cập nhật 2 trường: Trạng thái cũ (lịch sử), Hoàn thành (%)');
  });

  it('TC-HD-06: có code + name ⇒ chỉ hiện TÊN (bỏ mã); chỉ có code ⇒ fallback mã', () => {
    expect(window.moTaChiTietHoatDong({ code: 'CV001', name: 'Nâng cấp hệ thống' })).toBe(
      'Nâng cấp hệ thống'
    );
    expect(window.moTaChiTietHoatDong({ code: 'CV001' })).toBe('CV001');
  });

  it('TC-HD-07: nhãn mới — action máy chủ ghi mà bảng cũ thiếu thì hết hiện tên thô', () => {
    const cap = [
      ['auth.changePassword', 'Đổi mật khẩu', 'fa-key'],
      ['settings.update', 'Sửa thiết lập hệ thống', 'fa-gear'],
      ['permissions.update', 'Sửa phân quyền', 'fa-user-shield'],
      ['zalo.tao-ma', 'Lấy mã liên kết Zalo', 'fa-qrcode'],
      ['zalo.lien-ket', 'Liên kết Zalo', 'fa-link'],
      ['zalo.bo-lien-ket', 'Bỏ liên kết Zalo', 'fa-link-slash'],
      ['approvals.return', 'Trả lại để sửa', 'fa-rotate-left'],
      ['approvals.requestDelete', 'Đề nghị xoá', 'fa-trash-arrow-up'],
      ['approvals.approveDelete', 'Duyệt xoá', 'fa-trash-can'],
      ['approvals.rejectDelete', 'Từ chối xoá', 'fa-ban'],
      ['approvals.ty-le.approve', 'Duyệt tỷ lệ mới', 'fa-percent'],
      ['approvals.ty-le.reject', 'Từ chối tỷ lệ mới', 'fa-percent'],
      ['approvals.gui-bld.approve', 'Duyệt đổi BLĐ kiểm soát', 'fa-user-shield'],
      ['approvals.gui-bld.reject', 'Từ chối đổi BLĐ kiểm soát', 'fa-user-shield'],
      ['taskFiles.khai', 'Khai kết quả', 'fa-file-circle-plus'],
      ['taskFiles.nop', 'Nộp file kết quả', 'fa-file-arrow-up'],
      ['taskFiles.nop-bao-cao', 'Nộp báo cáo', 'fa-file-arrow-up'],
      ['taskFiles.luu-tam', 'Lưu tạm kết quả', 'fa-floppy-disk'],
      ['taskFiles.luu-ngay', 'Lưu kết quả', 'fa-floppy-disk'],
      ['taskFiles.ty-le', 'Sửa tỷ lệ file', 'fa-percent'],
      ['taskFiles.gui-di-duyet', 'Gửi kết quả đi duyệt', 'fa-paper-plane'],
      ['taskFiles.gui-ban-moi', 'Gửi bản mới', 'fa-paper-plane'],
      ['taskFiles.huy-lenh-sua', 'Huỷ lệnh sửa', 'fa-ban'],
      ['taskFiles.sua-truc-tuyen', 'Sửa trực tuyến', 'fa-file-pen'],
      ['taskFiles.gom-y', 'Góp ý kết quả', 'fa-comment-dots'],
      ['taskFiles.xoa', 'Xoá file kết quả', 'fa-trash'],
      ['taskFiles.tp-phe-duyet', 'TP/PP phê duyệt', 'fa-clipboard-check'],
      ['taskFiles.tra-ve-cbo', 'Trả về cán bộ', 'fa-reply'],
      ['taskFiles.hoan-thanh', 'Hoàn thành / Duyệt', 'fa-circle-check'],
      ['taskFiles.tra-ve-tp', 'Trả về TP/PP', 'fa-reply'],
      ['taskFiles.duyet', 'Duyệt kết quả', 'fa-circle-check'],
    ];
    for (const [action, nhan, icon] of cap) {
      const cfg = window.nhanHanhDongNhatKy(action);
      expect(cfg.nhan, action).toBe(nhan);
      expect(cfg.icon, action).toBe(icon);
      // Màu chết (class không có trong tailwind.min.css đóng băng) thì chữ hiện màu đen — kiểm luôn
      // để nhãn mới không lặp lại nợ cũ `text-teal-600`.
      expect(cfg.mau, action).toMatch(
        /^text-(gray|blue|green|red|amber|indigo|purple|orange)-\d{3}$/
      );
    }
    window.renderActivity([dong({ [window.COL.A_ACTION]: 'auth.changePassword' })]);
    const html = document.getElementById('recent-activity').innerHTML;
    expect(html).toContain('Đổi mật khẩu');
    expect(html).toContain('fa-key');
    expect(html).not.toContain('auth.changePassword');
  });

  it('TC-HD-08: hết JSON thô — {revokedSessions:0} ⇒ mô tả rỗng, khoá kỹ thuật/khoá lạ ⇒ im lặng', () => {
    expect(window.moTaChiTietHoatDong({ revokedSessions: 0 })).toBe('');
    expect(window.moTaChiTietHoatDong({ revokedSessions: 2 })).toBe('Đã đăng xuất 2 phiên khác');
    expect(window.moTaChiTietHoatDong({ fileId: 7, versionId: 9, changeId: 3 })).toBe('');
    expect(window.moTaChiTietHoatDong({ khoaLa: { a: 1 }, viaDelegationId: 4 })).toBe('');
    window.renderActivity([
      dong({
        [window.COL.A_ACTION]: 'auth.changePassword',
        [window.COL.A_DETAILS]: window.moTaChiTietHoatDong({ revokedSessions: 0 }),
      }),
    ]);
    const html = document.getElementById('recent-activity').innerHTML;
    expect(html).not.toContain('revokedSessions');
    expect(html).not.toContain('{}');
  });

  it('TC-HD-09: dịch khoá nghiệp vụ thành cụm tiếng Việt ngắn, nối bằng « · »', () => {
    const cap = [
      [{ fileId: 12, trangThai: 'can-sua' }, 'Trạng thái file: Cần sửa — nộp bản mới'],
      [
        { code: 'ĐN-01', loai: 'Ngoài kế hoạch', status: 'Chờ duyệt' },
        'ĐN-01 · Loại: Ngoài kế hoạch · Trạng thái: Chờ duyệt',
      ],
      [
        { code: 'CV002', status: { from: 'Đề xuất mới', to: 'Chờ duyệt' } },
        'CV002 · Trạng thái: Đề xuất mới → Chờ duyệt',
      ],
      [
        {
          code: 'CV001-01',
          changes: { due_date: { from: '2026-09-01', to: '2026-09-20' } },
          tyLeDeNghi: 30,
        },
        'Cập nhật 1 trường: Ngày hết hạn · Tỷ lệ đề nghị 30%',
      ],
      // Cột lạ trong `changes` vẫn hiện nguyên tên cột — thà thô một chữ còn hơn giấu mất lượt sửa.
      [
        { code: 'CV001', changes: { duong_dan_moi: { from: 'a', to: 'b' } } },
        'Cập nhật 1 trường: duong_dan_moi',
      ],
      [{ total: 5, type: 'info', toAll: true }, '5 người nhận · Gửi toàn hệ thống'],
      [
        { code: 'CV001', name: 'X', level: 3, deletedChildren: 2, deletedCount: 3 },
        'X · Nhiệm vụ · kèm 2 mục con · Xoá 3 dòng',
      ],
      [{ changeId: 5, guiBldPheDuyet: false }, 'Không gửi BLĐ phê duyệt'],
      [{ changeId: 5, target: 'file', tyLe: 40 }, 'Tỷ lệ 40%'],
      [{ fileId: 1, versionNo: 2, tuDong: false }, 'Bản 2'],
      [{ versionId: 4, daLuu: true }, 'Đã lưu'],
      [
        { fileId: 1, dinhDang: 'Báo cáo', tyLe: 20, choDuyet: true },
        'Định dạng: Báo cáo · Tỷ lệ 20% · Chờ duyệt',
      ],
      [{ reminderId: 3, remindDate: '2026-09-15' }, 'Ngày nhắc 15/09/2026'],
      [{ from: 'CV001', copiedCount: 3 }, 'Từ CV001 · Sao 3 dòng'],
      [
        {
          code: 'CV001',
          name: 'Báo cáo',
          origin: 'Tự đăng ký',
          createdByName: 'An',
          assignedByName: 'Bình',
        },
        'Báo cáo · Nguồn: Tự đăng ký · Người lập: An · Người giao: Bình',
      ],
      [{ count: 4, skipped: 1 }, '4 mục · Bỏ qua 1'],
      [{ length: 240 }, '240 ký tự'],
      [{ code: 'NV010', name: 'Trần Thị B', role: 'Nhân viên' }, 'Trần Thị B · Vai trò: Nhân viên'],
      [
        { code: 'APP1', name: 'App thử', allowedRoles: ['Trưởng phòng', 'Phó phòng'] },
        'App thử · Vai trò được phép: Trưởng phòng, Phó phòng',
      ],
      [{ cancelled: true }, 'Đã hủy'],
      [{ changed: 2, status: 'Đã duyệt' }, '2 thay đổi · Trạng thái: Đã duyệt'],
      [
        { approvalStatus: 'Chờ duyệt', notified: 2, soCon: 1 },
        'Duyệt: Chờ duyệt · Đã báo 2 người · 1 mục con',
      ],
      [{ approvalStatus: 'Đã duyệt', notified: 0, soCon: 0 }, 'Duyệt: Đã duyệt'],
    ];
    for (const [details, kyVong] of cap) {
      expect(window.moTaChiTietHoatDong(details), JSON.stringify(details)).toBe(kyVong);
    }
  });

  it('TC-HD-10: bản máy chủ (RPC) khớp TỪNG CHỮ bản giao diện (REST) — cùng một panel đọc cả hai', () => {
    const danhSach = [
      {},
      { revokedSessions: 0 },
      { revokedSessions: 3 },
      { code: 'CV001' },
      { code: 'CV001', name: 'Nâng cấp hệ thống' },
      {
        code: 'CV003',
        workName: 'Quyết toán Q3',
        month: '2026-08',
        name: 'Tháng 8',
        previousName: '',
      },
      { itemName: 'Nhiệm vụ A', month: '2026-09', previousName: 'Cũ' },
      {
        code: 'CV003',
        changes: { status: { from: 'a', to: 'b' }, completion: { from: '10', to: '90' } },
      },
      { code: 'CV001', changes: { duong_dan_moi: { from: 'a', to: 'b' } }, tyLeDeNghi: 30 },
      { fileId: 12, trangThai: 'cho-lanh-dao' },
      { fileId: 1, versionNo: 2, tuDong: true },
      { changeId: 5, guiBldPheDuyet: true },
      { total: 5, type: 'overdue', toAll: true },
      { code: 'CV001', name: 'X', level: 3, deletedChildren: 2, deletedCount: 3 },
      { code: 'CV001', deletedCount: 1, soCon: 0 },
      { reminderId: 3, remindDate: '2026-09-15' },
      {
        fromUserId: 1,
        toUserId: 2,
        fromDate: '2026-09-01',
        toDate: '2026-09-30',
        departmentIds: [1, 2],
      },
      { from: 'CV001', copiedCount: 3 },
      {
        code: 'CV001',
        name: 'Báo cáo',
        origin: 'Tự đăng ký',
        createdByName: 'An',
        assignedByName: 'Bình',
      },
      { code: 'NV010', name: 'Trần Thị B', role: 'Nhân viên' },
      { code: 'APP1', name: 'App thử', allowedRoles: ['Trưởng phòng'] },
      { code: 'CV002', status: { from: 'Đề xuất mới', to: 'Chờ duyệt' } },
      { code: 'ĐN-01', loai: 'Trong kế hoạch', status: 'Đã duyệt' },
      { count: 4, skipped: 1 },
      { length: 240 },
      { cancelled: true },
      { changed: 2, status: 'Đã duyệt' },
      { approvalStatus: 'Chờ duyệt', notified: 2, soCon: 1 },
      { fileId: 1, dinhDang: 'Excel', tyLe: 20, choDuyet: true },
      { versionId: 4, daLuu: true },
      { versionId: 4, boQua: true },
      { khoaLa: { a: 1 }, viaDelegationId: 4, viaDelegationIds: [4] },
      'Chuỗi có sẵn',
    ];
    for (const details of danhSach) {
      const mayChu = activityToLegacy({
        created_at: '2026-09-12T05:00:00.000Z',
        action: 'works.update',
        actor_name: 'An',
        details,
      })[COL_MAY_CHU.A_DETAILS];
      expect(mayChu, JSON.stringify(details)).toBe(window.moTaChiTietHoatDong(details));
      // Không bên nào được in JSON thô ra panel.
      expect(mayChu, JSON.stringify(details)).not.toMatch(/^\{.*\}$/);
    }
  });
});
