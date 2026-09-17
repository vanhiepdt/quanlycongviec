import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { htmlEditor } from '../../src/modules/taskFiles/service.js';

let dongTrang;

afterEach(() => dongTrang?.());

function moTrang({
  duocGui = true,
  duocVerdict = false,
  coBanChoSua = false,
  banChoSuaId = null,
  traVe = () => ({}),
} = {}) {
  const config = {
    document: { title: 'Kết quả' },
    documentType: 'word',
    editorConfig: { user: { id: '4', name: 'Cán bộ' }, mode: 'edit' },
  };
  const html = htmlEditor({
    dsUrl: 'http://onlyoffice.test',
    token: 'test',
    config,
    ban: { id: 11, file_id: 7, version_no: 1, ten_goc: '<em>Tên file</em>' },
    item: { id: 3, code: 'CV001-001', name: 'Nhiệm vụ' },
    nhom: { id: 7, lenh_sua_ghi_chu: '<em>Ghi chú</em>' },
    duocSua: true,
    duocGui,
    duocVerdict,
    coBanChoSua,
    banChoSuaId,
  });
  const dom = new JSDOM(html, { url: 'http://localhost', runScripts: 'outside-only' });
  const { window } = dom;
  const closeThat = window.close.bind(window);
  dongTrang = closeThat;
  window.close = vi.fn();
  window.confirm = vi.fn(() => true);
  const timers = [];
  window.setTimeout = (callback) => {
    timers.push(callback);
    return timers.length;
  };
  let cauHinh;
  window.DocsAPI = {
    DocEditor: function (_id, data) {
      cauHinh = data;
    },
  };
  window.fetch = vi.fn(async (url, opts) => {
    const data = await traVe(url, opts);
    return { ok: true, status: 200, json: () => Promise.resolve({ ok: true, data }) };
  });
  for (const script of window.document.querySelectorAll('script:not([src])'))
    window.eval(script.textContent);
  const nut = (id) => window.document.getElementById(id);
  const sua = () => {
    cauHinh.events.onDocumentStateChange({ data: true });
    cauHinh.events.onDocumentStateChange({ data: false });
  };
  return { window, nut, sua, timers, cauHinh };
}

async function doiXuLy() {
  for (let lan = 0; lan < 30; lan++) await Promise.resolve();
}

describe('TC-OO-LS: lưu tạm / lưu bản cuối / gửi là ba thao tác độc lập', () => {
  it('ý kiến và tên file là chữ; không có lệnh thì không có nút gửi; có Lưu tạm và Lưu bản cuối', () => {
    const { nut, window } = moTrang({ duocGui: false });
    expect(nut('noi-dung').value).toBe('<em>Ghi chú</em>');
    expect(window.document.querySelector('em')).toBeNull();
    expect(nut('gui')).toBeNull();
    expect(nut('luu')).not.toBeNull();
    expect(nut('luu').textContent).toBe('Lưu tạm');
    expect(nut('luu-ban-cuoi')).not.toBeNull();
    expect(nut('luu-ban-cuoi').textContent).toBe('Lưu bản cuối');
    expect(nut('duyet-moi')).toBeNull();
    expect(nut('sua-ban-vua-luu')).toBeNull();
  });

  it('có bản chờ thì hiện Sửa bản vừa lưu; TP/PP cũng có đủ 3 nút, không duyệt trên tab', () => {
    const { nut } = moTrang({ duocGui: false, duocVerdict: true, coBanChoSua: true, banChoSuaId: 12 });
    expect(nut('luu')).not.toBeNull();
    expect(nut('luu-ban-cuoi')).not.toBeNull();
    expect(nut('sua-ban-vua-luu')).not.toBeNull();
    expect(nut('sua-ban-vua-luu').textContent).toBe('Sửa bản vừa lưu');
    expect(nut('duyet-moi')).toBeNull();
  });

  it('editor sạch chỉ gửi bản đã lưu, mang ý kiến và đóng sau thành công', async () => {
    const { nut, window } = moTrang();
    nut('noi-dung').value = 'Đã sửa xong';
    nut('gui').click();
    await doiXuLy();
    expect(window.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = window.fetch.mock.calls[0];
    expect(url).toBe('/api/v1/task-files/7/gui-ban-moi');
    expect(JSON.parse(opts.body)).toEqual({ noiDung: 'Đã sửa xong' });
    expect(window.close).toHaveBeenCalledOnce();
  });

  it('dirty phải chờ Lưu bản cuối hoàn tất, chống nhấp đôi, rồi mới gửi', async () => {
    let xong;
    const { nut, window, sua } = moTrang({
      traVe: (url) =>
        url.endsWith('/save')
          ? new Promise((resolve) => {
              xong = resolve;
            })
          : {},
    });
    sua();
    nut('gui').click();
    nut('gui').click();
    await doiXuLy();
    expect(window.fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/task-file-versions/11/save',
    ]);
    expect(JSON.parse(window.fetch.mock.calls[0][1].body)).toEqual({ cheDo: 'ban-cuoi' });
    expect(window.close).not.toHaveBeenCalled();
    xong({ daLuu: true, versionNo: 2, banId: 12 });
    await doiXuLy();
    expect(window.fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/task-file-versions/11/save',
      '/api/v1/task-files/7/gui-ban-moi',
    ]);
    expect(window.close).toHaveBeenCalledOnce();
  });

  it('save lỗi thì không gửi, không đóng, mở lại nút', async () => {
    const { nut, window, sua } = moTrang({
      traVe: () => {
        throw new Error('Chưa lưu được');
      },
    });
    sua();
    nut('gui').click();
    await doiXuLy();
    expect(window.fetch).toHaveBeenCalledTimes(1);
    expect(window.close).not.toHaveBeenCalled();
    expect(nut('gui').disabled).toBe(false);
    expect(nut('tinh').textContent).toBe('Chưa lưu được');
  });

  it('Lưu tạm gọi /save cheDo=luu-tam, không đóng, không thành bản', async () => {
    const { nut, window, sua } = moTrang({ traVe: () => ({ daLuu: true, tam: true }) });
    sua();
    nut('luu').click();
    await doiXuLy();
    expect(window.fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/task-file-versions/11/save',
    ]);
    expect(JSON.parse(window.fetch.mock.calls[0][1].body)).toEqual({ cheDo: 'luu-tam' });
    expect(nut('tinh').textContent).toContain('lưu tạm');
    expect(window.close).not.toHaveBeenCalled();
  });

  it('save trả chưa thay đổi khi dirty thì không được gửi bản cũ', async () => {
    const { nut, window, sua } = moTrang({ traVe: () => ({ daLuu: false }) });
    sua();
    nut('gui').click();
    await doiXuLy();
    expect(window.fetch).toHaveBeenCalledTimes(1);
    expect(window.close).not.toHaveBeenCalled();
    expect(nut('tinh').textContent).toContain('Chưa xác nhận thay đổi đã lưu');
  });

  it('confirm Không trên Lưu bản cuối không lưu/đóng; Lưu tạm không gọi gửi', async () => {
    const { nut, window } = moTrang({ traVe: () => ({ daLuu: true, versionNo: 2, banId: 12 }) });
    window.confirm.mockReturnValue(false);
    nut('luu-ban-cuoi').click();
    await doiXuLy();
    expect(window.fetch).not.toHaveBeenCalled();
    expect(window.close).not.toHaveBeenCalled();
    nut('luu').click();
    await doiXuLy();
    expect(window.fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/task-file-versions/11/save',
    ]);
    expect(JSON.parse(window.fetch.mock.calls[0][1].body)).toEqual({ cheDo: 'luu-tam' });
    expect(window.close).not.toHaveBeenCalled();
  });

  it('Lưu bản cuối Có thì /save ban-cuoi rồi đóng', async () => {
    const { nut, window, sua } = moTrang({
      traVe: () => ({ daLuu: true, versionNo: 2, banId: 12 }),
    });
    sua();
    nut('luu-ban-cuoi').click();
    await doiXuLy();
    expect(window.fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/task-file-versions/11/save',
    ]);
    expect(JSON.parse(window.fetch.mock.calls[0][1].body)).toEqual({ cheDo: 'ban-cuoi' });
    expect(window.confirm).toHaveBeenCalledWith('Chắc chắn lưu bản này không?');
    expect(window.close).toHaveBeenCalledOnce();
  });
});

describe('TC-V6-UI: ý kiến trong luồng bố cục, không duyệt trên tab OnlyOffice', () => {
  it.each([true, false])(
    'TC-V6-UI-01: khối ý kiến không absolute, đứng trước khung editor (gửi=%s)',
    (duocGui) => {
      const { window, nut } = moTrang({
        duocGui,
        duocVerdict: !duocGui,
      });
      expect(window.getComputedStyle(nut('y-kien')).position).not.toBe('absolute');
      expect(window.getComputedStyle(nut('thanh')).position).not.toBe('absolute');
      expect(nut('y-kien').compareDocumentPosition(nut('placeholder')) & 4).toBe(4);
      expect(nut('noi-dung').disabled).toBe(false);
      expect(nut('duyet-moi')).toBeNull();
      expect(nut('luu-ban-cuoi')).not.toBeNull();
    }
  );

  it('TC-V6-UI-02: Lưu bản cuối confirm Có mới save và đóng, chống bấm đôi, không gọi verdict', async () => {
    let xong;
    const { window, nut, sua } = moTrang({
      duocGui: false,
      duocVerdict: true,
      traVe: (url) =>
        url.endsWith('/save')
          ? new Promise((resolve) => {
              xong = resolve;
            })
          : {},
    });
    expect(nut('duyet-moi')).toBeNull();
    expect(nut('luu-ban-cuoi')).not.toBeNull();
    sua();
    nut('luu-ban-cuoi').click();
    nut('luu-ban-cuoi').click();
    await doiXuLy();
    expect(window.fetch.mock.calls.map(([u]) => u)).toEqual(['/api/v1/task-file-versions/11/save']);
    expect(window.close).not.toHaveBeenCalled();
    xong({ daLuu: true, banId: 12, versionNo: 2 });
    await doiXuLy();
    expect(window.fetch.mock.calls.map(([u]) => u)).toEqual([
      '/api/v1/task-file-versions/11/save',
    ]);
    expect(window.fetch.mock.calls.some(([u]) => String(u).includes('/verdict'))).toBe(false);
    expect(window.close).toHaveBeenCalledOnce();
  });

  it.each(['không đổi', 'lỗi'])('TC-V6-UI-03: save %s không đóng tab, không duyệt', async (loai) => {
    const { window, nut } = moTrang({
      duocGui: false,
      duocVerdict: true,
      traVe: () => {
        if (loai === 'lỗi') throw new Error('Không lưu được');
        return { daLuu: false };
      },
    });
    expect(nut('luu-ban-cuoi')).not.toBeNull();
    nut('luu-ban-cuoi').click();
    await doiXuLy();
    expect(window.fetch).toHaveBeenCalledTimes(1);
    expect(window.close).not.toHaveBeenCalled();
    expect(nut('luu-ban-cuoi').disabled).toBe(false);
    expect(nut('noi-dung').disabled).toBe(false);
    expect(window.fetch.mock.calls.some(([u]) => String(u).includes('/verdict'))).toBe(false);
  });

  it('TC-V6-UI-04: TP có 3 nút lưu, không tự duyệt trên tab, không in «không tự Hoàn thành»', () => {
    const { window, nut } = moTrang({
      duocGui: false,
      duocVerdict: true,
      coBanChoSua: true,
    });
    expect(nut('duyet-moi')).toBeNull();
    expect(nut('luu')).not.toBeNull();
    expect(nut('luu-ban-cuoi')).not.toBeNull();
    expect(nut('sua-ban-vua-luu')).not.toBeNull();
    expect(window.document.body.textContent).not.toContain('không tự Hoàn thành');
  });
});
