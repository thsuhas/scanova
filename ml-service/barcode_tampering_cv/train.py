"""
Scanova Barcode Tampering CV - Model Training Pipeline
Performs barcode-aware grouped train/validation/test splitting,
CV descriptor extraction with training augmentation, and model training.
"""

import csv
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from PIL import Image

from .model import BarcodeTamperingClassifier, MODEL_ARTIFACT_PATH
from .preprocessing import apply_training_augmentation, extract_cv_descriptors
from .utils import MODEL_VERSION

DEFAULT_DATASET_PATH = Path(r"C:\Users\SUHAS\OneDrive\Desktop\scanova_barcode_dataset\scanova_barcode_dataset")

# Barcode-aware partitioning (prevents data leakage between variations of the same product)
TRAIN_BARCODES = [str(i) for i in range(1001, 1029)]  # 28 barcodes (70%)
VAL_BARCODES = [str(i) for i in range(1029, 1035)]    # 6 barcodes (15%)
TEST_BARCODES = [str(i) for i in range(1035, 1041)]   # 6 barcodes (15%)


def load_dataset_records(dataset_dir: Optional[Path] = None) -> List[Dict[str, Any]]:
    """
    Reads metadata.csv and resolves image file paths.
    """
    root = dataset_dir or Path(os.getenv("BARCODE_DATASET_DIR", str(DEFAULT_DATASET_PATH)))
    meta_path = root / "metadata.csv"

    if not meta_path.exists():
        raise FileNotFoundError(f"Metadata file not found at {meta_path}")

    records: List[Dict[str, Any]] = []
    with open(meta_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            cls = row.get("class", "genuine").lower()
            img_name = row.get("image_name")
            folder = root / ("genuine" if cls == "genuine" else "tampered")
            img_path = folder / img_name

            if not img_path.exists():
                raise FileNotFoundError(f"Image {img_path} referenced in metadata not found.")

            records.append({
                "image_name": img_name,
                "file_path": str(img_path),
                "barcode_value": str(row.get("barcode_value", "")).strip(),
                "product_name": row.get("product_name", ""),
                "tampering_type": row.get("tampering_type", "none"),
                "class": cls,
                "label": 1 if cls == "tampered" else 0,
            })

    return records


def build_barcode_splits(records: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Splits dataset into Train, Validation, and Test sets based strictly on Barcode IDs
    to prevent data leakage.
    """
    train_set = [r for r in records if r["barcode_value"] in TRAIN_BARCODES]
    val_set = [r for r in records if r["barcode_value"] in VAL_BARCODES]
    test_set = [r for r in records if r["barcode_value"] in TEST_BARCODES]
    return train_set, val_set, test_set


def extract_features_and_labels(
    records: List[Dict[str, Any]],
    is_training: bool = False,
    augment_factor: int = 1,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Extracts CV feature matrix X, binary labels y_binary, and multi-class categories y_category.
    """
    X_list: List[np.ndarray] = []
    y_binary_list: List[int] = []
    y_category_list: List[str] = []

    for rec in records:
        img_path = Path(rec["file_path"])
        pil_img = Image.open(img_path).convert("RGB")

        # 1. Base image features
        feat = extract_cv_descriptors(pil_img)
        X_list.append(feat)
        y_binary_list.append(rec["label"])
        y_category_list.append(rec["tampering_type"])

        # 2. Augmented features for training set
        if is_training and augment_factor > 0:
            for i in range(augment_factor):
                aug_img = apply_training_augmentation(pil_img, seed=42 + i + len(X_list))
                aug_feat = extract_cv_descriptors(aug_img)
                X_list.append(aug_feat)
                y_binary_list.append(rec["label"])
                y_category_list.append(rec["tampering_type"])

    X = np.vstack(X_list)
    y_binary = np.array(y_binary_list, dtype=np.int32)
    y_category = np.array(y_category_list, dtype=object)
    return X, y_binary, y_category


def train_barcode_tampering_model(
    dataset_dir: Optional[Path] = None,
    augment_factor: int = 1,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Executes full training pipeline and saves trained model artifact.
    """
    print("==================================================")
    print("  SCANOVA BARCODE CV - MODEL TRAINING PIPELINE    ")
    print("==================================================")

    root = dataset_dir or Path(os.getenv("BARCODE_DATASET_DIR", str(DEFAULT_DATASET_PATH)))
    print(f"Loading dataset from: {root}")
    records = load_dataset_records(root)
    print(f"Total dataset records: {len(records)}")

    train_records, val_records, test_records = build_barcode_splits(records)
    print(f"\n[Barcode-Aware Data Splits]")
    print(f"Train set: {len(train_records)} images (Barcodes 1001-1028, 28 barcodes)")
    print(f"Validation set: {len(val_records)} images (Barcodes 1029-1034, 6 barcodes)")
    print(f"Held-out Test set: {len(test_records)} images (Barcodes 1035-1040, 6 barcodes)")

    print("\nExtracting Computer Vision descriptors...")
    X_train, y_train_bin, y_train_cat = extract_features_and_labels(train_records, is_training=True, augment_factor=augment_factor)
    X_val, y_val_bin, y_val_cat = extract_features_and_labels(val_records, is_training=False)
    X_test, y_test_bin, y_test_cat = extract_features_and_labels(test_records, is_training=False)

    print(f"Feature matrix shape (Train): {X_train.shape} (with {augment_factor}x augmentation)")
    print(f"Feature matrix shape (Val):   {X_val.shape}")
    print(f"Feature matrix shape (Test):  {X_test.shape}")

    print("\nTraining BarcodeTamperingClassifier...")
    classifier = BarcodeTamperingClassifier(random_state=random_state)
    
    metadata = {
        "model_version": MODEL_VERSION,
        "dataset_total_samples": len(records),
        "train_samples_raw": len(train_records),
        "train_samples_augmented": int(X_train.shape[0]),
        "val_samples": len(val_records),
        "test_samples": len(test_records),
        "features_dimension": int(X_train.shape[1]),
        "train_barcodes": TRAIN_BARCODES,
        "val_barcodes": VAL_BARCODES,
        "test_barcodes": TEST_BARCODES,
        "timestamp": datetime.utcnow().isoformat(),
    }

    classifier.fit(X_train, y_train_bin, y_train_cat, metadata=metadata)

    # Validation performance
    val_probs = classifier.predict_proba(X_val)
    val_preds = (val_probs >= 0.50).astype(int)
    val_acc = float(np.mean(val_preds == y_val_bin))
    print(f"Validation Accuracy: {val_acc * 100.0:.2f}%")

    model_path = classifier.save()
    print(f"\n[SUCCESS] Model artifact saved to: {model_path}")

    return {
        "status": "trained_successfully",
        "model_path": str(model_path),
        "val_accuracy": val_acc,
        "metadata": metadata,
    }


if __name__ == "__main__":
    train_barcode_tampering_model()
