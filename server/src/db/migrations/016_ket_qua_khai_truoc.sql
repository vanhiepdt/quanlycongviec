-- 016_ket_qua_khai_truoc.sql — KHAI KẾT QUẢ TRƯỚC, NỘP FILE SAU + «Báo cáo» là BẢN KHÔNG CÓ FILE
-- (2026-09-04, Vòng 14 — đợt 2 của thiết kế lại theo `docs/moi.xlsx`).
--
-- Vì sao cần: sheet «kq-modal» của người dùng đòi dòng kết quả TỒN TẠI TRƯỚC khi có file —
-- «Dòng đầu tiên khi mới tạo nhiệm vụ sẽ điền 1. 2. 3. điền những nội dung Kết quả làm được,
-- Định dạng, Ghi ý kiến» và cột «File đã tải lên» ghi «Chưa có». Lược đồ 014 KHÔNG dựng được
-- dòng đó: `task_files` sinh ra cùng bản v1 (`nop()` luôn cần buffer) và `ten_goc` của nhóm CHÍNH
-- LÀ tên file đầu tiên, nên không có chỗ nào giữ «tên kết quả người dùng tự khai».
--
-- Ba thay đổi, không hơn:
--   1. `task_files.ten_ket_qua`  TÊN KẾT QUẢ do người dùng khai (khác `ten_goc` = tên file đầu).
--   2. `task_files.dinh_dang`    ĐỊNH DẠNG khai trước (Word/Excel/PPT/PDF/Ảnh/Báo cáo) — đợt 1
--      suy từ đuôi file nên dòng chưa có file thì không suy được gì.
--   3. `task_file_versions.noi_dung` + nới NOT NULL 4 cột file: «Báo cáo» là BẢN KHÔNG CÓ FILE
--      (người dùng chốt: «như một BẢN không có file») ⇒ dùng lại nguyên bộ máy bản/góp ý/luồng/
--      verdict, không dựng bảng thứ năm.
--
-- CHECK `tfv_file_hoac_chu`: MỘT BẢN LÀ FILE HOẶC LÀ CHỮ, không lửng lơ ở giữa —
--   file: ten_luu + loai_mime + kich_thuoc đủ ba, noi_dung NULL;
--   chữ : ba cột kia NULL cả, noi_dung có nội dung thật (>= 10 ký tự sau khi bỏ trắng, cùng ngưỡng
--         `DO_DAI_NOI_DUNG_TOI_THIEU` của service — «ok» không phải một bản báo cáo).
-- `ten_goc` giữ NOT NULL cho cả hai nhánh: bản báo cáo cũng cần một tiêu đề để in ra bảng.
--
-- «Chưa có» = nhóm có ĐÚNG 0 bản. Không dựng bản rỗng giả để lấp chỗ: bản rỗng sẽ chui vào hàng
-- chờ phê duyệt, vào `banCuoiCung`, vào ONLYOFFICE và vào mọi câu đếm «bao nhiêu bản».
--
-- Backfill: `ten_ket_qua = ten_goc` cho dòng cũ (giao diện đợt 1 đang in chính `ten_goc` làm tên
-- kết quả nên copy nguyên, KHÔNG cắt đuôi — cắt đuôi là đổi cái người dùng đang nhìn thấy).
-- `dinh_dang` để NULL: server/client suy từ đuôi file như đợt 1 khi cột này trống, nên dòng cũ
-- không cần đoán, và không có nguy cơ gán sai loại.
--
-- Down: XOÁ các bản «chữ» TRƯỚC khi siết lại NOT NULL (bẫy 012/014/015 — hạ dữ liệu trước khi siết
-- ràng buộc, còn dòng là ALTER nổ «contains null values»).

-- Up Migration

ALTER TABLE task_files ADD COLUMN ten_ket_qua text;
ALTER TABLE task_files ADD COLUMN dinh_dang   text;

UPDATE task_files SET ten_ket_qua = ten_goc WHERE ten_ket_qua IS NULL;

ALTER TABLE task_files
  ADD CONSTRAINT tf_dinh_dang_ok CHECK (
    dinh_dang IS NULL
    OR dinh_dang IN ('Word', 'Excel', 'PPT', 'PDF', 'Ảnh', 'Báo cáo')
  );

ALTER TABLE task_file_versions ADD COLUMN noi_dung text;

ALTER TABLE task_file_versions ALTER COLUMN ten_luu    DROP NOT NULL;
ALTER TABLE task_file_versions ALTER COLUMN loai_mime  DROP NOT NULL;
ALTER TABLE task_file_versions ALTER COLUMN kich_thuoc DROP NOT NULL;

ALTER TABLE task_file_versions
  ADD CONSTRAINT tfv_file_hoac_chu CHECK (
    (ten_luu IS NOT NULL AND loai_mime IS NOT NULL AND kich_thuoc IS NOT NULL
     AND noi_dung IS NULL)
    OR
    (ten_luu IS NULL AND loai_mime IS NULL AND kich_thuoc IS NULL
     AND noi_dung IS NOT NULL AND length(btrim(noi_dung)) >= 10)
  );

COMMENT ON COLUMN task_files.ten_ket_qua IS
  'TÊN KẾT QUẢ người dùng tự khai (016) — cột «Kết quả làm được». Khác ten_goc (tên file đầu tiên); NULL với dòng cũ trước 016 thì giao diện lùi về ten_goc.';
COMMENT ON COLUMN task_files.dinh_dang IS
  'ĐỊNH DẠNG khai trước khi có file (016): Word/Excel/PPT/PDF/Ảnh/Báo cáo. NULL = suy từ đuôi file của bản mới nhất như trước 016.';
COMMENT ON COLUMN task_file_versions.noi_dung IS
  'NỘI DUNG CHỮ của bản «Báo cáo» (016) — bản KHÔNG có file. Bản có file thì cột này NULL (CHECK tfv_file_hoac_chu).';
COMMENT ON TABLE task_file_versions IS
  'BẢN của nhóm file (014, nới 016). ten_luu là tên vật lý SINH SẴN (v{n}-{uuid}.{ext}) — CẤM dùng tên gốc làm đường dẫn (path traversal). Bản «Báo cáo» không có file: 3 cột file NULL, noi_dung có chữ.';

-- Down Migration

-- XOÁ bản «chữ» TRƯỚC khi siết lại NOT NULL: lược đồ cũ không có chỗ giữ nội dung chữ nên giữ
-- lại là ALTER nổ «column contains null values». Xoá bản kéo theo góp ý của bản đó (ON DELETE
-- CASCADE của 014) và đưa version_id của dòng luồng về NULL (ON DELETE SET NULL) — đúng ý: hành
-- động vẫn còn trong bảng luồng, chỉ mất con trỏ tới bản đã biến mất.
DELETE FROM task_file_versions WHERE noi_dung IS NOT NULL;

ALTER TABLE task_file_versions DROP CONSTRAINT IF EXISTS tfv_file_hoac_chu;

ALTER TABLE task_file_versions ALTER COLUMN ten_luu    SET NOT NULL;
ALTER TABLE task_file_versions ALTER COLUMN loai_mime  SET NOT NULL;
ALTER TABLE task_file_versions ALTER COLUMN kich_thuoc SET NOT NULL;

ALTER TABLE task_file_versions DROP COLUMN IF EXISTS noi_dung;

COMMENT ON TABLE task_file_versions IS
  'BẢN của nhóm file (v1, v2, …). ten_luu là tên vật lý SINH SẴN (v{n}-{uuid}.{ext}) — CẤM dùng tên gốc làm đường dẫn (path traversal).';

ALTER TABLE task_files DROP CONSTRAINT IF EXISTS tf_dinh_dang_ok;
ALTER TABLE task_files DROP COLUMN IF EXISTS dinh_dang;
ALTER TABLE task_files DROP COLUMN IF EXISTS ten_ket_qua;
