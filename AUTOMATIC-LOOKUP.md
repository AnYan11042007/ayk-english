# Tra từ tự động — MyMemory + Wiktionary

Giao diện gọi các API công khai trực tiếp. Không cần API key, gói Blaze hoặc máy chủ riêng.

- MyMemory GET `/get?q=...&langpair=en|vi`: dịch từ/cụm từ và định nghĩa. Hạn mức miễn phí 5.000 ký tự/ngày khi dùng ẩn danh, mỗi yêu cầu tối đa 500 byte theo tài liệu của nhà cung cấp. Không gửi email, mật khẩu hay token để tăng hạn mức.
- Wiktionary Action API `action=parse&prop=wikitext`: chỉ đọc mục English; lấy n/v/adj/adv, IPA và câu ví dụ do cộng đồng biên soạn. Không lấy trích dẫn sách/nhạc làm ví dụ. Có từ không có ví dụ: để trống và thông báo để giáo viên bổ sung.
- Free Dictionary API là nguồn dự phòng khi Wiktionary không có kết quả.
- Các nghĩa đã có sẵn trong ứng dụng được giữ để tra nhanh, hiển thị nguồn là “Từ điển có sẵn”. Các nguồn trực tuyến được ghi rõ; không giả mạo kết quả Google.
- Nếu chọn nhiều loại từ, tra nghĩa theo từng loại từ khi có định nghĩa. Nếu chỉ dịch được nghĩa chung, web thông báo để giáo viên kiểm tra.
- Dùng nghĩa tiếng Việt đã dịch để xây dựng từ khóa ảnh; Wikimedia Commons cung cấp ảnh và đường dẫn giấy phép. Có thể thay/bỏ ảnh. Ảnh tìm kiếm là gợi ý, không bảo đảm luôn diễn đạt đúng mọi nghĩa. Những từ trừu tượng không tự gắn ảnh.
- Cache dịch và từ điển tối đa 200 mục trên máy, hiệu lực 7 ngày. Không cache thông báo hạn mức hoặc lỗi mạng. Cache không làm thay đổi phiên đăng nhập Firebase.
- Chỉ các từ/cụm từ đang tra được gửi tới các API. Tài khoản và dữ liệu đăng nhập vẫn do Firebase quản lý.

Nguồn từ điển/ảnh được lưu kèm từ vựng và hiển thị trong phần Chi tiết để ghi nguồn Wiktionary (CC BY-SA) và giấy phép ảnh.

Tài liệu chính thức:
- https://mymemory.translated.net/doc/spec.php
- https://mymemory.translated.net/doc/usagelimits.php
- https://www.mediawiki.org/wiki/API:Parsing_wikitext
- https://dictionaryapi.dev/

Kiểm tra: `node tests/translation.test.cjs` và các kiểm tra học/từ vựng hiện có. Khi kiểm tra thật, chọn adj rồi tra `comfortable` để kiểm tra từ ngoài danh sách có sẵn: nghĩa tiếng Việt, ví dụ từ Wiktionary và ảnh giường phù hợp.
