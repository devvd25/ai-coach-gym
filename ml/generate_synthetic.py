"""Sinh dữ liệu tập luyện MÔ PHỎNG theo tuần (cột is_synthetic = 1).

Cùng định dạng với file xuất từ ứng dụng (pnpm ml:export -> ml/data/real_weeks.csv), để notebook
progress_rf.ipynb đọc chung. Dữ liệu này chỉ dùng để phát triển và kiểm thử pipeline khi chưa đủ
dữ liệu thật; mọi kết luận khoa học phải ghi rõ là trên dữ liệu mô phỏng.

Các quy luật được cài vào (để mô hình có thứ để học, và để biết "đáp án đúng"):
  - Mỗi người có mức tuân thủ nền (trình độ cao hơn thì nền cao hơn) + dao động AR(1) theo tuần.
  - Tuần bận ngẫu nhiên (~8%) làm giảm mạnh số buổi hoàn thành.
  - Mệt mỏi: RPE trung bình >= 8.5 và khối lượng tăng > 15% so với tuần trước -> tuần sau dễ bỏ buổi.
  - Đặt mục tiêu quá nhiều buổi (5-6 buổi với người mới) -> tuân thủ thấp hơn.
  - Khối lượng tăng dần khi tập đều (progressive overload), giảm khi nghỉ nhiều.
  - Cân nặng đi theo mục tiêu nhân với mức tuân thủ, cộng nhiễu.

Chạy:  python ml/generate_synthetic.py --users 300 --seed 42
"""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np

COLUMNS = [
    "user_id", "week_start", "week_index", "sex", "age_group", "goal", "level",
    "sessions_target", "planned_sessions", "completed_sessions", "completion_rate", "workouts",
    "total_sets", "volume_kg", "avg_rpe", "weight_kg", "squat_reps", "is_synthetic",
]

LEVELS = ["beginner", "intermediate", "advanced"]
GOALS = ["fat_loss", "muscle_gain", "maintain"]
# Weekly weight change (kg) at full adherence.
GOAL_TREND = {"fat_loss": -0.35, "muscle_gain": 0.18, "maintain": 0.0}
LEVEL_ADHERENCE = {"beginner": 0.62, "intermediate": 0.74, "advanced": 0.84}
LEVEL_VOLUME = {"beginner": 700.0, "intermediate": 1400.0, "advanced": 2300.0}  # kg per session

# Fixed calendar so TimeSeriesSplit sees real time order: everyone starts within 16 weeks, and
# the last simulated week (16 + 30) is still before the app's first real data (Oct 2026).
FIRST_MONDAY = date(2025, 11, 3)


def simulate_user(uid: int, weeks: int, rng: np.random.Generator) -> list[dict]:
    level = str(rng.choice(LEVELS, p=[0.45, 0.4, 0.15]))
    goal = str(rng.choice(GOALS, p=[0.45, 0.35, 0.2]))
    sex = str(rng.choice(["male", "female"], p=[0.6, 0.4]))
    age = int(rng.integers(16, 61))
    target = int(rng.choice([2, 3, 4, 5, 6], p=[0.1, 0.35, 0.3, 0.15, 0.1]))
    height = rng.normal(170 if sex == "male" else 158, 6) / 100
    weight = float(np.clip(rng.normal(23.5, 3.5) * height**2, 40, 130))
    uses_camera = rng.random() < 0.4

    base = np.clip(rng.normal(LEVEL_ADHERENCE[level], 0.1), 0.2, 0.98)
    if level == "beginner" and target >= 5:
        base -= 0.15  # too ambitious a plan
    vol_per_session = LEVEL_VOLUME[level] * rng.uniform(0.7, 1.3) * (0.75 if sex == "female" else 1)
    vol_ceiling = 2.5 * vol_per_session  # strength gains level off
    motivation = 0.0
    volumes: list[float] = []
    last_rpe: float | None = None
    start = FIRST_MONDAY + timedelta(weeks=int(rng.integers(0, 16)))
    rows = []

    for i in range(weeks):
        motivation = 0.7 * motivation + rng.normal(0, 0.08)
        p = base + motivation
        busy = rng.random() < 0.08
        if busy:
            p -= 0.45
        fatigued = (
            last_rpe is not None and last_rpe >= 8.5
            and len(volumes) >= 2 and volumes[-1] > 1.15 * volumes[-2]
        )
        if fatigued:
            p -= 0.3
        p = float(np.clip(p, 0.02, 0.99))

        completed = int(rng.binomial(target, p))
        extra = int(rng.random() < 0.08)
        workouts = completed + extra

        # Progressive overload: +2–4% per session load after a good week, -5% after a poor one.
        rate = completed / target
        vol_per_session *= 1 + (rng.uniform(0.02, 0.04) if rate >= 0.8 else -0.05 if rate < 0.5 else 0.005)
        vol_per_session = min(vol_per_session, vol_ceiling)
        volume = max(0.0, workouts * vol_per_session * rng.normal(1, 0.08))
        sets = int(round(workouts * rng.normal(16, 2))) if workouts else 0
        # Harder (higher RPE) when this week's volume jumped above last week's.
        jumped = bool(volumes) and volume > 1.1 * volumes[-1] > 0
        rpe = float(np.clip(rng.normal(7.0 + 1.0 * jumped, 0.8), 5, 10)) if workouts else None
        weight += GOAL_TREND[goal] * rate + rng.normal(0, 0.25)
        squat = int(max(0, rng.normal(14 * completed, 5))) if uses_camera and completed else 0

        rows.append({
            "user_id": f"s_{uid:04d}",
            "week_start": (start + timedelta(weeks=i)).isoformat(),
            "week_index": i,
            "sex": sex,
            "age_group": age // 5 * 5,
            "goal": goal,
            "level": level,
            "sessions_target": target,
            "planned_sessions": target,
            "completed_sessions": completed,
            "completion_rate": round(rate, 3),
            "workouts": workouts,
            "total_sets": sets,
            "volume_kg": round(volume, 1),
            "avg_rpe": "" if rpe is None else round(rpe, 2),
            "weight_kg": round(weight, 1),
            "squat_reps": squat,
            "is_synthetic": 1,
        })
        volumes.append(volume)
        last_rpe = rpe
    return rows


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")  # Windows consoles default to a legacy code page
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--users", type=int, default=300)
    ap.add_argument("--min-weeks", type=int, default=10)
    ap.add_argument("--max-weeks", type=int, default=30)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", type=Path, default=Path(__file__).parent / "data" / "synthetic_weeks.csv")
    args = ap.parse_args()

    rng = np.random.default_rng(args.seed)
    rows = []
    for uid in range(args.users):
        rows += simulate_user(uid, int(rng.integers(args.min_weeks, args.max_weeks + 1)), rng)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows)
    print(f"Đã sinh {len(rows)} dòng (user-tuần) cho {args.users} người dùng mô phỏng -> {args.out}")


if __name__ == "__main__":
    main()
