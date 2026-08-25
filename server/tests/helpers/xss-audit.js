// Bộ soát XSS TĨNH cho tầng trình duyệt — việc 4.6.
//
// Vì sao phải có công cụ này thay vì soát tay một lần: `web/assets/js/app.js` dựng HTML bằng phép
// cộng chuỗi ở 70 chỗ với 474 giá trị được nội suy. Soát tay xong hôm nay thì mai thêm một dòng
// `innerHTML +=` là lỗ hổng quay lại mà không ai biết. `tests/unit/xss-guard.test.js` gọi hàm này
// và chặn đúng điều đó.
//
// Cách làm: phân tích cú pháp bằng acorn, tìm mọi chuỗi ghép `+` (và chuỗi mẫu) có chứa thẻ HTML,
// rồi với từng "lỗ" tính NGỮ CẢNH HTML mà nó rơi vào — dựa trên đuôi phần chữ TĨNH ngay trước nó:
//
//   text          giữa hai thẻ                     => escapeHtml
//   attr          trong thuộc tính có dấu bao      => escapeHtml
//   url           href/src/action…                 => escapeHtml(safeUrl(…))
//   handler       trong chuỗi JS của thuộc tính on* => escapeForInlineHandler
//   handler-ngoai trong on* nhưng ngoài chuỗi JS    => phải soát tay (là số, hay là mã JS)
//   trong-the     trong thẻ mà không có dấu bao     => phải soát tay
//
// Mỗi lỗ được xếp một trong các loại: DA-THOAT (đã gọi hàm thoát), DA-THOAT-BIEN (biến đã thoát sẵn
// — bọc thêm là hiện ra `&quot;` trên màn hình), HTML-LONG / HTML-BIEN (giá trị CHÍNH LÀ HTML, các
// lỗ bên trong nó được soát riêng), SO (số), và CAN-THOAT (còn hở).
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';

/** Các hàm thoát của app.js. */
const DA_THOAT = new Set(['escapeHtml', 'escapeHtmlAttr', 'safeUrl', 'escapeForInlineHandler']);

// Hàm TRẢ VỀ HTML (đã tự thoát bên trong). `format*` KHÔNG nằm ở đây: formatDateForDisplay trả về
// nguyên giá trị khi không phân tích được ngày, nên một ô ngày chứa HTML sẽ đi thẳng ra giao diện.
const BUILDER = /^(create|build|render|wrap|describe|linkify|get.*Html$)/;

const ATTR_URL = ['href', 'src', 'action', 'formaction', 'xlink:href', 'data', 'poster'];

/** Soát một file JS của trình duyệt. Trả về `{ sites, sinks }`. */
export function soatFile(duongDan) {
  const SRC = readFileSync(duongDan, 'utf8');
  // `app.js` là script cổ điển (thẻ <script> thường), còn file mẫu để tự kiểm bộ soát là module.
  // Thử script trước vì đó là thứ thật cần soát; nếu file có import/export thì đọc lại theo module.
  let AST;
  try {
    AST = parse(SRC, { ecmaVersion: 'latest' });
  } catch {
    AST = parse(SRC, { ecmaVersion: 'latest', sourceType: 'module' });
  }

  const dauDong = [0];
  for (let i = 0; i < SRC.length; i += 1) if (SRC[i] === '\n') dauDong.push(i + 1);
  const dong = (pos) => {
    let lo = 0,
      hi = dauDong.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (dauDong[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };

  const conCua = (node) => {
    const ra = [];
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) v.forEach((c) => c && typeof c.type === 'string' && ra.push(c));
      else if (v && typeof v.type === 'string') ra.push(v);
    }
    return ra;
  };
  const diKhap = (node, tham) => {
    if (!node || typeof node.type !== 'string') return;
    tham(node);
    conCua(node).forEach((c) => diKhap(c, tham));
  };

  const tenHam = (node) => {
    if (!node || node.type !== 'CallExpression') return null;
    const c = node.callee;
    if (c.type === 'Identifier') return c.name;
    if (c.type === 'MemberExpression' && c.property.type === 'Identifier') return c.property.name;
    return null;
  };
  const phang = (node, ra = []) => {
    if (node.type === 'BinaryExpression' && node.operator === '+') {
      phang(node.left, ra);
      phang(node.right, ra);
    } else ra.push(node);
    return ra;
  };
  const laChuoi = (n) => n.type === 'Literal' && typeof n.value === 'string';
  const coThe = (s) => /<\/?[a-zA-Z]/.test(s) || s.includes('<!--');

  /** Biểu thức này có DỰNG HTML không (chuỗi có thẻ, hàm dựng, hay .map().join())? */
  const laHtml = (node) => {
    if (!node) return false;
    if (laChuoi(node)) return coThe(node.value);
    if (node.type === 'TemplateLiteral')
      return coThe(node.quasis.map((q) => q.value.cooked ?? '').join(''));
    if (node.type === 'BinaryExpression' && node.operator === '+') return phang(node).some(laHtml);
    if (node.type === 'ConditionalExpression')
      return laHtml(node.consequent) || laHtml(node.alternate);
    if (node.type === 'LogicalExpression') return laHtml(node.left) || laHtml(node.right);
    const ham = tenHam(node);
    return Boolean(ham) && (BUILDER.test(ham) || ham === 'join');
  };

  const HAMS = [];
  diKhap(AST, (n) => {
    if (/Function/.test(n.type)) HAMS.push(n);
  });

  /** Mọi giá trị từng được gán cho tên `ten` trong phạm vi gần nhất chứa `pos`. */
  const cacGiaTri = (ten, pos) => {
    const bao = HAMS.filter((f) => f.start <= pos && pos <= f.end).sort(
      (a, b) => b.start - a.start
    );
    for (const f of bao) {
      const gan = [];
      diKhap(f, (n) => {
        if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.id.name === ten)
          gan.push(n.init);
        if (
          n.type === 'AssignmentExpression' &&
          n.left.type === 'Identifier' &&
          n.left.name === ten
        )
          gan.push(n.right);
      });
      if (gan.length) return gan;
    }
    return [];
  };
  const bienChuaHtml = (ten, pos) => cacGiaTri(ten, pos).some(laHtml);
  const daThoatSan = (n) =>
    Boolean(n) &&
    ((n.type === 'CallExpression' && DA_THOAT.has(tenHam(n))) ||
      (n.type === 'ConditionalExpression' &&
        (daThoatSan(n.consequent) || daThoatSan(n.alternate))) ||
      (n.type === 'ArrowFunctionExpression' && daThoatSan(n.body)) ||
      (n.type === 'LogicalExpression' && (daThoatSan(n.left) || daThoatSan(n.right))));
  const bienDaThoat = (ten, pos) => cacGiaTri(ten, pos).some(daThoatSan);

  /**
   * Ngữ cảnh HTML suy ra từ đuôi phần chữ tĩnh đứng trước lỗ.
   * Phải dùng máy trạng thái chứ không dùng biểu thức chính quy: `onclick="f('` có cả " và ' lồng
   * nhau nên mọi mẫu kiểu `[^"']*$` đều trượt, và đó đúng là nhóm chỗ nguy hiểm nhất.
   */
  const nguCanh = (duoi) => {
    const moThe = duoi.lastIndexOf('<');
    if (moThe <= duoi.lastIndexOf('>')) return { loai: 'text', ten: '' };
    const s = duoi.slice(moThe + 1);
    let i = 0,
      tenAttr = '',
      bao = '',
      trongGiaTri = false,
      giaTri = '';
    while (i < s.length && /\S/.test(s[i])) i += 1; // bỏ tên thẻ
    while (i < s.length) {
      const c = s[i];
      if (trongGiaTri) {
        if ((bao && c === bao) || (!bao && /[\s>]/.test(c))) {
          trongGiaTri = false;
          tenAttr = '';
        } else giaTri += c;
        i += 1;
        continue;
      }
      if (/\s/.test(c)) {
        i += 1;
        continue;
      }
      let ten = '';
      while (i < s.length && /[^\s=>/]/.test(s[i])) {
        ten += s[i];
        i += 1;
      }
      while (i < s.length && /\s/.test(s[i])) i += 1;
      if (s[i] === '=') {
        i += 1;
        while (i < s.length && /\s/.test(s[i])) i += 1;
        tenAttr = ten.toLowerCase();
        bao = s[i] === '"' || s[i] === "'" ? s[i] : '';
        if (bao) i += 1;
        trongGiaTri = true;
        giaTri = '';
      } else if (ten === '') i += 1;
    }
    if (!trongGiaTri) return { loai: 'trong-the', ten: '' };
    if (!bao) return { loai: 'bare-attr', ten: tenAttr };
    if (tenAttr.startsWith('on')) {
      const soNhay = (giaTri.match(/'/g) || []).length;
      return { loai: soNhay % 2 === 1 ? 'handler' : 'handler-ngoai', ten: tenAttr };
    }
    if (ATTR_URL.includes(tenAttr)) return { loai: 'url', ten: tenAttr };
    return { loai: 'attr', ten: tenAttr };
  };

  const sites = [];
  const daXet = new Set();

  /** Ghi nhận một lỗ (biểu thức được nội suy) cùng ngữ cảnh của nó. */
  const themLo = (node, duoi) => {
    // Nhánh của ?: và ||/&& được xét riêng, vì mỗi nhánh là một chỗ cần bọc khác nhau.
    if (node.type === 'ConditionalExpression') {
      themLo(node.consequent, duoi);
      themLo(node.alternate, duoi);
      return;
    }
    if (node.type === 'LogicalExpression') {
      themLo(node.left, duoi);
      themLo(node.right, duoi);
      return;
    }
    if (node.type === 'BinaryExpression' && node.operator === '+') {
      let d = duoi;
      for (const p of phang(node)) {
        if (laChuoi(p)) {
          d = (d + p.value).slice(-300);
          continue;
        }
        themLo(p, d);
        d += '';
      }
      return;
    }
    if (node.type === 'Literal') return;
    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return;

    const khoa = node.start + ':' + node.end;
    if (daXet.has(khoa)) return;
    daXet.add(khoa);

    const ma = SRC.slice(node.start, node.end).replace(/\s+/g, ' ');
    const ham = tenHam(node);
    let loai = 'CAN-THOAT';
    if (ham && DA_THOAT.has(ham)) loai = 'DA-THOAT';
    else if (ham && (BUILDER.test(ham) || ham === 'join' || ham === 'map')) loai = 'HTML-LONG';
    else if (node.type === 'CallExpression' && node.callee.type === 'ArrowFunctionExpression')
      loai = 'HTML-LONG';
    else if (/^(parseInt|parseFloat|Number|Math\.)/.test(ma)) loai = 'SO';
    else if (node.type === 'MemberExpression' && node.property.name === 'length') loai = 'SO';
    else if (node.type === 'BinaryExpression') loai = 'SO';
    else if (node.type === 'Identifier' && bienChuaHtml(node.name, node.start)) loai = 'HTML-BIEN';
    else if (node.type === 'Identifier' && bienDaThoat(node.name, node.start))
      loai = 'DA-THOAT-BIEN';
    else if (ham && bienDaThoat(ham, node.start)) loai = 'DA-THOAT-BIEN';

    const ctx = nguCanh(duoi);
    sites.push({ line: dong(node.start), loai, ctx: ctx.loai, attr: ctx.ten, ma });
  };

  /** Một chuỗi ghép có chứa thẻ HTML: mọi phần không phải chữ tĩnh đều là một lỗ. */
  const xetChuoiGhep = (node) => {
    const parts = phang(node);
    if (
      !coThe(
        parts
          .filter(laChuoi)
          .map((p) => p.value)
          .join('')
      )
    )
      return;
    let duoi = '';
    for (const p of parts) {
      if (laChuoi(p)) {
        duoi = (duoi + p.value).slice(-300);
        continue;
      }
      themLo(p, duoi);
    }
  };
  const xetChuoiMau = (node) => {
    if (!coThe(node.quasis.map((q) => q.value.cooked ?? '').join(''))) return;
    let duoi = '';
    node.quasis.forEach((q, i) => {
      duoi = (duoi + (q.value.cooked ?? '')).slice(-300);
      if (i < node.expressions.length) themLo(node.expressions[i], duoi);
    });
  };

  diKhap(AST, (n) => {
    if (n.type === 'BinaryExpression' && n.operator === '+') xetChuoiGhep(n);
    if (n.type === 'TemplateLiteral') xetChuoiMau(n);
  });
  sites.sort((a, b) => a.line - b.line);

  // Danh sách CHỖ GHI HTML (sink). `PHAI-SOAT` = vế phải không phải HTML dựng sẵn, tức là có thể
  // đang ghim thẳng một biến chữ vào trang; phải soát tay từng chỗ.
  const sinks = [];
  diKhap(AST, (node) => {
    let rhs = null,
      kieu = '';
    if (
      node.type === 'AssignmentExpression' &&
      node.left.type === 'MemberExpression' &&
      node.left.property.type === 'Identifier' &&
      /^(innerHTML|outerHTML)$/.test(node.left.property.name)
    ) {
      rhs = node.right;
      kieu = node.left.property.name;
    }
    if (node.type === 'CallExpression' && tenHam(node) === 'insertAdjacentHTML') {
      rhs = node.arguments[1];
      kieu = 'insertAdjacentHTML';
    }
    if (!rhs) return;
    const dungHtml =
      laHtml(rhs) ||
      (rhs.type === 'Identifier' && bienChuaHtml(rhs.name, rhs.start)) ||
      (rhs.type === 'CallExpression' && BUILDER.test(tenHam(rhs) || ''));
    sinks.push({
      line: dong(node.start),
      kieu,
      trangThai: dungHtml ? 'HTML-DUNG' : 'PHAI-SOAT',
      ma: SRC.slice(rhs.start, rhs.end).replace(/\s+/g, ' ').slice(0, 60),
    });
  });
  sinks.sort((a, b) => a.line - b.line);

  return { sites, sinks };
}
