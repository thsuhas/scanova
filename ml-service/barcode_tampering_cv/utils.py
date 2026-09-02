"""
Scanova Barcode Tampering CV - Utilities Module
Provides robust image loading, base64 data URL decoding, format validation,
and score thresholding utilities.
"""

import base64
import io
import re
from pathlib import Path
from typing import Any, Dict, Optional, Tuple, Union
import numpy as np
from PIL import Image

# Score Thresholds
TAMPERING_THRESHOLD_HIGH = 0.65
TAMPERING_THRESHOLD_MEDIUM = 0.35
TAMPERING_DETECTION_THRESHOLD = 0.50

MODEL_VERSION = "barcode_cv_v1"


def score_to_tampering_level(score: float) -> str:
    """
    Deterministic mapping from continuous tampering probability [0.0, 1.0] to discrete tiers:
    - [0.00, 0.35): low
    - [0.35, 0.65): medium
    - [0.65, 1.00]: high
    """
    if score < TAMPERING_THRESHOLD_MEDIUM:
        return "low"
    elif score < TAMPERING_THRESHOLD_HIGH:
        return "medium"
    else:
        return "high"


def load_image_to_pil(image_input: Union[str, bytes, Path, Image.Image]) -> Image.Image:
    """
    Converts various image input representations into a PIL Image.
    Supports:
    - PIL.Image instance
    - File system path (str or Path)
    - Raw image bytes
    - Base64 encoded string or Data URI (e.g. data:image/png;base64,...)
    """
    if isinstance(image_input, Image.Image):
        return image_input.copy()

    if isinstance(image_input, Path):
        return Image.open(image_input).convert("RGB")

    if isinstance(image_input, str):
        # 1. Check if it's a file path on disk
        potential_path = Path(image_input)
        if potential_path.exists() and potential_path.is_file():
            return Image.open(potential_path).convert("RGB")

        # 2. Check if it's a data URI (e.g. data:image/png;base64,...)
        if image_input.startswith("data:"):
            match = re.search(r"base64,(.*)$", image_input)
            if match:
                b64_data = match.group(1)
            else:
                raise ValueError("Invalid data URI format for image")
        else:
            b64_data = image_input

        # 3. Decode base64
        try:
            image_bytes = base64.b64decode(b64_data)
            return Image.open(io.BytesIO(image_bytes)).convert("RGB")
        except Exception as e:
            raise ValueError(f"Failed to decode base64 image data: {e}")

    if isinstance(image_input, bytes):
        return Image.open(io.BytesIO(image_input)).convert("RGB")

    raise TypeError(f"Unsupported image input type: {type(image_input)}")


def create_tampering_response(
    detected: bool,
    score: float,
    level: str,
    tampering_type: str = "none",
    method: str = "computer_vision",
    model_version: str = MODEL_VERSION,
    extra_details: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Builds standard structured tampering evaluation response contract."""
    clean_score = float(np.clip(float(score), 0.0, 1.0))
    return {
        "barcode_tampering": {
            "detected": bool(detected),
            "score": round(clean_score, 4),
            "level": str(level).lower(),
            "method": str(method),
            "model_version": str(model_version),
            "tampering_type": str(tampering_type),
            **(extra_details or {}),
        }
    }


def create_error_tampering_response(error_message: str) -> Dict[str, Any]:
    """Returns safe, non-blocking fallback response when evaluation fails."""
    return {
        "barcode_tampering": {
            "detected": False,
            "score": 0.0,
            "level": "low",
            "method": "computer_vision_fallback",
            "model_version": MODEL_VERSION,
            "tampering_type": "none",
            "error": str(error_message),
        }
    }
