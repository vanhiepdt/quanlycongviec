import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { htmlEditor } from '../../src/modules/taskFiles/service.js';

let dongTrang;

afterEach(() => dongTrang?.());

function moTrang({
  duocGui = true,
  duyetMoi = null,
  duocVerdict = false,
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
    duyetMoi,
    duocVerdict,
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

describe('TC-OO-LS: lưu và gửi là hai thao tác độc lập', () => {
  it('ý kiến và tên file là chữ; không có lệnh thì không có nút gửi', () => {
    const { nut, window } = moTrang({ duocGui: false });
    expect(nut('noi-dung').value).toBe('<em>Ghi chú</em>');
    expect(window.document.querySelector('em')).toBeNull();
    expect(nut('gui')).toBeNull();
    expect(nut('luu')).not.toBeNull();
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

  it('dirty phải chờ save hoàn tất, chống nhấp đôi, rồi mới gửi', async () => {
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
    expect(window.close).not.toHaveBeenCalled();
    xong({ daLuu: true, versionNo: 2 });
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

  it('Ctrl+S: chỉ báo đã lưu sau thấy bản thực tế; gửi không forcesave lần nữa', async () => {
    const { nut, window, sua, timers } = moTrang({
      traVe: (url) =>
        url.endsWith('/files')
          ? {
              nhom: [
                {
                  id: 7,
                  bans: [{ id: 12, version_no: 2, uploaded_by: 4 }],
                  luong: [{ version_id: 12, hanh_dong: 'sua-truc-tuyen' }],
                },
              ],
            }
          : {},
    });
    sua();
    expect(nut('tinh').textContent).toContain('chưa lưu');
    await timers.shift()();
    expect(nut('tinh').textContent).toBe('Đã lưu bản mới — chưa gửi đi');
    nut('gui').click();
    await doiXuLy();
    expect(window.fetch.mock.calls.some(([url]) => url.endsWith('/save'))).toBe(false);
    expect(window.close).toHaveBeenCalledOnce();
  });

  it('save trả chưa thay đổi khi dirty thì không được gửi bản cũ', async () => {
    const { nut, window, sua } = moTrang({ traVe: () => ({ daLuu: false }) });
    sua();
    nut('gui').click();
    await doiXuLy();
    expect(window.fetch).toHaveBeenCalledTimes(1);
    expect(window.close).not.toHaveBeenCalled();
    expect(nut('tinh').textContent).toContain('chưa gửi đi');
  });

  it('confirm Không không lưu/gửi/đóng; lưu riêng không gọi gửi', async () => {
    const { nut, window } = moTrang({ traVe: () => ({ daLuu: true, versionNo: 2 }) });
    window.confirm.mockReturnValue(false);
    nut('gui').click();
    await doiXuLy();
    expect(window.fetch).not.toHaveBeenCalled();
    nut('luu').click();
    await doiXuLy();
    expect(window.fetch.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/task-files/7/luu-tam',
      '/api/v1/task-file-versions/11/save',
    ]);
    expect(nut('tinh').textContent).toBe('Đã lưu bản mới — chưa gửi đi');
    expect(window.close).not.toHaveBeenCalled();
  });
});

describe('TC-V6-UI: ý kiến trong luồng bố cục, lưu thật trước khi duyệt', () => {
  const duyetMoi = { ma: 'duyet', nhan: 'Duyệt', canNoiDung: false };
  it.each([true, false])(
    'TC-V6-UI-01: khối ý kiến không absolute, đứng trước khung editor (gửi=%s)',
    (duocGui) => {
      const { window, nut } = moTrang({
        duocGui,
        duocVerdict: !duocGui,
        duyetMoi: duocGui ? null : duyetMoi,
      });
      expect(window.getComputedStyle(nut('y-kien')).position).not.toBe('absolute');
      expect(window.getComputedStyle(nut('thanh')).position).not.toBe('absolute');
      expect(nut('y-kien').compareDocumentPosition(nut('placeholder')) & 4).toBe(4);
      expect(nut('noi-dung').disabled).toBe(false);
    }
  );
  it('TC-V6-UI-02: forcesave xong mới gửi verdict kèm đúng versionId và ý kiến, chống bấm đôi', async () => {
    let xong;
    const { window, nut, sua } = moTrang({
      duocGui: false,
      duocVerdict: true,
      duyetMoi,
      traVe: (url) =>
        url.endsWith('/save')
          ? new Promise((resolve) => {
              xong = resolve;
            })
          : {},
    });
    expect(nut('duyet-moi')).not.toBeNull();
    expect(nut('duyet-moi').textContent).toBe('Phê duyệt bản mới vừa chỉnh sửa');
    nut('noi-dung').value = 'Đã kiểm tra nội dung';
    sua();
    nut('duyet-moi').click();
    nut('duyet-moi').click();
    await doiXuLy();
    expect(window.fetch.mock.calls.map(([u]) => u)).toEqual(['/api/v1/task-file-versions/11/save']);
    expect(window.close).not.toHaveBeenCalled();
    xong({ daLuu: true, banId: 12, versionNo: 2 });
    await doiXuLy();
    expect(window.fetch.mock.calls.map(([u]) => u)).toEqual([
      '/api/v1/task-file-versions/11/save',
      '/api/v1/task-files/7/verdict',
    ]);
    expect(JSON.parse(window.fetch.mock.calls[1][1].body)).toEqual({
      hanhDong: 'duyet',
      noiDung: 'Đã kiểm tra nội dung',
      versionId: 12,
    });
    expect(window.close).toHaveBeenCalledOnce();
  });
  it.each(['không đổi', 'lỗi'])('TC-V6-UI-03: save %s không được duyệt bản cũ', async (loai) => {
    const { window, nut } = moTrang({
      duocGui: false,
      duocVerdict: true,
      duyetMoi,
      traVe: () => {
        if (loai === 'lỗi') throw new Error('Không lưu được');
        return { daLuu: false };
      },
    });
    expect(nut('duyet-moi')).not.toBeNull();
    nut('duyet-moi').click();
    await doiXuLy();
    expect(window.fetch).toHaveBeenCalledTimes(1);
    expect(window.close).not.toHaveBeenCalled();
    expect(nut('duyet-moi').disabled).toBe(false);
    expect(nut('noi-dung').disabled).toBe(false);
  });
  it('TC-V6-UI-04: TP sửa thành bản của mình chỉ trình PGĐ, không tự Hoàn thành', async () => {
    const { window, nut } = moTrang({
      duocGui: false,
      duocVerdict: true,
      // ĐIỂM 7 (ĐỢT B): «Trình Phó giám đốc» nay là «TP/PP phê duyệt» — cùng một hành động nhưng
      // máy chủ CÓ ghi mốc người ký và lúc ký. Ghi chú «không tự Hoàn thành» chỉ in cho mã mới.
      duyetMoi: { ma: 'tp-phe-duyet', nhan: 'TP/PP phê duyệt', canNoiDung: true },
      traVe: () => ({ daLuu: true, banId: 12, versionNo: 2 }),
    });
    expect(nut('duyet-moi')).not.toBeNull();
    expect(window.document.body.textContent).toContain('không tự Hoàn thành');
    nut('noi-dung').value = 'Đã sửa và trình lãnh đạo';
    nut('duyet-moi').click();
    await doiXuLy();
    expect(JSON.parse(window.fetch.mock.calls[1][1].body).hanhDong).toBe('tp-phe-duyet');
  });
});
