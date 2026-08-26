// @vitest-environment jsdom
//
// Việc 5.6 (nửa giao diện) — nhãn vàng 'Chờ duyệt'.
//
// Hai điều phải đúng, và điều thứ hai mới là điều dễ hỏng:
//   1. Mục chờ duyệt CÓ nhãn, mục đã duyệt KHÔNG có — cả ở thẻ dự án lẫn dòng nhiệm vụ.
//   2. Nhãn không mở thêm một lỗ XSS. Nội dung nhãn là hằng số, nhưng nó được nối vào cùng một
//      chuỗi HTML với tên do người dùng đặt; nếu chỗ nối sai vị trí thì tên thoát ra ngoài thẻ.
//      Vì vậy test bơm đòn tấn công vào TÊN của một mục đang chờ duyệt, chứ không kiểm nhãn rời.
//
// Chạy app.js bằng `new Function` rồi tự xuất hàm cần gọi — cùng cách của xss-escape.test.js.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  escapeHtml, isPendingApproval, pendingApprovalBadge, createProjectCard, createTaskTableRowSimple,
  createTaskListItem, COL,
  __dat: (ten, giaTri) => { ({ allTasks: () => { allTasks = giaTri; },
    allProjects: () => { allProjects = giaTri; },
    currentUser: () => { currentUser = giaTri; } })[ten](); }
});`;

const DON = '<img src=x onerror="window.BI_CHIEM=1">';

/** Một dự án tối thiểu đủ để `createProjectCard` chạy. */
function duAn(trangThaiDuyet, ten = 'Việc A') {
  return {
    [window.COL.P_ID]: 'CV001',
    [window.COL.P_NAME]: ten,
    [window.COL.P_STATUS]: 'Đang thực hiện',
    [window.COL.P_APPROVAL]: trangThaiDuyet,
  };
}

/** Một nhiệm vụ tối thiểu đủ để hai hàm vẽ dòng chạy. */
function nhiemVu(trangThaiDuyet, ten = 'Nhiệm vụ A') {
  return {
    [window.COL.T_ID]: 'CV001-01',
    [window.COL.T_PID]: 'CV001',
    [window.COL.T_NAME]: ten,
    [window.COL.T_STATUS]: 'Đang thực hiện',
    [window.COL.T_PRIORITY]: 'Trung bình',
    [window.COL.T_APPROVAL]: trangThaiDuyet,
  };
}

/** Dán chuỗi HTML vào DOM thật rồi hỏi lại — kiểm cái trình duyệt DỰNG được, không kiểm chuỗi. */
function dung(html) {
  const hop = document.createElement('div');
  hop.innerHTML = html;
  return hop;
}

beforeEach(() => {
  document.body.innerHTML = '<div id="thu"></div>';
  delete window.BI_CHIEM;
  new Function(APP_SRC + EXPORTS)();
  window.__dat('allTasks', []);
  window.__dat('allProjects', []);
  window.__dat('currentUser', { name: 'Người khác', role: 'Nhân viên' });
});

describe('isPendingApproval — nhận đúng mục chờ duyệt', () => {
  it('đúng "Chờ duyệt" mới là chờ duyệt', () => {
    expect(window.isPendingApproval({ 'Trạng thái duyệt': 'Chờ duyệt' })).toBe(true);
  });

  it('Đã duyệt / Từ chối / rỗng / thiếu cột / null đều không phải', () => {
    for (const giaTri of ['Đã duyệt', 'Từ chối', '', undefined]) {
      expect(window.isPendingApproval({ 'Trạng thái duyệt': giaTri })).toBe(false);
    }
    expect(window.isPendingApproval({})).toBe(false);
    expect(window.isPendingApproval(null)).toBe(false);
  });

  it('dùng chung một tên cột cho cả dự án và nhiệm vụ', () => {
    expect(window.COL.P_APPROVAL).toBe(window.COL.T_APPROVAL);
  });
});

describe('pendingApprovalBadge — chuỗi nhãn', () => {
  it('mục chờ duyệt sinh ra một thẻ .status-awaiting ghi "Chờ duyệt"', () => {
    const nhan = dung(window.pendingApprovalBadge({ 'Trạng thái duyệt': 'Chờ duyệt' }));
    const span = nhan.querySelector('.status-awaiting');
    expect(span).not.toBeNull();
    expect(span.textContent).toContain('Chờ duyệt');
    expect(span.classList.contains('status-badge')).toBe(true);
  });

  it('mục đã duyệt sinh ra chuỗi RỖNG, không phải thẻ ẩn', () => {
    expect(window.pendingApprovalBadge({ 'Trạng thái duyệt': 'Đã duyệt' })).toBe('');
  });
});

describe('Nhãn vàng xuất hiện đúng chỗ trên giao diện', () => {
  it('thẻ dự án chờ duyệt có nhãn, dự án đã duyệt thì không', () => {
    expect(
      dung(window.createProjectCard(duAn('Chờ duyệt'))).querySelector('.status-awaiting')
    ).not.toBeNull();
    expect(
      dung(window.createProjectCard(duAn('Đã duyệt'))).querySelector('.status-awaiting')
    ).toBeNull();
  });

  it('dòng nhiệm vụ trong bảng có nhãn khi chờ duyệt', () => {
    const co = dung(window.createTaskTableRowSimple(nhiemVu('Chờ duyệt')));
    const khong = dung(window.createTaskTableRowSimple(nhiemVu('Đã duyệt')));
    expect(co.querySelector('.status-awaiting')).not.toBeNull();
    expect(khong.querySelector('.status-awaiting')).toBeNull();
  });

  it('thẻ nhiệm vụ (cả kiểu gọn và kiểu thường) đều có nhãn khi chờ duyệt', () => {
    for (const gon of [true, false]) {
      const hop = dung(window.createTaskListItem(nhiemVu('Chờ duyệt'), gon));
      expect(hop.querySelector('.status-awaiting')).not.toBeNull();
    }
  });

  it('nhãn nằm CẠNH nhãn trạng thái chứ không thay thế nó', () => {
    const hop = dung(window.createTaskTableRowSimple(nhiemVu('Chờ duyệt')));
    expect(hop.textContent).toContain('Đang thực hiện');
    expect(hop.textContent).toContain('Chờ duyệt');
  });
});

describe('Nhãn vàng không mở thêm lỗ XSS', () => {
  it('tên độc của một mục chờ duyệt vẫn chỉ là chữ (dòng bảng)', () => {
    const hop = dung(window.createTaskTableRowSimple(nhiemVu('Chờ duyệt', DON)));
    document.getElementById('thu').appendChild(hop);
    expect(hop.querySelector('img')).toBeNull();
    expect(window.BI_CHIEM).toBeUndefined();
    expect(hop.textContent).toContain('onerror');
  });

  it('tên độc của một dự án chờ duyệt vẫn chỉ là chữ (thẻ dự án)', () => {
    const hop = dung(window.createProjectCard(duAn('Chờ duyệt', DON)));
    document.getElementById('thu').appendChild(hop);
    expect(hop.querySelector('img')).toBeNull();
    expect(window.BI_CHIEM).toBeUndefined();
  });

  it('giá trị lạ ở chính cột duyệt không dựng được thẻ nào', () => {
    const hop = dung(window.createTaskTableRowSimple(nhiemVu(DON)));
    expect(hop.querySelector('img')).toBeNull();
    expect(hop.querySelector('.status-awaiting')).toBeNull();
  });
});
