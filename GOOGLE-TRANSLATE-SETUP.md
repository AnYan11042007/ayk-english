# Bật Google Dịch tự động cho AYK English

## Trạng thái
GitHub Pages chỉ phục vụ giao diện. `lookupVocabulary` trong `functions/` gọi **Google Cloud Translation Basic v2** qua máy chủ Firebase bằng OAuth của service account. Phiên bản mã này không tự bật thanh toán hoặc tự triển khai máy chủ.

## Các bước của chủ dự án
1. Trong Firebase console, chuyển dự án sang Blaze và liên kết tài khoản thanh toán. Đây là bước chủ tài khoản phải tự thực hiện vì có thể phát sinh phí.
2. Trong Google Cloud console của cùng dự án, bật **Cloud Translation API** (`translate.googleapis.com`). Đặt hạn mức dịch phù hợp trong APIs & Services → Quotas; cảnh báo ngân sách không phải mức trần chi phí.
3. Đăng nhập Firebase CLI trên máy của bạn và triển khai:

```sh
npm install -g firebase-tools
firebase login
cd functions
npm install
cd ..
firebase deploy --only functions:lookupVocabulary
```

Service account chạy Function cần quyền gọi dịch vụ của dự án, thường có sẵn với cấu hình mặc định. Nếu Google báo lỗi quyền, kiểm tra service account của Function và quyền `serviceusage.services.use`. Không đưa API key, JSON service account, mật khẩu hoặc access token lên GitHub.

## Luồng dữ liệu
- Admin/teacher nhập từ, có thể ghi `light(n,v,adj)` hoặc chọn nhiều ô loại từ.
- Free Dictionary API cung cấp loại từ, định nghĩa và câu ví dụ. Có từ không có ví dụ; khi đó web để trống và thông báo để giáo viên tự bổ sung.
- Google dịch từ và định nghĩa theo từng loại từ Anh → Việt. Không dùng nghĩa giả để thay thế lỗi mạng.
- Từ dịch tiếng Việt được dịch ngược thành từ khóa ảnh tiếng Anh để tìm Wikimedia Commons. Web gắn ảnh gợi ý khi có tiêu đề phù hợp; giáo viên có thể đổi hoặc bỏ. Đây là kết quả tìm kiếm, không phải xác nhận ảnh luôn đúng nghĩa.
- Từ trừu tượng chỉ có adj/adv không tự gắn ảnh để tránh minh họa sai.
- Kết quả dịch được lưu 7 ngày trong `lookupCache`, chỉ máy chủ đọc/ghi. `lookupLimits` giới hạn 10 lần/phút theo tài khoản. Không thay đổi quy tắc truy cập Firebase của khách hàng.
- Từ vựng giữ `pos` chính (n/v/adj/adv) để tương thích quy tắc hiện có; `partsOfSpeech` lưu đầy đủ các loại từ. Bộ lọc và thẻ học dùng cả danh sách.

## Kiểm tra sau triển khai
Đăng nhập tài khoản admin/teacher thật. Tra `light` với n, v, adj và kiểm tra nguồn báo **Google Dịch**; kiểm tra nghĩa theo từng loại từ. Tra một danh từ cụ thể để xem ảnh gợi ý; kiểm tra nút đổi và bỏ ảnh. Kiểm tra tài khoản học viên không gọi được máy chủ và lỗi mạng không điền nghĩa giả.

Bản demo dùng dữ liệu có sẵn/từ điển miễn phí và ghi rõ trạng thái. Chưa có máy chủ thì nút Google Dịch ↗ vẫn mở bản dịch trên trang Google, không tự nhận nội dung từ cửa sổ đó.

Tài liệu: https://docs.cloud.google.com/translate/docs/setup · https://firebase.google.com/docs/functions/get-started · https://dictionaryapi.dev/
