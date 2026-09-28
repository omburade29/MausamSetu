import numpy as np

from app.ml.baseline import bias_correct, block_baseline, quantile_map
from app.ml.features import chronological_split, impute_numeric, rolling_origin_splits
from app.ml.metrics import improvement_percent, improvement_statement, regression_metrics
from app.ml.uncertainty import confidence_score, conformal_quantile, prediction_interval
import pandas as pd


def test_block_baseline_copies_values():
    values = np.array([1.0, 2.0, 3.0])
    assert np.array_equal(block_baseline(values), values)


def test_bias_correction_and_quantile_mapping():
    corrected = bias_correct([10, 10], [1.5, np.nan])
    assert corrected[0] == 11.5
    assert corrected[1] == 10
    mapped = quantile_map([5, 15], np.arange(40), np.arange(40) + 2, min_samples=30)
    assert mapped is not None
    assert mapped[0] > 5
    assert quantile_map([1], [1, 2], [1, 2], min_samples=30) is None


def test_metrics_and_improvement_statement():
    stats = regression_metrics([1, 2, 3, 4], [1, 2, 3, 5])
    assert stats["mae"] == 0.25
    assert improvement_percent(10, 7) == 30
    better = improvement_statement("rainfall_mm", 10, 7)
    assert better.startswith("Downscaling improved rainfall mm RMSE by")
    worse = improvement_statement("rainfall_mm", 7, 10)
    assert worse.startswith("Downscaling did not improve the baseline")


def test_chronological_split_keeps_future_out_of_training():
    dates = pd.date_range("2026-01-01", periods=20, freq="D")
    train, val, test = chronological_split(dates)
    assert max(train) < min(val) <= max(val) < min(test)
    folds = list(rolling_origin_splits(dates, n_splits=3, min_train=8))
    assert folds
    assert max(folds[0][0]) < min(folds[0][1])


def test_imputation_logs_and_does_not_drop_rows():
    frame = pd.DataFrame({"elevation_m": [1.0, None, 3.0]})
    output, medians, notes = impute_numeric(frame, ["elevation_m"])
    assert len(output) == 3
    assert notes[0]["imputed"] == 1
    assert output["elevation_m"].isna().sum() == 0
    assert medians["elevation_m"] == 2


def test_uncertainty_bounds_and_confidence_drop():
    lower, upper = prediction_interval(10, 2, ood=0)
    assert lower < 10 < upper
    qhat = conformal_quantile([1, -1, 0.5, -0.2, 0.3])
    assert qhat > 0
    high = confidence_score(
        interval_width=2, typical_width=4, missing_count=0, ood=0, history_days=180, lead_time_hours=24, max_lead_trained=120
    )
    low = confidence_score(
        interval_width=30, typical_width=4, missing_count=7, ood=2.4, history_days=3, lead_time_hours=240, max_lead_trained=120
    )
    assert 0.05 <= low < high <= 0.97
