"""
Scanova ML Service - Feature Engineering and Data Preparation Layer
Transforms raw Scanova Supabase transactions and telemetry into structured,
numeric feature vectors for fraud detection model training and inference.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from supabase_client import (
    fetch_orders,
    fetch_order_items,
    fetch_payments,
    fetch_profiles,
    fetch_products,
    fetch_inventory,
    fetch_scan_events,
    fetch_exit_verifications,
    fetch_exit_verified_items,
)


def _parse_timestamp(val: Any) -> Optional[datetime]:
    """Safely parse ISO/string timestamp or datetime object."""
    if val is None or (isinstance(val, float) and np.isnan(val)):
        return None
    if isinstance(val, datetime):
        return val
    try:
        ts = pd.to_datetime(val)
        return ts.to_pydatetime() if hasattr(ts, "to_pydatetime") else None
    except Exception:
        return None


def calculate_scanning_features(scan_events: List[Dict[str, Any]]) -> Dict[str, float]:
    """
    Calculate scanning behavior features from raw scan telemetry events.
    Handles empty/unavailable telemetry by setting ratios and velocity to NaN.
    """
    if not scan_events:
        return {
            "scan_count": np.nan,
            "manual_scan_ratio": np.nan,
            "failed_scan_ratio": np.nan,
            "scan_velocity": np.nan,
        }

    total_scans = len(scan_events)
    manual_scans = sum(1 for s in scan_events if str(s.get("scan_type", "")).lower() == "manual")
    failed_scans = sum(1 for s in scan_events if str(s.get("status", "")).lower() in ("not_found", "error"))

    manual_ratio = (manual_scans / total_scans) if total_scans > 0 else 0.0
    failed_ratio = (failed_scans / total_scans) if total_scans > 0 else 0.0

    timestamps = []
    for s in scan_events:
        ts = _parse_timestamp(s.get("scanned_at"))
        if ts:
            timestamps.append(ts)

    scan_velocity = np.nan
    if len(timestamps) > 1:
        timestamps.sort()
        intervals = [(t2 - t1).total_seconds() for t1, t2 in zip(timestamps[:-1], timestamps[1:])]
        scan_velocity = float(np.mean(intervals)) if intervals else np.nan

    return {
        "scan_count": float(total_scans),
        "manual_scan_ratio": float(manual_ratio),
        "failed_scan_ratio": float(failed_ratio),
        "scan_velocity": float(scan_velocity) if not np.isnan(scan_velocity) else np.nan,
    }


def calculate_cart_order_features(
    order: Dict[str, Any],
    order_items: List[Dict[str, Any]],
) -> Dict[str, float]:
    """
    Calculate cart and order behavior features.
    Extracts item counts and quantities from order_items table or fallback items JSONB.
    """
    subtotal = float(order.get("subtotal") or 0.0)
    gst = float(order.get("gst") or 0.0)
    total_order_value = float(order.get("total") or (subtotal + gst))

    quantities: List[int] = []

    if order_items:
        for item in order_items:
            qty = int(item.get("quantity") or 0)
            if qty > 0:
                quantities.append(qty)
    elif "items" in order and isinstance(order["items"], list):
        for item in order["items"]:
            if isinstance(item, dict):
                qty = int(item.get("quantity") or 1)
                quantities.append(qty)

    item_count = len(quantities)
    total_quantity = sum(quantities)
    max_item_quantity = max(quantities) if quantities else 0
    average_item_price = (total_order_value / total_quantity) if total_quantity > 0 else 0.0

    return {
        "subtotal": float(subtotal),
        "gst": float(gst),
        "total_order_value": float(total_order_value),
        "item_count": float(item_count),
        "total_quantity": float(total_quantity),
        "average_item_price": float(average_item_price),
        "max_item_quantity": float(max_item_quantity),
    }


def calculate_payment_features(
    order: Dict[str, Any],
    payments: List[Dict[str, Any]],
) -> Dict[str, float]:
    """
    Calculate payment behavior features and verify alignment with order value.
    """
    order_total = float(order.get("total") or 0.0)

    if not payments:
        payment_method = str(order.get("payment_method", "")).lower()
        payment_status = str(order.get("payment_status", "")).lower()
        is_completed = 1.0 if payment_status == "completed" else 0.0

        return {
            "payment_amount": order_total if is_completed else np.nan,
            "payment_to_order_ratio": 1.0 if (is_completed and order_total > 0) else np.nan,
            "payment_discrepancy": 0.0 if is_completed else np.nan,
            "is_payment_completed": is_completed,
            "payment_method_card": 1.0 if "card" in payment_method else 0.0,
            "payment_method_upi": 1.0 if "upi" in payment_method else 0.0,
            "payment_method_cash": 1.0 if "cash" in payment_method else 0.0,
        }

    total_paid = sum(float(p.get("amount") or 0.0) for p in payments)
    completed_payments = [p for p in payments if str(p.get("payment_status", "")).lower() == "completed"]
    is_completed = 1.0 if (completed_payments or str(order.get("payment_status", "")).lower() == "completed") else 0.0

    payment_ratio = (total_paid / order_total) if order_total > 0 else (1.0 if total_paid == 0 else np.nan)
    discrepancy = abs(total_paid - order_total)
    first_method = str(payments[0].get("payment_method", order.get("payment_method", ""))).lower()

    return {
        "payment_amount": float(total_paid),
        "payment_to_order_ratio": float(payment_ratio),
        "payment_discrepancy": float(discrepancy),
        "is_payment_completed": float(is_completed),
        "payment_method_card": 1.0 if "card" in first_method else 0.0,
        "payment_method_upi": 1.0 if "upi" in first_method else 0.0,
        "payment_method_cash": 1.0 if "cash" in first_method else 0.0,
    }


def calculate_exit_verification_features(
    order: Dict[str, Any],
    exit_verification: Optional[Dict[str, Any]] = None,
    exit_items: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, float]:
    """
    Calculate exit gate and turnstile verification features.
    """
    qr_scan_count_val = order.get("qr_scan_count")
    qr_scan_count = float(qr_scan_count_val) if qr_scan_count_val is not None else np.nan

    time_to_exit_seconds = np.nan
    first_scanned_at = _parse_timestamp(order.get("first_scanned_at"))
    order_created_at = _parse_timestamp(order.get("created_at"))
    if first_scanned_at and order_created_at:
        time_to_exit_seconds = float(max(0.0, (first_scanned_at - order_created_at).total_seconds()))

    if not exit_verification:
        return {
            "qr_scan_count": qr_scan_count,
            "time_to_exit_seconds": time_to_exit_seconds,
            "billed_item_count": np.nan,
            "verified_item_count": np.nan,
            "quantity_difference": np.nan,
            "mismatch_detected": np.nan,
            "unbilled_item_count": np.nan,
            "missing_item_count": np.nan,
            "excess_item_count": np.nan,
        }

    billed_count = float(exit_verification.get("total_billed_items") or 0.0)
    verified_count = float(exit_verification.get("total_verified_items") or 0.0)
    qty_diff = abs(verified_count - billed_count)
    mismatch_bool = exit_verification.get("mismatch_detected")
    mismatch_val = 1.0 if mismatch_bool else 0.0

    unbilled_count = np.nan
    missing_count = np.nan
    excess_count = np.nan

    if exit_items is not None:
        unbilled_count = float(sum(1 for i in exit_items if str(i.get("status", "")).lower() == "unbilled"))
        missing_count = float(sum(1 for i in exit_items if str(i.get("status", "")).lower() == "missing"))
        excess_count = float(sum(1 for i in exit_items if str(i.get("status", "")).lower() == "excess"))

    return {
        "qr_scan_count": qr_scan_count,
        "time_to_exit_seconds": time_to_exit_seconds,
        "billed_item_count": billed_count,
        "verified_item_count": verified_count,
        "quantity_difference": qty_diff,
        "mismatch_detected": mismatch_val,
        "unbilled_item_count": unbilled_count,
        "missing_item_count": missing_count,
        "excess_item_count": excess_count,
    }


def calculate_customer_history_features(
    order: Dict[str, Any],
    profile: Optional[Dict[str, Any]],
    prior_orders: List[Dict[str, Any]],
) -> Dict[str, float]:
    """
    Calculate customer tenure, order frequency, and historical spending features.
    """
    order_created_at = _parse_timestamp(order.get("created_at")) or datetime.utcnow()
    profile_created_at = _parse_timestamp(profile.get("created_at") if profile else None)

    account_age_days = 0.0
    if profile_created_at:
        delta = (order_created_at - profile_created_at).total_seconds() / 86400.0
        account_age_days = float(max(0.0, delta))

    previous_order_count = float(len(prior_orders))
    previous_total_spent = float(sum(float(o.get("total") or 0.0) for o in prior_orders))

    return {
        "account_age_days": account_age_days,
        "previous_order_count": previous_order_count,
        "previous_total_spent": previous_total_spent,
    }


def extract_order_features(
    order: Dict[str, Any],
    order_items: List[Dict[str, Any]],
    payments: List[Dict[str, Any]],
    profile: Optional[Dict[str, Any]] = None,
    prior_orders: Optional[List[Dict[str, Any]]] = None,
    scan_events: Optional[List[Dict[str, Any]]] = None,
    exit_verification: Optional[Dict[str, Any]] = None,
    exit_items: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Extracts a unified numeric feature vector for a given order context.
    """
    order_id = order.get("id") or order.get("order_id")
    user_id = order.get("user_id")

    scanning_feats = calculate_scanning_features(scan_events or [])
    cart_feats = calculate_cart_order_features(order, order_items)
    payment_feats = calculate_payment_features(order, payments)
    exit_feats = calculate_exit_verification_features(order, exit_verification, exit_items)
    history_feats = calculate_customer_history_features(order, profile, prior_orders or [])

    feature_record: Dict[str, Any] = {
        "order_id": str(order_id),
        "user_id": str(user_id) if user_id else None,
        **cart_feats,
        **payment_feats,
        **scanning_feats,
        **exit_feats,
        **history_feats,
    }

    return feature_record


def build_feature_dataframe(
    orders: List[Dict[str, Any]],
    order_items: List[Dict[str, Any]],
    payments: List[Dict[str, Any]],
    profiles: List[Dict[str, Any]],
    scan_events: Optional[List[Dict[str, Any]]] = None,
    exit_verifications: Optional[List[Dict[str, Any]]] = None,
    exit_verified_items: Optional[List[Dict[str, Any]]] = None,
) -> pd.DataFrame:
    """
    Combines relational collections and constructs an ML-ready pandas DataFrame.
    """
    items_by_order: Dict[str, List[Dict[str, Any]]] = {}
    for item in order_items:
        oid = str(item.get("order_id", ""))
        items_by_order.setdefault(oid, []).append(item)

    payments_by_order: Dict[str, List[Dict[str, Any]]] = {}
    for p in payments:
        oid = str(p.get("order_id", ""))
        payments_by_order.setdefault(oid, []).append(p)

    profiles_by_user: Dict[str, Dict[str, Any]] = {
        str(prof.get("id", "")): prof for prof in profiles
    }

    scans_by_user: Dict[str, List[Dict[str, Any]]] = {}
    if scan_events:
        for s in scan_events:
            uid = str(s.get("user_id", ""))
            scans_by_user.setdefault(uid, []).append(s)

    exit_by_order: Dict[str, Dict[str, Any]] = {}
    if exit_verifications:
        for ev in exit_verifications:
            oid = str(ev.get("order_id", ""))
            exit_by_order[oid] = ev

    exit_items_by_verif: Dict[str, List[Dict[str, Any]]] = {}
    if exit_verified_items:
        for ei in exit_verified_items:
            vid = str(ei.get("verification_id", ""))
            exit_items_by_verif.setdefault(vid, []).append(ei)

    sorted_orders = sorted(
        orders,
        key=lambda o: _parse_timestamp(o.get("created_at")) or datetime.min
    )

    user_order_history: Dict[str, List[Dict[str, Any]]] = {}
    feature_rows: List[Dict[str, Any]] = []

    for order in sorted_orders:
        oid = str(order.get("id", ""))
        uid = str(order.get("user_id", ""))

        order_items_list = items_by_order.get(oid, [])
        order_payments_list = payments_by_order.get(oid, [])
        profile_dict = profiles_by_user.get(uid)
        prior_orders = user_order_history.get(uid, [])

        user_scans = scans_by_user.get(uid, [])
        exit_verif = exit_by_order.get(oid)
        exit_items_list = exit_items_by_verif.get(str(exit_verif.get("id", ""))) if exit_verif else None

        record = extract_order_features(
            order=order,
            order_items=order_items_list,
            payments=order_payments_list,
            profile=profile_dict,
            prior_orders=prior_orders,
            scan_events=user_scans,
            exit_verification=exit_verif,
            exit_items=exit_items_list,
        )
        feature_rows.append(record)
        user_order_history.setdefault(uid, []).append(order)

    if not feature_rows:
        columns = [
            "order_id", "user_id", "subtotal", "gst", "total_order_value",
            "item_count", "total_quantity", "average_item_price", "max_item_quantity",
            "payment_amount", "payment_to_order_ratio", "payment_discrepancy",
            "is_payment_completed", "payment_method_card", "payment_method_upi", "payment_method_cash",
            "scan_count", "manual_scan_ratio", "failed_scan_ratio", "scan_velocity",
            "qr_scan_count", "time_to_exit_seconds", "billed_item_count", "verified_item_count",
            "quantity_difference", "mismatch_detected", "unbilled_item_count", "missing_item_count", "excess_item_count",
            "account_age_days", "previous_order_count", "previous_total_spent"
        ]
        return pd.DataFrame(columns=columns)

    return pd.DataFrame(feature_rows)


def prepare_live_feature_dataset(limit: Optional[int] = None) -> pd.DataFrame:
    """
    Fetches available dataset from Supabase using supabase_client and prepares
    an ML-ready feature DataFrame.
    """
    orders = fetch_orders(limit=limit)
    order_items = fetch_order_items(limit=limit)
    payments = fetch_payments(limit=limit)
    profiles = fetch_profiles(limit=limit)
    scan_events = fetch_scan_events(limit=limit)
    exit_verifications = fetch_exit_verifications(limit=limit)
    exit_verified_items = fetch_exit_verified_items(limit=limit)

    return build_feature_dataframe(
        orders=orders,
        order_items=order_items,
        payments=payments,
        profiles=profiles,
        scan_events=scan_events,
        exit_verifications=exit_verifications,
        exit_verified_items=exit_verified_items,
    )
