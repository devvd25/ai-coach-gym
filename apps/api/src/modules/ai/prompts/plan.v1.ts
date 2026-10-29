import { MUSCLE_LABELS, type Exercise, type Profile } from '@ai-coach/shared';
import type { LlmMessage } from '../llm.service.js';
import { DATA_RULE, dataBlock, profileFacts } from './common.js';

export const PLAN_PROMPT_VERSION = 'plan.v1';

const SYSTEM = `Bạn là huấn luyện viên thể hình có chứng chỉ, lập kế hoạch tập luyện một tuần an toàn và hiệu quả.
Trả lời bằng tiếng Việt, đúng JSON schema được yêu cầu.

Quy tắc bắt buộc:
1. Số buổi đúng bằng "so_buoi_moi_tuan" (chỉ liệt kê buổi tập, không liệt kê ngày nghỉ); mỗi ngày tối đa 1 buổi; nếu có "ngay_uu_tien" thì chỉ xếp vào các ngày đó; các buổi nên cách đều nhau.
2. "day" dùng mã: mon, tue, wed, thu, fri, sat, sun.
3. Chỉ dùng "slug" có trong danh sách bài tập được phép. Không lặp bài trong cùng một buổi.
4. Mỗi buổi 4–7 bài, tổng 6–20 set; mỗi bài 2–5 set. Bài compound (nhiều khớp) đặt trước bài cô lập.
5. "reps" dạng "8", "8-12" hoặc "45s" cho bài giữ thời gian; trong khoảng 3–30 rep hoặc 15–120 giây.
6. "restSeconds" từ 30 đến 240: compound nặng 90–180, cô lập 45–90.
7. "durationMin" bằng "phut_moi_buoi" (lệch tối đa 10 phút).
8. Phân bổ nhóm cơ cân đối trong tuần; người mới ưu tiên toàn thân, ít bài hơn, rep cao hơn.
9. Tránh mọi bài gây áp lực lên vùng chấn thương được mô tả.
10. "summary": 2–4 câu giải thích VÌ SAO kế hoạch phù hợp với mục tiêu, trình độ và hạn chế của người dùng.

${DATA_RULE}`;

export function planMessages(profile: Profile, allowed: readonly Exercise[]): LlmMessage[] {
  const library = allowed.map((e) => ({
    slug: e.slug,
    ten: e.name,
    nhom_co: MUSCLE_LABELS[e.muscleGroup],
    do_kho: e.level,
    goi_y: `${e.defaultSets}x${e.defaultReps}, nghỉ ${e.restSeconds}s`,
  }));
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content:
        `Hồ sơ tập luyện:\n${dataBlock(profileFacts(profile))}\n\n` +
        `Danh sách bài tập được phép (đã lọc theo dụng cụ, trình độ, chấn thương):\n${dataBlock(library)}\n\n` +
        'Hãy lập kế hoạch tập cho một tuần.',
    },
  ];
}
