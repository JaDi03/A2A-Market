/**
 * Simple in-memory mock database/indexer for A2A Market.
 * In a production environment, this would be a PostgreSQL database 
 * or an indexer tracking ERC-8183 events on Arc Testnet.
 */

export interface JobRecord {
  job_id: string;
  erc8183_id?: string;
  status: 'pending_onchain' | 'open' | 'active' | 'pending_evaluation' | 'completed' | 'failed' | 'cancelled';
  data: any; // Full job schema object
  created_at: string;
  provider_address?: string;
  deliverable?: any;
}

class MockDatabase {
  private jobs: Map<string, JobRecord> = new Map();

  createJob(jobData: any): JobRecord {
    const job_id = jobData.job_id || Math.random().toString(36).substring(7);
    const record: JobRecord = {
      job_id,
      status: jobData.status || 'open',
      data: { ...jobData, job_id },
      created_at: new Date().toISOString()
    };
    this.jobs.set(job_id, record);
    return record;
  }

  getJob(job_id: string): JobRecord | undefined {
    return this.jobs.get(job_id);
  }

  storeDeliverable(job_id: string, deliverable: any) {
    const job = this.jobs.get(job_id);
    if (job) {
        job.deliverable = deliverable;
    }
  }

  listOpenJobs(filters: { type?: string; min_budget?: number }): JobRecord[] {
    return Array.from(this.jobs.values()).filter(job => {
      if (job.status !== 'open') return false;
      if (filters.type && job.data.job_type !== filters.type) return false;
      if (filters.min_budget && job.data.budget_usdc < filters.min_budget) return false;
      return true;
    });
  }

  updateStatus(job_id: string, status: JobRecord['status'], provider_address?: string): boolean {
    const job = this.jobs.get(job_id);
    if (!job) return false;
    job.status = status;
    if (provider_address) job.provider_address = provider_address;
    return true;
  }

  getJobByChainId(chainId: string): JobRecord | undefined {
    return Array.from(this.jobs.values()).find(j => j.erc8183_id === chainId);
  }
}

export const db = new MockDatabase();
