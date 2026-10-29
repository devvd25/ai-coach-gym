# Hướng dẫn thực nghiệm

Ba đóng góp nghiên cứu của đề tài, mỗi phần có cách chạy, đầu ra và cách đọc kết quả. Mọi lệnh chạy ở thư mục gốc của repo, trên Windows (Git Bash hoặc PowerShell).

| # | Thực nghiệm | Lệnh chính | Đầu ra |
|---|---|---|---|
| 1 | Đếm rep Squat bằng camera | Trang **Camera → Đánh giá bằng video** | `squat-eval-*.csv` (tải về) |
| 2 | LLM sinh kế hoạch và dinh dưỡng | `pnpm benchmark:llm` | `scripts/results/llm-benchmark-*.csv` |
| 3 | Random Forest dự đoán tiến độ | `python -m jupyter nbconvert --execute …` | `ml/progress_rf.ipynb`, `ml/figures/*.png` |

> Dữ liệu thật của người dùng (`ml/data/real_weeks.csv`) và kết quả benchmark (`scripts/results/`) **không được commit** (đã có trong `.gitignore`). Chỉ người dùng bật "Đồng ý cho nghiên cứu" mới được xuất dữ liệu.

---

## 1. Đếm rep Squat (MediaPipe)

**Mục tiêu:** đo độ chính xác của bộ đếm so với người đếm tay.

**Chuẩn bị video**
- Quay 10–20 video, mỗi video 5–20 rep, **đứng nghiêng khoảng 90°** so với camera, thấy toàn thân. Nên đa dạng: người khác nhau, ánh sáng, tốc độ, độ sâu (có vài rep nông để kiểm tra bộ đếm không đếm nhầm), khoảng cách.
- Mỗi video, **2 người đếm tay độc lập** số rep hợp lệ (đùi về song song sàn rồi đứng thẳng); bất đồng thì xem lại cùng nhau. Ghi lại cách đếm vào báo cáo.

**Chạy**
1. `pnpm dev`, đăng nhập, vào **Camera Squat → Đánh giá bằng video** (cần bật đồng ý dùng camera).
2. Chọn tất cả video, chọn mô hình (Lite / Full) và lấy mẫu 15 hoặc 30 frame/giây → **Chạy đánh giá**. Video được xử lý ngay trên trình duyệt, không tải lên máy chủ.
3. Nhập số đếm tay vào cột **Đếm tay** (trang tính ngay MAE và tỉ lệ đếm đúng hoàn toàn) → **Tải CSV**.
4. Lặp lại cho mỗi cấu hình muốn so sánh (Lite và Full, 15 và 30 fps). Ngưỡng đếm nằm ở `apps/web/src/features/squat/config.ts`; mỗi dòng CSV có cột `config` ghi lại ngưỡng đã dùng.

**Cột CSV:** `video, model, sample_fps, duration_s, frames, low_visibility_frames, rep_count, rep_timestamps_s, rep_min_angles_deg, ground_truth_reps, processing_s, config`.

**Đọc kết quả**
- **MAE** (rep) = trung bình |đếm máy − đếm tay|; **tỉ lệ đúng hoàn toàn** = % video đếm đúng tuyệt đối. Nên báo cáo thêm *sai số tương đối* = MAE / số rep trung bình.
- `low_visibility_frames / frames` cao (> 20%) nghĩa là video quay chưa đúng tư thế; nên loại hoặc báo cáo riêng.
- `rep_timestamps_s` dùng để đối chiếu từng rep với video: tìm rep thừa (đếm khi chưa xuống đủ sâu) và rep thiếu.
- `rep_min_angles_deg` cho thấy độ sâu: gần 90° là squat song song; nếu nhiều rep đúng bị bỏ do góc chỉ khoảng 115°, cân nhắc tăng `downAngle`.
- Unit test của bộ đếm (dữ liệu giả lập): `pnpm --filter @ai-coach/web test`.

---

## 2. Benchmark LLM (Ollama)

**Mục tiêu:** so sánh model (độ trễ, tỉ lệ JSON hợp lệ, số vi phạm luật an toàn, tỉ lệ phải dùng mẫu chuẩn) trên **30 hồ sơ mẫu** `scripts/fixtures/profiles/p01–p30.json`. Bộ hồ sơ phủ: nam/nữ, 16–65 tuổi, BMI thấp/cao, 3 trình độ, 2–6 buổi/tuần, 30–90 phút, phòng gym / tại nhà / chỉ có xà / chỉ dây kháng lực, chấn thương gối, lưng, vai, cổ tay, khuỷu tay, ghi không dấu, và **p23 chèn lệnh vào ô chấn thương** (prompt injection).

Benchmark gọi đúng prompt, JSON schema, luật an toàn, retry và fallback như API (`apps/api/src/modules/ai/tasks.ts`), không cần database.

**Chạy**
```bash
ollama pull qwen3:4b
pnpm benchmark:llm
pnpm benchmark:llm --models qwen3:4b,qwen3:8b --runs 3 --save-output
pnpm benchmark:llm --tasks plan --profiles p06,p23
```
Tùy chọn: `--models` (danh sách, mặc định `OLLAMA_MODEL`), `--tasks plan,nutrition`, `--profiles` (mặc định cả 30), `--runs` (lặp lại để đo dao động), `--think` (bật thinking của qwen3), `--save-output` (ghi JSON đầu ra để chấm rubric), `--out`.

Thời gian: khoảng 10–30 giây mỗi lần gọi với qwen3:4b trên GPU 12 GB, tức 30 hồ sơ × 2 tác vụ mất khoảng 15–20 phút cho một model. Kết quả được ghi sau từng lần gọi, nên dừng giữa chừng vẫn giữ được phần đã chạy.

**Cột CSV:** `model, task, profile_id, run, prompt_version, latency_ms, schema_valid, retry_count, violations_count, violations_first_attempt, used_fallback, output_tokens, error, violations`.
- `schema_valid`: lần trả lời **đầu tiên** có đúng JSON schema không.
- `violations_first_attempt`: số vi phạm luật an toàn ở lần đầu; `violations_count` gồm cả lần thử lại (dòng bắt đầu bằng "Lần 2:").
- `used_fallback = true`: sau 2 lần vẫn không đạt (hoặc hết thời gian chờ) nên dùng kế hoạch/thực đơn mẫu.

**Đọc kết quả** (mở CSV bằng Excel hoặc pandas):
- Theo model: độ trễ trung vị và p90, % `schema_valid`, % có retry, % `used_fallback`, trung bình `violations_first_attempt`.
- Liệt kê các vi phạm hay gặp (cột `violations`) để cải tiến prompt; khi sửa prompt, **tăng phiên bản** (`plan.v2.ts`) để so sánh v1 với v2.
- **Chấm rubric thủ công** trên file `llm-outputs-*.jsonl` (`--save-output`): ví dụ thang 1–5 cho (a) phù hợp mục tiêu/trình độ, (b) an toàn với chấn thương, (c) cân đối nhóm cơ, (d) thực đơn thực tế cho người Việt, (e) chất lượng lời giải thích. Hai người chấm độc lập, báo cáo độ đồng thuận.
- Dữ liệu dùng thật trong app nằm ở bảng `ai_requests` (cùng ý nghĩa các cột) để so sánh với benchmark.

**Phát hiện ban đầu (29/10/2026, qwen3:4b, RTX 12 GB)**
- Ở chat tự do, model **bỏ qua `think:false`** (khoảng 30 giây, khoảng 1.400 token suy nghĩ). Khi có JSON schema trong `format` thì chỉ còn 1–4 giây. Vì vậy mọi lời gọi đều dùng structured output.
- Khi schema để tự do số buổi và ngày tập, model trả 7 buổi (gồm cả "ngày nghỉ") → sai 2 lần → dùng mẫu chuẩn (65 giây). Sau khi ràng buộc schema theo từng người (đúng số buổi, chỉ các ngày đã chọn, chỉ bài được phép, 2–5 set, nghỉ 30–240 giây): đạt ngay lần đầu, 14–21 giây.
- Thử 3 hồ sơ (p06, p09, p23): 6/6 lần gọi đúng schema ngay lần đầu, 1 lần phải thử lại (rep "testing" sai định dạng), không lần nào dùng mẫu chuẩn. p23 (chèn lệnh 40 set, 800 kcal) vẫn cho 12 set mỗi buổi và 1.980 kcal.

---

## 3. Random Forest dự đoán tiến độ

**Bài toán:** từ dữ liệu đến hết tuần *t*, dự đoán cho tuần *t+1*:
- **Phân loại** `on_plan_next`: hoàn thành ≥ 80% số buổi trong lịch (cùng ngưỡng với Dashboard). Chỉ số: F1, accuracy, ROC-AUC.
- **Hồi quy** `volume_next`: tổng khối lượng (kg). Chỉ số: MAE.

**Dữ liệu**
```bash
python ml/generate_synthetic.py --users 300 --seed 42
pnpm ml:export
```
- Lệnh đầu sinh `ml/data/synthetic_weeks.csv`, dữ liệu mô phỏng (`is_synthetic = 1`). Các quy luật được cài vào ghi ở đầu file `generate_synthetic.py`.
- Lệnh sau cần SQL Server đang chạy và sinh `ml/data/real_weeks.csv` từ ứng dụng:
  - chỉ người dùng **đồng ý nghiên cứu**;
  - `user_id` là mã HMAC, đặt `EXPORT_SALT` trong `.env` nếu muốn mã ổn định giữa các lần xuất;
  - tuổi gộp nhóm 5 năm; không có tên hay email;
  - bỏ tuần hiện tại vì chưa hết tuần.
- Hai file cùng định dạng: `user_id, week_start, week_index, sex, age_group, goal, level, sessions_target, planned_sessions, completed_sessions, completion_rate, workouts, total_sets, volume_kg, avg_rpe, weight_kg, squat_reps, is_synthetic`.

> Không xuất từ tài khoản thử nghiệm có dữ liệu tự tạo (đặt "Đồng ý cho nghiên cứu" = tắt cho các tài khoản đó), nếu không, notebook sẽ coi dữ liệu tự tạo là dữ liệu thật.

**Chạy notebook**
```bash
python -m pip install -r ml/requirements.txt
cd ml
python -m jupyter nbconvert --to notebook --execute --inplace progress_rf.ipynb
```
Mất khoảng 1 phút. Có thể mở bằng VS Code (extension Jupyter) để chạy từng ô. Biểu đồ được lưu vào `ml/figures/` để chèn vào báo cáo.

**Phương pháp:** đặc trưng chỉ dùng quá khứ (lag, trung bình trượt 3 tuần, % thay đổi khối lượng, RPE, cân nặng, rep Squat, hồ sơ). **TimeSeriesSplit 5 fold theo tuần lịch**: test luôn muộn hơn train, không tách một tuần ra hai phía. Giá trị thiếu được điền trong từng fold huấn luyện. So với baseline: "giữ nguyên tuần này", trung bình 3 tuần, Logistic Regression / Linear Regression.

**Đọc kết quả**
- Bảng mean ± std qua 5 fold. Chênh lệch nhỏ hơn độ lệch chuẩn thì kết luận "**tương đương**"; ô cuối notebook tự viết câu kết luận theo quy tắc này.
- `metrics_by_fold.png`: chỉ số có ổn định theo thời gian không (các fold đầu ít dữ liệu huấn luyện).
- `feature_importance.png` (permutation importance trên 20% tuần cuối): đặc trưng nào ảnh hưởng.

**Kết quả hiện tại (chỉ dữ liệu mô phỏng, seed 42):**

| | RF | Baseline tốt nhất |
|---|---|---|
| Phân loại | F1 = 0,536 ± 0,059 | Logistic Regression F1 = 0,540 → tương đương |
| Hồi quy | MAE = 1.109 ± 97 kg | Linear Regression MAE = 1.086 kg → tương đương |

Cả hai cách đều tốt hơn rõ các baseline "giữ nguyên" (F1 0,49; MAE khoảng 1.250 kg).

**Hạn chế** (xem đầy đủ ở cuối notebook): dữ liệu chủ yếu là mô phỏng, nên kết quả chứng minh pipeline đúng chứ chưa chứng minh dự đoán được người thật. Ngoài ra: các tuần của cùng một người nằm ở cả train và test (dùng thêm GroupKFold theo `user_id` để đánh giá trên người mới); ngưỡng 80% là lựa chọn; khối lượng không tính bài không tạ; chưa tinh chỉnh siêu tham số và chưa lặp nhiều seed.

---

## Xử lý sự cố

| Triệu chứng | Cách xử lý |
|---|---|
| `pnpm benchmark:llm` báo không kết nối được Ollama | Mở Ollama; kiểm tra `OLLAMA_HOST` trong `.env` |
| Benchmark có nhiều dòng `Hết thời gian chờ Ollama` | Tăng `OLLAMA_TIMEOUT_MS`; kiểm tra `ollama ps` thấy `100% GPU` |
| Notebook báo `FileNotFoundError: synthetic_weeks.csv` | Chạy `python ml/generate_synthetic.py` trước |
| `UnicodeEncodeError` khi chạy Python trên Windows | Đặt `PYTHONIOENCODING=utf-8` hoặc chạy trong Windows Terminal |
| Đánh giá video báo không đọc được thời lượng | Chuyển video sang MP4 (H.264) rồi thử lại |
