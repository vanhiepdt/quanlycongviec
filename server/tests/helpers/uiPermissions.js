// Fixture UI dùng đúng ma trận máy chủ; không đặt quyền dự phòng trong mã sản phẩm.
import { PERMISSIONS } from '../../src/middleware/rbac.js';
export const QUYEN_UI =
  '\ncapNhatBangQuyen({macDinh:' + JSON.stringify(PERMISSIONS) + ',ghiDe:[]});\n';
