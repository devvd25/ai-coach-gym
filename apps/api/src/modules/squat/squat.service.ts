import { squatSessionSchema, type SquatSession, type SquatSessionInput } from '@ai-coach/shared';
import { Op } from 'sequelize';
import { SquatSessionModel } from './squat.model.js';

export interface SquatService {
  create(userId: number, input: SquatSessionInput): Promise<SquatSession>;
  list(userId: number, opts: { from?: Date; limit: number }): Promise<SquatSession[]>;
}

const num = (v: number | null) => (v === null ? null : Number(v));

function toSession(row: SquatSessionModel): SquatSession {
  return squatSessionSchema.parse({
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    durationSec: row.durationSec,
    repCount: row.repCount,
    avgMinKneeAngle: num(row.avgMinKneeAngle),
    model: row.model,
    avgFps: num(row.avgFps),
  });
}

export function createSquatService(): SquatService {
  return {
    async create(userId, input) {
      const row = await SquatSessionModel.create({
        userId,
        startedAt: new Date(input.startedAt),
        durationSec: input.durationSec,
        repCount: input.repCount,
        avgMinKneeAngle:
          input.avgMinKneeAngle === null ? null : Math.round(input.avgMinKneeAngle * 10) / 10,
        model: input.model,
        avgFps: input.avgFps === null ? null : Math.round(input.avgFps * 10) / 10,
      });
      return toSession(row);
    },
    async list(userId, { from, limit }) {
      const rows = await SquatSessionModel.findAll({
        where: { userId, ...(from ? { startedAt: { [Op.gte]: from } } : {}) },
        order: [['startedAt', 'DESC']],
        limit,
      });
      return rows.map(toSession);
    },
  };
}
