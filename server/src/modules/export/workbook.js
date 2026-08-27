// Xuất Excel — tầng GHI FILE (§7 việc 7.5). Nhận mô hình bảng thuần của `service.js`, trả về
// Buffer `.xlsx` thật (không phải CSV đổi tên — §3.3 chốt `exceljs` 4.4.0).
//
// Ba điều TC-MISC-10/13 đo, và cách file này bảo đảm:
//  1. «Mở bằng Excel không cảnh báo»: ghi bằng `wb.xlsx.writeBuffer()` — định dạng OOXML đúng
//     chuẩn. Không tự nối chuỗi XML, không đổi đuôi file HTML/CSV.
//  2. «Số dòng = số mục thấy được»: bảng chỉ có 2 dòng cố định trước dữ liệu (dòng 1 tiêu đề,
//     dòng 2 tên cột), rồi mỗi mục MỘT dòng, không dòng phụ. Mẫu nào cần dòng «TỔNG CỘNG» thì tự
//     đưa vào `dongTong` — mẫu công việc cố ý KHÔNG có, để phép đối chiếu số dòng còn đúng.
//  3. «Excel nhận là ngày»: ô ngày nhận `Date` (không phải chuỗi 'dd/mm/yyyy') + `numFmt`. Ghi
//     chuỗi thì Excel canh trái, không lọc/sắp/tính hiệu số ngày được — đúng lỗi bản CSV cũ.
import ExcelJS from 'exceljs';

export const DINH_DANG_NGAY = 'dd/mm/yyyy';

/** Kiểu MIME của .xlsx. Sai chuỗi này là Excel đòi "sửa file" khi mở. */
export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Số dòng đứng trước dữ liệu: tiêu đề + tên cột. Test đối chiếu số dòng dựa vào hằng này. */
export const SO_DONG_DAU = 2;

const XAM_NHAT = 'FFF2F2F2';
const XAM_TIEU_DE = 'FFDCE6F1';

/** Một dòng cột: `{ key, header, width, type?: 'date'|'number', indent?: boolean }`. */
function datCot(sheet, cot) {
  sheet.columns = cot.map((c) => ({ key: c.key, width: c.width ?? 16 }));
}

function dongTieuDe(sheet, tieuDe, soCot) {
  const row = sheet.getRow(1);
  row.getCell(1).value = tieuDe;
  row.font = { bold: true, size: 14 };
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 22;
  if (soCot > 1) sheet.mergeCells(1, 1, 1, soCot);
}

function dongTenCot(sheet, cot) {
  const row = sheet.getRow(SO_DONG_DAU);
  cot.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XAM_TIEU_DE } };
    cell.border = { bottom: { style: 'thin' } };
  });
  row.height = 20;
}

/**
 * Ghi một dòng dữ liệu.
 *
 * Thụt lề dùng `alignment.indent` của Excel, KHÔNG chèn dấu cách vào đầu chuỗi: dấu cách đi theo
 * giá trị nên hàm `TRIM`, phép lọc và mọi lần sao chép sang chỗ khác đều mang theo nó, còn `indent`
 * là thuộc tính hiển thị — nội dung ô vẫn sạch (§7 việc 7.5, mẫu (a) «có thụt lề»).
 */
function ghiDong(sheet, cot, data, viTri) {
  const row = sheet.getRow(viTri);
  const capDo = Number(data.capDo ?? 1);
  cot.forEach((c, i) => {
    const cell = row.getCell(i + 1);
    const value = data[c.key];
    if (c.type === 'date') {
      // `null` để Ô TRỐNG, không ghi chuỗi rỗng: ô trống mới không lọt vào phép sắp xếp theo ngày.
      if (value != null) {
        cell.value = value;
        cell.numFmt = DINH_DANG_NGAY;
      }
      cell.alignment = { horizontal: 'center' };
    } else if (c.type === 'number') {
      if (value != null) cell.value = Number(value);
      cell.alignment = { horizontal: 'center' };
    } else {
      cell.value = value ?? '';
      if (c.indent && capDo > 1) cell.alignment = { indent: (capDo - 1) * 2 };
    }
  });
  // Cấp 1 in đậm, cấp 2 nền xám nhạt: cây 3 tầng trên giấy phải nhìn ra tầng ngay, thụt lề một mình
  // thì in đen trắng gần như mất.
  if (capDo === 1) row.font = { bold: true };
  else if (capDo === 2) {
    for (let i = 1; i <= cot.length; i += 1) {
      row.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XAM_NHAT } };
    }
  }
  return row;
}

/** Dựng một sheet từ mô hình bảng. Trả về sheet để hàm gọi kiểm tra nếu cần. */
export function dungSheet(wb, model) {
  const cot = model.cot;
  const sheet = wb.addWorksheet(model.ten, {
    // Khoá dòng đầu (§7 việc 7.5): `ySplit = 2` giữ CẢ dòng tiêu đề và dòng tên cột đứng yên khi
    // cuộn. Khoá đúng 1 dòng thì tên cột trôi mất — người đọc file 5.000 dòng không còn biết cột
    // nào là hạn chót.
    views: [{ state: 'frozen', xSplit: 0, ySplit: SO_DONG_DAU }],
  });
  datCot(sheet, cot);
  dongTieuDe(sheet, model.tieuDe, cot.length);
  dongTenCot(sheet, cot);

  let viTri = SO_DONG_DAU;
  for (const data of model.dong) {
    viTri += 1;
    ghiDong(sheet, cot, data, viTri);
  }

  if (model.dongTong) {
    viTri += 1;
    const row = ghiDong(sheet, cot, { ...model.dongTong, capDo: 1 }, viTri);
    row.border = { top: { style: 'double' } };
  }

  // `commit()` không cần cho workbook trong bộ nhớ, nhưng `lastRow.commit()` đảm bảo mọi dòng đã
  // vào model trước khi ghi buffer (thói quen an toàn khi sau này chuyển sang streaming writer).
  sheet.lastRow?.commit();
  return sheet;
}

/**
 * Mô hình bảng → Buffer .xlsx.
 *
 * Nhận CẢ một mô hình lẫn mảng mô hình: file nhiều sheet chỉ là vòng lặp, không cần đường riêng.
 */
export async function taoBuffer(models) {
  const list = Array.isArray(models) ? models : [models];
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Quản lý công việc';
  wb.created = new Date();
  for (const model of list) dungSheet(wb, model);
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
}

export default taoBuffer;
