// Nghiệp vụ «Bảng phân quyền hệ thống» (009_permission_overrides.sql) — Giám đốc sửa bằng
// dropdown ở trang Quản lý tài khoản; REST chỉ dành cho admin, máy chủ là rào chặn cuối.
//
// Ba lớp của `can()` (ma trận gốc → phạm vi → ủy quyền) KHÔNG ĐỔI. Ghi đè chỉ bật/tắt ô của
// ma trận gốc theo vai: 'cho-phep'/'cho-duyet' cho phép khi ma trận từ chối (inScope vẫn xét),
// 'tu-choi' tắt cả khi ma trận cho phép. Admin và user/department không chịu ghi đè.
import { AppError } from '../../utils/errors.js';
import { PERMISSIONS } from '../../middleware/rbac.js';
import * as repo from './repo.js';

const THUC_THE_DUOC_SUA = ['work', 'subwork', 'task'];
const HANH_DONG_DUOC_SUA = ['read', 'create', 'update', 'delete', 'approve'];
const GIA_TRI_HOP_LE = ['cho-phep', 'tu-choi', 'cho-duyet'];

/** Vai được chỉnh trong bảng: mọi vai nghiệp vụ TRỪ admin (chính người sửa bảng). */
export function vaiSuaDuoc(vai) {
  return Object.hasOwn(PERMISSIONS, vai) && vai !== 'admin';
}

/** Ma trận gốc + mọi ghi đè đang có — cho dropdown của admin. */
export async function bangHienTai() {
  return { macDinh: PERMISSIONS, ghiDe: await repo.listAll() };
}

/**
 * Lưu một loạt ghi đè. `giaTri: 'mac-dinh'` ⇒ XOÁ dòng (về mặc định); giá trị khác ⇒ upsert.
 * Kiểm từng mục trước khi ghi một cái nào — lỗi giữa chừng không được để nửa vời.
 */
export async function luuGhiDe(user, thayDoi) {
  const VAI_CO_PHAM_VI_RONG = ['Phó Giám đốc', 'Trưởng phòng', 'Phó phòng'];
  for (const g of thayDoi) {
    if (!g || !vaiSuaDuoc(g.vai)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Vai "${g?.vai}" không được chỉnh trong bảng (trừ admin)`,
        {
          field: 'vai',
        }
      );
    }
    if (!THUC_THE_DUOC_SUA.includes(g.entityType)) {
      throw new AppError('VALIDATION_ERROR', `Loại dữ liệu "${g.entityType}" không cho chỉnh`, {
        field: 'entityType',
      });
    }
    if (!HANH_DONG_DUOC_SUA.includes(g.action)) {
      throw new AppError('VALIDATION_ERROR', `Hành động "${g.action}" không cho chỉnh`, {
        field: 'action',
      });
    }
    if (g.giaTri !== 'mac-dinh' && !GIA_TRI_HOP_LE.includes(g.giaTri)) {
      throw new AppError('VALIDATION_ERROR', `Giá trị "${g.giaTri}" không hợp lệ`, {
        field: 'giaTri',
      });
    }
    if (g.giaTri === 'cho-duyet' && !['create', 'update', 'delete'].includes(g.action)) {
      throw new AppError('VALIDATION_ERROR', '«Chờ duyệt» chỉ áp dụng cho Tạo / Sửa / Xoá', {
        field: 'giaTri',
      });
    }
    // «Chờ duyệt» chỉ có ý nghĩa với vai có NGƯỜI DUYỆT phía trên: Phó GĐ / Trưởng phòng / Phó
    // phòng (cửa duyệt là Phó GĐ phụ trách hoặc Giám đốc), và từ Vòng 12e thêm **Cán bộ**
    // (`Nhân viên`) cho TẠO và SỬA theo yêu cầu người dùng «riêng cán bộ thì thêm option tạo,
    // sửa thêm mới duyệt» — việc Cán bộ lập/sửa rơi «Chờ duyệt» chờ cấp trên duyệt lại.
    // XOÁ vẫn không mở cho Cán bộ: 'cho-duyet' ở delete nghĩa là CHẶN xoá (`xoaDuocKhongKhiChoDuyet`)
    // mà luồng duyệt-yêu-cầu-xoá chưa có, nên với vai chỉ xoá được nhiệm vụ của mình thì thành
    // khoá cứng không có đường ra.
    const VAI_CO_CHO_DUYET = ['Phó Giám đốc', 'Trưởng phòng', 'Phó phòng'];
    const canBoChoDuyetDuoc = g.vai === 'Nhân viên' && ['create', 'update'].includes(g.action);
    if (g.giaTri === 'cho-duyet' && !VAI_CO_CHO_DUYET.includes(g.vai) && !canBoChoDuyetDuoc) {
      throw new AppError('VALIDATION_ERROR', `Vai "${g.vai}" không có luồng «Chờ duyệt»`, {
        field: 'giaTri',
      });
    }
    // Điều kiện phạm vi (Vòng 10): chỉ Phó GĐ / Trưởng phòng / Phó phòng được nới «tất cả các phòng».
    if (g.phamVi === 'tat-ca' && !VAI_CO_PHAM_VI_RONG.includes(g.vai)) {
      throw new AppError(
        'VALIDATION_ERROR',
        `Vai "${g.vai}" không được nới phạm vi tất cả các phòng`,
        {
          field: 'phamVi',
        }
      );
    }
  }
  for (const g of thayDoi) {
    if (g.giaTri === 'mac-dinh') {
      await repo.xoa(g);
    } else {
      await repo.upsert({
        ...g,
        phamVi: g.phamVi === 'tat-ca' ? 'tat-ca' : 'phong',
        updatedBy: user.id,
      });
    }
  }
  return repo.listAll();
}
