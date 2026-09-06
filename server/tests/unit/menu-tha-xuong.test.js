// Phase 8b lỗi 1 — menu thả xuống ở đầu trang phủ lên nội dung thay vì kéo dài khung.
//
// Bệnh cụ thể: bấm «+ Tạo mới» (hay «Xuất Excel») thì khung trắng đầu trang CAO LÊN để chứa menu
// thay vì menu phủ lên nội dung bên dưới. Nguyên nhân: bốn menu ấy mang cùng lúc hai class
// `absolute … glass-card`. Tailwind nạp trước khai báo `.absolute { position: absolute }`, nhưng
// `.glass-card { position: relative }` trong app.css có CÙNG độ ưu tiên (0,1,0) mà nạp sau nên
// thắng — menu rơi vào dòng chảy bình thường và đội khung header lên.
//
// Cách chữa: rule `.glass-card.absolute { position: absolute }` (độ ưu tiên 0,2,0) trong app.css.
// Test này canh ba thứ: rule ấy còn và đứng sau khối `.glass-card`; khối `.glass-card` vẫn giữ
// `position: relative` (đường kẻ ::before cần nó); bốn menu ở index.html vẫn mang class `absolute`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = resolve(process.cwd(), '../web');
const INDEX = readFileSync(resolve(WEB, 'index.html'), 'utf8');
const CSS = readFileSync(resolve(WEB, 'assets/css/app.css'), 'utf8');

describe('8b lỗi 1 — menu đầu trang phủ xuống, không kéo dài khung', () => {
  it('TC-MENU-01: app.css nạp sau tailwind — tiền đề của cuộc so độ ưu tiên', () => {
    const viTriTailwind = INDEX.indexOf('assets/vendor/tailwind/tailwind.min.css');
    const viTriAppCss = INDEX.indexOf('assets/css/app.css');
    expect(viTriTailwind).toBeGreaterThan(0);
    expect(viTriAppCss).toBeGreaterThan(viTriTailwind);
  });

  it('TC-MENU-02: rule .glass-card.absolute lấy lại vị trí tuyệt đối, đứng sau khối .glass-card', () => {
    const khoiBase = CSS.indexOf('.glass-card {');
    const ruleChua = CSS.match(/\.glass-card\.absolute\s*{[^}]*position:\s*absolute[^}]*}/);
    expect(khoiBase).toBeGreaterThan(0);
    expect(ruleChua).not.toBeNull();
    expect(CSS.indexOf(ruleChua[0])).toBeGreaterThan(khoiBase);
  });

  it('TC-MENU-03: khối .glass-card vẫn giữ position: relative cho đường kẻ ::before', () => {
    const khoiBase = CSS.match(/\.glass-card\s*{[^}]*}/);
    expect(khoiBase).not.toBeNull();
    expect(khoiBase[0]).toContain('position: relative');
  });

  it('TC-MENU-04: bốn menu đầu trang vẫn mang cùng lúc absolute + glass-card', () => {
    const menus = [...INDEX.matchAll(/class="([^"]*)"/g)]
      .map((m) => m[1])
      .filter((cls) => /\bglass-card\b/.test(cls) && /\babsolute\b/.test(cls));
    // Xuất Excel, Tạo mới, chuông, Chat — thiếu chiếc nào là chiếc ấy lại đội khung lên.
    expect(menus.length).toBe(4);
  });
});
