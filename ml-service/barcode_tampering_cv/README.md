# Scanova Barcode Tampering Computer Vision Module

## 1. Why Barcode CV is Used in Self-Checkout
In cashierless retail environments like Scanova, optical barcode decoders (e.g. ZXing, camera scanners) only verify that a barcode is **syntactically decodable**. They cannot detect whether a physical barcode label has been maliciously altered, swapped, partially masked, or damaged to trigger incorrect price lookups or bypass exit turnstile audits.

The **Barcode Tampering Computer Vision Module** provides visual inspection of the physical barcode image frame before or during checkout.

---

## 2. Barcode Decoding vs. Physical Tampering Detection

| Feature | Standard Barcode Scanner (ZXing) | Barcode Tampering CV Detector |
| :--- | :--- | :--- |
| **Primary Goal** | Extract numeric barcode string (e.g. `"1001"`) | Inspect physical integrity & tampering patterns |
| **Tampering Resilience** | May successfully decode altered/overlayed barcodes | Detects physical cuts, stickers, and overlays |
| **Detection Method** | 1D Pattern matching / timing signals | Multi-scale structural Computer Vision descriptors |
| **Output** | String payload | Tampering probability, risk level (`low`/`medium`/`high`) |

---

## 3. Dataset & Data Leakage Prevention

### Dataset Overview
* **Total Images**: 400 PNG images
* **Genuine Images**: 200 images
* **Tampered Images**: 200 images
* **Unique Barcodes**: 40 barcodes (`1001`–`1040`) matching the Scanova product catalog.
* **Tampering Categories**:
  1. `none` (genuine)
  2. `partial_obstruction` (stickers, blackouts, tape)
  3. `barcode_line_interruption` (horizontal cuts, line gaps)
  4. `physical_damage_simulation` (creases, stains, tears)
  5. `replacement_label_simulation` (paste seams, mismatched label backgrounds)
  6. `localized_barcode_alteration` (digit modification, localized bar thickness distortion)

### Barcode-Aware Grouped Split
To prevent data leakage caused by having near-identical variations of the same product in both training and test partitions, the dataset is split strictly by **Barcode ID**:

* **Training Set**: Barcodes `1001` to `1028` (28 barcodes = 280 images, 70%)
* **Validation Set**: Barcodes `1029` to `1034` (6 barcodes = 60 images, 15%)
* **Held-out Test Set**: Barcodes `1035` to `1040` (6 barcodes = 60 images, 15%)

*The held-out test set (barcodes 1035–1040) remains completely unseen during feature engineering, model training, and threshold selection.*

---

## 4. Computer Vision Descriptors & Architecture

### Preprocessing & Feature Extraction
1. **Standardization**: Resized to $224 \times 224$ pixels, normalized to $[0.0, 1.0]$.
2. **Vertical Stripe Projection**: Evaluates column intensity standard deviation along vertical barcode bars.
3. **Horizontal vs. Vertical Gradient Ratio ($G_x$ vs $G_y$)**: Detects horizontal scratches and cuts across vertical lines.
4. **Localized Patch Variance (4×4 Grid)**: Identifies local anomalies such as tape, stickers, or localized replacement patches.
5. **Quiet Zone Uniformity**: Inspects left and right 10% margins for paste boundaries or text overflow.
6. **Luminance Moments & Frequency Domain Power Spectrum**: Evaluates print noise, contrast bimodality, and high-frequency edge energy.

### Model Architecture
* **Classifier**: Calibrated `GradientBoostingClassifier` with sigmoid probability calibration and `ExtraTreesClassifier` for tampering category attribution.
* **Score & Thresholds**:
  * `tampering_probability`: $[0.0, 1.0]$
  * `low`: $< 0.35$
  * `medium`: $0.35 \le score < 0.65$
  * `high`: $\ge 0.65$
  * `tampering_detected`: `bool(score >= 0.50)`

---

## 5. API & Inference

### Endpoint
`POST /barcode-tampering`

#### Request Payload
```json
{
  "image": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

#### Response Contract
```json
{
  "barcode_tampering": {
    "detected": false,
    "score": 0.0821,
    "level": "low",
    "method": "computer_vision",
    "model_version": "barcode_cv_v1",
    "tampering_type": "none"
  }
}
```

---

## 6. Integration with Transaction Fraud ML & Combined Security

* **Transaction Fraud ML (`/predict`)**: Evaluates cart total, quantity discrepancies, exit verification, and customer history using Isolation Forest.
* **Barcode Tampering CV (`/barcode-tampering`)**: Evaluates physical barcode image integrity.
* **Combined Security Result**:
  * If transaction risk is `low` and tampering risk is `low` $\rightarrow$ `auto_cleared`.
  * If transaction risk is `high` OR tampering risk is `high` $\rightarrow$ `flag_for_gate_check`.
  * Preserves separate auditability for both ML models.

---

## 7. Dataset Limitations & Academic Disclaimer

> [!CAUTION]
> **Academic & Dataset Limitation Notice**:
> This dataset is synthetic/controlled and does not represent a real-world barcode-tampering dataset.
> Real-world mobile camera photos involve non-uniform lighting, lens glare, perspective distortion, and packaging wrinkles that must be further evaluated with physical retail testing.
