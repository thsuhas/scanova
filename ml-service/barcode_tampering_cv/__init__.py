"""
Scanova Barcode Tampering Computer Vision Module
Provides lightweight, structural CV classification for physical barcode tampering.
"""

from .inference import predict_barcode_tampering, load_tampering_model
from .model import BarcodeTamperingClassifier
from .utils import (
    MODEL_VERSION,
    TAMPERING_DETECTION_THRESHOLD,
    TAMPERING_THRESHOLD_HIGH,
    TAMPERING_THRESHOLD_MEDIUM,
    score_to_tampering_level,
)

__all__ = [
    "predict_barcode_tampering",
    "load_tampering_model",
    "BarcodeTamperingClassifier",
    "score_to_tampering_level",
    "MODEL_VERSION",
    "TAMPERING_THRESHOLD_HIGH",
    "TAMPERING_THRESHOLD_MEDIUM",
    "TAMPERING_DETECTION_THRESHOLD",
]
