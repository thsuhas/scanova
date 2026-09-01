from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from supabase_client import (
    test_supabase_connection,
    fetch_order_by_id,
    fetch_order_items,
    fetch_payments,
    fetch_profiles,
    fetch_scan_events,
    fetch_exit_verifications,
    fetch_exit_verified_items,
    save_fraud_detection,
)
from feature_engineering import extract_order_features
from train_model import train_isolation_forest, MODEL_FILE_PATH, MODEL_FEATURES
from inference import predict_fraud_risk, load_model_artifact

app = FastAPI(
    title="Scanova ML Fraud Detection API",
    version="1.0.0",
    description="Machine learning inference service for cashier-less retail fraud detection."
)

# Enable CORS for cross-origin frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class OrderPredictionRequest(BaseModel):
    order_id: str = Field(..., description="UUID or order_id string of the completed order")
    user_id: Optional[str] = Field(None, description="Optional user identifier")
    session_id: Optional[str] = Field(None, description="Optional shopping session token")


class FeatureRecordModel(BaseModel):
    subtotal: Optional[float] = None
    gst: Optional[float] = None
    total_order_value: Optional[float] = None
    item_count: Optional[float] = None
    total_quantity: Optional[float] = None
    average_item_price: Optional[float] = None
    max_item_quantity: Optional[float] = None
    payment_amount: Optional[float] = None
    payment_to_order_ratio: Optional[float] = None
    payment_discrepancy: Optional[float] = None
    is_payment_completed: Optional[float] = None
    payment_method_card: Optional[float] = None
    payment_method_upi: Optional[float] = None
    payment_method_cash: Optional[float] = None
    scan_count: Optional[float] = None
    manual_scan_ratio: Optional[float] = None
    failed_scan_ratio: Optional[float] = None
    scan_velocity: Optional[float] = None
    qr_scan_count: Optional[float] = None
    time_to_exit_seconds: Optional[float] = None
    billed_item_count: Optional[float] = None
    verified_item_count: Optional[float] = None
    quantity_difference: Optional[float] = None
    mismatch_detected: Optional[float] = None
    unbilled_item_count: Optional[float] = None
    missing_item_count: Optional[float] = None
    excess_item_count: Optional[float] = None
    account_age_days: Optional[float] = None
    previous_order_count: Optional[float] = None
    previous_total_spent: Optional[float] = None

    class Config:
        extra = "allow"


OrderPredictionRequest.model_rebuild()
FeatureRecordModel.model_rebuild()


@app.get("/health")
def health_check():
    """Health check endpoint to verify service status."""
    return {"status": "ok", "service": "scanova-ml-service"}


@app.get("/health/supabase")
@app.get("/test-supabase")
def test_supabase():
    """
    Test endpoint to verify connectivity to Scanova Supabase database.
    Does not expose sensitive or private user data.
    """
    is_connected = test_supabase_connection()
    return {"supabase_connected": is_connected}


@app.get("/model/status")
def model_status():
    """
    Returns current model status, metadata, and technical diagnostics.
    Does not expose private user or order information.
    """
    artifact = load_model_artifact()
    metadata = artifact.get("metadata", {})
    return {
        "status": "ready",
        "model_artifact_exists": MODEL_FILE_PATH.exists(),
        "model_metadata": metadata,
        "features_count": len(MODEL_FEATURES),
    }


@app.post("/model/train")
def train_model():
    """
    Triggers model training using real available Supabase transaction records.
    Does NOT generate fake data if data is insufficient.
    """
    result = train_isolation_forest()
    return result


@app.post("/predict")
def predict_order_fraud(req: OrderPredictionRequest):
    """
    Calculates ML fraud/anomaly score for a completed order using real features,
    determines appropriate gate disposition, and persists the evaluation to fraud_detections.
    Does not expose sensitive customer information in response.
    """
    order = fetch_order_by_id(req.order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order '{req.order_id}' not found in database."
        )

    db_order_id = str(order.get("id"))
    user_id = req.user_id or order.get("user_id")

    order_items = fetch_order_items(order_id=db_order_id)
    payments = fetch_payments(order_id=db_order_id)
    
    profile = None
    if user_id:
        profiles = fetch_profiles()
        profile_matches = [p for p in profiles if str(p.get("id")) == str(user_id)]
        if profile_matches:
            profile = profile_matches[0]

    scan_events = fetch_scan_events(user_id=str(user_id) if user_id else None, session_id=req.session_id)
    exit_verifs = fetch_exit_verifications(order_id=db_order_id)
    exit_verif = exit_verifs[0] if exit_verifs else None
    exit_items = fetch_exit_verified_items(verification_id=str(exit_verif.get("id"))) if exit_verif else None

    features = extract_order_features(
        order=order,
        order_items=order_items,
        payments=payments,
        profile=profile,
        scan_events=scan_events,
        exit_verification=exit_verif,
        exit_items=exit_items,
    )

    prediction = predict_fraud_risk(features)
    risk_score = float(prediction.get("risk_score", 0.15))
    risk_level = str(prediction.get("risk_level", "low")).lower()
    is_anomaly = bool(prediction.get("is_anomaly", False))

    if risk_level == "low":
        action_taken = "auto_cleared"
    else:
        action_taken = "flag_for_gate_check"

    risk_factors = {
        "total_order_value": float(features.get("total_order_value") or 0.0),
        "item_count": float(features.get("item_count") or 0.0),
        "total_quantity": float(features.get("total_quantity") or 0.0),
        "average_item_price": float(features.get("average_item_price") or 0.0),
        "payment_discrepancy": float(features.get("payment_discrepancy") or 0.0),
        "is_payment_completed": float(features.get("is_payment_completed") or 1.0),
        "manual_scan_ratio": features.get("manual_scan_ratio"),
        "failed_scan_ratio": features.get("failed_scan_ratio"),
        "mismatch_detected": features.get("mismatch_detected"),
        "account_age_days": float(features.get("account_age_days") or 0.0),
        "evaluated_features_count": len(MODEL_FEATURES),
    }

    save_fraud_detection(
        order_id=db_order_id,
        user_id=str(user_id) if user_id else None,
        risk_score=risk_score,
        risk_level=risk_level,
        risk_factors=risk_factors,
        action_taken=action_taken,
    )

    return {
        "order_id": str(order.get("order_id") or db_order_id),
        "risk_score": round(risk_score, 4),
        "risk_level": risk_level,
        "anomaly_detected": is_anomaly,
        "action_taken": action_taken,
        "status": "evaluated",
    }


@app.post("/model/predict")
def predict_features(payload: FeatureRecordModel):
    """
    Evaluates order features directly and returns non-sensitive anomaly metrics.
    """
    return predict_fraud_risk(payload.model_dump())
