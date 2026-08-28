// Luật chung của TÊN THEO THÁNG, dùng cho CẢ ba cấp.
//
// Cấp 1 nằm ở `works/service.js`, cấp 2 và cấp 3 nằm ở `workItems/service.js`; phần kiểm QUYỀN của
// hai bên khác nhau (hai loại thực thể, hai cổng `can`), nhưng phần kiểm THÁNG thì giống hệt. Đặt ở
// đây để chỉ có một định nghĩa «tháng nào đặt tên được» phía máy chủ — hai bản chép tay là sớm muộn
// lệch nhau, và lệch ở đây nghĩa là cấp 1 cho đặt tháng mà cấp 3 chặn.
import { AppError } from '../../utils/errors.js';
import { MAU_THANG, thangCuaKhoang, thangSuaDuoc } from '../../utils/monthNames.js';

/**
 * Đọc tháng từ ĐƯỜNG DẪN (`/month-names/:month`) và chặn dạng sai ngay tại vỏ HTTP.
 *
 * Không dùng `validate(schema, 'params')`: Express dựng lại `req.params` cho từng lớp route, nên một
 * middleware ghi đè `req.params` không chắc còn nguyên khi vào handler. Một hàm gọi thẳng trong
 * handler thì không có chỗ nào cho sự "không chắc" đó.
 */
export function thangTuDuongDan(value) {
  const thang = String(value ?? '').trim();
  if (!MAU_THANG.test(thang)) {
    throw new AppError('VALIDATION_ERROR', 'Tháng phải theo dạng YYYY-MM', { field: 'month' });
  }
  return thang;
}

/**
 * Chặn nếu `month` không phải một tháng ĐẶT TÊN RIÊNG ĐƯỢC của khoảng `start`–`end`.
 *
 * Ba câu trả lời khác nhau, ba mã lỗi khác nhau, vì người dùng phải sửa ba cách khác nhau:
 *  · việc chỉ gói trong một tháng (hoặc thiếu ngày) ⇒ MONTH_OUT_OF_RANGE, không có gì để đặt;
 *  · tháng ĐẦU ⇒ MONTH_IS_FIRST, tên tháng đầu chính là tên gốc, sửa ở ô Tên của form;
 *  · tháng ngoài khoảng ⇒ MONTH_OUT_OF_RANGE.
 */
export function assertThangDatDuoc(month, start, end) {
  const thang = String(month ?? '');
  const cacThang = thangCuaKhoang(start, end);
  if (cacThang.length <= 1) {
    throw new AppError(
      'MONTH_OUT_OF_RANGE',
      'Đầu việc này không kéo dài hơn một tháng nên không đặt tên riêng theo tháng được'
    );
  }
  if (thang === cacThang[0]) {
    throw new AppError(
      'MONTH_IS_FIRST',
      `Tháng ${thang} là tháng đầu của đầu việc — tên của tháng đầu chính là tên gốc, sửa ở ô Tên`
    );
  }
  if (!thangSuaDuoc(start, end).includes(thang)) {
    throw new AppError(
      'MONTH_OUT_OF_RANGE',
      `Tháng ${thang} nằm ngoài thời gian của đầu việc (${cacThang[0]} → ${cacThang[cacThang.length - 1]})`
    );
  }
  return thang;
}

/**
 * Khoảng tháng của một dòng, đọc theo TÊN CỘT của bảng đang chứa nó.
 *
 * `works` dùng `start_date`/`end_date`, `work_items` dùng `start_date`/`due_date`. Nhận cả hai để
 * chỗ gọi không phải nhớ dòng mình đang giữ thuộc bảng nào.
 */
export function khoangCuaDong(row = {}) {
  return { start: row.start_date ?? null, end: row.end_date ?? row.due_date ?? null };
}

/** Tháng đặt tên được của một dòng — giao diện lấy đúng danh sách này để dựng ô nhập. */
export function thangDatDuocCuaDong(row = {}) {
  const { start, end } = khoangCuaDong(row);
  return thangSuaDuoc(start, end);
}

export { thangSuaDuoc };

export default {
  thangTuDuongDan,
  assertThangDatDuoc,
  khoangCuaDong,
  thangDatDuocCuaDong,
};
