# tools/

Bộ script dịch lại `Code.gs` và `js.html` từ dạng obfuscate (javascript-obfuscator,
biến thể string-array + rotation). Chạy từ **thư mục gốc project**.

```bash
cd tools && npm install && cd ..

# dịch
node tools/deobfuscate.js Code.gs  Code.clean.gs  --license-rename
node tools/deobfuscate.js js.html  js.clean.html

# kiểm tra
node tools/verify.js Code.gs Code.clean.gs
node tools/verify.js js.html js.clean.html
node tools/verify-license.js
```

`--license-rename` chỉ dùng cho `Code.gs` — đổi tên các định danh khối license
(`_cyval` → `xorDecode`, `_omcjj` → `getLicenseState`, …). Không đổi giá trị nào,
nên 3 lớp anti-tamper vẫn pass; `verify-license.js` chứng minh điều đó bằng cách
chạy song song khối license của cả hai bản.

`Code.gs` và `js.html` không bị chạm tới — giữ làm bản gốc đối chiếu.
