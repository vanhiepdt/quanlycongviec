// Giá trị cứng dự phòng khi bảng trống hoặc không đọc được. Không cache theo phiên.
export const DEFAULT_FILE_PROGRESS = Object.freeze({
  chuaCoBan: 0,
  luuTam: 0,
  canSua: 20,
  canBoGuiBld: 40,
  canBoGuiTpPp: 50,
  lanhDaoTuLamChoPgd: 50,
  tpPpDaDuyetGuiPgd: 80,
  daDuyet: 100,
});
export const FILE_PROGRESS_LABELS = Object.freeze({
  chuaCoBan: 'Chưa có bản',
  luuTam: 'Lưu tạm',
  canSua: 'Cần sửa',
  canBoGuiBld: 'Cán bộ gửi TP/PP, có tích Gửi BLĐ',
  canBoGuiTpPp: 'Cán bộ gửi TP/PP, không tích Gửi BLĐ',
  lanhDaoTuLamChoPgd: 'TP/PP tự làm, chờ Phó GĐ',
  tpPpDaDuyetGuiPgd: 'TP/PP đã duyệt, gửi PGĐ/GĐ',
  daDuyet: 'Đã duyệt / Hoàn thành',
});
// Ba đường đi: mốc ở nhánh khác không cần so với nhau.
export const PROGRESS_PATHS = [
  ['chuaCoBan', 'luuTam', 'canSua', 'canBoGuiBld', 'tpPpDaDuyetGuiPgd', 'daDuyet'],
  ['chuaCoBan', 'luuTam', 'canSua', 'canBoGuiTpPp', 'daDuyet'],
  ['chuaCoBan', 'luuTam', 'canSua', 'lanhDaoTuLamChoPgd', 'daDuyet'],
];
export function fileProgress(file, settings = DEFAULT_FILE_PROGRESS) {
  const p = { ...DEFAULT_FILE_PROGRESS, ...settings };
  if (file.co_ban === false) return p.chuaCoBan;
  if (file.trang_thai === 'luu-tam') return p.luuTam;
  if (file.trang_thai === 'can-sua') return p.canSua;
  if (['da-duyet', 'hoan-thanh'].includes(file.trang_thai)) return p.daDuyet;
  if (file.trang_thai === 'cho-xem') return file.gui_bld_phe_duyet ? p.canBoGuiBld : p.canBoGuiTpPp;
  if (file.trang_thai === 'cho-lanh-dao')
    return file.lanh_dao_tu_lam ? p.lanhDaoTuLamChoPgd : p.tpPpDaDuyetGuiPgd;
  return 0;
}
