"""
Scanova ML Service - Model Inference and Risk Scoring Module
Provides deterministic anomaly scoring and normalized risk assessment
for order transactions.
"""

from pathlib import Path
from typing import Any, Dict, Optional, Tuple, Union
import joblib
import numpy as np
import pandas as pd

from train_model import MODEL_FEATURES, MODEL_FILE_PATH, train_isolation_forest

_cached_artifact: Optional[Dict[str, Any]] = None


def load_model_artifact() -> Dict[str, Any]:
    """Loads and caches the model pipeline artifact from disk."""
    global _cached_artifact
    if _cached_artifact is not None:
        return _cached_artifact

    if not MODEL_FILE_PATH.exists():
        train_isolation_forest()

    if MODEL_FILE_PATH.exists():
        _cached_artifact = joblib.load(MODEL_FILE_PATH)
    else:
        _cached_artifact = {"pipeline": None, "metadata": {"status": "uninitialized"}}

    return _cached_artifact


def _safe_float(val: Any, default: float = 0.0) -> float:
    """Safely converts any value to a finite float, returning default if None, NaN, or Inf."""
    if val is None:
        return default
    try:
        f = float(val)
        if np.isnan(f) or np.isinf(f):
            return default
        return f
    except (ValueError, TypeError):
        return default


def compute_heuristic_baseline_risk(features: Dict[str, Any]) -> Tuple[float, float]:
    """
    Deterministic baseline risk evaluator used when insufficient real transactions
    exist in the live database to fit a statistical Isolation Forest model.
    """
    risk = 0.15

    total_value = _safe_float(features.get("total_order_value"), 0.0)
    payment_discrepancy = _safe_float(features.get("payment_discrepancy"), 0.0)
    is_payment_completed = _safe_float(features.get("is_payment_completed"), 1.0)
    mismatch_detected = _safe_float(features.get("mismatch_detected"), 0.0)
    failed_scan_ratio = _safe_float(features.get("failed_scan_ratio"), 0.0)
    max_qty = _safe_float(features.get("max_item_quantity"), 1.0)

    if is_payment_completed < 1.0:
        risk += 0.40
    if payment_discrepancy > 10.0:
        risk += 0.30
    if mismatch_detected >= 1.0:
        risk += 0.40
    if failed_scan_ratio > 0.40:
        risk += 0.20
    if max_qty > 20.0:
        risk += 0.15

    normalized_risk = float(np.clip(risk, 0.0, 1.0))
    raw_anomaly_score = float((0.5 - normalized_risk) * 0.5)
    return raw_anomaly_score, normalized_risk


def score_to_risk_level(risk_score: float) -> str:
    """
    Deterministic mapping from continuous risk score [0, 1] to discrete tiers:
    - [0.00, 0.40): low
    - [0.40, 0.70): medium
    - [0.70, 1.00]: high
    """
    clean_score = _safe_float(risk_score, 0.15)
    if clean_score < 0.40:
        return "low"
    elif clean_score < 0.70:
        return "medium"
    else:
        return "high"


def predict_fraud_risk(
    feature_record: Union[Dict[str, Any], pd.Series, pd.DataFrame],
) -> Dict[str, Any]:
    """
    Evaluates an order feature vector and returns non-sensitive anomaly metrics:
    - anomaly_score: Raw Isolation Forest decision function value (or heuristic equivalent)
    - risk_score: Normalized risk index between 0.0 (safest) and 1.0 (highest anomaly)
    - risk_level: 'low', 'medium', or 'high'
    - is_anomaly: Boolean flag indicating if anomaly threshold is exceeded
    """
    artifact = load_model_artifact()
    pipeline = artifact.get("pipeline")

    if isinstance(feature_record, pd.DataFrame):
        record_dict = feature_record.iloc[0].to_dict()
    elif isinstance(feature_record, pd.Series):
        record_dict = feature_record.to_dict()
    else:
        record_dict = dict(feature_record)

    if pipeline is not None:
        row_values = [_safe_float(record_dict.get(col), 0.0) for col in MODEL_FEATURES]
        X = pd.DataFrame([row_values], columns=MODEL_FEATURES)

        try:
            imputed_X = pipeline.named_steps["imputer"].transform(X)
            imputed_X = np.nan_to_num(imputed_X, nan=0.0, posinf=0.0, neginf=0.0)
            raw_score = float(pipeline.named_steps["model"].decision_function(imputed_X)[0])

            if np.isnan(raw_score) or np.isinf(raw_score):
                raw_score, risk_score = compute_heuristic_baseline_risk(record_dict)
                is_anomaly = bool(risk_score >= 0.70)
                engine_status = "heuristic_baseline_fallback"
            else:
                risk_score = float(np.clip(0.5 - (raw_score / 0.5), 0.0, 1.0))
                is_anomaly = bool(raw_score < 0.0)
                engine_status = "trained_isolation_forest"
        except Exception:
            raw_score, risk_score = compute_heuristic_baseline_risk(record_dict)
            is_anomaly = bool(risk_score >= 0.70)
            engine_status = "heuristic_baseline_fallback"
    else:
        raw_score, risk_score = compute_heuristic_baseline_risk(record_dict)
        is_anomaly = bool(risk_score >= 0.70)
        engine_status = "heuristic_baseline_pending_real_data"

    clean_raw_score = _safe_float(raw_score, 0.175)
    clean_risk_score = _safe_float(risk_score, 0.15)
    clean_risk_score = float(np.clip(clean_risk_score, 0.0, 1.0))
    risk_level = score_to_risk_level(clean_risk_score)

    return {
        "anomaly_score": round(clean_raw_score, 4),
        "risk_score": round(clean_risk_score, 4),
        "risk_level": str(risk_level),
        "is_anomaly": bool(is_anomaly),
        "model_status": engine_status,
        "evaluated_features_count": len(MODEL_FEATURES),
    }
