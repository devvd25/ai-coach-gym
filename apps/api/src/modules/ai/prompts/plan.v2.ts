import { MUSCLE_LABELS, type Exercise, type Profile } from '@ai-coach/shared';
import type { LlmMessage } from '../llm.service.js';
import { DATA_RULE, dataBlock, profileFacts } from './common.js';

/**
 * plan.v2 (29/10/2026). Changes from plan.v1, driven by the 30-profile benchmark:
 *  - the JSON Schema now fixes the session title (list of names) and the reps format, so the
 *    prompt explains both instead of only asking for them;
 *  - rule 1 says explicitly that rest days are simply left out.
 * plan.v1 stays unchanged so both versions can be benchmarked side by side.
 */
export const PLAN_V2_PROMPT_VERSION = 'plan.v2';

const SYSTEM = `Bạn là huấn luyện viên thể hình có chứng chỉ, lập kế hoạch tập luyện một tuần an toàn và hiệu quả.
Trả lời bằng tiếng Việt, đúng JSON schema được yêu cầu.

Quy tắc bắt buộc:
1. Mảng "sessions" chỉ chứa BUỔI TẬP, đúng bằng "so_buoi_moi_tuan" phần tử. Ngày nghỉ KHÔNG được đưa vào mảng (bỏ trống ngày đó). Mỗi ngày tối đa 1 buổi; nếu có "ngay_uu_tien" thì chỉ xếp vào các ngày đó; các buổi nên cách đều nhau.
2. "day" dùng mã: mon, tue, wed, thu, fri, sat, sun.
3. "title" chọn một tên trong danh sách cho sẵn của schema, khớp với nhóm cơ chính của buổi (ví dụ buổi ngực–vai–tay sau là "Đẩy (ngực, vai, tay sau)").
4. Chỉ dùng "slug" có trong danh sách bài tập được phép. Không lặp bài trong cùng một buổi.
5. Mỗi buổi 4–7 bài, tổng 6–20 set; mỗi bài 2–5 set. Bài compound (nhiều khớp) đặt trước bài cô lập.
6. "reps" CHỈ gồm chữ số: một số ("8"), một khoảng ("8-12"), hoặc số giây kèm chữ s cho bài giữ thời gian ("45s"). Không viết "x", "rep" hay chữ khác. Trong khoảng 3–30 rep hoặc 15–120 giây.
7. "restSeconds" từ 30 đến 240: compound nặng 90–180, cô lập 45–90.
8. "durationMin" bằng "phut_moi_buoi" (lệch tối đa 10 phút).
9. Phân bổ nhóm cơ cân đối trong tuần; người mới ưu tiên toàn thân, ít bài hơn, rep cao hơn.
10. Tránh mọi bài gây áp lực lên vùng chấn thương được mô tả.
11. "summary": 2–4 câu giải thích VÌ SAO kế hoạch phù hợp với mục tiêu, trình độ và hạn chế của người dùng.

${DATA_RULE}`;

export function planMessagesV2(profile: Profile, allowed: readonly Exercise[]): LlmMessage[] {
  const library = allowed.map((e) => ({
    slug: e.slug,
    ten: e.name,
    nhom_co: MUSCLE_LABELS[e.muscleGroup],
    do_kho: e.level,
    goi_y: `${e.defaultSets} set, ${e.defaultReps}, nghỉ ${e.restSeconds}s`,
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
