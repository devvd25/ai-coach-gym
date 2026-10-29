# AI Coach Gym

Web app huấn luyện gym cá nhân hóa bằng AI — đề tài NCKH sinh viên (bảo vệ 4/2027).

- **Frontend** `apps/web`: React + TypeScript + Vite, React Router, TanStack Query
- **Backend** `apps/api`: Node.js 22 + TypeScript + Express 5
- **Database**: SQL Server 2022 (Docker) + Sequelize v6, schema quản lý bằng migration
- **Shared** `packages/shared`: Zod schema + type dùng chung
- **LLM**: Ollama chạy local (mặc định `qwen3:4b`)

Quy ước làm việc và các mốc phát triển: xem [AGENTS.md](AGENTS.md). Thiết kế giao diện: file Figma _AI Coach Gym – UI Design_.

---

## Cài đặt trên Windows (≈ 30 phút)

### 1. Cài công cụ (một lần)

| Công cụ | Phiên bản | Ghi chú |
|---|---|---|
| [Node.js](https://nodejs.org/) | 22 LTS | Kiểm tra: `node -v` |
| pnpm | 10 | `corepack enable` rồi `corepack prepare pnpm@10.30.3 --activate` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | mới nhất | Bật WSL 2; cấp ít nhất 2 GB RAM cho Docker (SQL Server cần) |
| [Ollama](https://ollama.com/download) | mới nhất | Cài native trên Windows, không chạy trong Docker |
| Git | mới nhất | |
| [Python](https://www.python.org/downloads/) | 3.11+ | Chỉ cần cho thực nghiệm ML: `python -m pip install -r ml/requirements.txt` |

Tải model LLM (khoảng 2,5 GB):

```powershell
ollama pull qwen3:4b
```

> **Bảo mật:** Ollama mặc định nghe ở `127.0.0.1:11434` và **không có xác thực**. Không đổi `OLLAMA_HOST` thành `0.0.0.0` và không mở cổng 11434 trên firewall/router. Chỉ backend được gọi Ollama.

### 2. Lấy mã nguồn và cài thư viện

```powershell
git clone <url-repo> ai-coach-gym
cd ai-coach-gym
pnpm install
```

### 3. Tạo file môi trường

```powershell
copy .env.example .env
```

Mở `.env` và đổi:

- `DB_PASSWORD`: SQL Server yêu cầu **≥ 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt** — nếu mật khẩu yếu, container sẽ tự tắt.
- `JWT_SECRET`: chuỗi ngẫu nhiên ≥ 32 ký tự, mỗi máy một giá trị. Tạo nhanh:

  ```powershell
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

### 4. Chạy SQL Server, tạo database và bảng

Mở Docker Desktop trước, rồi:

```powershell
pnpm db:up        # chạy SQL Server 2022 trong Docker, chờ đến khi sẵn sàng (lần đầu tải ~1,5 GB)
pnpm db:create    # tạo database ai_coach
pnpm db:migrate   # tạo các bảng
```

### 5. Chạy ứng dụng

```powershell
pnpm dev
```

- Web: <http://localhost:5173> — đăng ký tài khoản → đồng ý dữ liệu → tạo hồ sơ → vào app.
- Hoặc dùng tài khoản demo có sẵn 8 tuần dữ liệu: chạy `pnpm db:seed:demo` rồi đăng nhập `demo@aicoach.local` / `Demo2026`.
- Trạng thái hệ thống: <http://localhost:5173/trang-thai> hiển thị API, SQL Server và Ollama.
- API: <http://localhost:4000/health> — trả `200` khi mọi thứ sẵn sàng, `503` khi có thành phần chưa sẵn sàng.

### API hiện có

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/health` | Kiểm tra SQL Server + Ollama |
| POST | `/api/auth/register` | Đăng ký (giới hạn 10 lần / 15 phút / IP) |
| POST | `/api/auth/login` | Đăng nhập, trả JWT (giới hạn 10 lần / 15 phút / IP) |
| GET | `/api/auth/me` | Thông tin người dùng hiện tại |
| PUT | `/api/me/consent` | Đồng ý xử lý dữ liệu (2 mục bắt buộc + camera, nghiên cứu) |
| GET / PUT | `/api/profile` | Xem / lưu hồ sơ tập luyện |
| POST | `/api/ai/plan` | AI sinh lịch tuần `{ weekStart }`, thay lịch cũ của tuần đó |
| POST | `/api/ai/nutrition` | AI tính calo/macro + thực đơn `{ date }` |
| GET | `/api/nutrition/:date` | Thực đơn đã lưu của một ngày |
| POST | `/api/ai/review` | Số liệu tuần + AI nhận xét tiến độ `{ weekStart }` |
| POST | `/api/ai/chat` | Hỏi đáp `{ messages }` (tối đa 12 tin gần nhất) |
| GET | `/api/ai/requests` | Lịch sử gọi AI của người dùng (độ trễ, retry, fallback) |
| GET | `/api/ai/status` | Model, thinking, timeout, phiên bản prompt |
| GET | `/api/stats/dashboard?weeks=8` | Số liệu Dashboard theo tuần: buổi tập, khối lượng, % hoàn thành, rep Squat, cân nặng |
| GET / POST | `/api/squat-sessions` | Kết quả buổi Squat bằng camera (POST cần đồng ý dùng camera) |

Các endpoint `POST /api/ai/*` giới hạn `AI_RATE_LIMIT_PER_HOUR` lượt/giờ cho mỗi người dùng. Mỗi lần gọi được ghi vào bảng `ai_requests` để làm thực nghiệm. Kết quả của model luôn được kiểm tra bằng Zod và luật an toàn (`apps/api/src/modules/ai/safety-rules.ts`); sai thì hỏi lại 1 lần, vẫn sai thì dùng kế hoạch/thực đơn mẫu.

Các đường dẫn `/api/*` (trừ đăng ký, đăng nhập) cần header `Authorization: Bearer <token>`. Token hết hạn sau `JWT_TTL_MINUTES` phút (mặc định 60), khi đó người dùng phải đăng nhập lại.

---

## Lệnh thường dùng

| Lệnh | Việc làm |
|---|---|
| `pnpm dev` | Chạy web + API ở chế độ phát triển |
| `pnpm lint` | ESLint + kiểm tra định dạng Prettier |
| `pnpm format` | Tự định dạng code bằng Prettier |
| `pnpm typecheck` | Kiểm tra kiểu TypeScript cho cả 3 package |
| `pnpm test` | Unit test + test HTTP; test tích hợp SQL Server (`*.db.test.ts`, database riêng `ai_coach_test`) chạy khi `pnpm db:up`, nếu không thì tự bỏ qua |
| `pnpm build` | Build shared, API và web |
| `pnpm db:up` / `pnpm db:down` | Bật / tắt SQL Server (dữ liệu giữ trong volume `sqlserver-data`) |
| `pnpm db:create` | Tạo database theo `DB_NAME` |
| `pnpm db:migrate` | Chạy migration mới |
| `pnpm db:seed` | Thêm thư viện 40 bài tập (chạy lại không trùng) |
| `pnpm db:seed:demo` | Tạo lại tài khoản demo `demo@aicoach.local` / `Demo2026` với 8 tuần dữ liệu |
| `pnpm --filter @ai-coach/api db:migrate:undo` | Hoàn tác migration gần nhất |
| `pnpm benchmark:llm` | Benchmark LLM trên 30 hồ sơ mẫu → `scripts/results/` |
| `pnpm ml:export` | Xuất dữ liệu tập luyện ẩn danh (người dùng đồng ý nghiên cứu) → `ml/data/real_weeks.csv` |
| `python ml/generate_synthetic.py` | Sinh dữ liệu mô phỏng → `ml/data/synthetic_weeks.csv` |

Tài liệu:
- [docs/architecture.md](docs/architecture.md): sơ đồ kiến trúc, luồng AI, bộ đếm Squat, cơ sở dữ liệu, kiểm thử
- [docs/security.md](docs/security.md): rà soát bảo mật theo AGENTS.md §8 và rủi ro đã chấp nhận
- [docs/experiments.md](docs/experiments.md): cách chạy và đọc kết quả 3 thực nghiệm
- [docs/demo.md](docs/demo.md): chuẩn bị, kịch bản 15 phút và phương án dự phòng cho buổi bảo vệ

Tạo migration mới (đặt tên theo thời gian, đuôi `.cjs`) trong `apps/api/src/db/migrations/`. **Không dùng** `sequelize.sync({ alter: true })`.

---

## Cấu trúc thư mục

```
apps/
  api/            Express API
    src/
      config/     Đọc & kiểm tra biến môi trường (Zod)
      db/         Kết nối Sequelize, config cho sequelize-cli, migrations, seeders
      modules/    Mỗi module: routes / controller / service (/ model)
  web/            React app (token màu & font lấy từ Figma: src/styles/tokens.css)
packages/
  shared/         Zod schema + type dùng chung
scripts/          benchmark-llm.ts + fixtures/profiles (30 hồ sơ mẫu)
ml/               generate_synthetic.py, progress_lib.py, progress_rf.ipynb, figures/, data/ (không commit)
docs/             architecture.md, security.md, experiments.md, demo.md
docker-compose.yml  SQL Server 2022 (chỉ mở ở 127.0.0.1)
.env.example        Mẫu biến môi trường
```

---

## Xử lý sự cố

| Triệu chứng | Cách xử lý |
|---|---|
| `pnpm db:up` báo container unhealthy hoặc tự tắt | Mật khẩu chưa đủ mạnh. Đổi `DB_PASSWORD`, chạy `docker compose down -v` (xóa dữ liệu cũ) rồi `pnpm db:up` lại |
| Cổng 1433 đã bị dùng | Máy đã cài SQL Server khác. Đổi `DB_PORT=1434` trong `.env` |
| `failed to connect to the docker API` | Docker Desktop chưa mở hoặc đang khởi động |
| Trang web báo **Ollama: Không kết nối được** | Mở ứng dụng Ollama (biểu tượng ở khay hệ thống) |
| Trang web báo **Chưa có model qwen3:4b** | Chạy `ollama pull qwen3:4b` |
| AI báo **Hết thời gian chờ Ollama** hoặc luôn ra "Mẫu chuẩn" | Lần gọi đầu phải nạp model vào GPU (~10 giây). Kiểm tra `ollama ps` thấy `100% GPU`; tăng `OLLAMA_TIMEOUT_MS` nếu máy yếu |
| Camera Squat báo **không tải được mô hình** | Trang tải WASM MediaPipe từ cdn.jsdelivr.net và mô hình pose từ storage.googleapis.com ở lần đầu, cần mạng (video vẫn không rời máy) |
| Camera Squat không đếm | Đứng nghiêng ~90°, lùi xa để thấy cả hông – gối – cổ chân; ngưỡng đếm nằm ở `apps/web/src/features/squat/config.ts` |
| Web báo **Chưa kết nối được API** | Kiểm tra cửa sổ `pnpm dev` có lỗi ở `apps/api` không; thường do thiếu biến trong `.env` |
