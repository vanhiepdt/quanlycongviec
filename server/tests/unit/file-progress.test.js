import { afterEach, expect, it, vi } from 'vitest';
import { DEFAULT_FILE_PROGRESS, fileProgress } from '../../src/modules/systemSettings/defaults.js';
import * as settings from '../../src/modules/systemSettings/service.js';
import { pool } from '../../src/db/pool.js';
afterEach(() => vi.restoreAllMocks());
it('TC-V2-07: bảng mốc mặc định và từng nhánh', () => {
  for (const [row, expected] of [
    [{ trang_thai: 'da-duyet', co_ban: false }, 0],
    [{ trang_thai: 'luu-tam' }, 0],
    [{ trang_thai: 'can-sua' }, 20],
    [{ trang_thai: 'cho-xem', gui_bld_phe_duyet: true }, 40],
    [{ trang_thai: 'cho-xem', gui_bld_phe_duyet: false }, 50],
    [{ trang_thai: 'cho-lanh-dao', lanh_dao_tu_lam: true }, 50],
    [{ trang_thai: 'cho-lanh-dao' }, 80],
    [{ trang_thai: 'da-duyet' }, 100],
    [{ trang_thai: 'hoan-thanh' }, 100],
  ])
    expect(fileProgress(row)).toBe(expected);
});
it('TC-V2-08: bảng trống hoặc không đọc được dùng dự phòng cứng', async () => {
  const query = vi
    .spyOn(pool, 'query')
    .mockResolvedValueOnce({ rows: [] })
    .mockRejectedValueOnce(new Error('CSDL tạm không đọc được'));
  expect((await settings.read()).fileProgress).toEqual(DEFAULT_FILE_PROGRESS);
  expect((await settings.read()).fileProgress).toEqual(DEFAULT_FILE_PROGRESS);
  expect(query).toHaveBeenCalledTimes(2);
});
