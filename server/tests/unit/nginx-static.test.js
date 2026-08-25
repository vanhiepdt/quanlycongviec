// Việc 4.8 — Nginx phục vụ `web/` tĩnh: cache `assets/` 30 ngày, `index.html` KHÔNG cache.
//
// Vì sao kiểm cấu hình bằng test: cái sai ở đây không làm gì đổ. Nó chỉ làm người dùng giữ bản
// `app.js` cũ đến 30 ngày sau khi vá lỗi — không ai nhìn thấy, kể cả người vá. Ba luật dưới đây là
// đúng những thứ mà mắt người đọc `nginx -t` xanh sẽ bỏ qua.
//
// `nginx -t` chỉ kiểm CÚ PHÁP (cách chạy nó ghi ở đầu deploy/nginx/app.conf); test này kiểm Ý.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const GOC = resolve(process.cwd(), '..');
const CONF = readFileSync(resolve(GOC, 'deploy/nginx/app.conf'), 'utf8');
const DAU = readFileSync(resolve(GOC, 'deploy/nginx/security-headers.conf'), 'utf8');
const INDEX = readFileSync(resolve(GOC, 'web/index.html'), 'utf8');

/** Bỏ chú thích trước khi xét: chú thích cũng chứa chữ `add_header`, xét lẫn là đỏ oan. */
const MA = CONF.replace(/#[^\n]*/g, '');

/** Cắt lấy phần thân của một `location` để không xét lẫn sang location khác. */
function than(duongDan) {
  const dau = MA.indexOf('location ' + duongDan + ' {');
  expect(dau, 'không tìm thấy location ' + duongDan).toBeGreaterThan(-1);
  const i = MA.indexOf('{', dau);
  let sau = 0;
  for (let j = i; j < MA.length; j += 1) {
    if (MA[j] === '{') sau += 1;
    if (MA[j] === '}') {
      sau -= 1;
      if (sau === 0) return MA.slice(i + 1, j);
    }
  }
  throw new Error('ngoặc không đóng ở location ' + duongDan);
}

describe('4.8 — Nginx phục vụ web/', () => {
  it('TC-NGX-01: gốc web là web/ của repo và trang mặc định là index.html', () => {
    expect(CONF).toMatch(/^\s*root\s+\/srv\/web;/m);
    expect(CONF).toMatch(/^\s*index\s+index\.html;/m);
  });

  it('TC-NGX-02: assets/ cache đúng 30 ngày', () => {
    // 2592000 = 30 * 24 * 3600. Viết bằng số giây chứ không "30d" để test đọc được đúng con số.
    expect(than('/assets/')).toMatch(/add_header Cache-Control "public, max-age=2592000"/);
  });

  it('TC-NGX-03: index.html và mọi đường dẫn của ứng dụng KHÔNG được cache', () => {
    for (const loc of ['= /index.html', '= /', '/'])
      expect(than(loc), loc).toMatch(/add_header Cache-Control "no-store, must-revalidate"/);
  });

  it('TC-NGX-04: thiếu tệp trong assets/ phải là 404, không rơi về index.html', () => {
    // Nếu assets/ cũng `try_files $uri /index.html` thì một đường dẫn JS sai chính tả trả về
    // HTML với mã 200: trình duyệt báo "Unexpected token <" và không ai đoán được vì sao.
    expect(than('/assets/')).toMatch(/try_files \$uri =404;/);
    expect(than('/')).toMatch(/try_files \$uri \/index\.html;/);
  });

  it('TC-NGX-05: mọi location phục vụ tĩnh đều include lại đầu bảo vệ', () => {
    // `add_header` của nginx KHÔNG cộng dồn: location nào có add_header riêng thì mất sạch
    // add_header của cấp trên. Location nào đặt Cache-Control mà quên include là mất CSP.
    for (const loc of ['/assets/', '= /index.html', '= /', '/'])
      expect(than(loc), loc).toContain('include /etc/nginx/snippets/security-headers.conf;');
  });

  it('TC-NGX-06: /api/ chuyển tiếp sang app:3000 kèm X-Forwarded-* (trust proxy = 1)', () => {
    const api = than('/api/');
    // Cố ý KHÔNG dùng khối `upstream`: nginx phân giải tên trong đó ngay lúc khởi động và chết với
    // "host not found in upstream" nếu container app chưa lên. Để tên trong biến + resolver của
    // Docker thì app chậm chỉ thành 502. Đã gặp thật: `nginx -t` đỏ vì đúng lý do này.
    expect(MA).not.toMatch(/^\s*upstream\s/m);
    expect(MA).toMatch(/resolver 127\.0\.0\.11\b/);
    expect(MA).toMatch(/set \$app_upstream "app:3000";/);
    // $request_uri phải viết rõ: proxy_pass có biến thì nginx KHÔNG tự nối đường dẫn vào, thiếu nó
    // là mọi yêu cầu /api/... rơi hết về "/" của Node.
    expect(api).toMatch(/proxy_pass http:\/\/\$app_upstream\$request_uri;/);
    expect(api).toMatch(/proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;/);
    expect(api).toMatch(/proxy_set_header X-Forwarded-Proto \$scheme;/);
    // Không đặt thêm đầu ở /api/: helmet trong Express đã đặt, thêm nữa là trùng đôi.
    expect(api).not.toContain('add_header');
  });

  it('TC-NGX-07: đầu bảo vệ có CSP và nosniff, và CSP không còn cho phép CDN', () => {
    expect(DAU).toMatch(/add_header X-Content-Type-Options "nosniff" always;/);
    const csp = DAU.match(/add_header Content-Security-Policy "([^"]+)"/);
    expect(csp, 'thiếu Content-Security-Policy').not.toBeNull();
    expect(csp[1]).toContain("default-src 'self'");
    expect(csp[1]).toContain("object-src 'none'");
    expect(csp[1]).not.toContain('cdn.');
  });

  it('TC-NGX-08: ba tệp tĩnh tự viết đều có ?v= để bản mới không bị cache 30 ngày', () => {
    // index.html không cache, nên ?v= là cách duy nhất đẩy bản mới xuống người đang dùng.
    for (const tep of ['assets/css/app.css', 'assets/js/api-bridge.js', 'assets/js/app.js'])
      expect(INDEX, tep).toMatch(new RegExp(tep.replace(/[./]/g, '\\$&') + '\\?v=\\d{8}'));
  });

  it('TC-NGX-09: khối này là default_server, nếu không thì default.conf của ảnh nginx thắng', () => {
    // Đã gặp thật khi thử bằng container: /  trả 200 nhưng là trang "Welcome to nginx", mọi tệp
    // trong /assets/ trả 404, và không có Cache-Control lẫn CSP nào — vì ảnh nginx chính thức có
    // sẵn /etc/nginx/conf.d/default.conf, và khối nào KHÔNG khai default_server thì khối đầu tiên
    // theo thứ tự đọc tệp (default.conf < app.conf) nhận hết yêu cầu không khớp server_name.
    expect(MA).toMatch(/^\s*listen 80 default_server;/m);
    expect(MA).toMatch(/^\s*listen \[::\]:80 default_server;/m);
  });

  it('TC-NGX-10: cache 30 ngày KHÔNG được `always` — nếu không, 404 cũng bị nhớ 30 ngày', () => {
    // `always` bắt nginx đặt đầu cho cả phản hồi lỗi. Với Cache-Control 30 ngày thì một đường dẫn
    // JS sai chính tả trả 404 và trình duyệt nhớ luôn: thêm đúng tệp đó vào sau cũng vẫn 404 với
    // người đã ghé. Ngược lại, đầu bảo vệ PHẢI `always` để trang lỗi cũng có CSP.
    expect(than('/assets/')).toMatch(/add_header Cache-Control "public, max-age=2592000";/);
    expect(than('/assets/')).not.toMatch(/max-age=2592000" always/);
    for (const dong of DAU.split('\n').filter((d) => d.trim().startsWith('add_header')))
      expect(dong.trim(), dong.trim().slice(0, 40)).toMatch(/ always;$/);
  });
});
