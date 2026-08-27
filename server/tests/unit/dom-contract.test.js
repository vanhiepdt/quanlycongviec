// Việc 4.7 — code chết trong tầng DOM.
//
// Bệnh cụ thể: `app.js` gắn listener cho một id KHÔNG có trong `index.html`. Toán tử `?.` làm nó im
// lặng tuyệt đối — không lỗi, không cảnh báo, chỉ là cái nút ấy vĩnh viễn không bấm được. Kế hoạch
// chỉ tên được một chỗ (`#add-notification-btn`); quét bằng máy ra thêm hai chỗ nữa.
//
// Test này canh cả LỚP lỗi đó, không chỉ ba id đã biết: mọi id mà `app.js` đọc phải sinh ra được từ
// một trong ba nguồn — `index.html`, chuỗi HTML do chính `app.js` dựng, hoặc `phanTu.id = "..."`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = resolve(process.cwd(), '../web');
const APP = readFileSync(resolve(WEB, 'assets/js/app.js'), 'utf8');
const INDEX = readFileSync(resolve(WEB, 'index.html'), 'utf8');

/** Bỏ dấu `\` trước dấu ngoặc kép để một biểu thức bắt được cả chuỗi thường lẫn chuỗi mẫu. */
const FLAT = APP.replace(/\\"/g, '"');

const bornIds = new Set([
  ...[...INDEX.matchAll(/id="([^"]+)"/g)].map((m) => m[1]),
  ...[...FLAT.matchAll(/id="([^"]+)"/g)].map((m) => m[1]),
  ...[...FLAT.matchAll(/\.id\s*=\s*"([^"]+)"/g)].map((m) => m[1]),
]);

const readIds = (pattern) => [...new Set([...APP.matchAll(pattern)].map((m) => m[1]))];

describe('4.7 — không còn listener treo vào id không tồn tại', () => {
  it('TC-DEAD-01: cả 22 id được gắn listener đều có nơi sinh ra', () => {
    const ids = readIds(/getElementById\("([^"]+)"\)\??\.addEventListener/g);
    expect(ids.length).toBeGreaterThanOrEqual(20);
    expect(ids.filter((id) => !bornIds.has(id))).toEqual([]);
  });

  /** Rộng hơn TC-DEAD-01: đọc để ẩn/hiện cũng vô nghĩa như gắn listener nếu id không có thật. */
  it('TC-DEAD-02: cả 147 id mà app.js đọc bằng getElementById đều có nơi sinh ra', () => {
    const ids = readIds(/getElementById\("([^"]+)"\)/g);
    expect(ids.length).toBeGreaterThanOrEqual(140);
    expect(ids.filter((id) => !bornIds.has(id))).toEqual([]);
  });

  /**
   * Kiểm sự có mặt dạng CHUỖI (`"add-project-btn"`) chứ không kiểm cả file: chú thích trong `app.js`
   * có nhắc tên ba id này để người sau biết vì sao chúng biến mất — nhắc trong chú thích thì không
   * sao, còn còn sót dưới dạng chuỗi nghĩa là vẫn còn code chạm vào chúng.
   */
  it('TC-DEAD-03: năm id chết không còn tồn tại dưới dạng chuỗi trong code', () => {
    // 2026-08-27: tab Nhiệm vụ bỏ ô ngày đơn lẻ (thay bằng Tháng/Năm) — hai id dưới cùng phải chết
    // ở CẢ hai phía: xoá khỏi index.html thì cũng không được còn code nào đọc chúng.
    for (const dead of [
      'add-notification-btn',
      'add-project-btn',
      'add-task-btn',
      'tasks-date-filter',
      'tasks-date-clear',
    ]) {
      expect({ dead, conSot: APP.includes(`"${dead}"`) }).toEqual({ dead, conSot: false });
      expect({ dead, trongHtml: INDEX.includes(`id="${dead}"`) }).toEqual({
        dead,
        trongHtml: false,
      });
    }
  });
});

describe('5.12 — nút «+ công việc con» trên cây (điểm C7)', () => {
  it('TC-TREE-UI-01: hai id ẩn mới của #task-form đều có nơi sinh ra', () => {
    for (const id of ['task-create-level', 'task-create-parent']) {
      expect({ id, born: bornIds.has(id) }).toEqual({ id, born: true });
    }
  });

  it('TC-TREE-UI-02: cây có class nút cấp 2 / cấp 3 và chữ «+ công việc con»', () => {
    expect(APP).toContain('add-subwork-from-work-btn');
    expect(APP).toContain('add-task-from-subwork-btn');
    expect(APP).toContain('+ công việc con');
    expect(FLAT).toContain('id="task-create-level"');
    expect(FLAT).toContain('id="task-create-parent"');
    expect(FLAT).toContain('name="level"');
    expect(FLAT).toContain('name="parent"');
  });

  it('TC-TREE-UI-03: không thêm <select name="level"> — cấp suy ra từ chỗ bấm, không cho người dùng chọn', () => {
    expect(FLAT).not.toMatch(/<select\b[^>]*\bname="level"/);
    expect(FLAT).not.toMatch(/<select\b[^>]*\bname="parent"/);
  });
});
