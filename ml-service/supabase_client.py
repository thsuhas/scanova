"""
Scanova ML Service - Supabase Database Client Module
Provides safe data access to existing Scanova Supabase tables:
- orders
- order_items
- payments
- products
- profiles
- inventory
- scan_events
- exit_verifications
- exit_verified_items
- fraud_detections
"""

import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import numpy as np
from dotenv import load_dotenv
from supabase import Client, create_client

# Locate and load environment variables from ml-service/.env or root .env
BASE_DIR = Path(__file__).resolve().parent
PARENT_DIR = BASE_DIR.parent

# Load local ml-service .env first if present, then fallback to root .env
load_dotenv(BASE_DIR / ".env")
load_dotenv(PARENT_DIR / ".env")

# Resolve Supabase URL and Key from supported environment variables
SUPABASE_URL: Optional[str] = (
    os.getenv("SUPABASE_URL")
    or os.getenv("VITE_SUPABASE_URL")
)

SUPABASE_KEY: Optional[str] = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or os.getenv("VITE_SUPABASE_ANON_KEY")
)

_client: Optional[Client] = None


def get_supabase_client() -> Client:
    """
    Initializes and returns the Supabase client instance.
    Raises ValueError if required environment variables are not found.
    """
    global _client
    if _client is not None:
        return _client

    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError(
            "Supabase credentials not configured. Please set SUPABASE_URL / VITE_SUPABASE_URL "
            "and SUPABASE_KEY / VITE_SUPABASE_ANON_KEY in environment variables or .env file."
        )

    _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


def test_supabase_connection() -> bool:
    """
    Safely tests connection to the Supabase database by reading a single record
    from the products table. Returns True if successful, False otherwise.
    Does NOT log or return any sensitive data.
    """
    try:
        client = get_supabase_client()
        response = client.table("products").select("id").limit(1).execute()
        return response.data is not None
    except Exception as exc:
        print(f"Supabase connection test failed: {exc}")
        return False


def fetch_orders(limit: Optional[int] = None, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Read order records from 'orders' table.
    Columns: id, order_id, user_id, items, subtotal, gst, total,
             payment_method, payment_status, created_at, qr_token,
             qr_scan_count, first_scanned_at, last_scanned_at, exit_status
    """
    client = get_supabase_client()
    query = client.table("orders").select("*")
    if user_id:
        query = query.eq("user_id", user_id)
    if limit:
        query = query.limit(limit)
    response = query.execute()
    return response.data or []


def fetch_order_items(order_id: Optional[str] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Read line items from 'order_items' table.
    Columns: id, order_id, product_id, quantity, price, size, created_at
    """
    client = get_supabase_client()
    query = client.table("order_items").select(
        "id, order_id, product_id, quantity, price, size, created_at"
    )
    if order_id:
        query = query.eq("order_id", order_id)
    if limit:
        query = query.limit(limit)
    response = query.execute()
    return response.data or []


def fetch_payments(order_id: Optional[str] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Read payment transactions from 'payments' table.
    Columns: id, order_id, transaction_id, receipt_number, amount,
             payment_method, payment_status, created_at
    """
    client = get_supabase_client()
    query = client.table("payments").select(
        "id, order_id, transaction_id, receipt_number, amount, "
        "payment_method, payment_status, created_at"
    )
    if order_id:
        query = query.eq("order_id", order_id)
    if limit:
        query = query.limit(limit)
    response = query.execute()
    return response.data or []


def fetch_products(limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Read catalog products from 'products' table.
    Columns: id, name, brand, size, price, image, created_at
    """
    client = get_supabase_client()
    query = client.table("products").select(
        "id, name, brand, size, price, image, created_at"
    )
    if limit:
        query = query.limit(limit)
    response = query.execute()
    return response.data or []


def fetch_profiles(limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Read user profiles from 'profiles' table.
    Columns: id, username, email, created_at
    """
    client = get_supabase_client()
    query = client.table("profiles").select(
        "id, username, email, created_at"
    )
    if limit:
        query = query.limit(limit)
    response = query.execute()
    return response.data or []


def fetch_inventory(limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Read product inventory levels from 'inventory' table.
    Columns: product_id, stock, updated_at
    """
    client = get_supabase_client()
    query = client.table("inventory").select(
        "product_id, stock, updated_at"
    )
    if limit:
        query = query.limit(limit)
    response = query.execute()
    return response.data or []


def fetch_scan_events(user_id: Optional[str] = None, session_id: Optional[str] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Safely read scan events telemetry if table exists.
    Returns empty list if table does not exist yet.
    """
    try:
        client = get_supabase_client()
        query = client.table("scan_events").select("*")
        if user_id:
            query = query.eq("user_id", user_id)
        if session_id:
            query = query.eq("session_id", session_id)
        if limit:
            query = query.limit(limit)
        response = query.execute()
        return response.data or []
    except Exception:
        return []


def fetch_exit_verifications(order_id: Optional[str] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Safely read exit verification records if table exists.
    Returns empty list if table does not exist yet.
    """
    try:
        client = get_supabase_client()
        query = client.table("exit_verifications").select("*")
        if order_id:
            query = query.eq("order_id", order_id)
        if limit:
            query = query.limit(limit)
        response = query.execute()
        return response.data or []
    except Exception:
        return []


def fetch_exit_verified_items(verification_id: Optional[str] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Safely read exit verified items if table exists.
    Returns empty list if table does not exist yet.
    """
    try:
        client = get_supabase_client()
        query = client.table("exit_verified_items").select("*")
        if verification_id:
            query = query.eq("verification_id", verification_id)
        if limit:
            query = query.limit(limit)
        response = query.execute()
        return response.data or []
    except Exception:
        return []


def fetch_order_by_id(order_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetches a single order by its primary key UUID 'id' or business 'order_id'.
    """
    client = get_supabase_client()
    try:
        res = client.table("orders").select("*").eq("id", order_id).limit(1).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception:
        pass

    try:
        res = client.table("orders").select("*").eq("order_id", order_id).limit(1).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
    except Exception:
        pass

    return None


def sanitize_json_value(val: Any) -> Any:
    """
    Recursively sanitizes values for RFC 8259 JSON compliance.
    Ensures no NaN, Infinity, -Infinity, or non-serializable objects exist.
    Converts numpy scalar types to native Python types.
    """
    if val is None:
        return None
    if isinstance(val, (float, np.floating)):
        f = float(val)
        if np.isnan(f) or np.isinf(f):
            return 0.0
        return f
    if isinstance(val, (int, np.integer)):
        return int(val)
    if isinstance(val, (bool, np.bool_)):
        return bool(val)
    if isinstance(val, str):
        return val
    if isinstance(val, dict):
        return {str(k): sanitize_json_value(v) for k, v in val.items()}
    if isinstance(val, (list, tuple, set)):
        return [sanitize_json_value(v) for v in val]
    return str(val)


def save_fraud_detection(
    order_id: str,
    user_id: Optional[str],
    risk_score: float,
    risk_level: str,
    risk_factors: Dict[str, Any],
    action_taken: str,
) -> Optional[Dict[str, Any]]:
    """
    Persists an ML anomaly risk evaluation to the 'fraud_detections' table.
    Guarantees all payload fields and nested JSONB risk factors are strictly
    finite, valid JSON compliant types.
    """
    try:
        client = get_supabase_client()

        clean_risk_score = float(risk_score) if (risk_score is not None and not np.isnan(risk_score) and not np.isinf(risk_score)) else 0.15
        clean_risk_score = float(np.clip(clean_risk_score, 0.0, 1.0))

        clean_risk_level = str(risk_level or "low").lower()
        if clean_risk_level not in ("low", "medium", "high"):
            clean_risk_level = "low"

        clean_action_taken = str(action_taken or "auto_cleared").lower()
        if clean_action_taken not in ("auto_cleared", "flag_for_gate_check", "blocked"):
            clean_action_taken = "auto_cleared" if clean_risk_level == "low" else "flag_for_gate_check"

        clean_risk_factors = sanitize_json_value(risk_factors) if risk_factors else {}

        payload = {
            "order_id": str(order_id),
            "user_id": str(user_id) if user_id else None,
            "risk_score": clean_risk_score,
            "risk_level": clean_risk_level,
            "risk_factors": clean_risk_factors,
            "action_taken": clean_action_taken,
        }
        res = client.table("fraud_detections").insert(payload).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        return payload
    except Exception as exc:
        print(f"Warning: Failed to save fraud detection record: {exc}")
        return None


def fetch_fraud_detections(order_id: Optional[str] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    Reads fraud detection assessments from 'fraud_detections' table.
    """
    try:
        client = get_supabase_client()
        query = client.table("fraud_detections").select("*")
        if order_id:
            query = query.eq("order_id", order_id)
        if limit:
            query = query.limit(limit)
        response = query.execute()
        return response.data or []
    except Exception:
        return []


def save_barcode_tampering_detection(
    barcode: str,
    tampering_score: Optional[float],
    risk_level: str,
    tampering_detected: bool,
    tampering_type: Optional[str] = None,
    user_id: Optional[str] = None,
    username: Optional[str] = None,
    order_id: Optional[str] = None,
    model_version: str = "barcode_cv_v1",
) -> Optional[Dict[str, Any]]:
    """
    Persists a barcode tampering CV evaluation to the 'barcode_tampering_detections' table.
    """
    try:
        client = get_supabase_client()
        clean_score = (
            float(np.clip(float(tampering_score), 0.0, 1.0))
            if (tampering_score is not None and not np.isnan(tampering_score) and not np.isinf(tampering_score))
            else None
        )
        clean_level = str(risk_level or "low").lower()
        if clean_level not in ("low", "medium", "high"):
            clean_level = "low"

        payload = {
            "user_id": str(user_id) if user_id else None,
            "username": str(username) if username else None,
            "order_id": str(order_id) if order_id else None,
            "barcode": str(barcode),
            "tampering_score": round(clean_score, 4) if clean_score is not None else None,
            "risk_level": clean_level,
            "tampering_detected": bool(tampering_detected),
            "tampering_type": str(tampering_type or "none"),
            "model_version": str(model_version or "barcode_cv_v1"),
        }
        res = client.table("barcode_tampering_detections").insert(payload).execute()
        if res.data and len(res.data) > 0:
            return res.data[0]
        return payload
    except Exception as exc:
        print(f"Warning: Failed to save barcode tampering detection record: {exc}")
        return None


def fetch_barcode_tampering_detections(
    barcode: Optional[str] = None,
    limit: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Reads barcode tampering detections from 'barcode_tampering_detections' table.
    """
    try:
        client = get_supabase_client()
        query = client.table("barcode_tampering_detections").select("*").order("created_at", desc=True)
        if barcode:
            query = query.eq("barcode", barcode)
        if limit:
            query = query.limit(limit)
        response = query.execute()
        return response.data or []
    except Exception:
        return []

