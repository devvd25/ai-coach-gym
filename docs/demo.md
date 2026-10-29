# Hướng dẫn demo (buổi bảo vệ)

Tổng thời gian khoảng **15 phút**: 2 phút giới thiệu, 10 phút trình diễn 3 đóng góp, 3 phút kết quả thực nghiệm. Có phương án dự phòng cho từng bước.

## A. Chuẩn bị (làm trước 30 phút)

1. Mở **Docker Desktop** và **Ollama** (biểu tượng ở khay hệ thống).
2. Ở thư mục repo, chạy lần lượt:
   ```bash
   pnpm db:up
   pnpm db:migrate
   pnpm db:seed
   pnpm db:seed:demo
   pnpm dev
   ```
   - `pnpm db:seed` thêm thư viện 40 bài tập (chạy lại nhiều lần không bị trùng).
   - `pnpm db:seed:demo` tạo lại tài khoản demo với 8 tuần dữ liệu kết thúc đúng hôm nay.
3. Mở <http://localhost:5173/trang-thai>: **Database ok**, **Ollama ok – có model qwen3:4b**.
4. **Làm nóng model** để lần gọi đầu không mất thêm khoảng 10 giây nạp vào GPU: đăng nhập demo → **AI Coach** → hỏi một câu bất kỳ. Kiểm tra `ollama ps` thấy `100% GPU`.
5. **Camera:** mở trang **Camera Squat** một lần khi có mạng để trình duyệt tải và lưu sẵn mô hình MediaPipe. Đặt camera hoặc laptop cách khoảng 2,5 m, ngang hông, có chỗ đứng nghiêng.
6. Chuẩn bị sẵn: 2–3 **video Squat đã đếm tay** (cho chế độ đánh giá), file CSV benchmark và `ml/progress_rf.ipynb` đã chạy, các ảnh `ml/figures/*.png`.
7. Trình duyệt: zoom 110–125% cho máy chiếu, tắt thông báo, mở sẵn tab <http://localhost:5173>.

**Tài khoản demo:** `demo@aicoach.local` / `Demo2026`. Đây là dữ liệu tự tạo (tăng cơ, trình độ trung bình, 4 buổi/tuần), đã tắt đồng ý nghiên cứu.

## B. Kịch bản

| # | Thời gian | Màn hình | Thao tác và lời dẫn |
|---|---|---|---|
| 1 | 1′ | Đăng ký → **Đồng ý dữ liệu** | Tạo nhanh tài khoản mới để cho thấy màn hình đồng ý (2 mục bắt buộc, camera và nghiên cứu là tự chọn). Nhấn mạnh: API cũng chặn nếu chưa đồng ý, không chỉ giao diện. Sau đó đăng xuất, vào tài khoản demo |
| 2 | 1′ | **Tổng quan** | 4 chỉ số tuần này, 5 biểu đồ 8 tuần: tần suất, khối lượng tăng dần, % hoàn thành so với mục tiêu 80%, cân nặng tăng nhẹ (đang tăng cơ), rep Squat. Đổi 4 / 12 tuần; bấm **Bảng** để xem số liệu |
| 3 | 3′ | **Lịch tập → Tạo lại bằng AI** (đóng góp 2) | Trong 15–30 giây chờ, giải thích luồng: hồ sơ → lọc bài theo dụng cụ/chấn thương → JSON Schema riêng → Ollama local → Zod → luật an toàn → thử lại → mẫu chuẩn. Kết quả: thẻ "Vì sao AI đề xuất lịch này", dòng model, phiên bản prompt, thời gian. Sửa thử 1 buổi để cho thấy người dùng vẫn chỉnh được |
| 4 | 1′ | **Hồ sơ** → chấn thương "đau gối" → **Lịch tập → Tạo lại bằng AI** | Lịch mới không còn Squat tạ đòn, Lunge, Leg extension (luật an toàn). Nếu AI vi phạm, mục "Lỗi AI đã mắc" liệt kê lỗi đã bị chặn |
| 5 | 1′ | **Dinh dưỡng → Tạo lại bằng AI** | Calo/macro theo Mifflin–St Jeor, thực đơn món Việt, câu lưu ý y tế. Nói về ngưỡng tối thiểu 1.200/1.500 kcal |
| 6 | 1′ | **AI Coach** | Bấm **Nhận xét tuần này** (hệ thống tự tính số liệu, AI chỉ diễn giải). Hỏi thử câu ngoài phạm vi hoặc câu nguy hiểm ("cho tôi thực đơn 800 kcal") để thấy AI từ chối. Chỉ vào danh sách "Lần gọi AI gần đây" (dữ liệu cho thực nghiệm) |
| 7 | 2′ | **Camera Squat** (đóng góp 1) | Bật camera, đứng nghiêng, Squat 5 rep: số rep, góc gối, trạng thái, FPS. Hạ nửa chừng một lần để cho thấy không bị đếm. Kết thúc → **Lưu kết quả** → quay lại Tổng quan thấy cột Squat mới. Nhấn mạnh: không gửi, không lưu video |
| 8 | 1′ | **Camera → Đánh giá bằng video** | Chạy 2 video có sẵn, nhập số đếm tay → MAE và tỉ lệ đếm đúng → **Tải CSV** |
| 9 | 3′ | Slide / notebook (đóng góp 3 và kết quả) | Benchmark LLM (độ trễ, % JSON hợp lệ, % dùng mẫu chuẩn, kết quả hồ sơ chèn lệnh p23); Random Forest so với baseline (`model_comparison.png`, `feature_importance.png`), nói rõ dữ liệu mô phỏng và hạn chế |

## C. Dự phòng

| Sự cố | Cách xử lý ngay |
|---|---|
| Ollama chậm hoặc không chạy | Vẫn bấm "Tạo lịch bằng AI": hệ thống tự dùng **mẫu chuẩn** và hiện cảnh báo. Đây chính là tính năng fallback, nên trình bày như một phần thiết kế. Có thể chiếu sẵn ảnh chụp một lần chạy thành công |
| Camera không nhận hoặc phòng thiếu sáng | Chuyển sang **Đánh giá bằng video** với video đã quay |
| Không có Internet (MediaPipe chưa lưu sẵn) | Dùng ảnh chụp hoặc video quay màn hình phần Camera đã chuẩn bị trước |
| Dữ liệu demo bị sửa lung tung khi tập dượt | `pnpm db:seed:demo` (khoảng 5 giây) để tạo lại |
| Quên mật khẩu demo | `Demo2026` (README và file này) |

## D. Câu hỏi hội đồng hay gặp (gợi ý trả lời)

- **Vì sao LLM chạy local?** Dữ liệu sức khỏe không rời máy; không tốn phí API; đo được độ trễ trên phần cứng phổ thông (GPU 12 GB). Đổi model chỉ cần sửa biến `OLLAMA_MODEL`.
- **Làm sao đảm bảo AI không đưa lời khuyên nguy hiểm?** Ba lớp: JSON Schema giới hạn ngay khi sinh (chỉ bài được phép, đúng số buổi), Zod và luật an toàn kiểm tra sau, sai thì thử lại rồi dùng mẫu chuẩn. Mọi lần gọi được ghi vào `ai_requests` để đo.
- **Vì sao tắt "thinking" của qwen3?** Đo được: chat tự do bỏ qua `think:false` (khoảng 30 giây); có JSON Schema thì chỉ 1–4 giây mà vẫn đúng tiếng Việt.
- **Độ chính xác đếm rep?** Xem CSV đánh giá (MAE, tỉ lệ đúng). Hạn chế: phải đứng nghiêng, thấy đủ chân; ngưỡng 110°/160° có thể chỉnh trong `config.ts`.
- **Random Forest có tốt hơn không?** Trên dữ liệu mô phỏng: tương đương Logistic/Linear Regression, tốt hơn rõ baseline "giữ nguyên". Kết luận trung thực: cần dữ liệu thật nhiều hơn; pipeline đã sẵn sàng (`pnpm ml:export`).
- **Bảo mật?** Xem [security.md](security.md): bcrypt, JWT hạn ngắn, phân quyền theo user, API bắt buộc đồng ý dữ liệu, rate limit, Zod, log không chứa dữ liệu, Ollama chỉ localhost.
