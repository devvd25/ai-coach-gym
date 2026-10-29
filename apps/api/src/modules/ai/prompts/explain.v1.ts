import type { Profile, WeekStats } from '@ai-coach/shared';
import type { LlmMessage } from '../llm.service.js';
import { DATA_RULE, dataBlock, profileFacts } from './common.js';

export const EXPLAIN_PROMPT_VERSION = 'explain.v1';

const SYSTEM = `Bạn là huấn luyện viên thể hình, nhận xét tiến độ một tuần tập của học viên.
Trả lời bằng tiếng Việt, đúng JSON schema được yêu cầu, giọng khích lệ nhưng trung thực.

Quy tắc bắt buộc:
1. Chỉ dựa vào số liệu được cung cấp; không bịa thêm số liệu. Nếu tuần chưa có dữ liệu, nói rõ điều đó.
2. "verdict": 2–3 câu đánh giá chung, nhắc tỉ lệ hoàn thành và xu hướng so với tuần trước.
3. "highlights": 1–4 ý ngắn về điểm tốt hoặc điểm cần chú ý (khối lượng, RPE, cân nặng).
4. "nextSteps": 1–3 việc cụ thể nên làm tuần tới, phù hợp mục tiêu và trình độ.
5. Nếu RPE trung bình từ 9 trở lên hoặc người dùng có chấn thương, nhắc nghỉ ngơi/giảm tải. Không chẩn đoán bệnh.

${DATA_RULE}`;

export function explainMessages(profile: Profile, stats: WeekStats): LlmMessage[] {
  const facts = {
    tuan_bat_dau: stats.weekStart,
    buoi_ke_hoach: stats.plannedSessions,
    buoi_hoan_thanh: stats.completedSessions,
    ti_le_hoan_thanh_phan_tram: stats.completionPct,
    so_buoi_da_ghi: stats.workouts,
    tong_set: stats.totalSets,
    tong_khoi_luong_kg: stats.volumeKg,
    rpe_trung_binh: stats.avgRpe,
    khoi_luong_tuan_truoc_kg: stats.previousVolumeKg,
    so_buoi_tuan_truoc: stats.previousWorkouts,
    can_nang_dau_tuan_kg: stats.weightStartKg,
    can_nang_cuoi_tuan_kg: stats.weightEndKg,
  };
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content:
        `Hồ sơ:\n${dataBlock(profileFacts(profile))}\n\n` +
        `Số liệu tuần (do hệ thống tính):\n${dataBlock(facts)}\n\nHãy nhận xét tiến độ tuần này.`,
    },
  ];
}
