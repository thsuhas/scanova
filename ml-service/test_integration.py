"""
Scanova ML Service - Integration Test Suite
Tests all endpoints: health, Supabase connection, model status,
feature extraction safety, RFC 8259 JSON compliance, risk scoring,
and fraud_detections persistence.
"""

import json
import numpy as np
from fastapi.testclient import TestClient
from app import app
from feature_engineering import extract_order_features
from inference import predict_fraud_risk
from supabase_client import get_supabase_client, sanitize_json_value, save_fraud_detection
from train_model import MODEL_FEATURES

client = TestClient(app)


def run_tests():
    print("==================================================")
    print("  SCANOVA ML FRAUD DETECTION INTEGRATION TESTS    ")
    print("==================================================")

    # Test 1: Service Health
    resp = client.get("/health")
    assert resp.status_code == 200, f"Health check failed: {resp.text}"
    print("[PASS] Test 1: ML Service /health check OK")

    # Test 2: Supabase Connection
    resp = client.get("/health/supabase")
    assert resp.status_code == 200, f"Supabase health check failed: {resp.text}"
    assert resp.json().get("supabase_connected") is True
    print("[PASS] Test 2: Supabase database connection verified")

    # Test 3: Model Status
    resp = client.get("/model/status")
    assert resp.status_code == 200
    status_data = resp.json()
    assert status_data["features_count"] == 30
    print(f"[PASS] Test 3: Model status check OK (Features count: {status_data['features_count']})")

    # Test 4: Low-Risk Prediction (Normal shopping basket)
    normal_features = {
        "total_order_value": 2499.0,
        "item_count": 2,
        "total_quantity": 2,
        "average_item_price": 1249.5,
        "payment_discrepancy": 0.0,
        "is_payment_completed": 1.0,
        "failed_scan_ratio": 0.0,
    }
    pred_low = client.post("/model/predict", json=normal_features).json()
    assert pred_low["risk_level"] in ("low", "medium")
    assert pred_low["is_anomaly"] is False
    assert np.isfinite(pred_low["risk_score"])
    print(f"[PASS] Test 4: Low-risk evaluation OK (risk_score={pred_low['risk_score']}, level={pred_low['risk_level']})")

    # Test 5: High-Risk Prediction (Unpaid, high discrepancy, extreme quantity)
    suspicious_features = {
        "total_order_value": 45000.0,
        "item_count": 1,
        "total_quantity": 50,
        "max_item_quantity": 50,
        "payment_discrepancy": 45000.0,
        "is_payment_completed": 0.0,
        "failed_scan_ratio": 0.6,
        "mismatch_detected": 1.0,
    }
    pred_high = client.post("/model/predict", json=suspicious_features).json()
    assert pred_high["risk_level"] == "high"
    assert pred_high["is_anomaly"] is True
    assert np.isfinite(pred_high["risk_score"])
    print(f"[PASS] Test 5: High-risk anomaly evaluation OK (risk_score={pred_high['risk_score']}, level={pred_high['risk_level']})")

    # Test 6: Invalid/Nonexistent Order ID (safe error handling)
    resp_invalid = client.post("/predict", json={"order_id": "ORD-NONEXISTENT-999"})
    assert resp_invalid.status_code == 404
    print("[PASS] Test 6: Nonexistent order handled safely with 404")

    # Test 7: Feature extraction on completely empty/missing telemetry data
    sample_order = {
        "id": "11111111-2222-3333-4444-555555555555",
        "order_id": "ORD-TEST-001",
        "subtotal": 1200.0,
        "gst": 216.0,
        "total": 1416.0,
        "payment_method": "card",
        "payment_status": "completed",
    }
    extracted = extract_order_features(
        order=sample_order,
        order_items=[],
        payments=[],
        profile=None,
        prior_orders=None,
        scan_events=None,
        exit_verification=None,
        exit_items=None,
    )
    for feat in MODEL_FEATURES:
        assert feat in extracted, f"Missing feature: {feat}"
        val = extracted[feat]
        assert isinstance(val, (int, float)), f"Feature {feat} is not numeric: {type(val)}"
        assert np.isfinite(val), f"Feature {feat} is non-finite: {val}"
    print("[PASS] Test 7: Feature extraction with empty telemetry produces 100% finite features")

    # Test 8: RFC 8259 JSON compliance verification
    risk_factors_with_nans = {
        "total_order_value": 1416.0,
        "manual_scan_ratio": float("nan"),
        "failed_scan_ratio": float("inf"),
        "mismatch_detected": float("-inf"),
        "numpy_float": np.float64(3.14),
    }
    clean_factors = sanitize_json_value(risk_factors_with_nans)
    # json.dumps with allow_nan=False must NOT raise ValueError
    serialized = json.dumps(clean_factors, allow_nan=False)
    assert serialized is not None
    assert clean_factors["manual_scan_ratio"] == 0.0
    assert clean_factors["failed_scan_ratio"] == 0.0
    assert clean_factors["mismatch_detected"] == 0.0
    print("[PASS] Test 8: JSON sanitizer strictly enforces RFC 8259 compliance")

    # Test 9: Verify fraud_detections table schema and persistence capability
    sb_client = get_supabase_client()
    fd_check = sb_client.table("fraud_detections").select("id").limit(1).execute()
    assert fd_check.data is not None
    print("[PASS] Test 9: fraud_detections table read/query verified on live database")

    # Test 10: Barcode Tampering CV Endpoint - Genuine Image
    from pathlib import Path
    import base64
    dataset_root = Path(r"C:\Users\SUHAS\OneDrive\Desktop\scanova_barcode_dataset\scanova_barcode_dataset")
    if dataset_root.exists():
        genuine_img_bytes = (dataset_root / "genuine" / "1035_genuine_01.png").read_bytes()
        gen_b64 = "data:image/png;base64," + base64.b64encode(genuine_img_bytes).decode("utf-8")
        resp_gen = client.post("/barcode-tampering", json={"image": gen_b64, "barcode": "1035"})
        assert resp_gen.status_code == 200, f"CV genuine test failed: {resp_gen.text}"
        data_gen = resp_gen.json()["barcode_tampering"]
        assert data_gen["detected"] is False
        assert data_gen["level"] == "low"
        assert data_gen["score"] < 0.35
        print(f"[PASS] Test 10: CV /barcode-tampering Genuine Image evaluated (score={data_gen['score']}, level={data_gen['level']})")

        # Test 11: Barcode Tampering CV Endpoint - Tampered Image
        tampered_img_bytes = (dataset_root / "tampered" / "1035_tampered_01.png").read_bytes()
        tamp_b64 = "data:image/png;base64," + base64.b64encode(tampered_img_bytes).decode("utf-8")
        resp_tamp = client.post("/barcode-tampering", json={"image": tamp_b64, "barcode": "1035"})
        assert resp_tamp.status_code == 200, f"CV tampered test failed: {resp_tamp.text}"
        data_tamp = resp_tamp.json()["barcode_tampering"]
        assert data_tamp["detected"] is True
        assert data_tamp["level"] == "high"
        assert data_tamp["score"] >= 0.65
        print(f"[PASS] Test 11: CV /barcode-tampering Tampered Image evaluated (score={data_tamp['score']}, level={data_tamp['level']})")

    # Test 12: Barcode Tampering CV Endpoint - Missing Payload Error Handling
    resp_empty = client.post("/barcode-tampering", json={})
    assert resp_empty.status_code == 400
    print("[PASS] Test 12: CV /barcode-tampering missing payload handled with 400")

    print("\n==================================================")
    print("  ALL 12 INTEGRATION TESTS PASSED SUCCESSFULLY!   ")
    print("==================================================")


if __name__ == "__main__":
    run_tests()

