"""
Scanova ML Service - Schema Verification Script
Verifies presence of Step 4 tables and altered columns on live Supabase.
"""

from supabase_client import get_supabase_client


def verify_schema():
    client = get_supabase_client()
    results = {}

    tables = ["fraud_detections", "scan_events", "exit_verifications", "exit_verified_items", "barcode_tampering_detections"]
    for table in tables:
        try:
            res = client.table(table).select("id").limit(1).execute()
            results[table] = True
        except Exception as exc:
            results[table] = False
            print(f"Error checking {table}: {exc}")

    try:
        res = client.table("orders").select("qr_token, qr_scan_count, first_scanned_at, last_scanned_at, exit_status").limit(1).execute()
        results["orders_qr_columns"] = True
    except Exception as exc:
        results["orders_qr_columns"] = False
        print(f"Error checking orders columns: {exc}")

    print("--- SCHEMA VERIFICATION RESULTS ---")
    for item, exists in results.items():
        print(f"{item}: {'EXISTS' if exists else 'MISSING'}")
    return results


if __name__ == "__main__":
    verify_schema()
