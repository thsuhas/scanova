"""
Scanova Barcode Tampering CV - Model Evaluation Pipeline
Evaluates the trained model strictly on the held-out test set (barcodes 1035-1040).
Reports Accuracy, Precision, Recall, F1-Score, and Confusion Matrix.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

from .model import BarcodeTamperingClassifier, MODEL_ARTIFACT_PATH
from .train import build_barcode_splits, extract_features_and_labels, load_dataset_records


def evaluate_barcode_tampering_model(
    dataset_dir: Optional[Path] = None,
    model_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Evaluates model performance strictly on unseen held-out test split.
    """
    print("==================================================")
    print("  SCANOVA BARCODE CV - TEST SET EVALUATION        ")
    print("==================================================")

    # 1. Load model
    classifier = BarcodeTamperingClassifier.load(model_path or MODEL_ARTIFACT_PATH)
    print(f"Model loaded: {classifier.metadata.get('model_version', 'barcode_cv_v1')}")

    # 2. Load held-out test records
    records = load_dataset_records(dataset_dir)
    _, _, test_records = build_barcode_splits(records)
    print(f"Held-out test set size: {len(test_records)} images (Barcodes: 1035 to 1040)")

    # 3. Extract test descriptors
    X_test, y_test_bin, y_test_cat = extract_features_and_labels(test_records, is_training=False)

    # 4. Predict probabilities and binary decisions
    probs = classifier.predict_proba(X_test)
    preds = (probs >= 0.50).astype(int)

    acc = float(accuracy_score(y_test_bin, preds))
    prec = float(precision_score(y_test_bin, preds, zero_division=0))
    rec = float(recall_score(y_test_bin, preds, zero_division=0))
    f1 = float(f1_score(y_test_bin, preds, zero_division=0))
    cm = confusion_matrix(y_test_bin, preds).tolist()

    tn, fp, fn, tp = confusion_matrix(y_test_bin, preds).ravel()

    print("\n--- PERFORMANCE METRICS (HELD-OUT TEST SET) ---")
    print(f"Test Samples Count : {len(test_records)}")
    print(f"Accuracy           : {acc * 100.0:.2f}%")
    print(f"Precision          : {prec * 100.0:.2f}%")
    print(f"Recall             : {rec * 100.0:.2f}%")
    print(f"F1-Score           : {f1 * 100.0:.2f}%")
    print("\nConfusion Matrix (Rows: Actual, Cols: Predicted):")
    print(f"  [TN={tn} (Genuine Correct),  FP={fp} (False Alarm)]")
    print(f"  [FN={fn} (Missed Tamper),   TP={tp} (Tamper Detected)]")

    print("\nDetailed Binary Classification Report:")
    print(classification_report(y_test_bin, preds, target_names=["Genuine", "Tampered"]))

    print("\n--- EVALUATION LIMITATIONS & DISCLAIMER ---")
    print("NOTE: This dataset is synthetic/controlled and does not represent a")
    print("real-world barcode-tampering dataset. Real camera artifacts (lighting,")
    print("reflections, angle distortions) must be validated with physical tests.")

    return {
        "test_samples_count": len(test_records),
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "confusion_matrix": {
            "tn": int(tn),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp),
        },
        "raw_confusion_matrix": cm,
    }


if __name__ == "__main__":
    evaluate_barcode_tampering_model()
