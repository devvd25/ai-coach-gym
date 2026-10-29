"""Hàm dùng chung cho notebook progress_rf.ipynb: đọc dữ liệu tuần, tạo đặc trưng, chia theo thời gian,
huấn luyện và đánh giá Random Forest so với các baseline.

Bài toán (dự đoán TUẦN SAU từ dữ liệu đến hết tuần này):
  - Phân loại: tuần sau có hoàn thành >= 80% kế hoạch không (on_plan_next).
  - Hồi quy: tổng khối lượng tuần sau (volume_next, kg).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Callable

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, roc_auc_score
from sklearn.model_selection import TimeSeriesSplit
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

DATA_DIR = Path(__file__).parent / "data"
ON_PLAN = 0.8  # same threshold as the dashboard's completion target
SEED = 42

CATEGORICAL = ["goal", "level", "sex"]
NUMERIC = [
    "week_index", "age_group", "sessions_target",
    "completion_rate", "completion_lag1", "completion_ma3", "completion_std3",
    "workouts", "workouts_lag1", "total_sets",
    "volume_kg", "volume_lag1", "volume_ma3", "volume_change",
    "avg_rpe", "rpe_lag1", "weight_change_2w", "squat_reps",
]


def load_weeks(include_real: bool = True) -> pd.DataFrame:
    """Synthetic weeks, plus the exported app data when ml/data/real_weeks.csv exists."""
    frames = [pd.read_csv(DATA_DIR / "synthetic_weeks.csv")]
    real = DATA_DIR / "real_weeks.csv"
    if include_real and real.exists():
        frames.append(pd.read_csv(real))
    df = pd.concat(frames, ignore_index=True)
    df["week_start"] = pd.to_datetime(df["week_start"])
    for c in ["completion_rate", "avg_rpe", "weight_kg"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    return df.sort_values(["user_id", "week_start"]).reset_index(drop=True)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Per user, only past and current weeks feed the features; targets come from the next week."""
    g = df.groupby("user_id", group_keys=False)
    out = df.copy()
    out["completion_lag1"] = g["completion_rate"].shift(1)
    out["completion_ma3"] = g["completion_rate"].transform(lambda s: s.rolling(3, min_periods=1).mean())
    out["completion_std3"] = g["completion_rate"].transform(lambda s: s.rolling(3, min_periods=2).std())
    out["workouts_lag1"] = g["workouts"].shift(1)
    out["volume_lag1"] = g["volume_kg"].shift(1)
    out["volume_ma3"] = g["volume_kg"].transform(lambda s: s.rolling(3, min_periods=1).mean())
    out["volume_change"] = (out["volume_kg"] - out["volume_lag1"]) / out["volume_lag1"].replace(0, np.nan)
    out["rpe_lag1"] = g["avg_rpe"].shift(1)
    out["weight_change_2w"] = out["weight_kg"] - g["weight_kg"].shift(2)

    nxt = g["completion_rate"].shift(-1)
    out["on_plan_next"] = (nxt >= ON_PLAN).astype(float).where(nxt.notna())
    out["volume_next"] = g["volume_kg"].shift(-1)
    # The first week has no history; the last week has no "next week" to predict.
    out = out[(out["week_index"] >= 1) & out["volume_next"].notna()]
    return out.reset_index(drop=True)


def design_matrix(feat: pd.DataFrame) -> pd.DataFrame:
    """Numeric features (missing values kept; each model imputes from its own training fold) plus
    one-hot categoricals."""
    x = feat[NUMERIC].astype(float)
    dummies = pd.get_dummies(feat[CATEGORICAL], prefix=CATEGORICAL, dtype=float)
    return pd.concat([x, dummies], axis=1)


def time_splits(feat: pd.DataFrame, n_splits: int = 5):
    """TimeSeriesSplit over calendar weeks: every test fold is strictly later than its training
    data, and one week is never split between train and test (no look-ahead leakage)."""
    weeks = np.sort(feat["week_start"].unique())
    for train_w, test_w in TimeSeriesSplit(n_splits=n_splits).split(weeks):
        train = feat.index[feat["week_start"].isin(weeks[train_w])].to_numpy()
        test = feat.index[feat["week_start"].isin(weeks[test_w])].to_numpy()
        yield train, test


@dataclass
class Model:
    name: str
    kind: str  # "baseline" or "ml"
    fit_predict: Callable[[pd.DataFrame, pd.Series, pd.DataFrame, pd.DataFrame], tuple[np.ndarray, np.ndarray | None]]


def forest_classifier() -> RandomForestClassifier:
    return RandomForestClassifier(
        n_estimators=300, min_samples_leaf=5, class_weight="balanced", random_state=SEED, n_jobs=-1
    )


def forest_regressor() -> RandomForestRegressor:
    return RandomForestRegressor(n_estimators=300, min_samples_leaf=5, random_state=SEED, n_jobs=-1)


def classification_models() -> list[Model]:
    def ma3(_x, _y, xt, ft):
        p = ft["completion_ma3"].fillna(0).to_numpy()
        return (p >= ON_PLAN).astype(int), p

    def last(_x, _y, xt, ft):
        p = ft["completion_rate"].fillna(0).to_numpy()
        return (p >= ON_PLAN).astype(int), p

    def logistic(x, y, xt, _ft):
        m = make_pipeline(
            SimpleImputer(strategy="median"),
            StandardScaler(),
            LogisticRegression(max_iter=2000, class_weight="balanced"),
        )
        m.fit(x, y)
        return m.predict(xt), m.predict_proba(xt)[:, 1]

    def forest(x, y, xt, _ft):
        m = make_pipeline(SimpleImputer(strategy="median"), forest_classifier())
        m.fit(x, y)
        return m.predict(xt), m.predict_proba(xt)[:, 1]

    return [
        Model("Tuần này ≥ 80%", "baseline", last),
        Model("Trung bình 3 tuần ≥ 80%", "baseline", ma3),
        Model("Logistic Regression", "ml", logistic),
        Model("Random Forest", "ml", forest),
    ]


def regression_models() -> list[Model]:
    def last(_x, _y, _xt, ft):
        return ft["volume_kg"].to_numpy(), None

    def ma3(_x, _y, _xt, ft):
        return ft["volume_ma3"].to_numpy(), None

    def linear(x, y, xt, _ft):
        m = make_pipeline(SimpleImputer(strategy="median"), StandardScaler(), LinearRegression())
        m.fit(x, y)
        return m.predict(xt), None

    def forest(x, y, xt, _ft):
        m = make_pipeline(SimpleImputer(strategy="median"), forest_regressor())
        m.fit(x, y)
        return m.predict(xt), None

    return [
        Model("Giữ nguyên tuần này", "baseline", last),
        Model("Trung bình 3 tuần", "baseline", ma3),
        Model("Linear Regression", "ml", linear),
        Model("Random Forest", "ml", forest),
    ]


def evaluate(feat: pd.DataFrame, task: str, n_splits: int = 5) -> pd.DataFrame:
    """One row per (model, fold) with the metrics of that fold."""
    target = "on_plan_next" if task == "classification" else "volume_next"
    data = feat[feat[target].notna()].reset_index(drop=True)
    x_all = design_matrix(data)
    y_all = data[target]
    models = classification_models() if task == "classification" else regression_models()
    rows = []
    for fold, (tr, te) in enumerate(time_splits(data, n_splits), start=1):
        for m in models:
            pred, score = m.fit_predict(x_all.iloc[tr], y_all.iloc[tr], x_all.iloc[te], data.iloc[te])
            y = y_all.iloc[te].to_numpy()
            row = {"model": m.name, "kind": m.kind, "fold": fold, "n_test": len(te)}
            if task == "classification":
                row["f1"] = f1_score(y, pred, zero_division=0)
                row["accuracy"] = accuracy_score(y, pred)
                row["roc_auc"] = roc_auc_score(y, score) if score is not None and len(set(y)) > 1 else np.nan
            else:
                row["mae"] = mean_absolute_error(y, pred)
                row["mae_pct_of_mean"] = 100 * row["mae"] / max(np.mean(y), 1e-9)
            rows.append(row)
    return pd.DataFrame(rows)


def summarize(results: pd.DataFrame, metrics: list[str]) -> pd.DataFrame:
    """Mean ± std over folds, keeping the model order."""
    order = list(dict.fromkeys(results["model"]))
    agg = results.groupby("model")[metrics].agg(["mean", "std"]).reindex(order)
    return agg.round(3)


def fit_full_forest(feat: pd.DataFrame, task: str):
    """Forest pipeline trained on the first 80% of weeks; returns it with the held-out last 20%."""
    target = "on_plan_next" if task == "classification" else "volume_next"
    data = feat[feat[target].notna()].reset_index(drop=True)
    x = design_matrix(data)
    weeks = np.sort(data["week_start"].unique())
    cut = weeks[int(len(weeks) * 0.8)]
    train, test = data["week_start"] < cut, data["week_start"] >= cut
    forest = forest_classifier() if task == "classification" else forest_regressor()
    m = make_pipeline(SimpleImputer(strategy="median"), forest)
    m.fit(x[train], data.loc[train, target])
    return m, x[test], data.loc[test, target]
