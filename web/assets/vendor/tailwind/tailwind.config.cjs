/* Cấu hình dựng bản Tailwind tự chứa (§7 việc 4.3).
 *
 * Vì sao có file này thay vì tải một bản "dist" sẵn: Tailwind v3 KHÔNG phát hành CSS build sẵn
 * trong gói npm (v2 mới có `dist/tailwind.min.css`), còn `cdn.tailwindcss.com` là bản biên dịch
 * ngay trong trình duyệt — chậm, và production thì cấm dùng. Nên bản tự chứa phải tự dựng.
 *
 * Dựng lại (chạy TỪ thư mục `web/`):
 *   npx --yes tailwindcss@3.4.19 -c assets/vendor/tailwind/tailwind.config.cjs \
 *     -i assets/vendor/tailwind/tailwind.input.css \
 *     -o assets/vendor/tailwind/tailwind.min.css --minify
 *
 * KHÔNG đặt `theme.extend`: bản cũ nạp CDN mà không kèm `tailwind.config`, nên nó chạy đúng theme
 * mặc định. Thêm gì vào đây là đổi giao diện, mà Phase 4 chỉ được cắt chuyển, không được sửa dáng.
 */
module.exports = {
  // Quét đúng hai tệp dựng ra HTML: trang gốc và `app.js` (mọi bảng/thẻ đều là chuỗi HTML trong đó).
  content: ['./index.html', './assets/js/*.js'],

  /**
   * Lớp GHÉP LÚC CHẠY thì máy quét không thấy. Chỗ duy nhất trong `app.js` làm vậy là bảng đề
   * nghị (dòng 3417): `"bg-" + màu + "-50"`, `"text-" + màu + "-700"`, `"bg-" + màu + "-100"`, với
   * 4 màu khai ở dòng 3389–3405. Thiếu danh sách này thì nhóm đề nghị mất nền màu mà không báo lỗi.
   */
  safelist: [
    'bg-blue-50',
    'bg-blue-100',
    'text-blue-700',
    'bg-amber-50',
    'bg-amber-100',
    'text-amber-700',
    'bg-green-50',
    'bg-green-100',
    'text-green-700',
    'bg-red-50',
    'bg-red-100',
    'text-red-700',
  ],
  theme: { extend: {} },
  plugins: [],
};
