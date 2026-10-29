# Rà soát bảo mật (AGENTS.md §8)

Rà soát ngày 29/10/2026 ở mốc M7. Cột **Kiểm chứng** chỉ ra test tự động hoặc cách kiểm tra lại.

| # | Yêu cầu | Hiện trạng | Kiểm chứng |
|---|---|---|---|
| 1 | Băm mật khẩu bằng bcrypt | `bcryptjs`, cost 12; mật khẩu 8–72 ký tự (bcrypt chỉ dùng 72 byte đầu); đăng nhập sai email vẫn so một hash giả để không lộ email có tồn tại hay không qua thời gian phản hồi | `auth.test.ts` |
| 2 | JWT có hạn | HS256 qua `jose`, `exp` = `JWT_TTL_MINUTES` (mặc định 60), chỉ chấp nhận thuật toán HS256, secret ≥ 32 ký tự (kiểm tra khi khởi động) | `auth.test.ts`, `security.test.ts` (token sửa đổi → 401) |
| 3 | Phân quyền theo user cho mọi tài nguyên | `userId` luôn lấy từ JWT (`res.locals.userId`), không bao giờ từ query/body; mọi truy vấn lọc theo `userId`; tài nguyên của người khác trả **404** (không lộ là có tồn tại) | `security.test.ts`, `integration.db.test.ts` (plans, sessions, workouts) |
| 4 | Đồng ý xử lý dữ liệu sức khỏe trước khi dùng | **Mới ở M7:** API chặn (403 `CONSENT_REQUIRED`) mọi route dữ liệu sức khỏe khi chưa đồng ý, không chỉ chặn ở giao diện. Lưu kết quả camera cần thêm đồng ý camera; xuất dữ liệu ML chỉ lấy người đồng ý nghiên cứu | `security.test.ts`, `squat-routes.test.ts`, `export.test.ts` |
| 5 | helmet, CORS chỉ cho origin web | `helmet()` (CSP, nosniff…), tắt `x-powered-by`, `cors({ origin: WEB_ORIGIN })` | `security.test.ts` |
| 6 | Rate limit login và AI | Đăng ký/đăng nhập: 10 lần / 15 phút / IP. AI: `AI_RATE_LIMIT_PER_HOUR` (20) / giờ / **user** | `auth.test.ts`, `ai-routes.test.ts` |
| 7 | Validate mọi request bằng Zod | Body qua `validateBody`, query/params qua `parseQuery`/`idParam`; body JSON tối đa 200 KB (**mới:** quá lớn trả 413 thay vì 500) | các `*routes*.test.ts`, `security.test.ts` |
| 8 | Không log mật khẩu, token, dữ liệu sức khỏe | Không log request/response. **Mới ở M7:** lỗi database chỉ log tên lỗi, vì SQL Server đưa giá trị (ví dụ email trùng) vào thông báo lỗi. Prompt gửi Ollama không có tên/email | `security.test.ts` (`safeLogLine`) |
| 9 | Ollama chỉ gọi từ backend qua localhost | Frontend không gọi Ollama. **Mới ở M7:** `OLLAMA_HOST` phải là `localhost/127.0.0.1/[::1]`, nếu không API không khởi động. README cảnh báo không mở cổng 11434 | `apps/api/src/config/env.ts` |
| 10 | Secrets chỉ trong `.env` | `.env` trong `.gitignore`, có `.env.example`; SQL Server chỉ bind `127.0.0.1`. Mật khẩu trong `ci.yml` chỉ dùng cho container CI tạm | `git check-ignore .env` |
| 11 | Dữ liệu người dùng nhập là dữ liệu, không phải chỉ thị (prompt injection) | Dữ liệu đặt trong khối `<du_lieu>` (escape `<`), system prompt dặn rõ; JSON Schema + luật an toàn chặn đầu ra nguy hiểm dù model bị lừa | hồ sơ `p23` của benchmark (chèn "40 set, 800 kcal" → vẫn 12 set/buổi, 1.980 kcal) |
| 12 | Camera | Video xử lý trên trình duyệt, không gửi lên, không lưu; chỉ lưu số liệu khi người dùng bấm lưu | `CameraPage`, `squat_sessions` |

## Rủi ro đã biết và chấp nhận (MVP nghiên cứu, chạy local)

| Rủi ro | Lý do chấp nhận / hướng xử lý |
|---|---|
| JWT lưu trong `localStorage` (bị đọc nếu có XSS) | React tự escape, không dùng `dangerouslySetInnerHTML`, CSP của helmet; token hạn ngắn. Triển khai thật: cookie `HttpOnly; SameSite=Strict` + CSRF token |
| Chưa có refresh token / thu hồi token | Hết hạn sau 60 phút thì đăng nhập lại; đúng phạm vi AGENTS.md (access token hạn ngắn) |
| `pnpm audit` (29/10/2026): `@azure/msal-node` < 7.1.0 (high) qua `tedious → @azure/identity` | Chỉ ảnh hưởng luồng đăng nhập Azure AD (authorization code), ứng dụng dùng SQL authentication nên không chạy tới. Nâng khi `tedious` cập nhật `@azure/identity` |
| `uuid` < 11.1.1 (moderate) qua `sequelize` | Lỗi chỉ xảy ra khi gọi v3/v5/v6 với buffer; app không dùng. Nâng cùng Sequelize |
| Dev dùng tài khoản `sa` của SQL Server | Chỉ trong container local bind `127.0.0.1`. Triển khai thật: tạo login riêng chỉ có quyền trên database `ai_coach` |
| Tải WASM/mô hình MediaPipe từ jsDelivr/Google | Chỉ tải mã và mô hình, không gửi dữ liệu; phiên bản ghim `1.1.1`. Có thể tự host trong `apps/web/public` nếu cần chạy offline |
| Chưa có HTTPS | Chạy trên `localhost`; trình duyệt coi localhost là secure context (camera vẫn dùng được) |

## Tài khoản thử nghiệm

- Demo: `demo@aicoach.local` / `Demo2026` (tạo bởi `pnpm db:seed:demo`, **đồng ý nghiên cứu = tắt** nên không bao giờ bị xuất sang dữ liệu ML).
- Trước khi xuất dữ liệu nghiên cứu (`pnpm ml:export`), kiểm tra không có tài khoản thử nghiệm nào bật "đồng ý nghiên cứu" (trang Hồ sơ → Quyền riêng tư).
