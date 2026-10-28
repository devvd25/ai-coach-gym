# AGENTS.md — AI Coach Gym (Đề tài NCKH, bảo vệ 4/2027)

## 1. Bối cảnh
- Web app huấn luyện gym cá nhân hóa bằng AI cho đề tài nghiên cứu khoa học sinh viên.
- Nhóm 4 người, mỗi người ~2 giờ/ngày. Ưu tiên code đơn giản, dễ đọc, dễ đo bằng thực nghiệm.
- Ba đóng góp nghiên cứu cần đo được:
  (1) Đếm rep Squat bằng camera (MediaPipe).
  (2) Sinh kế hoạch tập + gợi ý dinh dưỡng bằng LLM local (Ollama).
  (3) Thí nghiệm Random Forest dự đoán xu hướng tiến độ, so với baseline.
- Toàn bộ giao diện và nội dung người dùng thấy bằng **tiếng Việt**. Code, tên biến, commit bằng tiếng Anh.
- Môi trường dev: Windows 11, RAM 32 GB, GPU 12 GB VRAM. Ollama cài native trên Windows (không chạy trong Docker).

## 2. Tech stack (bắt buộc, không tự ý đổi)
- Monorepo: pnpm workspace.
- Frontend `apps/web`: React + TypeScript + Vite, React Router, TanStack Query, Recharts, `@mediapipe/tasks-vision`.
- Backend `apps/api`: Node.js LTS + TypeScript + Express 5.
- Database: SQL Server 2022 (Developer, image `mcr.microsoft.com/mssql/server:2022-latest`) chạy bằng Docker Compose, driver `tedious`, chuỗi tiếng Việt dùng NVARCHAR; ORM **Sequelize v6** (model khai báo kiểu với `InferAttributes`/`InferCreationAttributes`); quản lý schema bằng **migration + seeder** (sequelize-cli). KHÔNG dùng `sync({ alter: true })`.
- Shared `packages/shared`: Zod schemas + types dùng chung cho web, api và output LLM.
- Auth: JWT access token (hạn ngắn) + bcrypt.
- LLM: Ollama qua thư viện `ollama` (ollama-js). Model cấu hình qua biến môi trường `OLLAMA_MODEL` (mặc định `qwen3:4b`), host `OLLAMA_HOST=http://127.0.0.1:11434`.
- ML: thư mục `ml/` dùng Python 3 + scikit-learn + pandas + Jupyter, chạy offline.
- Test: Vitest (web, api, shared). Lint: ESLint + Prettier. CI: GitHub Actions (lint, typecheck, test, build).
- Nếu cần thêm thư viện ngoài danh sách: giải thích lý do trong phần tóm tắt mốc, ưu tiên thư viện phổ biến, ít phụ thuộc.

## 3. Cấu trúc thư mục
/apps/web          React app
/apps/api          Express API (src/modules/<module>/{routes,controller,service,model}.ts)
/packages/shared   Zod schemas, types, hằng số
/ml                notebooks, scripts Python, data/ (gitignore dữ liệu thật)
/scripts           script benchmark (TypeScript)
/docs              tài liệu kiến trúc, API, hướng dẫn thực nghiệm
docker-compose.yml, .env.example, README.md

## 4. Chức năng (MVP)
1. Đăng ký / đăng nhập / đăng xuất; màn hình **đồng ý xử lý dữ liệu sức khỏe** trước khi dùng.
2. Hồ sơ: tuổi, giới tính, chiều cao, cân nặng, mục tiêu (giảm mỡ/tăng cơ/duy trì), trình độ, số buổi/tuần, thời lượng/buổi, dụng cụ có sẵn, chấn thương/hạn chế.
3. Thư viện bài tập (seed ~40 bài, có nhóm cơ, dụng cụ, độ khó, mô tả tiếng Việt).
4. Lịch tập: AI sinh kế hoạch theo tuần; người dùng xem, sửa, đánh dấu hoàn thành.
5. Nhật ký buổi tập: bài, set, rep, khối lượng, RPE, ghi chú; cân nặng theo ngày.
6. Gợi ý dinh dưỡng: AI tính calo/macro mục tiêu + thực đơn mẫu theo ngày.
7. AI giải thích: vì sao đề xuất kế hoạch này / nhận xét tiến độ tuần.
8. Camera Squat: đếm rep realtime, hiển thị góc gối, lưu kết quả buổi (số rep, thời gian, góc min trung bình). **Không lưu video.**
9. Dashboard: tần suất tập, tổng khối lượng, xu hướng cân nặng, rep Squat theo thời gian, tỉ lệ hoàn thành kế hoạch.

## 5. Yêu cầu module AI (LLM)
- Mọi lời gọi Ollama đi qua `apps/api/src/modules/ai/llm.service.ts`; frontend KHÔNG gọi Ollama trực tiếp.
- Dùng structured output: chuyển Zod schema sang JSON Schema và truyền vào tham số `format`; tắt thinking (`think: false`) mặc định, có cấu hình bật lại.
- Sau khi nhận kết quả: parse bằng Zod → kiểm tra **luật an toàn** ở `ai/safety-rules.ts` (calo không thấp hơn ngưỡng tối thiểu theo giới tính, protein trong khoảng hợp lý, số set/rep/buổi trong giới hạn, loại bỏ bài xung đột với chấn thương, chỉ dùng bài có trong thư viện).
- Không hợp lệ → retry 1 lần kèm thông báo lỗi; vẫn lỗi → fallback về kế hoạch template theo mục tiêu/trình độ.
- Timeout cấu hình được; rate limit endpoint AI theo user.
- Ghi bảng `ai_requests`: user_id, task (plan/nutrition/explain), model, prompt_version, latency_ms, schema_valid, retry_count, violations (JSON), used_fallback, created_at. Bảng này phục vụ thực nghiệm.
- Prompt lưu thành file có version trong `ai/prompts/`, viết tiếng Việt, coi dữ liệu người dùng nhập là dữ liệu chứ không phải chỉ thị.

## 6. Yêu cầu module Camera (Squat)
- Logic đếm tách thành **hàm thuần** trong `apps/web/src/features/squat/counter.ts`, không phụ thuộc DOM, có unit test với chuỗi landmark giả lập.
- Tính góc hông–gối–cổ chân (chọn bên có visibility cao hơn), làm mượt (moving average/EMA), máy trạng thái UP→DOWN→UP với ngưỡng trễ (hysteresis); chỉ đếm khi visibility ≥ ngưỡng. Tất cả ngưỡng nằm trong file config.
- Cho chọn model lite/full; hiển thị FPS.
- **Chế độ đánh giá**: upload file video → chạy offline từng frame → xuất CSV (tên video, số rep đếm được, timestamps từng rep) để so với ground truth đếm tay.
- Hướng dẫn người dùng đứng nghiêng ~90° so với camera, toàn thân trong khung.

## 7. Thực nghiệm & ML
- `scripts/benchmark-llm.ts`: chạy N hồ sơ mẫu (file JSON trong `scripts/fixtures/profiles/`, tạo sẵn 30 hồ sơ đa dạng) qua danh sách model từ tham số dòng lệnh → xuất CSV: model, profile_id, latency_ms, schema_valid, violations_count, used_fallback. Có thể xuất kèm output để chấm rubric thủ công.
- `apps/api` có lệnh export dữ liệu tập luyện (ẩn danh hóa user_id) ra CSV vào `ml/data/`.
- `ml/generate_synthetic.py`: sinh dữ liệu tập luyện mô phỏng, đánh dấu rõ cột `is_synthetic`.
- `ml/progress_rf.ipynb`: định nghĩa biến mục tiêu (ví dụ: tuần tới có đạt ≥ 80% kế hoạch hay không; và hồi quy tổng khối lượng tuần tới), feature engineering theo tuần, so sánh Random Forest với baseline (moving average, logistic/linear regression) bằng TimeSeriesSplit; báo cáo F1/MAE, feature importance, biểu đồ. Ghi rõ hạn chế dữ liệu.
- `docs/experiments.md`: mô tả cách chạy từng thực nghiệm và cách đọc kết quả.

## 8. Bảo mật
- Băm mật khẩu bằng bcrypt; JWT có hạn; middleware phân quyền theo user cho mọi tài nguyên.
- helmet, CORS chỉ cho origin của web, rate limit login và AI.
- Validate mọi request bằng Zod. Không log mật khẩu/token/dữ liệu sức khỏe chi tiết.
- Ollama chỉ được gọi từ backend qua localhost; ghi chú trong README: không mở cổng 11434 ra ngoài.
- Secrets chỉ nằm trong `.env` (gitignore); cung cấp `.env.example`.

## 9. Quy tắc làm việc
- Làm **đúng một mốc** mỗi lần được yêu cầu, rồi DỪNG.
- Kết thúc mỗi mốc: chạy `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; sửa đến khi pass. Sau đó tóm tắt: đã làm gì, file chính, cách chạy/kiểm tra thủ công, việc còn tồn, thư viện mới thêm (và lý do).
- TypeScript `strict`. Không dùng `any` trừ khi có comment giải thích.
- Không bịa API thư viện; nếu không chắc, kiểm tra tài liệu/typings trong node_modules.
- Gặp quyết định ảnh hưởng thiết kế mà tài liệu này không nói → hỏi lại thay vì tự quyết.
- Commit nhỏ, message theo Conventional Commits.
- README phải đủ để một thành viên mới setup trên Windows trong ≤ 30 phút.

## 10. Các mốc (milestones)
- **M0 – Khung dự án**: pnpm monorepo, web/api/shared chạy được, docker-compose SQL Server 2022, Sequelize + migration đầu tiên, endpoint `GET /health` (kiểm tra DB + Ollama), ESLint/Prettier/Vitest, GitHub Actions, README, .env.example.
- **M1 – Auth & hồ sơ**: đăng ký/đăng nhập/JWT, màn hình đồng ý dữ liệu, CRUD hồ sơ, layout app + điều hướng, route bảo vệ.
- **M2 – Bài tập, lịch, nhật ký**: seed thư viện bài tập, CRUD kế hoạch (thủ công), ghi nhật ký buổi tập, nhật ký cân nặng.
- **M3 – AI Coach**: llm.service, prompts có version, sinh kế hoạch tuần, gợi ý dinh dưỡng, giải thích; Zod + safety rules + retry + fallback; bảng `ai_requests`; UI hiển thị trạng thái đang sinh và lỗi thân thiện.
- **M4 – Camera Squat**: counter thuần + unit test, trang camera realtime, lưu kết quả buổi, chế độ đánh giá bằng file video + xuất CSV.
- **M5 – Dashboard**: API thống kê + các biểu đồ ở mục 4.9.
- **M6 – Thực nghiệm**: benchmark-llm + 30 hồ sơ mẫu, export dữ liệu, sinh dữ liệu mô phỏng, notebook RF vs baseline, docs/experiments.md.
- **M7 – Hoàn thiện**: tăng test cho service quan trọng, seed tài khoản demo có dữ liệu 8 tuần, rà soát bảo mật theo mục 8, cập nhật docs kiến trúc (sơ đồ) và hướng dẫn demo.