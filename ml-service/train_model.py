"""
Scanova ML Service - Model Training Module
Trains an unsupervised Isolation Forest anomaly detection model using real
features prepared by the feature engineering layer.
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

from feature_engineering import prepare_live_feature_dataset

# Directories
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)
MODEL_FILE_PATH = MODELS_DIR / "fraud_detector.joblib"

# Model Features specification
MODEL_FEATURES: List[str] = [
    "subtotal",
    "gst",
    "total_order_value",
    "item_count",
    "total_quantity",
    "average_item_price",
    "max_item_quantity",
    "payment_amount",
    "payment_to_order_ratio",
    "payment_discrepancy",
    "is_payment_completed",
    "payment_method_card",
    "payment_method_upi",
    "payment_method_cash",
    "scan_count",
    "manual_scan_ratio",
    "failed_scan_ratio",
    "scan_velocity",
    "qr_scan_count",
    "time_to_exit_seconds",
    "billed_item_count",
    "verified_item_count",
    "quantity_difference",
    "mismatch_detected",
    "unbilled_item_count",
    "missing_item_count",
    "excess_item_count",
    "account_age_days",
    "previous_order_count",
    "previous_total_spent",
]

# Minimum real records threshold required to reliably fit IsolationForest
MIN_TRAINING_RECORDS = 5


def train_isolation_forest(
    df: Optional[pd.DataFrame] = None,
    n_estimators: int = 100,
    contamination: float = 0.05,
    random_state: int = 42,
    max_samples: Any = "auto",
) -> Dict[str, Any]:
    """
    Trains an Isolation Forest anomaly detection model on real transaction features.
    """
    if df is None:
        print("Fetching real transaction data from Supabase for feature engineering...")
        df = prepare_live_feature_dataset()

    available_records = len(df)
    print(f"Available real transaction records for training: {available_records}")

    if available_records < MIN_TRAINING_RECORDS:
        report = {
            "status": "insufficient_data",
            "model_trained": False,
            "real_records_found": available_records,
            "min_records_required": MIN_TRAINING_RECORDS,
            "message": (
                f"Insufficient real transaction data in database ({available_records} records found; "
                f"minimum {MIN_TRAINING_RECORDS} required). No fake data was generated. "
                "The training pipeline is configured and ready to train once real transactions exist."
            ),
            "features_count": len(MODEL_FEATURES),
            "feature_names": MODEL_FEATURES,
            "timestamp": datetime.utcnow().isoformat(),
        }
        joblib.dump({"pipeline": None, "metadata": report}, MODEL_FILE_PATH)
        return report

    X = df[MODEL_FEATURES].copy()

    # Configure imputer with median strategy, fill_value=0.0, and keep_empty_features=True
    imputer = SimpleImputer(strategy="median", fill_value=0.0, keep_empty_features=True)
    imputer.fit(X)

    # Sanitize any unobserved feature statistics to 0.0
    if hasattr(imputer, "statistics_") and imputer.statistics_ is not None:
        imputer.statistics_ = np.nan_to_num(imputer.statistics_, nan=0.0, posinf=0.0, neginf=0.0)

    model = IsolationForest(
        n_estimators=n_estimators,
        contamination=contamination,
        random_state=random_state,
        max_samples=max_samples,
    )

    imputed_X = np.nan_to_num(imputer.transform(X), nan=0.0, posinf=0.0, neginf=0.0)
    model.fit(imputed_X)

    pipeline = Pipeline([
        ("imputer", imputer),
        ("model", model),
    ])

    scores = np.nan_to_num(model.decision_function(imputed_X), nan=0.0, posinf=0.0, neginf=0.0)
    predictions = model.predict(imputed_X)
    anomalies_count = int(np.sum(predictions == -1))
    anomaly_percentage = float((anomalies_count / available_records) * 100.0) if available_records > 0 else 0.0

    min_score = float(np.min(scores)) if len(scores) > 0 else 0.0
    max_score = float(np.max(scores)) if len(scores) > 0 else 0.0
    mean_score = float(np.mean(scores)) if len(scores) > 0 else 0.0

    metadata = {
        "status": "trained_successfully",
        "model_trained": True,
        "model_type": "IsolationForest",
        "real_records_count": available_records,
        "features_count": len(MODEL_FEATURES),
        "feature_names": MODEL_FEATURES,
        "anomalies_detected": anomalies_count,
        "anomaly_percentage": round(anomaly_percentage, 2),
        "hyperparameters": {
            "n_estimators": n_estimators,
            "contamination": contamination,
            "random_state": random_state,
            "max_samples": max_samples,
        },
        "score_stats": {
            "min_score": round(min_score, 4),
            "max_score": round(max_score, 4),
            "mean_score": round(mean_score, 4),
        },
        "timestamp": datetime.utcnow().isoformat(),
    }

    joblib.dump({"pipeline": pipeline, "metadata": metadata}, MODEL_FILE_PATH)
    print(f"Model saved successfully to {MODEL_FILE_PATH}")
    return metadata


if __name__ == "__main__":
    result = train_isolation_forest()
    print("\n--- Training Result ---")
    for k, v in result.items():
        print(f"{k}: {v}")
