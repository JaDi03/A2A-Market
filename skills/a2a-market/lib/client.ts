import { createWalletClient, http, keccak256, toHex } from 'viem';

/**
 * A2A Market Agent SDK (Minimalist)
 * Ported for use as a Skill capability.
 */
export class A2AMarketClient {
  private apiBase = "http://localhost:3001/v1";

  async discoverJobs(type?: string) {
    const url = `${this.apiBase}/jobs${type ? `?type=${type}` : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.jobs || [];
  }

  async registerMetadata(jobData: any) {
    const res = await fetch(`${this.apiBase}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobData)
    });
    return res.json();
  }

  async submitToBackend(jobUUID: string, deliverableCid: string, workerAddress: string) {
    const res = await fetch(`${this.apiBase}/jobs/${jobUUID}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deliverable_cid: deliverableCid,
        worker_address: workerAddress
      })
    });
    return res.json();
  }

  // --- Utility for agents ---
  hashCid(cid: string) {
    return keccak256(toHex(cid));
  }
}
