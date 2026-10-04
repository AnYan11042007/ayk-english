# AYK English

Web học tiếng Anh responsive cho **điện thoại + máy tính**, chạy frontend trên **GitHub Pages** và dùng **Firebase** cho đăng nhập/database.

## Cấu hình dự án của Ân Yan

- GitHub: https://github.com/AnYan11042007/ayk-english
- Firebase project: `english-ayk`
- `assets/js/firebase-config.js` đã có cấu hình web được cung cấp.
- `.firebaserc` đã chọn project `english-ayk` cho Firebase CLI.
- Source đã kiểm tra cú pháp JavaScript và JSON. Chưa xác nhận đăng nhập hay ghi dữ liệu thật: provider đăng nhập và database rules đang chờ chủ project xác nhận áp dụng. Firebase Console đã truy cập được bằng tài khoản chủ project.

Trước khi dùng thật, cần hoàn tất trong Firebase Console:

1. Authentication → Sign-in method → bật Email/Password; bật Google nếu sử dụng.
2. Authentication → Settings → Authorized domains → thêm `anyan11042007.github.io`.
3. Realtime Database hiện có: `english-ayk-default-rtdb`, khu vực Singapore. Trong tab Rules, dán nội dung `database.rules.json` rồi Publish; hoặc dùng Firebase CLI như hướng dẫn bên dưới.
4. Sau khi web hoạt động, đăng ký tài khoản chính, đổi `role` của tài khoản đó thành `admin` trong Realtime Database rồi nhập từ mẫu.
5. Tra từ tự động dùng MyMemory + Wiktionary trực tiếp từ web; không cần triển khai Functions hoặc nâng gói Firebase. Xem mục 6.

GitHub Pages: sau khi source có trong nhánh `main`, chọn Settings → Pages → Source: GitHub Actions. Workflow có sẵn trong `.github/workflows/pages.yml`.

Kết nối GitHub đã được cấp quyền truy cập repository. Sau khi source được đưa lên, kiểm tra workflow Deploy GitHub Pages để xác nhận triển khai.

## Chức năng đã có

- Đăng ký / đăng nhập Email + Password, Google Sign-In.
- Dashboard tiến độ học.
- Học flashcard theo buổi, nghe phát âm bằng Web Speech API.
- Ôn lại từ từng sai hoặc đã đánh dấu sao.
- Danh sách từ vựng + tìm kiếm + lọc n / v / adj / adv.
- Học theo buổi.
- Bài tập trắc nghiệm tự sinh từ kho từ.
- Kiểm tra 10 / 20 / 30 câu, có đếm giờ, chấm điểm và lưu lịch sử.
- Solo 60 giây, lưu điểm và bảng xếp hạng.
- Admin thêm / sửa / xóa từ vựng.
- Admin: chọn nhiều loại từ; MyMemory dịch nghĩa, Wiktionary cung cấp IPA/loại từ/ví dụ. Web tìm và gắn ảnh gợi ý theo nghĩa, có thể sửa hoặc bỏ ảnh.
- PWA: có thể Add to Home Screen trên điện thoại.
- Chế độ demo bằng `localStorage` khi chưa cấu hình Firebase.

## Cấu trúc

```text
AYK-English/
├─ index.html
├─ assets/
│  ├─ css/styles.css
│  ├─ icons/icon.svg
│  └─ js/
│     ├─ app.js
│     ├─ ai.js
│     ├─ firebase.js
│     ├─ firebase-config.js
│     ├─ starter-data.js
│     └─ store.js
├─ functions/
│  ├─ index.js
│  └─ package.json
├─ database.rules.json
├─ firebase.json
├─ manifest.webmanifest
├─ sw.js
└─ .github/workflows/pages.yml
```

---

# 1. Chạy thử ngay trên máy

Không cần Firebase vẫn xem được bản demo:

```bash
python -m http.server 5500
```

Mở:

```text
http://localhost:5500
```

Chọn **Xem bản demo ngay**.

> Không nên mở trực tiếp bằng `file:///.../index.html` vì ES Modules và Service Worker cần web server.

---

# 2. Tạo Firebase

1. Vào Firebase Console → **Create project**.
2. **Project settings → Your apps → Web (`</>`)** → Register app.
3. Copy `firebaseConfig`.
4. Mở `assets/js/firebase-config.js` và thay các giá trị `PASTE_...`.

Ví dụ:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
```

**Firebase Web config không phải secret.** Có thể để file này trên GitHub. Không được để khóa dịch hoặc thông tin xác thực Google Cloud trong frontend.

---

# 3. Bật Authentication

Firebase Console → **Authentication → Sign-in method**:

- Enable **Email/Password**.
- Enable **Google** nếu muốn nút đăng nhập Google.

Khi đã đưa web lên GitHub Pages, vào **Authentication → Settings → Authorized domains** và thêm:

```text
TEN_GITHUB.github.io
```

---

# 4. Kết nối Realtime Database

Dùng database đã có: `https://english-ayk-default-rtdb.asia-southeast1.firebasedatabase.app`.

`databaseURL` đã được thêm vào cấu hình. Firebase Console → Realtime Database → Rules: áp dụng `database.rules.json`.

Cài Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
```

Chọn đúng project rồi deploy rules:

```bash
firebase deploy --only database
```

Các nhánh dữ liệu web sử dụng:

- `users`
- `vocabulary`
- `progress/{uid}/{wordId}`
- `testResults/{uid}/{resultId}`
- `soloScores`

---

# 5. Tạo tài khoản Admin

1. Đăng ký một tài khoản trên AYK English.
2. Vào Firebase Console → Realtime Database → nhánh `users`.
3. Mở node có khóa bằng UID tài khoản đó.
4. Đổi field:

```text
role: "student"
```

thành:

```text
role: "admin"
```

5. Đăng xuất rồi đăng nhập lại.

Menu **Admin** sẽ xuất hiện.

Trong Admin có nút **Nhập dữ liệu mẫu** để đẩy 24 từ mẫu vào Realtime Database.

---

# 6. Tra từ tự động miễn phí

Giao diện hiện dùng MyMemory + Wiktionary, không cần API key và không phụ thuộc Firebase Cloud Functions. Xem [AUTOMATIC-LOOKUP.md](AUTOMATIC-LOOKUP.md).

MyMemory có hạn mức dùng miễn phí. Web lưu kết quả trên máy 7 ngày để giảm số lần gọi. Khi hết hạn mức hoặc mất mạng, web báo rõ và không lưu thông báo lỗi thành nghĩa từ.

`functions/` và [GOOGLE-TRANSLATE-SETUP.md](GOOGLE-TRANSLATE-SETUP.md) là phương án Google Cloud tùy chọn; không cần bật để dùng chức năng tra từ hiện tại.

# 7. Đưa lên GitHub Pages

Tạo repository, ví dụ:

```text
ayk-english
```

Sau đó:

```bash
git init
git add .
git commit -m "AYK English first release"
git branch -M main
git remote add origin https://github.com/TEN_GITHUB/ayk-english.git
git push -u origin main
```

Repo đã có workflow `.github/workflows/pages.yml`.

Trên GitHub:

1. **Settings → Pages**.
2. Source chọn **GitHub Actions**.
3. Push vào branch `main`.
4. Chờ workflow **Deploy GitHub Pages** chạy xong.

Web sẽ có dạng:

```text
https://TEN_GITHUB.github.io/ayk-english/
```

---

# 8. Kiểm tra sau khi deploy

- Đăng ký tài khoản mới.
- Kiểm tra Realtime Database có node trong `users`.
- Chuyển tài khoản chính thành `admin` trong Firebase Console.
- Admin → **Nhập dữ liệu mẫu**.
- Admin → nhập `adventure`, chọn `n`, bấm **Tự điền nghĩa, ví dụ & ảnh**.
- Lưu từ → kiểm tra nhánh `vocabulary`.
- Học một từ → kiểm tra `progress`.
- Làm kiểm tra → kiểm tra `testResults`.
- Chơi Solo → kiểm tra `soloScores` và leaderboard.

## Ghi chú bảo mật

- Không commit khóa dịch hoặc thông tin xác thực Google Cloud lên GitHub.
- Realtime Database Rules đã giới hạn sửa từ vựng cho Admin.
- Người dùng không thể tự đổi `role` từ `student` thành `admin` qua frontend.
- Máy chủ kiểm tra quyền admin/teacher, giới hạn 10 lần/phút và lưu kết quả 7 ngày trước khi gọi Google Cloud Translation.


## Giao diện AYK Studio và đăng nhập

- Giao diện màu tím nhạt, trang học và trang quản trị thích ứng điện thoại.
- Admin: bộ lọc từ/buổi, thống kê nội dung, thêm/sửa/xóa từ và xuất CSV.
- Google: tài khoản chưa có phương thức password được yêu cầu đặt mật khẩu; credential được liên kết vào cùng Firebase UID bằng `linkWithCredential`. Mật khẩu không được lưu trong mã nguồn hay localStorage của ứng dụng.
- `browserLocalPersistence` ghi nhớ phiên Firebase trên trình duyệt. Tài khoản đã đặt mật khẩu vào thẳng trang khi mở lại, cho tới khi đăng xuất hoặc dữ liệu trình duyệt bị xóa.
- Tên đăng nhập nội bộ được chuyển sang định danh Firebase theo domain của project. Tài khoản quản trị được tạo riêng trong Firebase Authentication và cấp quyền tại profile `users/{uid}`. Không lưu mật khẩu hay định danh tài khoản quản trị cụ thể trong mã nguồn.


## Danh mục, buổi học và trò chơi

- `categories/{id}` lưu tên và mô tả danh mục; `lessons/{number}` lưu tên buổi, mô tả và `categoryId`. Từ vựng tiếp tục dùng số `session`, nên đổi tên hoặc chuyển danh mục không làm mất liên kết từ và tiến độ.
- `nextSession` được cấp phát bằng transaction để tránh hai giáo viên tạo cùng số buổi.
- Quyền `teacher` được admin gán tại `users/{uid}/role`. Giáo viên chỉ có quyền quản lý nội dung và dữ liệu học của chính mình, không được đổi quyền người dùng khác. Người dùng thường không thể tự nâng quyền.
- Cần áp dụng `database.rules.json` mới trước khi lưu danh mục/buổi học trên Firebase. Nếu chưa áp dụng, app vẫn tải thư viện hiện tại và thông báo phần kết nối chưa hoàn tất.
- Trò chơi ghép từ, nghe viết và xếp chữ lấy từ buổi đã chọn. Đáp án được ghi vào tiến độ của học viên. Phát âm dùng speech synthesis của trình duyệt.
- Trang học có hành trình theo buổi và 5 trò chơi: ghép thẻ, nghe viết, xếp chữ, nghe chọn đáp án, điền chữ còn thiếu. Danh sách ý tưởng trước đây lưu ở `IDEAS.md`, không hiển thị trên web.
- Firebase giữ phiên bằng browserLocalPersistence. Khi reload, web chờ khôi phục tài khoản rồi mở trang gần nhất. Phiên demo cũng được lưu đến khi đăng xuất; không lưu mật khẩu trong localStorage.

### Làm lại nội dung lớp học
Admin có nút Dọn toàn bộ nội dung: tạo bản lưu ở contentArchives rồi làm trống vocabulary/categories/lessons bằng một lần cập nhật. Tài khoản, tiến độ, kết quả kiểm tra giữ nguyên. Khôi phục bản lưu chỉ được phép khi thư viện trống. Database thật trống sẽ không tự nạp từ mẫu. Cần Publish database.rules.json mới trước khi dùng tính năng dọn. Giáo viên có thể sửa/xóa từ và quản lý danh mục, buổi học; chỉ admin dọn/khôi phục toàn bộ.


## Kiểm tra nghe và trọng âm

- Trong Kiểm tra, tích một hoặc nhiều buổi; cần ít nhất 20 từ khác nhau có nghĩa và trọng âm. Bài chọn ngẫu nhiên 20 từ, ưu tiên lấy từ từng buổi đã chọn.
- Đọc từ bằng giọng tiếng Anh của trình duyệt tại 0, 5, 10 giây; tự chuyển câu sau 15 giây. Đồng hồ dùng mốc thời gian thực, tiếp tục chạy khi chuyển tab.
- Cú pháp: `english (1): nghĩa tiếng Việt`, cũng nhận `english + (1): nghĩa tiếng Việt`. Không phân biệt hoa/thường, chuẩn hóa Unicode; vẫn yêu cầu dấu tiếng Việt, đúng từ, trọng âm dạng số và nghĩa hợp lệ đã lưu. Mỗi câu phải đúng đủ các phần mới nhận 5 điểm.
- Sau 20 câu có 15 giây rà soát tất cả câu trả lời. Chấm cục bộ ngay sau khi khóa bài, trong giới hạn 12 giây; lưu Firebase không chặn màn hình kết quả. Từ 15/20 (75%) là đạt, dưới mức này yêu cầu học lại.
- Giáo viên có ô trọng âm và nghĩa khác được chấp nhận. Suy luận trọng âm từ IPA là hỗ trợ ban đầu, giáo viên cần kiểm tra; cụm nhiều từ và từ thiếu dữ liệu bị loại khỏi bài.
- Kết quả lưu với mã bài duy nhất để thử lại khi lỗi mạng không tạo hai bản ghi. Đây là bài tự luyện trên trình duyệt, không phải bài thi có giám sát. Máy cần hỗ trợ Web Speech và có giọng đọc tiếng Anh.

- Nếu giọng đọc trình duyệt không dùng được, bài tải trước 20 bản ghi âm từ Free Dictionary API/Wiktionary và chỉ tính giờ sau khi học viên bấm bắt đầu. Nguồn và giấy phép âm thanh có trong đối chiếu kết quả. Không tải được đủ âm thanh thì bài chưa bắt đầu.
