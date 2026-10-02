# AYK English

Web học tiếng Anh responsive cho **điện thoại + máy tính**, chạy frontend trên **GitHub Pages** và dùng **Firebase** cho đăng nhập/database.

## Cấu hình dự án của Ân Yan

- GitHub: https://github.com/AnYan11042007/ayk-english
- Firebase project: `english-ayk`
- `assets/js/firebase-config.js` đã có cấu hình web được cung cấp.
- `.firebaserc` đã chọn project `english-ayk` cho Firebase CLI.
- Source đã kiểm tra cú pháp JavaScript và JSON. Chưa xác nhận đăng nhập hay ghi dữ liệu thật vì chưa truy cập được Firebase Console.

Trước khi dùng thật, cần hoàn tất trong Firebase Console:

1. Authentication → Sign-in method → bật Email/Password; bật Google nếu sử dụng.
2. Authentication → Settings → Authorized domains → thêm `anyan11042007.github.io`.
3. Firestore Database → Create database → chọn chế độ production. Trong tab Rules, dán nội dung `firestore.rules` rồi Publish; hoặc dùng Firebase CLI như hướng dẫn bên dưới.
4. Sau khi web hoạt động, đăng ký tài khoản chính, đổi `role` của tài khoản đó thành `admin` trong Firestore rồi nhập từ mẫu.
5. AI tra từ cần triển khai Functions và cấu hình secret riêng theo mục 6; cấu hình web không tự kích hoạt AI.

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
- Admin AI: nhập từ + loại từ → Gemini gợi ý nghĩa Việt, IPA, ví dụ, từ khóa ảnh; web tìm ảnh Wikimedia Commons để Admin duyệt.
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
├─ firestore.rules
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

**Firebase Web config không phải secret.** Có thể để file này trên GitHub. Không được để Gemini API key trong frontend.

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

# 4. Tạo Firestore Database

Firebase Console → **Firestore Database → Create database**.

Cài Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
```

Chọn đúng project rồi deploy rules:

```bash
firebase deploy --only firestore:rules
```

Các collection web sử dụng:

- `users`
- `vocabulary`
- `progress`
- `testResults`
- `soloScores`

---

# 5. Tạo tài khoản Admin

1. Đăng ký một tài khoản trên AYK English.
2. Vào Firebase Console → Firestore → collection `users`.
3. Mở document có ID bằng UID tài khoản đó.
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

Trong Admin có nút **Nhập dữ liệu mẫu** để đẩy 24 từ mẫu vào Firestore.

---

# 6. Bật AI tra từ bằng Gemini

AI được chạy trong **Firebase Cloud Functions**, không chạy trực tiếp ở trình duyệt để tránh lộ API key.

## 6.1 Lấy Gemini API key

Tạo API key cho Gemini trong Google AI Studio.

## 6.2 Cài package Functions

```bash
cd functions
npm install
cd ..
```

## 6.3 Lưu key vào Firebase Secret Manager

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

Dán Gemini API key khi CLI hỏi.

## 6.4 Deploy

```bash
firebase deploy --only functions,firestore:rules
```

Function dùng region:

```text
asia-southeast1
```

Frontend đã cấu hình cùng region trong `assets/js/firebase-config.js`.

> Cloud Functions cần project Firebase dùng gói Blaze. Hãy đặt budget alert trong Google Cloud/Firebase để kiểm soát chi phí.

---

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
- Kiểm tra Firestore có document trong `users`.
- Chuyển tài khoản chính thành `admin` trong Firebase Console.
- Admin → **Nhập dữ liệu mẫu**.
- Admin → nhập `adventure`, chọn `n`, bấm **AI tra nghĩa + ảnh**.
- Lưu từ → kiểm tra collection `vocabulary`.
- Học một từ → kiểm tra `progress`.
- Làm kiểm tra → kiểm tra `testResults`.
- Chơi Solo → kiểm tra `soloScores` và leaderboard.

## Ghi chú bảo mật

- Không commit Gemini API key lên GitHub.
- Firestore Rules đã giới hạn sửa từ vựng cho Admin.
- Người dùng không thể tự đổi `role` từ `student` thành `admin` qua frontend.
- AI Function kiểm tra lại quyền Admin ở phía server trước khi gọi Gemini.
