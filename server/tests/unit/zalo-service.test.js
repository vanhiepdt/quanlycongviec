// CỔNG GỌI ZALO BOT API — tầng đơn vị (017, TC-ZL-01..04 của docs/KE-HOACH-THONG-BAO.md B7).
//
// `env` là ảnh CHỤP lúc env.js được nạp, nên muốn đặt token thử thì phải đặt TRƯỚC khi import —
// cùng khuôn `rpc-rate-limit.test.js`: `vi.stubEnv` + `vi.resetModules` + import động.
//
// `fetch` toàn cục bị giả ở MỌI ca: file này KHÔNG được chạm Internet, và chính số lượt gọi
// `fetch` là thứ TC-ZL-04 đang canh.
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.stubEnv('ZALO_BOT_TOKEN', 'token-test-123');
vi.stubEnv('ZALO_BOT_API_BASE', 'https://bot-api.example.test');
vi.resetModules();

const zalo = await import('../../src/services/zalo.js');

let daGoi;

/** Giả fetch: ghi lại (url, body) và trả `{ok:true}` của Zalo theo `ketQua` tuỳ chọn. */
function datFetch(ketQua = { ok: true, result: { message_id: 'm1' } }) {
  daGoi = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url, opt) => {
      daGoi.push({ url: String(url), body: opt && opt.body ? JSON.parse(opt.body) : null });
      return Promise.resolve({ status: 200, json: () => Promise.resolve(ketQua) });
    })
  );
}

beforeEach(() => {
  datFetch();
});

afterAll(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('TC-ZL-01: gửi đúng URL, đúng thân — token nằm trong ĐƯỜNG DẪN', () => {
  it('guiTin gọi POST /bot<token>/sendMessage với {chat_id, text}', async () => {
    const kq = await zalo.guiTin({ chatId: 'chat-1', text: 'Xin chào' });
    expect(kq.ok).toBe(true);
    expect(kq.loi).toBe('');
    expect(daGoi).toHaveLength(1);
    expect(daGoi[0].url).toBe('https://bot-api.example.test/bottoken-test-123/sendMessage');
    expect(daGoi[0].body).toEqual({ chat_id: 'chat-1', text: 'Xin chào' });
  });

  it('KHÔNG gửi parse_mode — tên việc người gõ chứa * thì vẫn phải hiện nguyên văn', async () => {
    await zalo.guiTin({ chatId: 'chat-1', text: 'Việc *quan trọng*' });
    expect(daGoi[0].body).not.toHaveProperty('parse_mode');
  });

  it('chatId rỗng ⇒ trả lỗi ngay, KHÔNG gọi mạng (chưa liên kết là chuyện bình thường)', async () => {
    const kq = await zalo.guiTin({ chatId: '', text: 'Xin chào' });
    expect(kq.ok).toBe(false);
    expect(kq.loi).toContain('chưa liên kết');
    expect(daGoi).toHaveLength(0);
  });

  it('nội dung rỗng sau cắt ⇒ lỗi, không gọi mạng', async () => {
    const kq = await zalo.guiTin({ chatId: 'chat-1', text: '   ' });
    expect(kq.ok).toBe(false);
    expect(daGoi).toHaveLength(0);
  });
});

describe('TC-ZL-02: tin dài hơn 2000 ký tự bị cắt, cắt ở ranh giới từ', () => {
  it('catTin giữ nguyên tin ngắn, cắt tin dài về ≤ 2000 và thêm …', () => {
    expect(zalo.catTin('Ngắn')).toBe('Ngắn');
    const dai = 'a'.repeat(zalo.DAI_NHAT_TIN + 50);
    const cat = zalo.catTin(dai);
    expect(Array.from(cat).length).toBeLessThanOrEqual(zalo.DAI_NHAT_TIN);
    expect(cat.endsWith('…')).toBe(true);
  });

  it('cắt lùi về khoảng trắng khi vẫn giữ được >80% tin', () => {
    // 1990 chữ 'x' + khoảng trắng + 100 chữ nữa ⇒ điểm cắt 1999 rơi GIỮA từ cuối; phải lùi về
    // khoảng trắng để không gửi nửa chữ vô nghĩa.
    const text = 'x'.repeat(1990) + ' ' + 'y'.repeat(100);
    const cat = zalo.catTin(text);
    expect(cat.endsWith('…')).toBe(true);
    expect(cat).toBe('x'.repeat(1990) + '…');
  });

  it('guiTin gửi phần ĐÃ CẮT, không gửi nguyên văn tin dài', async () => {
    await zalo.guiTin({ chatId: 'chat-1', text: 'x '.repeat(1500) });
    const gui = daGoi[0].body.text;
    expect(Array.from(gui).length).toBeLessThanOrEqual(zalo.DAI_NHAT_TIN);
    expect(gui.endsWith('…')).toBe(true);
  });
});

describe('TC-ZL-03: ok trong THÂN phản hồi mới là sự thật', () => {
  it('HTTP 200 kèm {ok:false} vẫn tính là thất bại, loi lấy từ description', async () => {
    datFetch({ ok: false, description: 'Bot blocked', error_code: 403 });
    const kq = await zalo.guiTin({ chatId: 'chat-1', text: 'Xin chào' });
    expect(kq.ok).toBe(false);
    expect(kq.loi).toBe('Bot blocked');
  });

  it('thân không phải JSON ⇒ vẫn thất bại êm, không ném', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          status: 502,
          json: () => Promise.reject(new Error('không phải JSON')),
        })
      )
    );
    const kq = await zalo.guiTin({ chatId: 'chat-1', text: 'Xin chào' });
    expect(kq.ok).toBe(false);
    expect(kq.loi).toContain('502');
  });

  it('fetch ném lỗi mạng ⇒ bắt lại, KHÔNG ném lên tầng trên (kênh phụ không được làm đổ việc chính)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('fetch failed')))
    );
    const kq = await zalo.guiTin({ chatId: 'chat-1', text: 'Xin chào' });
    expect(kq.ok).toBe(false);
    expect(kq.loi).toBe('Không gọi được Zalo');
  });
});

describe('TC-ZL-04: token trống = TẮT — không một lần gọi mạng', () => {
  it('daBat() false và guiTin không chạm fetch', async () => {
    vi.resetModules();
    // Đặt key RỖNG chứ không xoá: process.loadEnvFile của env.js không ghi đè key đã có, nên
    // deploy/.env (nếu có token thật) không thể bật lại tính năng trong ca này.
    vi.stubEnv('ZALO_BOT_TOKEN', '');
    const zaloTat = await import('../../src/services/zalo.js');
    expect(zaloTat.daBat()).toBe(false);

    vi.stubGlobal('fetch', vi.fn());
    const kq = await zaloTat.guiTin({ chatId: 'chat-1', text: 'Xin chào' });
    expect(kq.ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();

    // Trả env về trạng thái của các ca khác trong file.
    vi.resetModules();
    vi.stubEnv('ZALO_BOT_TOKEN', 'token-test-123');
  });
});
