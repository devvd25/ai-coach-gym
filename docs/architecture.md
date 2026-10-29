# Kiến trúc hệ thống – AI Coach Gym

Các sơ đồ viết bằng Mermaid: GitHub và VS Code (extension *Markdown Preview Mermaid Support*) hiển thị trực tiếp; muốn xuất ảnh cho báo cáo thì dán từng khối vào <https://mermaid.live>.

## 1. Tổng quan thành phần

Mọi thứ chạy trên **một máy** (Windows 11, GPU 12 GB). Trình duyệt chỉ nói chuyện với API; LLM và camera không bao giờ đi qua mạng ngoài (riêng file mô hình MediaPipe được tải một lần từ CDN).

```mermaid
flowchart LR
  subgraph Browser["Trình duyệt (apps/web – React + Vite)"]
    UI["Trang: Tổng quan, Lịch tập, Nhật ký,<br/>Dinh dưỡng, AI Coach, Camera Squat"]
    MP["MediaPipe Pose<br/>(WASM/WebGL, chạy tại chỗ)"]
    CNT["counter.ts<br/>(hàm thuần đếm rep)"]
    UI --- MP --> CNT
  end

  subgraph API["apps/api – Node.js + Express 5 (cổng 4000)"]
    MW["helmet · CORS · rate limit<br/>JWT · đồng ý dữ liệu · Zod"]
    MOD["modules: auth, profile, exercises, plans,<br/>workouts, squat, stats, ai"]
    LLM["ai/llm.service.ts<br/>(nơi DUY NHẤT gọi Ollama)"]
    MW --> MOD --> LLM
  end

  DB[("SQL Server 2022<br/>Docker, 127.0.0.1:1433")]
  OL["Ollama native<br/>qwen3:4b, 127.0.0.1:11434"]
  SH["packages/shared<br/>Zod schema + type dùng chung"]

  UI -- "HTTPS/JSON + Bearer JWT<br/>(qua proxy Vite /api)" --> MW
  CNT -- "chỉ số liệu buổi (rep, góc, thời gian)" --> MW
  MOD -- "Sequelize v6 / tedious" --> DB
  LLM -- "structured output (JSON Schema)" --> OL
  SH -.-> UI
  SH -.-> MOD

  subgraph Offline["Thực nghiệm (chạy riêng)"]
    BM["scripts/benchmark-llm.ts"]
    EX["pnpm ml:export"]
    NB["ml/ (Python): generate_synthetic.py,<br/>progress_rf.ipynb"]
  end
  BM --> LLM
  EX --> DB
  EX -- "real_weeks.csv (ẩn danh)" --> NB
```

| Thư mục | Vai trò |
|---|---|
| `apps/web/src/features/<tính năng>` | Trang và hook TanStack Query; `squat/` có bộ đếm thuần và chế độ đánh giá video |
| `apps/api/src/modules/<module>` | `routes` (đường dẫn + validate), `controller` (HTTP), `service` (nghiệp vụ), `model` (Sequelize) |
| `apps/api/src/modules/ai` | `llm.service` (gọi Ollama, retry, fallback, log), `tasks` (prompt + schema + luật cho từng tác vụ), `safety-rules`, `templates`, `prompts/*.v1.ts` |
| `apps/api/src/db` | migrations, seeders (40 bài tập), `seed-library` |
| `apps/api/src/scripts` | `export-training` (dữ liệu ML), `seed-demo` (tài khoản demo) |
| `packages/shared` | Một nguồn duy nhất cho schema request/response, hằng số, hàm tính (khối lượng, ngày tuần…) |

## 2. Luồng AI sinh kế hoạch tuần

```mermaid
sequenceDiagram
  autonumber
  actor U as Người dùng
  participant W as Web (Lịch tập)
  participant A as API /api/ai/plan
  participant S as ai.service + tasks.ts
  participant L as llm.service
  participant O as Ollama (qwen3:4b)
  participant D as SQL Server

  U->>W: Bấm "Tạo lịch bằng AI"
  W->>A: POST { weekStart } + JWT
  A->>A: requireAuth → đồng ý dữ liệu → rate limit/user → Zod
  A->>S: generatePlan(userId, weekStart)
  S->>D: Hồ sơ + thư viện bài tập
  S->>S: allowedExercises (dụng cụ, trình độ, chấn thương)<br/>JSON Schema riêng cho user (số buổi, ngày, slug enum)
  S->>L: runStructured(prompt v1, schema, checkPlan, templatePlan)
  L->>O: chat(format = JSON Schema, think = false, timeout)
  O-->>L: JSON
  L->>L: JSON.parse → Zod → luật an toàn
  alt Hợp lệ
    L-->>S: kế hoạch AI
  else Sai schema / vi phạm luật
    L->>O: Gửi lại kèm danh sách lỗi (1 lần)
    O-->>L: JSON sửa
    L->>L: kiểm tra lại
    opt Vẫn sai, hết thời gian chờ hoặc lỗi kết nối
      L->>L: templatePlan (mẫu chuẩn theo mục tiêu/trình độ)
    end
  end
  L->>D: INSERT ai_requests (latency, schema_valid, retry, violations, fallback)
  S->>D: replaceWeek (transaction: xóa buổi cũ, giữ nhật ký đã tập)
  A-->>W: { plan, meta }
  W-->>U: Lịch tuần + "Vì sao AI đề xuất lịch này" + thông tin kiểm tra
```

Dinh dưỡng (`/api/ai/nutrition`) đi cùng đường ống, với `referenceTargets` (Mifflin–St Jeor) làm tham chiếu và `checkNutrition` (calo tối thiểu theo giới tính, protein 1,2–2,4 g/kg, macro khớp calo). Nhận xét tuần (`/api/ai/review`) cho hệ thống tự tính số liệu, AI chỉ diễn giải. Chat (`/api/ai/chat`) cũng dùng JSON Schema để tắt được chế độ "thinking".

## 3. Bộ đếm Squat (máy trạng thái)

```mermaid
stateDiagram-v2
  [*] --> waiting
  waiting --> up: góc gối (EMA) ≥ upAngle 160°
  up --> down: góc ≤ downAngle 110°
  down --> up: góc ≥ 160° → +1 rep nếu ≥ minRepMs 600 ms
  down --> down: ghi góc nhỏ nhất (độ sâu)
  up --> waiting: mất người > maxGapMs 1 s
  down --> waiting: mất người > 1 s (rep dở bị bỏ)
  note right of waiting
    Mỗi frame: chọn chân có visibility cao hơn,
    bỏ frame nếu visibility < 0,6,
    góc hông–gối–cổ chân có hiệu chỉnh tỉ lệ khung hình.
  end note
```

Khoảng cách giữa 110° và 160° là **ngưỡng trễ (hysteresis)**: rung lắc quanh một ngưỡng không tạo rep giả. Mọi ngưỡng nằm trong `apps/web/src/features/squat/config.ts`.

## 4. Cơ sở dữ liệu

```mermaid
erDiagram
  users ||--o| profiles : "có"
  users ||--o{ plans : "1 kế hoạch / tuần"
  plans ||--o{ plan_sessions : "buổi theo ngày"
  plan_sessions ||--o{ plan_session_exercises : "bài, set, rep"
  exercises ||--o{ plan_session_exercises : ""
  users ||--o{ workout_logs : "nhật ký"
  workout_logs ||--o{ workout_sets : "từng set"
  exercises ||--o{ workout_sets : ""
  plan_sessions |o--o{ workout_logs : "session_id (null khi xóa buổi)"
  users ||--o{ weight_logs : "1 lần cân / ngày"
  users ||--o{ squat_sessions : "kết quả camera"
  users ||--o{ nutrition_days : "1 thực đơn / ngày"
  users ||--o{ ai_requests : "log thực nghiệm"

  users { int id PK; nvarchar email UK; nvarchar password_hash; datetimeoffset health_consent_at; bit consent_camera; bit consent_research }
  profiles { int user_id FK; nvarchar goal; int age; decimal weight_kg; nvarchar injuries; int sessions_per_week }
  plans { int id PK; int user_id FK; date week_start; nvarchar source; nvarchar ai_note }
  workout_logs { int id PK; int user_id FK; int session_id FK; datetimeoffset started_at; nvarchar feeling }
  ai_requests { int id PK; int user_id FK; nvarchar task; nvarchar model; nvarchar prompt_version; int latency_ms; bit schema_valid; int retry_count; nvarchar violations; bit used_fallback }
  squat_sessions { int id PK; int user_id FK; int rep_count; decimal avg_min_knee_angle; nvarchar model; decimal avg_fps }
```

- Schema chỉ thay đổi qua **migration** (`apps/api/src/db/migrations`), không dùng `sync({ alter: true })`. Chuỗi tiếng Việt dùng NVARCHAR.
- SQL Server cấm nhiều đường cascade, nên chỉ chuỗi sở hữu `users → …` là `ON DELETE CASCADE`. Liên kết tới `exercises` và `workout_logs.session_id` là NO ACTION và được xử lý trong code (xóa buổi thì đặt `session_id` về null để giữ lịch sử).
- Không lưu video, ảnh hay landmark. Bảng `squat_sessions` chỉ có số liệu tổng hợp.

## 5. Kiểm thử

| Lớp | Ở đâu | Chạy |
|---|---|---|
| Hàm thuần (đếm rep, luật an toàn, mẫu chuẩn, tổng hợp thống kê, CSV) | `*.test.ts` trong web/api/shared | `pnpm test` |
| HTTP (định tuyến, validate, phân quyền, bảo mật) | `apps/api/src/**/*routes*.test.ts`, `security.test.ts` (service giả) | `pnpm test` |
| Tích hợp SQL Server (transaction, cascade, quyền sở hữu, AI pipeline với model giả) | `apps/api/src/integration.db.test.ts`, DB riêng `ai_coach_test` | `pnpm test` (tự bỏ qua nếu chưa `pnpm db:up`; CI luôn chạy) |
| Thực nghiệm | `scripts/benchmark-llm.ts`, `ml/`, chế độ đánh giá video | xem [experiments.md](experiments.md) |

Bảo mật: xem [security.md](security.md). Kịch bản trình diễn: xem [demo.md](demo.md).
