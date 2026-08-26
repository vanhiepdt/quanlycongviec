// Chốt bẫy 2026-08-26: COL phía client (web/assets/js/app.js) PHẢI khớp nguyên văn COL phía
// server (server/src/rpc/legacyFields.js) về TÊN KHOÁ lẫn CHUỖI GIÁ TRỊ — vì server trả object
// legacy với key là chuỗi tiếng Việt; client đọc project[COL.P_DEPT_ID] chẳng hạn. Sai một chữ
// (dấu, khoảng trắng) là đọc ra undefined mà không lỗi gì: ô phòng mất danh sách, phân công trống.
// Lần đó: client thiếu 5 khoá phân công ba lớp ⇒ "không chọn được phòng", danh sách lãnh đạo rỗng.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Trích khối COL (2 dạng: client `const COL = {…};` / server `export const COL = Object.freeze({…});`) thành map. */
function docCol(duongDan) {
  const src = readFileSync(duongDan, 'utf8');
  let dau = src.indexOf('export const COL = Object.freeze({');
  let mocDong = '});';
  if (dau < 0) {
    dau = src.indexOf('const COL = {');
    mocDong = '};';
  }
  expect(dau, `không thấy const COL trong ${duongDan}`).toBeGreaterThanOrEqual(0);
  const khoi = src.slice(dau, src.indexOf(mocDong, dau));
  const map = {};
  // client dùng nháy kép, server dùng nháy đơn — bắt cả hai rồi bỏ nháy/unescape tối thiểu.
  for (const m of khoi.matchAll(/([A-Z0-9_]+):\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g))
    map[m[1]] = (m[2] ?? m[3]).replace(/\\(['"\\])/g, '$1');
  expect(Object.keys(map).length, 'không trích được khoá nào').toBeGreaterThan(10);
  return map;
}

const SERVER = docCol(resolve(process.cwd(), 'src/rpc/legacyFields.js'));
const CLIENT = docCol(resolve(process.cwd(), '../web/assets/js/app.js'));

describe('COL client khớp COL server (bẫy 2026-08-26)', () => {
  it('mọi khoá có ở CẢ HAI phía phải cùng giá trị chuỗi', () => {
    const lech = Object.keys(CLIENT)
      .filter((k) => k in SERVER && CLIENT[k] !== SERVER[k])
      .map((k) => `${k}: client "${CLIENT[k]}" ≠ server "${SERVER[k]}"`);
    expect(lech).toEqual([]);
  });

  it('khối phân công ba lớp phải có mặt ở client (P_DEPT_ID/P_SUP/P_LEADERS/T_SUP/T_LEADERS)', () => {
    for (const k of ['P_DEPT_ID', 'P_SUP', 'P_LEADERS', 'T_SUP', 'T_LEADERS']) {
      expect(CLIENT[k], `client thiếu COL.${k}`).toBe(SERVER[k]);
    }
  });
});
