/**
 * Scanova ML Fraud Detection Integration Client
 * Provides safe, non-blocking evaluation of completed orders.
 * If the ML service is offline or unreachable, checkout operations proceed normally.
 */

const ML_SERVICE_URL = import.meta.env.VITE_ML_SERVICE_URL || 'http://localhost:8000';

export interface FraudEvaluationResult {
  order_id: string;
  risk_score: number;
  risk_level: 'low' | 'medium' | 'high';
  anomaly_detected: boolean;
  action_taken: 'auto_cleared' | 'flag_for_gate_check' | 'blocked';
  status: string;
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
