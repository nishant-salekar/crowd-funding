import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  getReadOnlyContract,
  parseCampaign,
  formatTimeLeft,
  shortenAddress,
} from "../utils/contract";
import { useContract } from "../hooks/useContract";
import { useWallet } from "../context/WalletContext";
import ProgressBar from "../components/ProgressBar";
import ProposalCard from "../components/ProposalCard";
import InterestPanel from "../components/InterestPanel";
import CreateProposalModal from "../components/CreateProposalModal";
import toast from "react-hot-toast";

/** Tab IDs */
const TABS = [
  { id: "overview",  label: "Overview",       icon: "📋" },
  { id: "dao",       label: "DAO Voting",     icon: "🗳️" },
  { id: "interest",  label: "Interest",       icon: "💸" },
];

export default function CampaignDetail() {
  const { id }      = useParams();
  const { account } = useWallet();
  const { contribute, withdraw, claimRefund, fetchProposals, pending } = useContract();

  // ── State ────────────────────────────────────────────────────────────────
  const [dbData,    setDbData]    = useState(null);
  const [chainData, setChainData] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [amount,    setAmount]    = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [showModal, setShowModal] = useState(false);
  const [userContrib, setUserContrib] = useState("0");

  // ── Data loaders ──────────────────────────────────────────────────────────
  const loadChainAndProposals = useCallback(async () => {
    const contract = getReadOnlyContract();
    if (!contract) return;

    try {
      // Campaign on-chain state
      const raw = await contract.getCampaign(BigInt(id));
      const parsed = parseCampaign(id, raw);
      setChainData(parsed);

      // User's contribution amount
      if (account) {
        const contribWei = await contract.getContribution(BigInt(id), account);
        const { ethers } = await import("ethers");
        setUserContrib(parseFloat(ethers.formatEther(contribWei)).toFixed(4));
      }

      // Proposals
      const props = await fetchProposals(Number(id));
      setProposals(props);
    } catch (err) {
      console.error("Chain load error:", err);
    }
  }, [id, account, fetchProposals]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Off-chain metadata
      const res = await fetch(`/api/campaigns/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDbData(data.campaign);
      }
      await loadChainAndProposals();
    } catch (err) {
      console.error(err);
      toast.error("Could not load campaign.");
    } finally {
      setLoading(false);
    }
  }, [id, loadChainAndProposals]);

  useEffect(() => { loadData(); }, [id, account]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!dbData || !chainData) {
    return (
      <div className="text-center py-20 px-4">
        <h2 className="text-2xl font-bold mb-4">Campaign Not Found</h2>
        <Link to="/" className="btn-primary">Browse Campaigns</Link>
      </div>
    );
  }

  // ── Derived flags ─────────────────────────────────────────────────────────
  const {
    isFunded, isExpired, totalFunds, fundingCap, progress, withdrawn,
    cancelled, owner, deadline,
  } = chainData;

  const isOwner      = account && account.toLowerCase() === owner.toLowerCase();
  const isContributor = parseFloat(userContrib) > 0;
  const canContribute = !isFunded && !isExpired && !cancelled;
  const canWithdraw   = isOwner && isFunded && !withdrawn && !cancelled;
  const canRefund     = !isFunded && (isExpired || cancelled);

  const openProposals   = proposals.filter((p) => p.isOpen);
  const closedProposals = proposals.filter((p) => !p.isOpen);

  // ── Action handlers ───────────────────────────────────────────────────────
  const handleContribute = async () => {
    if (!amount || Number(amount) <= 0) return toast.error("Enter a valid amount");
    const res = await contribute(id, amount);
    if (res.success) { setAmount(""); loadChainAndProposals(); }
  };

  const handleWithdraw  = async () => {
    const res = await withdraw(id);
    if (res.success) loadChainAndProposals();
  };

  const handleRefund    = async () => {
    const res = await claimRefund(id);
    if (res.success) loadChainAndProposals();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── LEFT: image + tabs ───────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Cover image */}
          <div className="w-full h-[340px] rounded-2xl overflow-hidden glass-card shadow-glass relative">
            {dbData.imageUrl ? (
              <img src={dbData.imageUrl} alt={dbData.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 flex items-center justify-center">
                <span className="text-6xl opacity-10">🚀</span>
              </div>
            )}
            <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
              <span className="badge badge-primary">{dbData.category}</span>
              {isFunded && !cancelled && <span className="badge badge-success shadow-glow-sm">CAP REACHED</span>}
              {cancelled && <span className="badge badge-danger">CANCELLED</span>}
              {!isFunded && !cancelled && isExpired && <span className="badge badge-danger">EXPIRED</span>}
              {!cancelled && !isExpired && !isFunded && <span className="badge badge-warning animate-pulse">ACTIVE</span>}
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-2xl border border-white/10">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-200
                  ${activeTab === tab.id
                    ? "bg-indigo-600 text-white shadow-lg"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.id === "dao" && openProposals.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-[10px] flex items-center justify-center text-black font-bold">
                    {openProposals.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab: Overview ─────────────────────────────────────────────── */}
          {activeTab === "overview" && (
            <div className="glass-card p-6 md:p-8 space-y-4">
              <h1 className="text-3xl md:text-4xl font-bold font-display text-white">{dbData.title}</h1>
              <p className="address-chip inline-flex border-indigo-500/20 text-indigo-300">
                Created by {shortenAddress(dbData.ownerAddress)}
              </p>
              <h3 className="text-xl font-semibold mt-2">About this Project</h3>
              <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{dbData.description}</p>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 pt-4">
                {[
                  { label: "Raised",    value: `${totalFunds} ETH`,    icon: "💰" },
                  { label: "Goal",      value: `${fundingCap} ETH`,    icon: "🎯" },
                  { label: "Proposals", value: proposals.length,        icon: "🗳️" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                    <div className="text-xl mb-1">{stat.icon}</div>
                    <div className="text-sm font-bold text-white">{stat.value}</div>
                    <div className="text-xs text-slate-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tab: DAO Voting ────────────────────────────────────────────── */}
          {activeTab === "dao" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="section-title text-xl">DAO Proposals</h2>
                {isOwner && !cancelled && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="btn-primary py-2 px-4 text-sm"
                  >
                    + New Proposal
                  </button>
                )}
              </div>

              {/* Info bar */}
              {isContributor && (
                <div className="glass-card p-3 flex items-center gap-2 border border-indigo-500/20 text-sm text-indigo-300">
                  <span>🗳️</span>
                  <span>Your voting power: <strong>{userContrib} ETH</strong></span>
                </div>
              )}

              {proposals.length === 0 && (
                <div className="glass-card p-10 text-center text-slate-400">
                  <div className="text-4xl mb-3">🗳️</div>
                  <p>No proposals yet.</p>
                  {isOwner && <p className="text-sm mt-1 text-slate-500">You can create one using the button above.</p>}
                </div>
              )}

              {/* Open proposals */}
              {openProposals.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider">
                    🟡 Active Votes ({openProposals.length})
                  </h3>
                  {openProposals.map((p) => (
                    <ProposalCard
                      key={p.id}
                      proposal={p}
                      campaignId={Number(id)}
                      isContributor={isContributor}
                      pending={pending}
                      onRefresh={loadChainAndProposals}
                    />
                  ))}
                </div>
              )}

              {/* Closed proposals */}
              {closedProposals.length > 0 && (
                <div className="space-y-3 mt-4">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
                    ⚫ Past Proposals ({closedProposals.length})
                  </h3>
                  {closedProposals.map((p) => (
                    <ProposalCard
                      key={p.id}
                      proposal={p}
                      campaignId={Number(id)}
                      isContributor={isContributor}
                      pending={pending}
                      onRefresh={loadChainAndProposals}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Interest ─────────────────────────────────────────────── */}
          {activeTab === "interest" && (
            <div className="space-y-4">
              <h2 className="section-title text-xl">Interest Rewards</h2>

              {/* Formula explanation */}
              <div className="glass-card p-4 border border-indigo-500/20">
                <h3 className="text-sm font-semibold text-indigo-300 mb-2">📐 Interest Formula</h3>
                <code className="text-xs text-slate-300 font-mono block mb-2">
                  interest = contribution × 5% × elapsed_seconds / 31,536,000
                </code>
                <p className="text-xs text-slate-500">
                  Simple annual interest at a fixed 5% APR. Accrues from your first contribution.
                  Claim at any time while the interest pool has funds.
                </p>
              </div>

              <InterestPanel
                campaignId={Number(id)}
                isOwner={isOwner}
                isCancelled={cancelled}
                onPoolFunded={loadChainAndProposals}
              />
            </div>
          )}
        </div>

        {/* ── RIGHT: sticky sidebar ────────────────────────────────────────── */}
        <div>
          <div className="glass-card p-6 sticky top-24 border-indigo-500/30 space-y-5">

            {/* Funding stats */}
            <div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-3xl font-bold text-white">{totalFunds}</span>
                <span className="text-lg text-slate-400">ETH</span>
              </div>
              <p className="text-slate-400 text-sm">
                pledged of <span className="text-white font-medium">{fundingCap} ETH</span> goal
              </p>
            </div>

            <ProgressBar progress={progress} className="h-3 bg-slate-800" />

            {/* Meta chips */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-lg mb-1">⏱</div>
                <div className="text-xs font-semibold text-white whitespace-nowrap">
                  {cancelled ? "Cancelled" : formatTimeLeft(deadline)}
                </div>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                <div className="text-lg mb-1">📈</div>
                <div className="text-xs font-semibold text-white">{progress.toFixed(0)}%</div>
              </div>
            </div>

            <hr className="divider" />

            {/* Contribute form */}
            {canContribute && (
              <div className="space-y-3">
                <label className="form-label text-xs">Contribution Amount</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    placeholder="0.1"
                    className="field pr-14 text-lg font-mono"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={pending}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">ETH</span>
                </div>
                <button
                  className="btn-primary w-full py-3 text-base"
                  onClick={handleContribute}
                  disabled={pending || !amount}
                >
                  {pending ? "Processing…" : "🚀 Back this project"}
                </button>
                <p className="text-center text-xs text-slate-500">
                  Overages instantly refunded. Earn 5% APR on contribution.
                </p>
              </div>
            )}

            {/* Funded + owner withdraw */}
            {isFunded && !cancelled && (
              <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-4 text-center space-y-2">
                <div className="text-indigo-300 font-bold text-lg">🎉 Goal Reached!</div>
                <p className="text-sm text-slate-300">No more contributions accepted.</p>
                {canWithdraw && (
                  <button className="btn-primary w-full" onClick={handleWithdraw} disabled={pending}>
                    {pending ? "Withdrawing…" : "💰 Withdraw Funds"}
                  </button>
                )}
                {isOwner && withdrawn && (
                  <div className="badge badge-success w-full justify-center py-2">✅ Already Withdrawn</div>
                )}
              </div>
            )}

            {/* Cancelled state */}
            {cancelled && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-3">
                <div className="text-red-400 font-bold text-center">🚫 Campaign Cancelled</div>
                <p className="text-sm text-slate-400 text-center">Cancelled via DAO vote.</p>
                {isContributor && (
                  <button className="btn-danger w-full" onClick={handleRefund} disabled={pending}>
                    {pending ? "Processing…" : "↩️ Claim Refund"}
                  </button>
                )}
              </div>
            )}

            {/* Expired + failed */}
            {!isFunded && isExpired && !cancelled && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-3">
                <div className="text-red-400 font-bold text-center">Campaign Failed</div>
                <p className="text-sm text-slate-400 text-center">Deadline passed before reaching goal.</p>
                {isContributor && (
                  <button className="btn-danger w-full" onClick={handleRefund} disabled={pending}>
                    {pending ? "Processing…" : "↩️ Claim Full Refund"}
                  </button>
                )}
              </div>
            )}

            {/* DAO summary chip */}
            {proposals.length > 0 && (
              <button
                onClick={() => setActiveTab("dao")}
                className="w-full text-left glass-card p-3 bg-white/5 border border-white/10 hover:border-indigo-500/40 transition-colors rounded-xl"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-300">🗳️ Active votes</span>
                  <span className={`font-bold ${openProposals.length > 0 ? "text-amber-400" : "text-slate-400"}`}>
                    {openProposals.length} open
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Create Proposal Modal */}
      {showModal && (
        <CreateProposalModal
          campaignId={Number(id)}
          deadline={deadline}
          onClose={() => setShowModal(false)}
          onCreated={loadChainAndProposals}
        />
      )}
    </div>
  );
}