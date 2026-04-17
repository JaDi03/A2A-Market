export type EvaluationDecision = "approved" | "rejected";

export interface EvaluationResult {
  decision: EvaluationDecision;
  score: number;           // 0 to 100
  reason: string;          // Short summary
  explanation: string;     // Detailed breakdown
  confidence: number;      // 0 to 1
}

export interface Deliverable {
  deliverable_cid: string;
  metadata?: any;
  worker_address: string;
}
