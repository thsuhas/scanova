"""
Scanova Barcode Tampering CV - Model Architecture Module
Provides the BarcodeTamperingClassifier for binary tampering classification
and fine-grained tampering category prediction.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union
import joblib
import numpy as np
from sklearn.ensemble import ExtraTreesClassifier, GradientBoostingClassifier, RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import CalibratedClassifierCV

from .preprocessing import extract_cv_descriptors
from .utils import (
    MODEL_VERSION,
    TAMPERING_DETECTION_THRESHOLD,
    TAMPERING_THRESHOLD_HIGH,
    TAMPERING_THRESHOLD_MEDIUM,
    create_error_tampering_response,
    create_tampering_response,
    score_to_tampering_level,
)

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)
MODEL_ARTIFACT_PATH = MODELS_DIR / "barcode_tampering_detector.joblib"

TAMPER_CLASSES = [
    "none",
    "partial_obstruction",
    "barcode_line_interruption",
    "physical_damage_simulation",
    "replacement_label_simulation",
    "localized_barcode_alteration",
]


class BarcodeTamperingClassifier:
    """
    Lightweight, calibrated Computer Vision classifier for physical barcode tampering.
    Outputs continuous probability [0.0, 1.0], discrete risk tiers (low, medium, high),
    binary detection flag, and predicted tampering category.
    """

    def __init__(self, random_state: int = 42):
        self.random_state = random_state
        self.scaler = StandardScaler()
        
        # Primary binary tampering classifier (ensemble + neural architecture with calibrated probabilities)
        base_estimator = GradientBoostingClassifier(
            n_estimators=120,
            learning_rate=0.08,
            max_depth=4,
            subsample=0.85,
            random_state=random_state,
        )
        self.binary_classifier = CalibratedClassifierCV(
            estimator=base_estimator,
            method="sigmoid",
            cv=3,
        )

        # Multi-class category classifier
        self.category_classifier = ExtraTreesClassifier(
            n_estimators=100,
            max_depth=8,
            random_state=random_state,
        )

        self.is_fitted = False
        self.metadata: Dict[str, Any] = {}

    def fit(
        self,
        X: np.ndarray,
        y_binary: np.ndarray,
        y_category: Optional[np.ndarray] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "BarcodeTamperingClassifier":
        """
        Fits the scaler and classifiers on extracted CV feature matrix X.
        - y_binary: 0 for genuine, 1 for tampered
        - y_category: string labels ('none', 'partial_obstruction', ...)
        """
        X_scaled = self.scaler.fit_transform(X)
        self.binary_classifier.fit(X_scaled, y_binary)

        if y_category is not None:
            self.category_classifier.fit(X_scaled, y_category)

        self.is_fitted = True
        self.metadata = metadata or {}
        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Returns tampering probabilities for input feature vectors."""
        if not self.is_fitted:
            raise RuntimeError("Model has not been fitted or loaded.")
        X_scaled = self.scaler.transform(X)
        # binary classifier returns [P(genuine), P(tampered)]
        probs = self.binary_classifier.predict_proba(X_scaled)
        return probs[:, 1]

    def predict_category(self, X: np.ndarray) -> List[str]:
        """Predicts specific tampering category."""
        if not self.is_fitted:
            raise RuntimeError("Model has not been fitted or loaded.")
        X_scaled = self.scaler.transform(X)
        return list(self.category_classifier.predict(X_scaled))

    def evaluate_features(self, feature_vector: np.ndarray) -> Dict[str, Any]:
        """Evaluates a single 1D feature vector."""
        X = np.atleast_2d(feature_vector)
        score = float(self.predict_proba(X)[0])
        score = float(np.clip(score, 0.0, 1.0))
        level = score_to_tampering_level(score)
        detected = bool(score >= TAMPERING_DETECTION_THRESHOLD)

        tamper_type = "none"
        if detected and hasattr(self.category_classifier, "classes_"):
            predicted_type = self.predict_category(X)[0]
            tamper_type = str(predicted_type) if predicted_type != "none" else "physical_damage_simulation"

        return create_tampering_response(
            detected=detected,
            score=score,
            level=level,
            tampering_type=tamper_type,
            method="computer_vision",
            model_version=MODEL_VERSION,
        )

    def evaluate_image(self, image_input: Union[str, bytes, Any]) -> Dict[str, Any]:
        """End-to-end evaluation from raw image input."""
        try:
            feats = extract_cv_descriptors(image_input)
            return self.evaluate_features(feats)
        except Exception as exc:
            return create_error_tampering_response(f"Image evaluation failed: {exc}")

    def save(self, filepath: Optional[Path] = None) -> Path:
        """Saves model artifact to disk."""
        target = filepath or MODEL_ARTIFACT_PATH
        target.parent.mkdir(parents=True, exist_ok=True)
        artifact = {
            "scaler": self.scaler,
            "binary_classifier": self.binary_classifier,
            "category_classifier": self.category_classifier,
            "is_fitted": self.is_fitted,
            "metadata": self.metadata,
            "version": MODEL_VERSION,
        }
        joblib.dump(artifact, target)
        return target

    @classmethod
    def load(cls, filepath: Optional[Path] = None) -> "BarcodeTamperingClassifier":
        """Loads trained model artifact from disk."""
        target = filepath or MODEL_ARTIFACT_PATH
        if not target.exists():
            raise FileNotFoundError(f"Trained model artifact not found at {target}")
        artifact = joblib.load(target)
        instance = cls()
        instance.scaler = artifact["scaler"]
        instance.binary_classifier = artifact["binary_classifier"]
        instance.category_classifier = artifact.get("category_classifier", instance.category_classifier)
        instance.is_fitted = artifact.get("is_fitted", True)
        instance.metadata = artifact.get("metadata", {})
        return instance
