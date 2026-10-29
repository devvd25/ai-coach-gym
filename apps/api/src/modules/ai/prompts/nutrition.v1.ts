import type { NutritionTargets, Profile } from '@ai-coach/shared';
import { MEAL_SPLIT } from '../templates.js';
import type { LlmMessage } from '../llm.service.js';
import { MIN_KCAL, PROTEIN_RANGE_PER_KG } from '../nutrition-reference.js';
import { DATA_RULE, dataBlock, profileFacts } from './common.js';

export const NUTRITION_PROMPT_VERSION = 'nutrition.v1';

const SYSTEM = `Bạn là chuyên gia dinh dưỡng thể thao, xây dựng mục tiêu calo/macro và thực đơn mẫu một ngày cho người Việt.
Trả lời bằng tiếng Việt, đúng JSON schema được yêu cầu.

Quy tắc bắt buộc:
1. Bắt đầu từ "muc_tieu_tham_chieu" (đã cân bằng: 4×protein + 4×carb + 9×fat = kcal). Có thể điều chỉnh tối đa ±10% cho hợp mục tiêu, nhưng "targets.kcal" không thấp hơn "kcal_toi_thieu".
2. Protein trong khoảng "protein_g_khoang"; chất béo tối thiểu 0,6 g/kg; nếu đổi protein hoặc chất béo thì tính lại carb để 4×protein + 4×carb + 9×fat vẫn bằng kcal.
3. Thực đơn theo đúng các bữa trong "phan_bo_bua": mỗi bữa có kcal và macro xấp xỉ con số gợi ý của bữa đó, để tổng các bữa bằng "targets".
4. Món ăn Việt Nam phổ biến, dễ mua, ghi rõ khẩu phần (gram, chén, quả) trong "dish"; khẩu phần phải đủ lớn để đạt kcal của bữa.
5. Giờ ăn dạng HH:MM.
6. "waterL" theo cân nặng (khoảng 0,035 lít/kg).
7. "explanation": 2–3 câu giải thích cách tính và vì sao phù hợp mục tiêu. Không chẩn đoán bệnh, không đề xuất thuốc hay thực phẩm chức năng.

${DATA_RULE}`;

export function nutritionMessages(profile: Profile, reference: NutritionTargets): LlmMessage[] {
  const facts = {
    ...profileFacts(profile),
    muc_tieu_tham_chieu: reference,
    kcal_toi_thieu: MIN_KCAL[profile.sex],
    protein_g_khoang: [
      Math.round(profile.weightKg * PROTEIN_RANGE_PER_KG[0]),
      Math.round(profile.weightKg * PROTEIN_RANGE_PER_KG[1]),
    ],
    phan_bo_bua: MEAL_SPLIT.map((m) => ({
      name: m.name,
      time: m.time,
      kcal: Math.round(reference.kcal * m.share),
      proteinG: Math.round(reference.proteinG * m.share),
      carbG: Math.round(reference.carbG * m.share),
      fatG: Math.round(reference.fatG * m.share),
    })),
  };
  return [
    { role: 'system', content: SYSTEM },
    {
      role: 'user',
      content: `Hồ sơ và số liệu tham chiếu (Mifflin–St Jeor):\n${dataBlock(facts)}\n\nHãy lập mục tiêu dinh dưỡng và thực đơn mẫu cho một ngày.`,
    },
  ];
}
