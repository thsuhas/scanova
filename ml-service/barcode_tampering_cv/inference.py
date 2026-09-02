"""
Scanova Barcode Tampering CV - Production Inference Module
Provides fast, lightweight inference for barcode tampering detection
from raw image frames, base64 strings, or file paths.
"""

from pathlib import Path
from typing import Any, Dict, Optional, Union
from PIL import Image

from .model import BarcodeTamperingClassifier, MODEL_ARTIFACT_PATH
from .utils import create_error_tampering_response, create_tampering_response

_cached_classifier: Optional[BarcodeTamperingClassifier] = None


def load_tampering_model(model_path: Optional[Path] = None) -> Optional[BarcodeTamperingClassifier]:
    """
    Loads and caches the BarcodeTamperingClassifier.
    If artifact does not exist yet, triggers initial training.
    """
    global _cached_classifier
    if _cached_classifier is not None:
        return _cached_classifier

    path = model_path or MODEL_ARTIFACT_PATH
    if not path.exists():
        try:
            from .train import train_barcode_tampering_model
            train_barcode_tampering_model()
        except Exception as exc:
            print(f"[CV Inference] Initial model training failed: {exc}")
            return None

    if path.exists():
        try:
            _cached_classifier = BarcodeTamperingClassifier.load(path)
        except Exception as exc:
            print(f"[CV Inference] Failed to load model artifact: {exc}")
            _cached_classifier = None

    return _cached_classifier


def predict_barcode_tampering(
    image_input: Union[str, bytes, Image.Image],
    model_path: Optional[Path] = None,
) -> Dict[str, Any]:
    """
    Evaluates a barcode image and returns the structured tampering prediction:
    {
      "barcode_tampering": {
        "detected": true/false,
        "score": 0.91,
        "level": "high",
        "method": "computer_vision",
        "model_version": "barcode_cv_v1",
        "tampering_type": "physical_damage_simulation"
      }
    }
    """
    try:
        classifier = load_tampering_model(model_path)
        if classifier is None:
            return create_error_tampering_response("Barcode tampering model uninitialized.")

        return classifier.evaluate_image(image_input)
    except Exception as exc:
        return create_error_tampering_response(f"Inference error: {exc}")
