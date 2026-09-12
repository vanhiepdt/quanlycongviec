import { pool, withTransaction } from '../../db/pool.js';
import { AppError, forbidden } from '../../utils/errors.js';
import { DEFAULT_FILE_PROGRESS, FILE_PROGRESS_LABELS, PROGRESS_PATHS } from './defaults.js';
export { DEFAULT_FILE_PROGRESS, FILE_PROGRESS_LABELS };
const defaults = () => ({
  fileProgress: { ...DEFAULT_FILE_PROGRESS },
  guiBldChangeRequiresApproval: true,
});
function validateProgress(p) {
  for (const [key, label] of Object.entries(FILE_PROGRESS_LABELS)) {
    if (typeof p[key] !== 'number' || !Number.isFinite(p[key]) || p[key] < 0 || p[key] > 100)
      throw new AppError('VALIDATION_ERROR', 'Mốc «' + label + '» phải là số từ 0 đến 100', {
        field: 'fileProgress.' + key,
      });
  }
  for (const path of PROGRESS_PATHS)
    for (let i = 1; i < path.length; i++) {
      if (p[path[i]] < p[path[i - 1]])
        throw new AppError(
          'VALIDATION_ERROR',
          'Mốc «' +
            FILE_PROGRESS_LABELS[path[i - 1]] +
            '» không được lớn hơn «' +
            FILE_PROGRESS_LABELS[path[i]] +
            '»',
          { field: 'fileProgress.' + path[i - 1] }
        );
    }
}
export async function read(client = null) {
  try {
    const row = (
      await (client ?? pool).query(
        "SELECT setting_value FROM system_settings WHERE setting_key='workflow'"
      )
    ).rows[0];
    const value = row?.setting_value ?? {};
    const p = { ...DEFAULT_FILE_PROGRESS, ...value.fileProgress };
    validateProgress(p);
    return {
      fileProgress: p,
      guiBldChangeRequiresApproval:
        typeof value.guiBldChangeRequiresApproval === 'boolean'
          ? value.guiBldChangeRequiresApproval
          : true,
    };
  } catch {
    return defaults();
  }
}
export function update(user, input) {
  if (user.role !== 'admin') throw forbidden('Chỉ Giám đốc (admin) được sửa cấu hình hệ thống');
  if (
    !input ||
    Array.isArray(input) ||
    typeof input !== 'object' ||
    Object.keys(input).some((k) => !['fileProgress', 'guiBldChangeRequiresApproval'].includes(k))
  )
    throw new AppError('VALIDATION_ERROR', 'Cấu hình không hợp lệ');
  if (
    input.fileProgress !== undefined &&
    (!input.fileProgress ||
      Array.isArray(input.fileProgress) ||
      typeof input.fileProgress !== 'object' ||
      Object.keys(input.fileProgress).some((k) => !Object.hasOwn(DEFAULT_FILE_PROGRESS, k)))
  )
    throw new AppError('VALIDATION_ERROR', 'Mốc tiến độ file không hợp lệ');
  if (
    Object.hasOwn(input, 'guiBldChangeRequiresApproval') &&
    typeof input.guiBldChangeRequiresApproval !== 'boolean'
  )
    throw new AppError('VALIDATION_ERROR', 'Tùy chọn duyệt đổi tích Gửi BLĐ phải là đúng hoặc sai');
  return withTransaction(async (client) => {
    // Khoá một bản ghi chung để hai admin sửa những mốc khác nhau không ghi đè lẫn nhau.
    await client.query(
      "INSERT INTO system_settings(setting_key,setting_value) VALUES('workflow','{}') ON CONFLICT DO NOTHING"
    );
    const old = (
      await client.query(
        "SELECT setting_value FROM system_settings WHERE setting_key='workflow' FOR UPDATE"
      )
    ).rows[0].setting_value;
    const next = {
      ...defaults(),
      ...old,
      ...input,
      fileProgress: { ...DEFAULT_FILE_PROGRESS, ...old.fileProgress, ...input.fileProgress },
    };
    validateProgress(next.fileProgress);
    await client.query(
      "UPDATE system_settings SET setting_value=$1::jsonb,updated_by=$2,updated_at=now() WHERE setting_key='workflow'",
      [JSON.stringify(next), user.id]
    );
    return next;
  });
}
