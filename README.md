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

Mở `.env` và đổi `DB_PASSWORD`. SQL Server yêu cầu mật khẩu **≥ 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt** — nếu mật khẩu yếu, container sẽ tự tắt.

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

- Web: <http://localhost:5173> — trang **Trạng thái hệ thống** hiển thị API, SQL Server và Ollama.
- API: <http://localhost:4000/health> — trả `200` khi mọi thứ sẵn sàng, `503` khi có thành phần chưa sẵn sàng.

---

## Lệnh thường dùng

| Lệnh | Việc làm |
|---|---|
| `pnpm dev` | Chạy web + API ở chế độ phát triển |
| `pnpm lint` | ESLint + kiểm tra định dạng Prettier |
| `pnpm format` | Tự định dạng code bằng Prettier |
| `pnpm typecheck` | Kiểm tra kiểu TypeScript cho cả 3 package |
| `pnpm test` | Chạy unit test (Vitest) |
| `pnpm build` | Build shared, API và web |
| `pnpm db:up` / `pnpm db:down` | Bật / tắt SQL Server (dữ liệu giữ trong volume `sqlserver-data`) |
| `pnpm db:create` | Tạo database theo `DB_NAME` |
| `pnpm db:migrate` | Chạy migration mới |
| `pnpm --filter @ai-coach/api db:migrate:undo` | Hoàn tác migration gần nhất |

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
| Web báo **Chưa kết nối được API** | Kiểm tra cửa sổ `pnpm dev` có lỗi ở `apps/api` không; thường do thiếu biến trong `.env` |
