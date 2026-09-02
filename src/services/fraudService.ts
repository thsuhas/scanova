/**
 * Scanova ML Fraud & Barcode Tampering Integration Client
 * Provides safe, non-blocking evaluation of completed orders and physical barcode images.
 * If the ML service is offline or unreachable, checkout and scanning proceed normally.
 */

import { supabase } from '../lib/supabase';

const ML_SERVICE_URL = import.meta.env.VITE_ML_SERVICE_URL || 'http://localhost:8000';

export interface FraudEvaluationResult {
  order_id: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  anomaly_detected: boolean;
  action_taken: 'auto_cleared' | 'flag_for_gate_check' | 'blocked';
  status: string;
}

export interface BarcodeTamperingResult {
  detected: boolean;
  score: number;
  level: 'low' | 'medium' | 'high';
  method: string;
  model_version: string;
  tampering_type: string;
  error?: string;
}

export interface CombinedSecurityResult {
  overall_status: 'cleared' | 'flagged';
  action_taken: 'auto_cleared' | 'flag_for_gate_check';
  transaction_fraud: {
    risk_score: number;
    risk_level: 'low' | 'medium' | 'high';
    anomaly_detected: boolean;
  };
  barcode_tampering: {
    tampering_detected: boolean;
    tampering_score: number;
    tampering_level: 'low' | 'medium' | 'high';
    tampering_type: string;
  };
}

export async function requestOrderFraudEvaluation(
  orderId: string,
  userId?: string | null
): Promise<FraudEvaluationResult | null> {
  if (!orderId) return null;

  try {
    const response = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: orderId,
        user_id: userId || null,
      }),
    });

    if (!response.ok) {
      console.warn(`[ML Service] Prediction request returned status ${response.status}`);
      return null;
    }

    const data: FraudEvaluationResult = await response.json();
    return data;
  } catch (error) {
    console.warn('[ML Service] ML service unreachable; checkout continuing with standard verification.');
    return null;
  }
}

export async function evaluateBarcodeTampering(
  imageData: string,
  barcode?: string
): Promise<BarcodeTamperingResult | null> {
  if (!imageData) return null;

  try {
    const response = await fetch(`${ML_SERVICE_URL}/barcode-tampering`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: imageData,
        barcode: barcode || null,
      }),
    });

    if (!response.ok) {
      console.warn(`[CV Tampering] Tampering evaluation returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.barcode_tampering || null;
  } catch (error) {
    console.warn('[CV Tampering] Barcode tampering CV service unreachable; proceeding without CV block.');
    return null;
  }
}

export function isBarcodeTampered(
  result?: BarcodeTamperingResult | null
): boolean {
  if (!result) return false;
  // High-confidence physical tampering criteria:
  // 1. Model explicitly classified as detected = true AND assigned level = 'high', OR
  // 2. Continuous tampering score >= 0.85 (calibrated high-confidence threshold).
  // Low-risk genuine barcodes (score < 0.35, level = 'low') and ambiguous/medium signals (< 0.85) are cleared.
  if (result.detected === true && result.level === 'high') {
    return true;
  }
  if (typeof result.score === 'number' && result.score >= 0.85) {
    return true;
  }
  return false;
}

export function computeCombinedSecurity(
  fraudResult?: FraudEvaluationResult | null,
  tamperingResult?: BarcodeTamperingResult | null
): CombinedSecurityResult {
  const fScore = fraudResult ? fraudResult.risk_score : 0.15;
  const fLevel = fraudResult ? fraudResult.risk_level : 'low';
  const fAnomaly = fraudResult ? fraudResult.anomaly_detected : false;

  const tTampered = isBarcodeTampered(tamperingResult);
  const tScore = tamperingResult ? tamperingResult.score : 0.0;
  const tLevel = tamperingResult ? (tTampered ? 'high' : tamperingResult.level) : 'low';
  const tType = tamperingResult ? tamperingResult.tampering_type : 'none';

  const isFlagged = fLevel === 'high' || fAnomaly || tTampered;

  return {
    overall_status: isFlagged ? 'flagged' : 'cleared',
    action_taken: isFlagged ? 'flag_for_gate_check' : 'auto_cleared',
    transaction_fraud: {
      risk_score: fScore,
      risk_level: fLevel,
      anomaly_detected: fAnomaly,
    },
    barcode_tampering: {
      tampering_detected: tTampered,
      tampering_score: tScore,
      tampering_level: tLevel,
      tampering_type: tType,
    },
  };
}

export interface SaveBarcodeTamperingParams {
  userId?: string | null;
  username?: string | null;
  orderId?: string | null;
  barcode: string;
  tamperingResult: BarcodeTamperingResult;
}

export async function saveBarcodeTamperingDetection(
  params: SaveBarcodeTamperingParams
): Promise<boolean> {
  const { userId, username, orderId, barcode, tamperingResult } = params;
  if (!barcode || !tamperingResult) return false;

  try {
    let resolvedUserId = userId || null;
    let resolvedUsername = username || null;

    // If userId or username was not passed directly, resolve from current Supabase session
    if (!resolvedUserId || !resolvedUsername) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          resolvedUserId = resolvedUserId || authData.user.id;
          if (!resolvedUsername) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', authData.user.id)
              .maybeSingle();
            resolvedUsername = profile?.username || authData.user.email?.split('@')[0] || null;
          }
        }
      } catch (authErr) {
        // non-blocking fallback
      }
    }

    const isTampered = isBarcodeTampered(tamperingResult);
    const rawScore = typeof tamperingResult.score === 'number' ? tamperingResult.score : null;
    const cleanScore = rawScore !== null && !isNaN(rawScore)
      ? Number(Math.max(0, Math.min(1, rawScore)).toFixed(4))
      : null;

    let cleanLevel = (tamperingResult.level || 'low').toLowerCase();
    if (isTampered) {
      cleanLevel = 'high';
    } else if (cleanLevel !== 'medium' && cleanLevel !== 'high') {
      cleanLevel = 'low';
    }

    const payload = {
      user_id: resolvedUserId,
      username: resolvedUsername,
      order_id: orderId || null,
      barcode: String(barcode),
      tampering_score: cleanScore,
      risk_level: cleanLevel,
      tampering_detected: isTampered,
      tampering_type: tamperingResult.tampering_type || 'none',
      model_version: tamperingResult.model_version || 'barcode_cv_v1',
    };

    const { error } = await supabase
      .from('barcode_tampering_detections')
      .insert(payload);

    if (error) {
      console.warn('[Barcode CV] Error persisting tampering detection to Supabase:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[Barcode CV] Failed to save barcode tampering detection:', error);
    return false;
  }
}

