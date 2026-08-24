// Dựng câu UPDATE từ một object thay đổi, theo DANH SÁCH TRẮNG cột.
//
// Vì sao cần: các API sửa của hệ này đều là PATCH — người dùng gửi 2 trong 20 cột thì chỉ 2 cột
// đó được ghi. Nếu viết tay mỗi service một đoạn `if (x !== undefined)` thì 5 module là 5 chỗ dễ
// sót, và chỉ cần một chỗ nối chuỗi tên cột từ `req.body` là mở đường tiêm SQL.
//
// Ở đây tên cột KHÔNG bao giờ đến từ dữ liệu vào: nó phải nằm trong `allowed`, còn giá trị luôn
// đi qua tham số `$n`.

/**
 * @param {readonly string[]} allowed tên cột được phép ghi, viết đúng như trong CSDL
 * @param {object} patch object khoá là tên cột; khoá `undefined` bị bỏ qua (không ghi)
 * @param {number} [startIndex] số thứ tự tham số bắt đầu, dùng khi câu SQL đã có $1, $2...
 * @returns {{sets: string[], values: unknown[], nextIndex: number}}
 */
export function buildUpdateSet(allowed, patch, startIndex = 1) {
  const sets = [];
  const values = [];
  let i = startIndex;
  for (const column of allowed) {
    if (!Object.hasOwn(patch, column)) continue;
    if (patch[column] === undefined) continue;
    sets.push(`${column} = $${i}`);
    values.push(patch[column]);
    i += 1;
  }
  return { sets, values, nextIndex: i };
}

/**
 * Dựng phần cột/tham số cho INSERT, cũng theo danh sách trắng.
 *
 * @param {readonly string[]} allowed tên cột được phép ghi
 * @param {object} data giá trị theo tên cột; khoá `undefined` bị bỏ qua
 * @param {object} [fixed] cột do máy chủ quyết định (mã sinh sẵn, người tạo...), luôn được ghi
 * @returns {{columns: string[], values: unknown[], params: string[]}}
 */
export function buildInsert(allowed, data, fixed = {}) {
  const columns = Object.keys(fixed);
  const values = Object.values(fixed);
  for (const column of allowed) {
    if (!Object.hasOwn(data, column)) continue;
    if (data[column] === undefined) continue;
    columns.push(column);
    values.push(data[column]);
  }
  return { columns, values, params: columns.map((_, i) => `$${i + 1}`) };
}

/**
 * `:id` trên URL nhận CẢ id số và mã (`CV001`, hoặc mã cũ `ID2508...`): frontend cũ và cầu RPC
 * §5.1 chỉ có mã trong tay, còn API mới thì tiện nhất là id. Chuỗi toàn số ⇒ id, còn lại ⇒ mã.
 * Mã của hệ này luôn bắt đầu bằng chữ nên hai miền không chồng nhau.
 *
 * @param {unknown} ref
 * @returns {{column: 'id'|'code', value: number|string}}
 */
export function refToColumn(ref) {
  const text = String(ref ?? '').trim();
  if (/^\d+$/.test(text)) return { column: 'id', value: Number(text) };
  return { column: 'code', value: text };
}

export default buildUpdateSet;
