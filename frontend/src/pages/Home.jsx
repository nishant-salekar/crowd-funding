import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CampaignCard from "../components/CampaignCard";
import QuickFund from "../components/QuickFund"; // ✅ Added QuickFund import
import { getReadOnlyContract, parseCampaign } from "../utils/contract";
import { RefreshCw } from "lucide-react";
import log from "../utils/logger.js";
import HeroScene from "../components/HeroScene.jsx";

/** Animated counter that counts up from 0 to target */
function AnimatedCounter({ target, suffix = "" }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (target === 0) return;
    const duration = 1200;
    const steps    = 40;
    const interval = duration / steps;
    const step     = target / steps;
    let current    = 0;

    const id = setInterval(() => {
      current = Math.min(current + step, target);
      setCount(Math.floor(current));
      if (current >= target) clearInterval(id);
    }, interval);

    return () => clearInterval(id);
  }, [target]);

  return <>{count}{suffix}</>;
}

export default function Home() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [stats,     setStats]     = useState({ total: 0, funded: 0, raised: 0 });
  const location  = useLocation();
  const navigate  = useNavigate();
  // ref to prevent multiple simultaneous fetches
  const isFetching = useRef(false);

  const fetchCampaigns = useCallback(async () => {
    log.ui("Fetching campaigns…");
    log.time("fetch_campaigns");
    setLoading(true);
    try {
      const contract = getReadOnlyContract();

      // ── Step 1: Try backend for metadata ───────────────────────────────────
      let backendCampaigns = [];
      try {
        log.api("GET /api/campaigns — requesting backend metadata");
        const res  = await fetch("/api/campaigns");
        if (res.ok) {
          const data = await res.json();
          backendCampaigns = data.campaigns || [];
          log.api(`GET /api/campaigns — ${res.status} OK`, { count: backendCampaigns.length });
        } else {
          log.warn(`GET /api/campaigns — ${res.status} ${res.statusText}`);
        }
      } catch (backendErr) {
        log.warn("Backend unreachable — falling back to chain-only", { error: backendErr.message });
        console.warn("Backend unreachable, falling back to chain-only:", backendErr.message);
      }

      // ── Step 2: If backend has data, enrich with on-chain ─────────────────
      if (backendCampaigns.length > 0) {
        if (!contract) {
          log.warn("No contract available — displaying backend-only campaign data");
          setCampaigns(backendCampaigns.map((c) => ({
            ...c, progress: 0, totalFunds: "0", fundingCap: "0", isExpired: false, isFunded: false, cancelled: false,
          })));
          return;
        }

        log.chain(`Enriching ${backendCampaigns.length} campaign(s) with on-chain data…`);
        const enriched = await Promise.all(
          backendCampaigns.map(async (camp) => {
            try {
              const raw     = await contract.getCampaign(BigInt(camp.contractId));
              const onChain = parseCampaign(camp.contractId, raw);
              return { ...camp, ...onChain };
            } catch {
              return { ...camp, progress: 0, totalFunds: 0, fundingCap: 0, isExpired: false, isFunded: false, cancelled: false };
            }
          })
        );

        setCampaigns(enriched);
        const funded = enriched.filter((c) => c.isFunded).length;
        const raised = enriched.reduce((sum, c) => sum + (parseFloat(c.totalFunds) || 0), 0);
        setStats({ total: enriched.length, funded, raised: parseFloat(raised.toFixed(2)) });
        log.success(`Campaigns loaded (backend+chain)`, { total: enriched.length, funded, raised: raised.toFixed(2) });
        log.timeEnd("fetch_campaigns", "UI");
        return;
      }

      // ── Step 3: Backend empty / down — read ALL campaigns directly from chain
      if (!contract) {
        log.warn("No campaigns — both backend and contract unavailable");
        setCampaigns([]);
        return;
      }

      let count = 0;
      try {
        count = Number(await contract.campaignCount());
      } catch {
        // some contracts expose getCampaignCount instead
        try { count = Number(await contract.getCampaignCount()); } catch {}
      }

      log.chain(`Chain reports ${count} campaign(s)`);

      if (count === 0) {
        log.ui("No campaigns found on-chain");
        setCampaigns([]);
        return;
      }

      log.chain(`Reading ${count} campaign(s) directly from chain…`);
      const chainCampaigns = await Promise.all(
        Array.from({ length: count }, async (_, i) => {
          try {
            const raw = await contract.getCampaign(BigInt(i));
            return {
              ...parseCampaign(i, raw),
              _id:         String(i),
              contractId:  String(i),
              title:       `On-Chain Campaign #${i}`,
              description: "Metadata stored on-chain only.",
              imageUrl:    "",
              category:    "General",
              ownerAddress: raw[0],
            };
          } catch {
            return null;
          }
        })
      );

      const valid = chainCampaigns.filter(Boolean);
      setCampaigns(valid);
      const funded = valid.filter((c) => c.isFunded).length;
      const raised = valid.reduce((sum, c) => sum + (parseFloat(c.totalFunds) || 0), 0);
      setStats({ total: valid.length, funded, raised: parseFloat(raised.toFixed(2)) });
      log.success(`Campaigns loaded (chain-only)`, { total: valid.length, funded, raised: raised.toFixed(2) });
      log.timeEnd("fetch_campaigns", "UI");

    } catch (err) {
      log.error("Failed to load campaigns", { message: err.message });
      console.error("Failed to load campaigns:", err);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch on mount OR after campaign creation (state.refresh / ?refresh) ───
  useEffect(() => {
    const hasRefreshState  = !!location.state?.refresh;
    const hasRefreshParam  = new URLSearchParams(location.search).get("refresh");
    const isRefreshTrigger = hasRefreshState || hasRefreshParam;

    if (isRefreshTrigger) {
      log.router("Refresh trigger detected — reloading campaigns", { fromState: hasRefreshState, fromParam: !!hasRefreshParam });
    } else {
      log.router("Home page mounted — initial campaign fetch");
    }

    // Clear navigation state/param first to prevent re-trigger loops
    if (hasRefreshState) navigate("/", { replace: true, state: {} });
    if (hasRefreshParam)  navigate("/", { replace: true });

    // Small delay on explicit refresh so backend has time to persist the new campaign
    const delay = isRefreshTrigger ? 600 : 0;
    const timer = setTimeout(() => fetchCampaigns(), delay);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.refresh, location.search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* ── Hero Section ────────────────────────────────────────────────────── */}
      <div className="relative mb-16 overflow-hidden" style={{ minHeight: "420px" }}>
        {/* Three.js Hero Scene — renders behind text */}
        <HeroScene />

        {/* Hero text content — above the 3D scene */}
        <div className="text-center relative z-10 pt-10">
          {/* CapFund+ badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6
                          bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-300">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse inline-block" />
            DAO Voting · Interest Rewards · Funding Caps
          </div>

          <h1 className="text-4xl md:text-6xl font-display font-bold mb-5 tracking-tight">
            Fund the Future on{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">
              Cap<span className="text-white">DAO</span>
            </span>
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8">
            A next-gen decentralised crowdfunding platform with strict funding caps,
            DAO governance, and 5% APR interest rewards for contributors.
          </p>

          <Link 
            to="/create" 
            className="inline-block px-10 py-4 rounded-full font-bold text-lg shadow-glow transition-all duration-300 hover:scale-[1.03]"
            style={{ 
              backgroundColor: "#ffffff", 
              color: "#8a9ea8", 
              WebkitTextFillColor: "#8a9ea8" 
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#e8dfd5"; e.currentTarget.style.color = "#ffffff"; e.currentTarget.style.WebkitTextFillColor = "#ffffff"; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#ffffff"; e.currentTarget.style.color = "#8a9ea8"; e.currentTarget.style.WebkitTextFillColor = "#8a9ea8"; }}
          >
            🚀 Launch a Campaign
          </Link>
        </div>
      </div>

      {/* ── Stats Banner ────────────────────────────────────────────────────── */}
      {!loading && campaigns.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-14">
          {[
            { label: "Total Campaigns", value: stats.total,  suffix: "",    icon: "🏆", color: "from-indigo-500/20 to-indigo-500/5" },
            { label: "Fully Funded",    value: stats.funded, suffix: "",    icon: "🎯", color: "from-emerald-500/20 to-emerald-500/5" },
            { label: "ETH Raised",      value: stats.raised, suffix: "+",   icon: "💰", color: "from-purple-500/20 to-purple-500/5" },
          ].map((s) => (
            <div
              key={s.label}
              className={`glass-card p-5 text-center bg-gradient-to-b ${s.color} border border-white/10`}
            >
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-3xl font-bold font-mono text-white mb-1">
                <AnimatedCounter target={s.value} suffix={s.suffix} />
              </div>
              <div className="text-xs text-slate-400 uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Feature Pills ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 justify-center mb-12">
        {[
          { icon: "🔒", text: "Strict Funding Caps" },
          { icon: "🗳️", text: "DAO Weighted Voting" },
          { icon: "💸", text: "5% APR Interest" },
          { icon: "↩️", text: "Auto Refunds" },
          { icon: "⚡", text: "Partial Refunds" },
          { icon: "🔐", text: "MetaMask Native" },
        ].map((f) => (
          <div
            key={f.text}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                       bg-white/5 border border-white/10 text-slate-300 hover:border-indigo-500/30 transition-colors"
          >
            <span>{f.icon}</span>
            <span>{f.text}</span>
          </div>
        ))}
      </div>

      {/* ✅ ── Quick Fund Widget ────────────────────────────────────────────── */}
      <div className="mb-12 max-w-3xl mx-auto">
        <QuickFund />
      </div>

      {/* ── Campaigns Grid ───────────────────────────────────────────────────── */}
      <div className="mb-8 flex justify-between items-center">
        <h2 className="section-title">Active Campaigns</h2>
        <div className="flex items-center gap-3">
          {!loading && campaigns.length > 0 && (
            <span className="text-slate-400 text-sm">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</span>
          )}
          <button
            onClick={() => { log.ui("Manual refresh clicked"); fetchCampaigns(); }}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white
                       px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20
                       transition-all disabled:opacity-40"
            title="Refresh campaigns"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card h-[380px] skeleton" />
          ))}
        </div>
      ) : campaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((camp) => (
            <CampaignCard key={camp._id || camp.contractId} campaign={camp} />
          ))}
        </div>
      ) : (
        <div className="glass-card text-center py-20 px-8">
          <div className="text-5xl mb-4">🌱</div>
          <p className="text-slate-300 text-lg font-semibold mb-2">No campaigns yet.</p>
          <p className="text-slate-500 mb-6">Be the first to launch a decentralised campaign on CapDAO!</p>
          <Link to="/create" className="btn-primary px-6 py-3">
            Launch the First Campaign
          </Link>
        </div>
      )}
    </div>
  );
}