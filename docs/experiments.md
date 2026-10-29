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

### 1b. Dùng bộ dữ liệu công khai RepCount (không cần tự quay)

Video lấy từ RepCount-A (Hu và cộng sự, *TransRAC*, CVPR 2022), bản lưu lại trong dataset Hugging Face [JevArena-mm/jevarena-MM_video](https://huggingface.co/datasets/JevArena-mm/jevarena-MM_video), thư mục `repcount-a`. Đây là dataset có kiểm soát truy cập, chỉ dùng cho nghiên cứu phi thương mại và **không được phát tán lại**. Nhãn số rep lấy từ [lmms-lab-eval/repcount](https://huggingface.co/datasets/lmms-lab-eval/repcount) (EveryShotCounts, có trường `action_type`). Báo cáo phải trích dẫn bài báo TransRAC.

1. Đăng nhập Hugging Face, chấp nhận điều kiện của dataset JevArena, rồi chạy `python -m pip install huggingface_hub` và `hf auth login`.
2. Tải nhãn và chỉ các video squat vào `ml/data/repcount/` (thư mục đã gitignore):
   ```bash
   hf download lmms-lab-eval/repcount --repo-type dataset --include "*.jsonl" --local-dir ml/data/repcount/labels
   ```
   Video: lọc các dòng `action_type` là squat hoặc "squant" (lỗi chính tả trong nhãn gốc), rồi tải `repcount-a/videos/<tên>.mp4` bằng `hf download JevArena-mm/jevarena-MM_video --repo-type dataset --include ... --local-dir ml/data/repcount`.
3. Trang **Đánh giá bằng video**:
   - chọn **cả thư mục** `ml/data/repcount/repcount-a/videos`;
   - ở **Nhãn số rep**, chọn cả 3 file `labels/*.jsonl`;
   - giữ "Chỉ chạy video được gán nhãn squat" và **Chế độ nhẹ**;
   - bấm **Chạy đánh giá**, sau đó **Tải CSV**.
4. Trang hiện cả **MAE chuẩn hóa** (|đếm − nhãn| / nhãn) và **OBO** (tỉ lệ video lệch ≤ 1 rep), hai chỉ số dùng trong các bài báo về RepCount.

**Kết quả lần 1 (29/10/2026):** 29/33 video squat của phần test và validation RepCount-A có trên JevArena (bỏ 4 video lớn nhất); MediaPipe Lite, 15 frame/giây, ngưỡng 110°/160°, chế độ nhẹ, 31 phút trên laptop. File: `ml/data/repcount/results/squat-eval-repcount-lite-15fps-20261029.csv` (không commit).

| Nhóm video | n | MAE (rep) | MAE chuẩn hóa | OBO | Đúng hoàn toàn | Đếm thiếu / thừa |
|---|---|---|---|---|---|---|
| Tất cả | 29 | 5,00 | 0,486 | 52% | 31% | 19 / 1 |
| Thấy rõ chân (frame khuất ≤ 20%) | 23 | 5,57 | 0,395 | 61% | 35% | 14 / 1 |
| Khuất chân (frame khuất > 20%) | 6 | 2,83 | 0,833 | 17% | 17% | 5 / 0 |
| Thấy rõ và bộ đếm có kích hoạt | 19 | 4,05 | 0,268 | 68% | 42% | 10 / 1 |

Nhận xét:
- **Sai gần như hoàn toàn theo một hướng: đếm thiếu** (19 video thiếu, chỉ 1 video thừa; tổng đếm được 145 so với 288 rep thật). Bộ đếm hầu như không "bịa" rep: ngưỡng trễ và `minRepMs` làm đúng việc chống đếm nhầm. Đổi lại, nó bỏ sót nhiều rep.
- **Nguyên nhân 1, góc quay:** RepCount là video YouTube và video học sinh tập thể dục, nhiều video quay **chính diện** chứ không nghiêng 90° như hướng dẫn của app. Nhìn chính diện, góc gối 2D gần như không đổi, nên 4 video thấy rõ người vẫn đếm 0 (`stu6_65`, `stu6_63`, `stu4_63`, `val1244`). 6 video có nhiều frame khuất chân thì OBO chỉ 17%.
- **Nguyên nhân 2, squat nông:** ở các video bị thiếu, góc gối thấp nhất đo được thường 100–109° (ví dụ `stu8_62` đếm 10/22, `stu6_61` 1/19), sát ngưỡng `downAngle = 110°`. Ngưỡng này được đặt cho squat sâu đúng kỹ thuật, trong khi nhãn RepCount đếm cả rep nông.
- Video quay đúng điều kiện (nghiêng, thấy rõ, squat sâu) cho kết quả tốt: `stu5_62` 31/32, `stu9_64` 14/14, `stu6_57` 15/15, `stu3_66` 10/9.
- **Cách viết vào báo cáo:** trên dữ liệu "ngoài điều kiện thiết kế", bộ đếm có độ chính xác cao về rep đã đếm (hầu như không đếm thừa) nhưng độ phủ thấp. Đây là căn cứ cho (a) hướng dẫn đứng nghiêng trong app và (b) thí nghiệm độ nhạy ngưỡng `downAngle` (110°, 120°, 130°) cùng với chế độ quay chính diện ở bước sau.
- Không so trực tiếp con số với TransRAC: bài báo báo cáo trên mọi loại động tác của RepCount-A, còn ở đây chỉ có squat. Nếu đưa vào báo cáo, chỉ so cùng định nghĩa chỉ số và ghi rõ khác biệt về tập dữ liệu.

### 1c. Thử ngưỡng mà không chạy lại mô hình

Trên trang đánh giá, sau khi chạy xong, bấm **Tải dữ liệu frame (JSON)**. File này lưu 6 landmark chân của mọi frame, khoảng 10 KB cho mỗi phút video. Sau đó chạy lại bộ đếm (cùng code `counter.ts`) với nhiều ngưỡng, mỗi lần chỉ vài giây:
```bash
pnpm squat:sweep -- ml/data/repcount/results/frames-repcount-lite-15fps.json --down 90,100,110,120,130,140,150 --up 160
```
Thêm `--max-low-vis 0.2` để chỉ tính các video thấy rõ chân. Kết quả được ghi ra `<file>-sweep.csv`. Phát lại cho kết quả trùng khớp với lần chạy thật (có test `frames.test.ts`).

**Kết quả lần 2 (29/10/2026): đủ 33/33 video squat** (389 rep thật), Lite, 15 fps, chế độ nhẹ, 35 phút. Biểu đồ: `ml/figures/squat_threshold_sweep.png`.

| `downAngle` (up = 160°) | OBO, tất cả 33 video | MAE chuẩn hóa | OBO, 27 video thấy rõ chân | MAE chuẩn hóa | Đếm thiếu / thừa (33 video) |
|---|---|---|---|---|---|
| 90° | 33% | 0,594 | 37% | 0,537 | 28 / 0 |
| 100° | 42% | 0,510 | 48% | 0,438 | 24 / 1 |
| **110° (mặc định)** | **48%** | **0,481** | **56%** | **0,403** | 23 / 1 |
| 120° | 48% | 0,448 | 56% | 0,363 | 23 / 1 |
| **130°** | **58%** | **0,418** | **67%** | **0,326** | 23 / 1 |
| 140° | 55% | 0,430 | 63% | 0,341 | 21 / 3 |
| 150° | 55% | 0,428 | 63% | 0,337 | 20 / 3 |

- Nới ngưỡng xuống-sâu từ 110° lên **130°** là tốt nhất trên bộ này: OBO tăng 48% → 58% (67% với video thấy rõ chân), MAE chuẩn hóa giảm 0,481 → 0,418, mà số video đếm thừa không tăng. Từ 140° trở đi, đếm thừa bắt đầu tăng và độ chính xác không cải thiện thêm.
- Dù ở ngưỡng nào, vẫn khoảng 20 video bị **đếm thiếu**. Đây là các video quay chính diện, nơi góc gối 2D không phản ánh độ sâu. Muốn cải thiện tiếp thì phải đổi đặc trưng (ví dụ độ cao của hông so với gối, hoặc dùng `worldLandmarks` 3D) chứ không phải chỉnh ngưỡng.
- **Đánh đổi khi chọn ngưỡng:** 110° buộc mỗi rep phải gần song song mới được đếm, đúng tinh thần "rep hợp lệ" trong hướng dẫn tập. 130° đếm cả squat nông, đúng với cách RepCount gán nhãn.
- **Quyết định của nhóm (29/10/2026): giữ 110° trong app.** Lý do: app là công cụ huấn luyện, nên một rep chỉ được tính khi đủ sâu (gần song song sàn), đúng như hướng dẫn kỹ thuật. Kết quả ở 130° chỉ báo cáo trong thực nghiệm, để cho thấy bộ đếm sẽ phủ nhãn RepCount tốt hơn nếu chấp nhận cả squat nông.

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
Tùy chọn: `--models` (danh sách, mặc định `OLLAMA_MODEL`), `--tasks plan,nutrition`, `--profiles` (mặc định cả 30), `--runs` (lặp lại để đo dao động), `--think` (bật thinking của qwen3), `--save-output` (ghi JSON đầu ra để chấm rubric), `--out`, `--delay 20` (nghỉ 20 giây giữa các lần gọi để laptop không bị giật; độ trễ đo được không bị ảnh hưởng), `--resume <file.csv>` (chạy tiếp lần chạy bị dừng, bỏ qua các lần gọi đã có).

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

**Kết quả benchmark đầy đủ (29/10/2026, qwen3:4b, 30 hồ sơ × 2 tác vụ, 1 lần chạy, `--delay 20`)**

| Tác vụ | Độ trễ trung vị / p90 / max | JSON đúng lần đầu | Phải thử lại | Dùng mẫu chuẩn | Token đầu ra (trung vị) |
|---|---|---|---|---|---|
| Lịch tập (`plan.v1`) | 21,3 / 32,2 / 42,8 giây | 30/30 | 4/30 (13%) | 1/30 (3%, p03) | 797 |
| Dinh dưỡng (`nutrition.v1`) | 10,1 / 12,0 / 12,5 giây | 30/30 | 0/30 | 0/30 | 530 |

- **Lỗi lần đầu ở lịch tập** (4 hồ sơ): 2 lần ghi rep dạng `"x10"` (p09, p16), 1 lần rep là `"]"` (p22); 3 lần này đều sửa được ở lần thử lại. p03 tạo một buổi tên "Ngày nghỉ" ở cả 2 lần, nên phải dùng mẫu chuẩn.

**Cải tiến `plan.v2` (29/10/2026)** (file `apps/api/src/modules/ai/prompts/plan.v2.ts`). Chuyển thêm 2 quy tắc từ lời dặn trong prompt sang ràng buộc cứng trong JSON Schema:
- `title` phải chọn trong danh sách tên buổi (`SESSION_TITLES`);
- `reps` phải khớp mẫu `^([0-9]{1,2}(-[0-9]{1,2})?|[0-9]{2,3}s)$`.

Ngoài ra, gợi ý cho từng bài đổi từ `4x6-10` sang `4 set, 6-10`, vì cách ghi cũ có thể khiến model bắt chước viết rep dạng "x10". Chạy lại 30 hồ sơ cùng điều kiện (qwen3:4b, 1 lần chạy, `--delay 20`, `pnpm benchmark:llm --tasks plan --plan-version plan.v2`):

| Lịch tập | Độ trễ trung vị / p90 / max | JSON đúng lần đầu | Vi phạm luật ở lần đầu | Phải thử lại | Dùng mẫu chuẩn | Token (trung vị) |
|---|---|---|---|---|---|---|
| `plan.v1` | 21,3 / 32,2 / 42,8 giây | 30/30 | 4/30 | 4/30 | 1/30 | 796 |
| **`plan.v2`** | **15,9 / 22,5 / 33,0 giây** | 30/30 | **0/30** | **0/30** | **0/30** | 764 |

- v2 loại hết các lỗi v1 còn mắc. Do không còn lần nào phải gọi lại, độ trễ trung vị giảm khoảng 25% và p90 giảm khoảng 30%.
- p23 (chèn lệnh) vẫn cho 12 set mỗi buổi.
- **Từ ngày này app dùng `plan.v2`** (`CURRENT_PLAN_VERSION` trong `tasks.ts`). `plan.v1` vẫn được giữ để tái lập kết quả.
- Hạn chế: mới chạy 1 lần mỗi hồ sơ, nên nhóm cần chạy thêm `--runs 3` cho cả 2 phiên bản trước khi kết luận chắc chắn. Danh sách tên buổi cố định làm tiêu đề kém đa dạng hơn: v2 dùng 8/15 tên, nhiều nhất là "Đẩy", "Chân & mông", "Kéo". Cần chấm rubric xem tên có khớp nội dung buổi không.
- Ý nghĩa cho báo cáo: với model nhỏ (4B), **đưa quy tắc vào JSON Schema hiệu quả hơn nhắc trong prompt**. Kết luận này lặp lại cả ở lần cải tiến trước (ràng buộc số buổi, ngày tập, bài tập) lẫn lần này.
- **Chấn thương:** bài chống chỉ định bị loại ngay từ enum `slug`, nên không lần nào vi phạm. Ví dụ p07 (thoát vị lưng) không có deadlift, RDL, row, squat tạ đòn; p24 ghi không dấu "dau goi trai" vẫn bị nhận ra (không có squat tạ đòn, lunge, leg extension). **Hạn chế:** danh sách từ khóa còn thô. p29 (đau khuỷu tay) vẫn có barbell curl, triceps pushdown; p08 (đau vai) vẫn có incline dumbbell press và push-up. Cần chuyên gia rà lại `INJURY_RULES`.
- **Prompt injection (p23):** không có tác dụng; lịch 12 set mỗi buổi, thực đơn 1.980 kcal.
- **Dinh dưỡng – phát hiện quan trọng:** cả 30/30 lần model **chép nguyên** mục tiêu tham chiếu (kcal, protein, carb, fat) do hệ thống tính bằng Mifflin–St Jeor; tổng các bữa lệch tối đa 0,2% so với mục tiêu. Nghĩa là con số calo/macro thực chất do công thức quyết định, còn LLM đóng góp **món ăn** (81 món khác nhau trên 30 thực đơn) và **lời giải thích**. Báo cáo nên trình bày đúng như vậy; độ hợp lý của khẩu phần so với số kcal ghi kèm cần chấm rubric thủ công.

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
