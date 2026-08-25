// Việc 4.6 — CHỐT KẾT QUẢ SOÁT XSS của `web/assets/js/app.js` thành test.
//
// Vì sao đây là test chứ không phải một bảng trong tài liệu: app.js dựng HTML bằng phép cộng chuỗi
// ở 70 chỗ với 474 giá trị nội suy. Soát tay xong hôm nay thì chỉ cần mai thêm một dòng
// `innerHTML +=` là lỗ hổng quay lại mà không ai hay. Test này gọi bộ soát tĩnh
// (`tests/helpers/xss-audit.js`) và đòi: mọi lỗ đều đã đi qua hàm thoát, TRỪ đúng những chỗ đã
// được ghi lý do dưới đây.
//
// Khi test này đỏ: KHÔNG sửa danh sách cho hết đỏ. Đọc dòng bị báo, bọc giá trị bằng đúng hàm cho
// ngữ cảnh của nó (escapeHtml / escapeForInlineHandler / escapeHtml(safeUrl(…))). Chỉ thêm vào
// danh sách khi chứng minh được giá trị KHÔNG do người dùng nhập, và phải ghi lý do.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { soatFile } from '../helpers/xss-audit.js';

const APP = resolve(process.cwd(), '../web/assets/js/app.js');
const { sites, sinks } = soatFile(APP);

/**
 * Những lỗ CỐ Ý không bọc, mỗi chỗ một lý do. `ma` là mã nguồn của lỗ, `ctx` là ngữ cảnh HTML.
 * Không ghi số dòng: số dòng đổi theo mọi lần sửa app.js, còn cặp (ngữ cảnh, mã) thì không.
 */
const CO_Y_KHONG_BOC = [
  // Cờ `selected`/`checked` do CHÍNH mã sinh ra ("selected" hoặc ""), không có dữ liệu người dùng.
  // Đây là chỗ trong thẻ mà không có dấu bao, nên nếu là dữ liệu ngoài thì cực nguy hiểm — vì vậy
  // ba chỗ này phải nêu tên rõ ràng thay vì bỏ qua cả nhóm "trong-the".
  { ctx: 'trong-the', ma: 'text3', so: 3, ly_do: 'cờ "selected" do mã sinh, không phải dữ liệu' },
  // Chỉ số của `.map()` — là SỐ, và nằm trong on* nhưng NGOÀI chuỗi JS: `onclick="f(" + i + ")"`.
  { ctx: 'handler-ngoai', ma: 'index', so: 4, ly_do: 'chỉ số .map(), là số nguyên do mã sinh' },
  // `const wrapRow = text => "<tr><td …>" + text + "</td></tr>"`. Cả 4 chỗ gọi đều truyền HTML
  // hằng (thông báo "không có dữ liệu"), nên bọc là hiện ra thẻ dưới dạng chữ.
  { ctx: 'text', ma: 'text', so: 1, ly_do: 'wrapRow: 4 chỗ gọi đều truyền HTML hằng' },
  // Việc 5.6 — nhãn vàng 'Chờ duyệt'. Hàm TRẢ VỀ HTML (thẻ <span>) chứ không trả dữ liệu, nên bọc
  // là hiện thẻ ra dưới dạng chữ. Nội dung nhãn là hằng số của chương trình và vẫn tự đi qua
  // escapeHtml/escapeHtmlAttr bên trong; `tests/unit/pending-badge.test.js` kiểm hành vi đó bằng
  // cách bơm đòn tấn công vào tên của một mục đang chờ duyệt.
  {
    ctx: 'text',
    ma: 'pendingApprovalBadge(task)',
    so: 3,
    ly_do: 'trả HTML đã thoát sẵn, không phải dữ liệu',
  },
  {
    ctx: 'text',
    ma: 'pendingApprovalBadge(project)',
    so: 2,
    ly_do: 'trả HTML đã thoát sẵn, không phải dữ liệu',
  },
];

/** Chỗ ghi HTML mà vế phải không phải HTML dựng sẵn — đã soát tay từng chỗ. */
const SINK_DA_SOAT_TAY = [
  { ma: '""', so: 5, ly_do: 'xoá rỗng vùng chứa, không có dữ liệu nào đi vào' },
  {
    ma: 'el.dataset.originalContent',
    so: 1,
    ly_do: 'setButtonLoading cất innerHTML CỦA CHÍNH nút rồi trả lại — không nhận dữ liệu ngoài',
  },
];

describe('soát XSS tĩnh app.js — không còn lỗ nào ngoài danh sách đã ghi lý do', () => {
  it('TC-SEC-10: mọi giá trị nội suy đều đã thoát, trừ những chỗ đã ghi lý do', () => {
    const con = sites.filter((s) => s.loai === 'CAN-THOAT');
    const chuaGhi = con.filter(
      (s) => !CO_Y_KHONG_BOC.some((k) => k.ctx === s.ctx && k.ma === s.ma)
    );
    // In cả dòng và mã để người sửa biết đi đâu, không phải chạy lại công cụ.
    expect(chuaGhi.map((s) => `${s.line}:${s.ctx}:${s.ma}`)).toEqual([]);
  });

  it('TC-SEC-11: số chỗ cố ý không bọc đúng như đã ghi (không thêm chỗ mới lặng lẽ)', () => {
    const con = sites.filter((s) => s.loai === 'CAN-THOAT');
    const dem = CO_Y_KHONG_BOC.map((k) => ({
      ctx: k.ctx,
      ma: k.ma,
      so: con.filter((s) => s.ctx === k.ctx && s.ma === k.ma).length,
    }));
    expect(dem).toEqual(CO_Y_KHONG_BOC.map(({ ctx, ma, so }) => ({ ctx, ma, so })));
  });

  it('TC-SEC-12: không chỗ nào trong on* nhận giá trị chỉ thoát HTML thường', () => {
    // Bẫy quan trọng nhất của việc 4.6: bộ phân tích HTML GIẢI MÃ thực thể TRƯỚC khi JS thấy mã
    // trong on*, nên `&#39;` của escapeHtml lại thành `'` và đóng chuỗi JS. Trong on* phải dùng
    // escapeForInlineHandler (thoát JS trước, thoát HTML sau).
    const sai = sites.filter((s) => s.ctx === 'handler' && !/escapeForInlineHandler/.test(s.ma));
    expect(sai.map((s) => `${s.line}:${s.ma}`)).toEqual([]);
  });

  it('TC-SEC-13: mọi href/src dựng động đều đi qua safeUrl (chặn javascript:)', () => {
    const sai = sites.filter((s) => s.ctx === 'url' && !/safeUrl/.test(s.ma));
    expect(sai.map((s) => `${s.line}:${s.attr}:${s.ma}`)).toEqual([]);
  });

  it('TC-SEC-14: không còn thuộc tính nào thiếu dấu bao (giá trị hở ra ngoài thẻ)', () => {
    const sai = sites.filter((s) => s.ctx === 'bare-attr');
    expect(sai.map((s) => `${s.line}:${s.attr}:${s.ma}`)).toEqual([]);
  });

  it('TC-SEC-15: mọi chỗ ghi innerHTML đều dựng HTML, trừ những chỗ đã soát tay', () => {
    const con = sinks.filter((s) => s.trangThai === 'PHAI-SOAT');
    const chuaGhi = con.filter((s) => !SINK_DA_SOAT_TAY.some((k) => k.ma === s.ma));
    expect(chuaGhi.map((s) => `${s.line}:${s.kieu}:${s.ma}`)).toEqual([]);
    const dem = SINK_DA_SOAT_TAY.map((k) => ({
      ma: k.ma,
      so: con.filter((s) => s.ma === k.ma).length,
    }));
    expect(dem).toEqual(SINK_DA_SOAT_TAY.map(({ ma, so }) => ({ ma, so })));
  });

  it('TC-SEC-16: bốn hàm thoát vẫn còn nguyên trong app.js', () => {
    // Nếu ai đó xoá/đổi tên một hàm thoát, bộ soát sẽ coi mọi chỗ gọi nó là CAN-THOAT và các test
    // trên đỏ ngay; test này chỉ nói rõ nguyên nhân thay vì để đọc 400 dòng báo lỗi.
    const src = readFileSync(APP, 'utf8');
    for (const ten of ['escapeHtml', 'escapeHtmlAttr', 'escapeForInlineHandler', 'safeUrl'])
      expect(src).toContain(`function ${ten}(value)`);
  });

  it('TC-SEC-17: con số đã chốt — 70 chỗ ghi HTML, 498 giá trị nội suy', () => {
    // Kế hoạch §7 ghi "53 chỗ innerHTML": đó là 53 DÒNG. Việc 4.6 chốt 70 chỗ ghi và 474 giá trị;
    // việc 5.6 thêm 5 chỗ gọi `pendingApprovalBadge` (nhãn vàng) ⇒ 481;
    // việc 5.12 thêm 17 chỗ (nút cấp 2/cấp 3 + ô ẩn level/parent) ⇒ 498, không thêm chỗ ghi nào.
    // Thêm HTML mới thì phải sửa hai số này VÀ docs/XSS-4.6.md — cố ý cho hơi rát, để việc thêm
    // một chỗ dựng HTML là một quyết định, không phải chuyện tình cờ.
    expect({ sink: sinks.length, gia_tri: sites.length }).toEqual({ sink: 70, gia_tri: 498 });
  });
});

// Các test trên chỉ nói "app.js không còn lỗ nào". Một bộ soát bị hỏng cũng nói y như vậy. Nhóm
// dưới đây soát file mẫu có lỗ ĐÃ BIẾT, để cái xanh ở trên có nghĩa.
describe('tự kiểm bộ soát trên file mẫu — phải bắt được lỗ đã biết', () => {
  const mau = soatFile(resolve(process.cwd(), 'tests/fixtures/xss-mau.js'));
  const chuKy = mau.sites.map((s) => [s.loai, s.ctx, s.attr, s.ma].join('|'));

  it('TC-SEC-18: xếp đúng loại và ngữ cảnh cho cả 11 lỗ của file mẫu', () => {
    expect(chuKy).toEqual([
      'CAN-THOAT|text||x', // giữa hai thẻ
      'DA-THOAT|text||escapeHtml(x)',
      'CAN-THOAT|attr|title|x', // trong thuộc tính có dấu bao
      'DA-THOAT|url|href|escapeHtml(x)', // thoát HTML nhưng thiếu safeUrl
      'DA-THOAT|url|href|escapeHtml(safeUrl(x))',
      'DA-THOAT|handler|onclick|escapeHtml(x)', // trong chuỗi JS, thoát sai kiểu
      'DA-THOAT|handler|onclick|escapeForInlineHandler(x)',
      'CAN-THOAT|handler-ngoai|onclick|i', // trong on* nhưng ngoài chuỗi JS
      'DA-THOAT|bare-attr|class|escapeHtml(x)', // thuộc tính thiếu dấu bao
      'CAN-THOAT|trong-the||x',
      'DA-THOAT|text||escapeHtml(x)',
    ]);
  });

  it('TC-SEC-19: chính ba luật của TC-SEC-12/13/14 bắt được lỗi trong file mẫu', () => {
    // Nếu một luật ngừng bắt được lỗi (ví bộ máy trạng thái trượt), nó sẽ xanh oan ở app.js.
    expect(
      mau.sites.filter((s) => s.ctx === 'handler' && !/escapeForInlineHandler/.test(s.ma))
    ).toHaveLength(1);
    expect(mau.sites.filter((s) => s.ctx === 'url' && !/safeUrl/.test(s.ma))).toHaveLength(1);
    expect(mau.sites.filter((s) => s.ctx === 'bare-attr')).toHaveLength(1);
  });

  it('TC-SEC-20: phân biệt được ghi thẳng biến chữ và ghi HTML dựng sẵn', () => {
    expect(mau.sinks.map((s) => s.trangThai)).toEqual(['PHAI-SOAT', 'HTML-DUNG']);
  });
});
