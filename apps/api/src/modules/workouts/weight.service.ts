import { weightEntrySchema, type WeightEntry } from '@ai-coach/shared';
import { Op } from 'sequelize';
import { AppError } from '../../lib/http.js';
import { WeightLogModel } from './workout.model.js';

export interface WeightService {
  list(userId: number, sinceDate: string): Promise<WeightEntry[]>;
  upsert(userId: number, date: string, weightKg: number, note: string): Promise<WeightEntry>;
  remove(userId: number, date: string): Promise<void>;
}

const toEntry = (row: WeightLogModel): WeightEntry =>
  weightEntrySchema.parse({ date: row.date, weightKg: Number(row.weightKg), note: row.note });

/** One measurement per user per day; saving the same day again replaces it. */
export function createWeightService(): WeightService {
  return {
    async list(userId, sinceDate) {
      const rows = await WeightLogModel.findAll({
        where: { userId, date: { [Op.gte]: sinceDate } },
        order: [['date', 'ASC']],
      });
      return rows.map(toEntry);
    },
    async upsert(userId, date, weightKg, note) {
      const existing = await WeightLogModel.findOne({ where: { userId, date } });
      const row = existing
        ? await existing.update({ weightKg, note })
        : await WeightLogModel.create({ userId, date, weightKg, note });
      return toEntry(row);
    },
    async remove(userId, date) {
      const n = await WeightLogModel.destroy({ where: { userId, date } });
      if (n === 0) throw new AppError(404, 'NOT_FOUND', 'Không có số đo cân nặng ngày này');
    },
  };
}
