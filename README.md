# Text-to-Speech song ngữ Việt–Anh

Web app nội bộ (2–5 người dùng) chuyển văn bản thành giọng đọc, phục vụ làm tài
liệu dạy học song ngữ Việt–Anh. Không dùng database, không lưu file — toàn bộ
xử lý diễn ra trong một request và trả trực tiếp về trình duyệt.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- TTS: kết hợp 2 nhà cung cấp, không cần thẻ tín dụng quốc tế
  - Tiếng Việt: [FPT.AI Text-to-Speech](https://fpt.ai/products/fpt-ai-voice-maker/) (nhà cung cấp trong nước)
  - Tiếng Anh: [ElevenLabs](https://elevenlabs.io/) (free tier, đăng ký chỉ bằng email)
- Auth: một tài khoản dùng chung, phiên đăng nhập ký bằng JWT (`jose`)

## Chạy local

```bash
npm install
cp .env.example .env.local
# rồi điền AUTH_USERNAME, AUTH_PASSWORD, AUTH_SECRET, FPT_AI_API_KEY, ELEVENLABS_API_KEY vào .env.local
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

### Sinh `AUTH_SECRET`

```bash
openssl rand -base64 32
```

Dán kết quả vào biến `AUTH_SECRET`. Đây là khoá bí mật dùng để ký JWT phiên
đăng nhập — không chia sẻ, không commit vào git.

## Cài đặt biến môi trường trên Vercel

Vào **Project Settings → Environment Variables** và thêm 5 biến sau (áp dụng
cho môi trường Production, và Preview nếu cần):

| Tên biến               | Giá trị                                              |
| ----------------------- | ----------------------------------------------------- |
| `AUTH_USERNAME`         | Tên đăng nhập dùng chung                              |
| `AUTH_PASSWORD`         | Mật khẩu dùng chung                                   |
| `AUTH_SECRET`           | Chuỗi bí mật sinh bằng `openssl rand -base64 32`      |
| `FPT_AI_API_KEY`        | API key của FPT.AI (console.fpt.ai)                   |
| `ELEVENLABS_API_KEY`    | API key của ElevenLabs (elevenlabs.io)                |

Sau khi thêm biến môi trường, redeploy lại project để áp dụng.

## Thiết lập FPT.AI Text-to-Speech (giọng tiếng Việt)

1. Vào [console.fpt.ai](https://console.fpt.ai/) → đăng ký tài khoản (không
   cần thẻ tín dụng quốc tế, đây là dịch vụ trong nước).
2. Sau khi đăng nhập, tìm mục **Text to Speech** / **API Key** trong console
   để lấy API key.
3. Điền vào `.env.local`:
   ```
   FPT_AI_API_KEY=<API key vừa lấy>
   ```

## Thiết lập ElevenLabs (giọng tiếng Anh)

1. Vào [elevenlabs.io](https://elevenlabs.io/) → **Sign up** bằng email
   (không cần thẻ tín dụng cho free tier).
2. Vào **Profile → API Keys** (góc trên bên phải sau khi đăng nhập) → tạo
   API key mới.
3. Điền vào `.env.local`:
   ```
   ELEVENLABS_API_KEY=<API key vừa lấy>
   ```

Free tier ElevenLabs giới hạn khoảng 10.000 credit/tháng (~10 phút audio,
tối đa 2.500 ký tự mỗi lần gọi) — chỉ nên dùng cho phần tiếng Anh vốn thường
ngắn hơn phần tiếng Việt trong tài liệu song ngữ. Xem chi tiết tại
[elevenlabs.io/pricing](https://elevenlabs.io/pricing).

## Giới hạn cần lưu ý

- Vercel Hobby giới hạn response body ~4.5MB mỗi request, nên client tự chia
  văn bản thành nhiều đoạn nhỏ (`lib/tts.ts`) và gọi `/api/tts` song song
  (tối đa 3 request cùng lúc) rồi ghép audio lại ở trình duyệt.
- App hoàn toàn stateless: không database, không lưu file trên server,
  không dùng `localStorage`/`sessionStorage` cho dữ liệu audio.
