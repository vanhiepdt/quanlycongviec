// @vitest-environment jsdom
//
// Khung chat phía TRÌNH DUYỆT (§7 việc 7.3) — chạy app.js THẬT trong jsdom, `fetch` giả.
//
// Hai điều được chốt ở đây:
//   TC-MISC-08  tin nhắn chứa `<script>` hiện thành CHỮ, không thành thẻ (renderChatMessages escape)
//   TC-MISC-07  vòng hỏi lại 10 giây gộp tin mới theo mốc `since` do máy chủ cấp, không nhân đôi
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const APP_SRC = readFileSync(resolve(process.cwd(), '../web/assets/js/app.js'), 'utf8');
const EXPORTS = `;Object.assign(window, {
  renderChatMessages, updateChatBadge, chatTuRest, gopTinChat,
  napChatTuServer, batDauHoiLaiChat, dungHoiLaiChat, CHAT_POLL_MS,
  datNguoiDung: (v) => { currentUser = v; },
  datMuc: (v) => { currentSection = v; },
  docTinChat: () => chatTinNhan,
  docSince: () => chatSince,
});`;

/** Mỗi lần gọi trả một phản hồi REST kế tiếp trong hàng đợi. Ghi lại đường đã gọi để kiểm `since`. */
function datFetch(hangDoi) {
  const daGoi = [];
  // Không viết `async` ở đây: hàm giả không chờ gì cả (eslint `require-await` là lỗi cứng).
  window.fetch = vi.fn((path) => {
    daGoi.push(path);
    const data = hangDoi.shift() ?? null;
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, data }) });
  });
  return daGoi;
}

const dong = (over = {}) => ({
  id: 1,
  user_name: 'Nguyễn Văn A',
  message: 'Chào cả nhà',
  created_at: '2026-08-27T09:05:00.000Z',
  ...over,
});

beforeEach(() => {
  document.body.innerHTML = `
    <div id="chat-messages"></div>
    <span id="chat-badge" class="hidden"></span>`;
  new Function(APP_SRC + EXPORTS)();
  window.datNguoiDung({ name: 'Nguyễn Văn A', role: 'Nhân viên' });
  window.datMuc('overview');
});

describe('TC-MISC-08: chat chứa mã HTML hiện thành chữ, không chạy', () => {
  it('<script> trong tin nhắn không sinh thẻ script nào', () => {
    window.renderChatMessages([window.chatTuRest(dong({ message: '<script>alert(1)</script>' }))]);
    const khung = document.getElementById('chat-messages');
    expect(khung.querySelectorAll('script')).toHaveLength(0);
    expect(khung.textContent).toContain('<script>alert(1)</script>');
    expect(khung.innerHTML).toContain('&lt;script&gt;');
  });

  it('<img src=x onerror=…> không sinh thẻ img, tên người gửi cũng được thoát', () => {
    window.renderChatMessages([
      window.chatTuRest(
        dong({ user_name: '<b>Kẻ xấu</b>', message: '<img src=x onerror=alert(1)>' })
      ),
    ]);
    const khung = document.getElementById('chat-messages');
    expect(khung.querySelectorAll('img')).toHaveLength(0);
    expect(khung.querySelectorAll('b')).toHaveLength(0);
    expect(khung.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('nhắc tên @ai vẫn được tô — đó là thẻ do formatChatMessage sinh, không phải HTML người gõ', () => {
    window.renderChatMessages([window.chatTuRest(dong({ message: '@hiep xem lại giúp' }))]);
    // formatChatMessage bọc @hiep bằng <span>, nhưng escapeHtml chạy SAU nên span thành chữ.
    // Điều phải giữ: không có thẻ nào lọt vào DOM từ nội dung người gõ.
    const khung = document.getElementById('chat-messages');
    expect(khung.textContent).toContain('@hiep');
    expect(khung.querySelectorAll('span.bg-blue-100')).toHaveLength(0);
  });
});

describe('chatTuRest — dòng REST thành hình dạng khung chat', () => {
  it('avatar là 2 chữ đầu, timestamp HH:MM giờ địa phương, chatDate đúng toDateString', () => {
    const d = new Date('2026-08-27T09:05:00.000Z');
    const tin = window.chatTuRest(dong({ created_at: d.toISOString() }));
    expect(tin.avatar).toBe('NV');
    expect(tin.user).toBe('Nguyễn Văn A');
    expect(tin.chatDate).toBe(d.toDateString());
    const hai = (n) => String(n).padStart(2, '0');
    expect(tin.timestamp).toBe(`${hai(d.getHours())}:${hai(d.getMinutes())}`);
  });

  it('tin của người đã nghỉ (user_name rỗng) không nổ, avatar rỗng', () => {
    const tin = window.chatTuRest(dong({ user_name: '' }));
    expect(tin.avatar).toBe('');
    expect(tin.user).toBe('');
  });
});

describe('TC-MISC-07: hỏi lại 10 giây gộp tin mới theo mốc since', () => {
  it('lần đầu không gửi since; lần sau gửi đúng mốc máy chủ trả', async () => {
    const daGoi = datFetch([
      { messages: [dong({ id: 1 })], total: 1, since: '2026-08-27T09:05:00.000Z' },
      {
        messages: [dong({ id: 2, message: 'Tin mới' })],
        total: 1,
        since: '2026-08-27T09:07:00.000Z',
      },
    ]);

    await window.napChatTuServer({ dauTien: true });
    expect(daGoi[0]).toBe('/api/v1/chat');

    await window.napChatTuServer();
    expect(daGoi[1]).toBe('/api/v1/chat?since=' + encodeURIComponent('2026-08-27T09:05:00.000Z'));
    expect(window.docSince()).toBe('2026-08-27T09:07:00.000Z');
    expect(window.docTinChat().map((t) => t.id)).toEqual([1, 2]);
    expect(document.getElementById('chat-messages').textContent).toContain('Tin mới');
  });

  it('máy chủ trả lại tin đã có (id trùng) ⇒ không nhân đôi', async () => {
    datFetch([
      { messages: [dong({ id: 1 })], total: 1, since: 'A' },
      { messages: [dong({ id: 1 }), dong({ id: 2 })], total: 2, since: 'B' },
    ]);
    await window.napChatTuServer({ dauTien: true });
    await window.napChatTuServer();
    expect(window.docTinChat().map((t) => t.id)).toEqual([1, 2]);
  });

  it('giữ nhiều nhất 50 tin trong bộ nhớ, cắt phần cũ nhất', () => {
    const nhieu = Array.from({ length: 60 }, (_, i) => window.chatTuRest(dong({ id: i + 1 })));
    window.gopTinChat(nhieu);
    const giu = window.docTinChat();
    expect(giu).toHaveLength(50);
    expect(giu[0].id).toBe(11);
    expect(giu[49].id).toBe(60);
  });

  it('lượt hỏi lại rỗng KHÔNG vẽ lại khung (không nhảy thanh cuộn khi đang đọc)', async () => {
    datFetch([
      { messages: [dong({ id: 1 })], total: 1, since: 'A' },
      { messages: [], total: 0, since: 'A' },
    ]);
    await window.napChatTuServer({ dauTien: true });
    const truoc = document.getElementById('chat-messages').innerHTML;
    document.getElementById('chat-messages').setAttribute('data-dau', 'x');
    await window.napChatTuServer();
    expect(document.getElementById('chat-messages').getAttribute('data-dau')).toBe('x');
    expect(document.getElementById('chat-messages').innerHTML).toBe(truoc);
  });

  it('lỗi mạng ⇒ trả 0, giữ nguyên tin đang có, không nổ toast', async () => {
    datFetch([{ messages: [dong({ id: 1 })], total: 1, since: 'A' }]);
    await window.napChatTuServer({ dauTien: true });
    window.fetch = vi.fn(() => Promise.reject(new Error('mất mạng')));
    await expect(window.napChatTuServer()).resolves.toBe(0);
    expect(window.docTinChat()).toHaveLength(1);
  });

  it('vòng hỏi lại đặt đúng 10 giây và chỉ hỏi khi đang xem Tổng quan', () => {
    vi.useFakeTimers();
    try {
      const daGoi = datFetch([]);
      expect(window.CHAT_POLL_MS).toBe(10000);
      window.batDauHoiLaiChat();

      window.datMuc('projects');
      vi.advanceTimersByTime(10000);
      expect(daGoi).toHaveLength(0);

      window.datMuc('overview');
      vi.advanceTimersByTime(10000);
      expect(daGoi).toHaveLength(1);

      window.dungHoiLaiChat();
      vi.advanceTimersByTime(30000);
      expect(daGoi).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
