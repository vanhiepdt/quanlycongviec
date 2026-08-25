// Thư viện ngoài phải TỰ CHỨA (§7 việc 4.3).
//
// Vì sao cần test cho mấy tệp tĩnh: rủi ro ở đây không phải "code sai" mà là "thiếu tệp" —
// `all.min.css` trỏ sang `../webfonts/...`, `inter.css` trỏ sang `fonts/...`. Thiếu một tệp thì
// trang vẫn chạy, chỉ là biểu tượng thành ô vuông hoặc chữ về font hệ thống, và không ai thấy
// dòng lỗi nào ngoài 404 trong Network. Kiểm bằng máy thì thiếu là đỏ ngay.
//
// Rủi ro thứ hai: ai đó "sửa cho nhanh" bằng cách trỏ lại CDN. Test dưới chặn cả việc đó.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = resolve(process.cwd(), '../web');
const read = (rel) => readFileSync(resolve(WEB, rel), 'utf8');
const sizeOf = (rel) => (existsSync(resolve(WEB, rel)) ? statSync(resolve(WEB, rel)).size : -1);

const INDEX = read('index.html');

describe('4.3 — trang không còn phụ thuộc CDN', () => {
  it('index.html không NẠP tài nguyên nào từ ngoài (không CDN, không Google Fonts)', () => {
    const loaders = [...INDEX.matchAll(/<(?:link|script|img|iframe|source|video|audio)\b[^>]*>/gi)]
      .map((m) => m[0])
      .filter((tag) => /https?:\/\//.test(tag));
    expect(loaders).toEqual([]);
    expect(INDEX).not.toContain('cdn.tailwindcss.com');
    expect(INDEX).not.toContain('fonts.googleapis.com');
  });

  /**
   * Tách riêng khỏi test trên vì đây là chuyện khác: `<a href>` ra ngoài thì KHÔNG phải phụ thuộc
   * CDN — trang vẫn chạy được khi máy chủ mất mạng. Chốt cứng đúng một URL để nếu sau này ai dán
   * thêm địa chỉ ngoài vào bất kỳ đâu trong trang, test này đỏ và người ta phải giải thích.
   */
  it('chỉ còn ĐÚNG một địa chỉ ngoài: liên kết ghi công cho người bấm', () => {
    expect([...INDEX.matchAll(/https?:\/\/[^"'\s<>]+/g)].map((m) => m[0])).toEqual([
      'https://gsheets.vn',
    ]);
  });

  it('nạp api-bridge.js TRƯỚC app.js — sai thứ tự là app.js gọi google.script.run chưa tồn tại', () => {
    const bridge = INDEX.indexOf('assets/js/api-bridge.js');
    const app = INDEX.indexOf('assets/js/app.js');
    expect(bridge).toBeGreaterThan(-1);
    expect(app).toBeGreaterThan(bridge);
  });

  it('mọi tệp mà index.html nạp đều CÓ trên đĩa và không rỗng', () => {
    // Bỏ `?v=...` (dấu vết phiên bản của việc 4.8) trước khi tìm trên đĩa: nó là chuyện của cache,
    // không phải phần tên tệp.
    const local = [...INDEX.matchAll(/(?:src|href)\s*=\s*"(assets\/[^"]+)"/g)].map((m) =>
      m[1].replace(/\?.*$/, '')
    );
    expect(local.length).toBeGreaterThanOrEqual(7);
    for (const rel of local) expect({ rel, size: sizeOf(rel) > 1000 }).toEqual({ rel, size: true });
  });
});

describe('4.3 — Font Awesome 6.4.0', () => {
  const CSS = read('assets/vendor/fontawesome/css/all.min.css');

  it('mọi tệp webfont mà CSS trỏ tới đều có thật', () => {
    const urls = [
      ...new Set([...CSS.matchAll(/url\(\.\.\/webfonts\/([^)]+)\)/g)].map((m) => m[1])),
    ];
    expect(urls.length).toBeGreaterThanOrEqual(6);
    for (const file of urls) {
      expect({ file, có: sizeOf(`assets/vendor/fontawesome/webfonts/${file}`) > 1000 }).toEqual({
        file,
        có: true,
      });
    }
  });

  it('đúng bộ 6 mà app.css đang chờ ("Font Awesome 6 Free")', () => {
    expect(CSS).toContain('Font Awesome 6 Free');
    expect(read('assets/css/app.css')).toContain('Font Awesome 6 Free');
  });
});

describe('4.3 — font Inter tự chứa', () => {
  const CSS = read('assets/vendor/inter/inter.css');

  it('không còn URL fonts.gstatic.com trong phần @font-face', () => {
    expect(CSS).not.toMatch(/src:\s*url\(https?:/);
  });

  it('có đủ 6 độ đậm mà giao diện dùng (300–800)', () => {
    for (const weight of [300, 400, 500, 600, 700, 800]) {
      expect(CSS).toContain(`font-weight: ${weight};`);
    }
  });

  it('CÓ bộ ký tự tiếng Việt — thiếu thì dấu mũ/dấu nặng rơi về font hệ thống', () => {
    expect(CSS).toContain('U+1EA0-1EF9');
    expect(sizeOf('assets/vendor/inter/fonts/inter-400-vietnamese.woff2')).toBeGreaterThan(1000);
  });

  it('mọi tệp woff2 được khai đều có thật', () => {
    const files = [...CSS.matchAll(/url\(fonts\/([^)]+)\)/g)].map((m) => m[1]);
    expect(files).toHaveLength(18);
    for (const file of files) {
      expect({ file, có: sizeOf(`assets/vendor/inter/fonts/${file}`) > 1000 }).toEqual({
        file,
        có: true,
      });
    }
  });
});

describe('4.3 — Tailwind bản build sẵn', () => {
  const CSS = read('assets/vendor/tailwind/tailwind.min.css');

  it('có preflight và các lớp khó (độ mờ dạng /80, biến thể md:) — không phải bản cắt cụt', () => {
    for (const token of [
      'bg-white\\/80',
      'bg-black\\/50',
      'md\\:translate-x-0',
      'backdrop-blur-xl',
      'from-slate-50',
      'min-h-screen',
    ]) {
      expect({ token, có: CSS.includes(token) }).toEqual({ token, có: true });
    }
  });

  /**
   * Lớp ghép lúc chạy (`"bg-" + màu + "-50"`) không lọt vào máy quét của Tailwind. Đây là test giữ
   * cho `safelist` không bị ai xoá: mất nó thì bảng đề nghị mất nền màu mà không có lỗi nào.
   */
  it('giữ đủ 12 lớp màu ghép lúc chạy của bảng đề nghị', () => {
    for (const color of ['blue', 'amber', 'green', 'red']) {
      for (const token of [`bg-${color}-50`, `bg-${color}-100`, `text-${color}-700`]) {
        expect({ token, có: CSS.includes(`.${token}`) }).toEqual({ token, có: true });
      }
    }
  });

  it('giữ nguồn để dựng lại được (config + input), không phải tệp trời cho', () => {
    expect(sizeOf('assets/vendor/tailwind/tailwind.config.cjs')).toBeGreaterThan(100);
    expect(sizeOf('assets/vendor/tailwind/tailwind.input.css')).toBeGreaterThan(50);
    expect(read('assets/vendor/tailwind/tailwind.config.cjs')).toContain('tailwindcss@3.4.19');
  });
});

describe('4.3 — Chart.js và Alpine.js đúng thư viện', () => {
  it('chart.umd.min.js là bản UMD của Chart.js, dùng được ngay bằng thẻ script', () => {
    const js = read('assets/vendor/chartjs/chart.umd.min.js');
    expect(js).toContain('Chart.js');
    expect(sizeOf('assets/vendor/chartjs/chart.umd.min.js')).toBeGreaterThan(100_000);
  });

  it('alpine.min.js là bản cdn (tự khởi động), không phải bản module', () => {
    const js = read('assets/vendor/alpinejs/alpine.min.js');
    expect(js.toLowerCase()).toContain('alpine');
    expect(sizeOf('assets/vendor/alpinejs/alpine.min.js')).toBeGreaterThan(30_000);
  });
});
