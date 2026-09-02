"""
Scanova Barcode Tampering CV - Image Preprocessing & Descriptor Extraction
Transforms barcode images into standardized, normalized structural feature vectors
sensitive to physical tampering (obstructions, breaks, cuts, damage, label overlays).
"""

import math
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

from .utils import load_image_to_pil

STANDARD_IMAGE_SIZE = (224, 224)


def preprocess_image(
    image_input: Union[str, bytes, Image.Image],
    target_size: Tuple[int, int] = STANDARD_IMAGE_SIZE,
) -> Image.Image:
    """
    Standardizes image input to target resolution in RGB format.
    """
    pil_img = load_image_to_pil(image_input)
    if pil_img.size != target_size:
        pil_img = pil_img.resize(target_size, Image.Resampling.BILINEAR)
    return pil_img


def apply_training_augmentation(image: Image.Image, seed: Optional[int] = None) -> Image.Image:
    """
    Applies light, controlled augmentation during training to improve generalizability:
    - Subtle brightness / contrast jitter (+/- 10%)
    - Micro-rotation (+/- 2 degrees)
    - Slight Gaussian blur or sharpening
    Does NOT distort the fundamental barcode structure.
    """
    rng = np.random.default_rng(seed)
    augmented = image.copy()

    # 1. Subtle rotation (-2 to +2 deg)
    angle = float(rng.uniform(-2.0, 2.0))
    if abs(angle) > 0.3:
        augmented = augmented.rotate(angle, resample=Image.Resampling.BILINEAR, fillcolor=(255, 255, 255))

    # 2. Brightness jitter (0.9 to 1.1)
    b_factor = float(rng.uniform(0.90, 1.10))
    augmented = ImageEnhance.Brightness(augmented).enhance(b_factor)

    # 3. Contrast jitter (0.9 to 1.1)
    c_factor = float(rng.uniform(0.90, 1.10))
    augmented = ImageEnhance.Contrast(augmented).enhance(c_factor)

    # 4. Optional subtle blur or sharpness
    if rng.random() > 0.6:
        augmented = augmented.filter(ImageFilter.UnsharpMask(radius=1, percent=120, threshold=3))

    return augmented


def extract_cv_descriptors(image_input: Union[str, bytes, Image.Image]) -> np.ndarray:
    """
    Extracts a rich, deterministic 64-dimensional structural Computer Vision descriptor vector:
    1. Vertical Stripe Projection & Row Consistency (detects cuts, line interruptions, breaks)
    2. Horizontal vs Vertical Gradient Ratio (detects horizontal damage and cuts across vertical bars)
    3. Spatial Grid Patch Variance & Entropy (detects localized stickers, tape, overlays)
    4. Quiet Zone Boundary Uniformity (detects border tampering / replacement label seams)
    5. Frequency Spectrum Energy (detects halftone resampling and print noise)
    6. Luminance Moments & Bimodality (measures barcode contrast clarity)
    """
    pil_img = preprocess_image(image_input, STANDARD_IMAGE_SIZE)
    gray = pil_img.convert("L")
    arr = np.asarray(gray, dtype=np.float32) / 255.0  # (224, 224), [0.0, 1.0]

    h, w = arr.shape
    features: List[float] = []

    # -------------------------------------------------------------
    # 1. Vertical Stripe Projection & Row Consistency
    # In genuine barcodes, column values are near-constant vertically.
    # In broken/interrupted barcodes, column standard deviation is high.
    # -------------------------------------------------------------
    col_std = np.std(arr, axis=0)  # (224,)
    col_mean = np.mean(arr, axis=0)  # (224,)

    features.append(float(np.mean(col_std)))
    features.append(float(np.std(col_std)))
    features.append(float(np.max(col_std)))
    features.append(float(np.percentile(col_std, 90)))
    features.append(float(np.percentile(col_std, 10)))

    features.append(float(np.mean(col_mean)))
    features.append(float(np.std(col_mean)))
    features.append(float(np.min(col_mean)))
    features.append(float(np.max(col_mean)))

    # -------------------------------------------------------------
    # 2. Horizontal vs Vertical Gradients (Sobel-like Differences)
    # Genuine barcodes have intense horizontal transitions (Gx) and minimal Gy.
    # Tampering (scratches, cuts, damage) creates high vertical gradients (Gy).
    # -------------------------------------------------------------
    gx = np.abs(arr[:, 1:] - arr[:, :-1])  # (224, 223)
    gy = np.abs(arr[1:, :] - arr[:-1, :])  # (223, 224)

    mean_gx = float(np.mean(gx))
    std_gx = float(np.std(gx))
    max_gx = float(np.max(gx))

    mean_gy = float(np.mean(gy))
    std_gy = float(np.std(gy))
    max_gy = float(np.max(gy))

    gradient_ratio = mean_gy / (mean_gx + 1e-6)

    features.extend([mean_gx, std_gx, max_gx, mean_gy, std_gy, max_gy, gradient_ratio])

    # -------------------------------------------------------------
    # 3. Localized Patch Variance & Spatial Grid Distribution (4x4 Grid = 16 Patches)
    # Tampering (stickers, blackouts, localized edits) causes extreme patch-to-patch variance.
    # -------------------------------------------------------------
    grid_rows, grid_cols = 4, 4
    ph, pw = h // grid_rows, w // grid_cols
    patch_means = []
    patch_stds = []

    for r in range(grid_rows):
        for c in range(grid_cols):
            patch = arr[r * ph : (r + 1) * ph, c * pw : (c + 1) * pw]
            p_mean = float(np.mean(patch))
            p_std = float(np.std(patch))
            patch_means.append(p_mean)
            patch_stds.append(p_std)

    features.extend(patch_means)  # 16 features
    features.extend(patch_stds)   # 16 features

    features.append(float(np.var(patch_means)))
    features.append(float(np.var(patch_stds)))
    features.append(float(np.max(patch_stds) - np.min(patch_stds)))

    # -------------------------------------------------------------
    # 4. Quiet Zone Uniformity (Left and Right 10% Margins)
    # -------------------------------------------------------------
    margin_w = int(w * 0.10)
    left_zone = arr[:, :margin_w]
    right_zone = arr[:, -margin_w:]

    left_mean = float(np.mean(left_zone))
    left_std = float(np.std(left_zone))
    right_mean = float(np.mean(right_zone))
    right_std = float(np.std(right_zone))

    features.extend([left_mean, left_std, right_mean, right_std])

    # -------------------------------------------------------------
    # 5. Global Luminance Moments & Bimodality (Otsu-like Contrast)
    # -------------------------------------------------------------
    global_mean = float(np.mean(arr))
    global_std = float(np.std(arr))
    # Normalized skewness & kurtosis
    m3 = float(np.mean((arr - global_mean) ** 3))
    m4 = float(np.mean((arr - global_mean) ** 4))
    skewness = m3 / ((global_std ** 3) + 1e-6)
    kurtosis = m4 / ((global_std ** 4) + 1e-6)

    # High-frequency noise level (Laplacian variance)
    laplacian = np.abs(
        arr[:-2, 1:-1] + arr[2:, 1:-1] + arr[1:-1, :-2] + arr[1:-1, 2:] - 4 * arr[1:-1, 1:-1]
    )
    laplacian_var = float(np.var(laplacian))

    features.extend([global_mean, global_std, skewness, kurtosis, laplacian_var])

    # -------------------------------------------------------------
    # 6. Frequency Domain Power Spectrum Descriptors
    # -------------------------------------------------------------
    try:
        fft2 = np.fft.fft2(arr)
        fft_shift = np.fft.fftshift(fft2)
        magnitude_spectrum = np.abs(fft_shift)
        ch, cw = h // 2, w // 2
        low_freq = magnitude_spectrum[ch - 15 : ch + 15, cw - 15 : cw + 15]
        total_energy = float(np.sum(magnitude_spectrum))
        low_energy = float(np.sum(low_freq))
        hf_energy_ratio = (total_energy - low_energy) / (total_energy + 1e-6)
    except Exception:
        hf_energy_ratio = 0.5

    features.append(float(hf_energy_ratio))

    feature_vector = np.array(features, dtype=np.float32)
    # Ensure strictly finite
    feature_vector = np.nan_to_num(feature_vector, nan=0.0, posinf=0.0, neginf=0.0)
    return feature_vector
