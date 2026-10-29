/**
 * Ground-truth rep counts from a CSV, so evaluation videos do not need typing counts by hand.
 *
 * Accepted formats:
 *  - RepCount CSV (TransRAC, CVPR 2022): `type, name, count, L1, L2, …` (L = cycle start/end frames)
 *  - Simple CSV: `video` or `name`, plus `ground_truth_reps` or `count` (e.g. a CSV exported here)
 *  - JSON Lines: `{"video", "count", "action_type"}` per line (Hugging Face RepCount labels)
 */

/** Spelling variants found in public label files ("squant" in EveryShotCounts) map to one class. */
export function isSquat(type: string | null): boolean {
  return type !== null && /^squ?a?n?t$|squat/.test(type);
}

export interface VideoLabel {
  count: number;
  /** Action class when the file has one (RepCount: "squat", "pull_up", …). */
  type: string | null;
}

export interface LabelSet {
  byVideo: Map<string, VideoLabel>;
  types: string[];
}

/** Splits one CSV line, honouring "quoted, cells" and "" escapes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** "folder/Squat_01.MP4" → "squat_01": labels and files are matched without path or extension. */
export function videoKey(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? name;
  return base
    .replace(/\.[a-z0-9]+$/i, '')
    .trim()
    .toLowerCase();
}

/**
 * JSON Lines as published on Hugging Face for RepCount videos (lmms-lab-eval/repcount, counts from
 * EveryShotCounts): `{"video": "stu8_42.mp4", "count": 6, "action_type": "push_up", …}` per line.
 */
function parseJsonLines(lines: readonly string[]): LabelSet {
  const byVideo = new Map<string, VideoLabel>();
  const types = new Set<string>();
  for (const line of lines) {
    const row = JSON.parse(line) as Record<string, unknown>;
    const name = row.video ?? row.name ?? row.video_id;
    const count = Number(row.count);
    if (typeof name !== 'string' || !Number.isFinite(count)) continue;
    const raw = row.action_type ?? row.type;
    const type = typeof raw === 'string' && raw.trim() ? raw.trim().toLowerCase() : null;
    if (type) types.add(type);
    byVideo.set(videoKey(name), { count: Math.round(count), type });
  }
  return { byVideo, types: [...types].sort() };
}

export function parseLabels(text: string): LabelSet {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '');
  if (lines[0]?.trimStart().startsWith('{')) return parseJsonLines(lines);
  const header = splitCsvLine(lines[0] ?? '').map((h) => h.trim().toLowerCase());
  const nameCol = header.findIndex((h) => h === 'name' || h === 'video');
  const countCol = header.findIndex((h) => h === 'count' || h === 'ground_truth_reps');
  const typeCol = header.indexOf('type');
  if (nameCol < 0 || countCol < 0) {
    throw new Error(
      'File nhãn cần cột "name" (hoặc "video") và "count" (hoặc "ground_truth_reps")',
    );
  }
  const byVideo = new Map<string, VideoLabel>();
  const types = new Set<string>();
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const name = cells[nameCol]?.trim();
    const count = Number.parseFloat(cells[countCol] ?? '');
    if (!name || !Number.isFinite(count)) continue;
    const type = typeCol >= 0 ? cells[typeCol]?.trim().toLowerCase() || null : null;
    if (type) types.add(type);
    byVideo.set(videoKey(name), { count: Math.round(count), type });
  }
  return { byVideo, types: [...types].sort() };
}

/** Merges several label files (RepCount ships train/valid/test separately). */
export function mergeLabels(sets: readonly LabelSet[]): LabelSet {
  const byVideo = new Map<string, VideoLabel>();
  const types = new Set<string>();
  for (const s of sets) {
    for (const [k, v] of s.byVideo) byVideo.set(k, v);
    for (const t of s.types) types.add(t);
  }
  return { byVideo, types: [...types].sort() };
}
