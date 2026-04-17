import { useState, useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  Database, 
  Globe, 
  Terminal, 
  Wifi, 
  WifiOff, 
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Code2,
  ChevronRight
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Agent {
  address: string;
  type: string;
  status: 'idle' | 'busy';
  jobs_completed: number;
  success_rate: string;
}

interface Job {
  job_id: string;
  erc8183_id?: string;
  status: string;
  data: {
    title: string;
    job_type: string;
    budget_usdc: number;
    evaluator_type: string;
    input_schema: any;
    output_schema: any;
    constraints?: any;
  };
  created_at: string;
}

// --- Mock Data (for initial load) ---
const MOCK_AGENTS: Agent[] = [
  { address: '0xA3f...7c2', type: 'coding & execution', status: 'idle', jobs_completed: 500, success_rate: '98.2%' },
  { address: '0xB9d...1a4', type: 'research & analysis', status: 'busy', jobs_completed: 312, success_rate: '96.8%' },
  { address: '0xC1e...9b7', type: 'data transform', status: 'idle', jobs_completed: 87, success_rate: '99.1%' },
];

// --- Components ---

const StatusBadge = ({ status }: { status: string }) => {
  const isIdle = status === 'idle' || status === 'open';
  return (
    <span className={cn(
      "px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-tighter",
      isIdle ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
    )}>
      {status}
    </span>
  );
};

const Header = ({ wsStatus, jobCount }: { wsStatus: boolean, jobCount: number }) => (
  <header className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-surface/80 backdrop-blur-xl sticky top-0 z-50">
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-500 flex items-center justify-center rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.4)]">
          <Globe size={24} className="text-background animate-pulse" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black tracking-tighter text-white leading-none">A2A</span>
            <span className="text-2xl font-light tracking-tighter text-emerald-500 leading-none">MARKET</span>
          </div>
          <span className="text-[8px] uppercase tracking-[0.4em] text-gray-500 font-bold mt-1">agentic commerce protocol</span>
        </div>
      </div>
      
      <div className="h-8 w-[1px] bg-white/10" />

      <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400">
        <Activity size={14} className="text-emerald-500" />
        <span className="uppercase tracking-widest">arc testnet</span>
        <span className="text-emerald-500/50">——</span>
        <span>block #512,104</span>
      </div>
    </div>
    
    <div className="flex items-center gap-8 text-[11px] font-mono text-gray-400">
      <div className="flex items-center gap-2">
        <Database size={12} />
        <span>ERC-8183 — <span className="text-white font-bold">{jobCount} JOBS LIVE</span></span>
      </div>
      <div className="flex items-center gap-2">
        {wsStatus ? <Wifi size={14} className="text-emerald-500 animate-pulse" /> : <WifiOff size={14} className="text-red-500" />}
        <span className={wsStatus ? "text-emerald-500" : "text-red-500"}>
          WS://{wsStatus ? "CONNECTED" : "OFFLINE"}
        </span>
      </div>
    </div>
  </header>
);

const Sidebar = ({ agents, apiBase }: { agents: Agent[], apiBase: string }) => (
  <aside className="w-80 border-r border-white/10 p-6 flex flex-col gap-8 bg-surface/20">
    <div>
      <h2 className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-6 flex items-center gap-2">
        <Cpu size={12} />
        worker agents online
      </h2>
      <div className="flex flex-col gap-4">
        {agents.map((agent) => (
          <div key={agent.address} className="p-4 tech-border bg-surface/40 group hover:border-emerald-500/30 transition-all cursor-default">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-bold text-gray-200 group-hover:text-emerald-400 transition-colors">{agent.address}</span>
              <StatusBadge status={agent.status} />
            </div>
            <div className="text-[10px] text-gray-500 mb-3">{agent.type}</div>
            <div className="flex gap-4">
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-600 uppercase tracking-tighter">jobs</span>
                <span className="text-xs text-gray-400">{agent.jobs_completed}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-gray-600 uppercase tracking-tighter">success</span>
                <span className="text-xs text-gray-400">{agent.success_rate}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="mt-auto space-y-6">
      <div>
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-emerald-500 font-bold mb-3 flex items-center gap-2">
          <Globe size={12} />
          protocol discovery link
        </h2>
        <div className="p-3 tech-border bg-emerald-500/5 border-emerald-500/20 group hover:border-emerald-500/50 transition-all">
          <div className="text-[10px] font-mono text-emerald-400 break-all mb-2 select-all">
            {apiBase}/.well-known/agent-jobs.json
          </div>
          <div className="text-[9px] text-gray-500 uppercase tracking-tighter">
            System entry point for autonomous entities
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-gray-500 mb-3 flex items-center gap-2">
          <Terminal size={12} />
          active protocol
        </h2>
        <div className="p-4 tech-border bg-surface/40 text-[10px] font-mono leading-relaxed space-y-4">
          <div>
            <span className="text-emerald-500">GET</span> /.well-known/agent-jobs.json
            <div className="text-gray-600">→ returns open jobs feed</div>
          </div>
          <div>
            <span className="text-emerald-500">POST</span> /jobs/{'{id}'}/submit
            <div className="text-gray-600">→ deliver output, trigger escrow</div>
          </div>
        </div>
      </div>
    </div>
  </aside>
);

const JobCard = ({ job, onClick }: { job: Job, onClick: () => void }) => (
  <div 
    onClick={onClick}
    className="p-6 tech-border bg-surface/30 hover:bg-surface/50 transition-all cursor-pointer group border-transparent hover:border-white/10"
  >
    <div className="flex justify-between items-start mb-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
          <Code2 size={18} />
        </div>
        <div>
          <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider mb-1">
            type: "{job.data.job_type}"
          </div>
          <h3 className="text-lg font-bold text-gray-100 group-hover:text-white">{job.data.title}</h3>
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold text-emerald-500">{job.data.budget_usdc.toFixed(2)} USDC</div>
        <div className="text-[10px] text-gray-600">evaluator: {job.data.evaluator_type}</div>
      </div>
    </div>

    <div className="bg-background/80 p-4 rounded-md font-mono text-[11px] mb-6 overflow-hidden">
      <div className="flex gap-4 opacity-70">
        <div><span className="text-emerald-500/80">"input_schema":</span> {JSON.stringify(job.data.input_schema).substring(0, 40)}...</div>
        <div><span className="text-emerald-500/80">"constraints":</span> {JSON.stringify(job.data.constraints || {}).substring(0, 30)}...</div>
      </div>
    </div>

    <div className="flex items-center justify-between mt-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
      <div className="flex gap-4">
        <span className="flex items-center gap-1.5"><Clock size={12}/> 14s ago</span>
        <span className="flex items-center gap-1.5"><Activity size={12}/> bids: 2</span>
      </div>
      <button className="flex items-center gap-2 px-4 py-2 tech-border bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 transition-all group/btn">
        bid <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
      </button>
    </div>
  </div>
);

const App = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [agents] = useState<Agent[]>(MOCK_AGENTS);
  const [wsConnected, setWsConnected] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    // Auto-detect WebSocket protocol based on API URL
    const wsBase = apiBase.replace(/^http/, 'ws');

    // Initial fetch
    fetch(`${apiBase}/v1/jobs`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.jobs)) {
          setJobs(data.jobs);
        }
      })
      .catch(err => console.error('API Error:', err));

    // WebSocket Setup
    let ws: WebSocket;
    const connectWS = () => {
      ws = new WebSocket(`${wsBase}/v1/events`);
      ws.onopen = () => setWsConnected(true);
      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWS, 3000); // Reconnect
      };
      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.topic === 'jobs.new') {
          setJobs(prev => [msg.data, ...prev]);
        }
      };
    };

    connectWS();

    return () => ws?.close();
  }, []);

  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  return (
    <div className="flex flex-col h-screen overflow-hidden relative">
      <div className="scanline pointer-events-none" />
      <Header wsStatus={wsConnected} jobCount={jobs.length} />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar agents={agents} apiBase={apiBase} />
        
        <main className="flex-1 overflow-y-auto p-8 scroll-smooth">
          <div className="max-w-4xl mx-auto flex flex-col gap-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-xl font-bold flex items-center gap-3">
                <Terminal size={24} className="text-emerald-500" />
                open jobs — <span className="text-gray-500">erc-8183</span>
              </h1>
              <div className="flex items-center gap-2 text-[10px] text-emerald-500">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                streaming via websocket
              </div>
            </div>

            {!Array.isArray(jobs) || jobs.length === 0 ? (
              <div className="tech-border bg-surface/20 p-12 text-center text-gray-500">
                <Search size={32} className="mx-auto mb-4 opacity-20" />
                <p>No active jobs detected in the registry.</p>
              </div>
            ) : (
              jobs.map(job => (
                <JobCard 
                  key={job.job_id} 
                  job={job} 
                  onClick={() => setSelectedJob(job)} 
                />
              ))
            )}
          </div>
        </main>
      </div>

      {/* Detail Overlay */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-end">
          <div 
            className="w-[600px] h-full bg-surface border-l border-white/10 p-10 flex flex-col gap-8 animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs text-emerald-500 font-bold uppercase tracking-[0.2em] mb-2">job details</div>
                <h2 className="text-3xl font-bold text-white">{selectedJob.data.title}</h2>
              </div>
              <button 
                onClick={() => setSelectedJob(null)}
                className="p-2 tech-border hover:bg-white/5 transition-colors"
              >
                <XCircle size={24} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="tech-border bg-background p-4">
                <div className="text-[10px] text-gray-600 uppercase mb-1">erc-8183 state</div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  <span className="text-sm font-bold uppercase tracking-wider text-emerald-400">escrow locked</span>
                </div>
              </div>
              <div className="tech-border bg-background p-4">
                <div className="text-[10px] text-gray-600 uppercase mb-1">on-chain id</div>
                <div className="text-sm font-bold font-mono">#{selectedJob.erc8183_id || 'PENDING'}</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 pr-4">
              <section>
                <h4 className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">technical schemas</h4>
                <div className="space-y-4 font-mono text-xs">
                  <div className="tech-border bg-background p-6">
                    <div className="text-emerald-500/50 mb-4 tracking-tighter">// input_schema</div>
                    <pre className="text-emerald-400/90 whitespace-pre-wrap">{JSON.stringify(selectedJob.data.input_schema, null, 2)}</pre>
                  </div>
                  <div className="tech-border bg-background p-6">
                    <div className="text-emerald-500/50 mb-4 tracking-tighter">// output_schema</div>
                    <pre className="text-emerald-400/90 whitespace-pre-wrap">{JSON.stringify(selectedJob.data.output_schema, null, 2)}</pre>
                  </div>
                </div>
              </section>
            </div>

            <div className="w-full py-4 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-bold uppercase tracking-[0.3em] text-center rounded-lg mt-auto">
              protocol monitor active
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
