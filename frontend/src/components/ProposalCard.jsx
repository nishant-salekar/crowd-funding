import { useState } from "react";
import { useContract } from "../hooks/useContract";
import { formatTimeLeft } from "../utils/contract";

/** Label and colour config per proposal type */
const PROPOSAL_META = {
  0: { label: "Release Funds",      icon: "💰", color: "success",  desc: "Allow the owner to withdraw raised funds early." },
  1: { label: "Change Deadline",    icon: "📅", color: "warning",  desc: "Extend the campaign funding deadline." },
  2: { label: "Cancel Campaign",    icon: "🚫", color: "danger",   desc: "Cancel the campaign and enable contributor refunds." },
};

const COLOR_MAP = {
  success: { badge: "badge-success", yes: "bg-emerald-500", no: "bg-red-500/60", glow: "0 0 12px rgba(16,185,129,0.4)" },
  warning: { badge: "badge-warning", yes: "bg-amber-500",   no: "bg-red-500/60", glow: "0 0 12px rgba(245,158,11,0.4)" },
  danger:  { badge: "badge-danger",  yes: "bg-emerald-500", no: "bg-red-500",    glow: "0 0 12px rgba(239,68,68,0.4)"  },
};

/**
 * ProposalCard
 *
 * Displays a single DAO proposal with:
 *  - Type badge + description
 *  - YES/NO weighted vote progress bars
 *  - Vote and Execute buttons
 *  - Status chips (Open / Passed / Failed / Executed)
 *
 * @param {object}   proposal        — enriched proposal from fetchProposals()
 * @param {number}   campaignId      — parent campaign ID
 * @param {boolean}  isContributor   — whether connected wallet contributed
 * @param {boolean}  pending         — global tx pending flag
 * @param {function} onRefresh       — callback to reload proposals
 */
export default function ProposalCard({ proposal, campaignId, isContributor, pending, onRefresh }) {
  const { castVote, executeProposal } = useContract();
  const [localPending, setLocalPending] = useState(false);

  const meta   = PROPOSAL_META[proposal.pType] || PROPOSAL_META[0];
  const colors = COLOR_MAP[meta.color];
  const isBusy = pending || localPending;

  const handleVote = async (support) => {
    setLocalPending(true);
    const res = await castVote(campaignId, proposal.id, support);
    setLocalPending(false);
    if (res.success) onRefresh();
  };

  const handleExecute = async () => {
    setLocalPending(true);
    const res = await executeProposal(campaignId, proposal.id);
    setLocalPending(false);
    if (res.success) onRefresh();
  };

  const timeLeft = proposal.isOpen ? formatTimeLeft(proposal.votingDeadline) : null;

  return (
    <div className="proposal-card glass-card p-5 border border-white/10 hover:border-indigo-500/30 transition-all duration-300">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xl shrink-0">{meta.icon}</span>
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm truncate">{proposal.description}</p>
            <p className="text-xs text-slate-400 mt-0.5">{meta.desc}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`badge ${colors.badge} text-xs`}>{meta.label}</span>
          {proposal.isOpen && (
            <span className="badge badge-primary text-[10px] animate-pulse">LIVE</span>
          )}
          {proposal.executed && (
            <span className={`badge ${proposal.passed ? "badge-success" : "badge-danger"} text-[10px]`}>
              {proposal.passed ? "PASSED ✓" : "FAILED ✗"}
            </span>
          )}
        </div>
      </div>

      {/* Vote tallies */}
      <div className="mb-4 space-y-2">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-emerald-400 font-medium">✅ YES</span>
            <span className="text-slate-400">{proposal.yesVotes} ETH ({proposal.yesPct}%)</span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${proposal.yesPct}%`,
                background: "linear-gradient(90deg, #10b981, #34d399)",
                boxShadow: proposal.yesPct > 0 ? colors.glow : "none",
              }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-red-400 font-medium">❌ NO</span>
            <span className="text-slate-400">{proposal.noVotes} ETH ({proposal.noPct}%)</span>
          </div>
          <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${proposal.noPct}%`,
                background: "linear-gradient(90deg, #ef4444, #f87171)",
              }}
            />
          </div>
        </div>
        <p className="text-xs text-slate-500 text-right mt-1">
          Total voting power: {proposal.total} MON
        </p>
      </div>

      {/* Voting deadline */}
      {proposal.isOpen && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400 mb-4 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <span>⏰</span>
          <span>Voting closes in <strong>{timeLeft}</strong></span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mt-2">
        {/* Vote buttons — only if open and contributor hasn't voted */}
        {proposal.isOpen && isContributor && !proposal.userVoted && (
          <>
            <button
              onClick={() => handleVote(true)}
              disabled={isBusy}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200
                         bg-emerald-600/80 hover:bg-emerald-500 border border-emerald-500/30
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBusy ? "…" : "👍 Vote YES"}
            </button>
            <button
              onClick={() => handleVote(false)}
              disabled={isBusy}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200
                         bg-red-600/80 hover:bg-red-500 border border-red-500/30
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBusy ? "…" : "👎 Vote NO"}
            </button>
          </>
        )}

        {/* Already voted indicator */}
        {proposal.isOpen && proposal.userVoted && (
          <div className="flex-1 text-center text-xs text-slate-400 py-2 bg-white/5 rounded-xl border border-white/10">
            ✓ You voted
          </div>
        )}

        {/* Not a contributor */}
        {proposal.isOpen && !isContributor && (
          <div className="flex-1 text-center text-xs text-slate-500 py-2 bg-white/5 rounded-xl border border-white/10">
            Contribute to vote
          </div>
        )}

        {/* Execute button — available after voting deadline if not yet executed */}
        {!proposal.isOpen && !proposal.executed && (
          <button
            onClick={handleExecute}
            disabled={isBusy}
            className="flex-1 btn-primary py-2 text-sm"
          >
            {isBusy ? "Executing…" : "⚡ Execute Proposal"}
          </button>
        )}

        {/* Done state */}
        {proposal.executed && (
          <div className={`flex-1 text-center text-xs py-2 rounded-xl border font-semibold
            ${proposal.passed
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}
          >
            {proposal.passed ? "✅ Proposal Executed" : "❌ Proposal Failed"}
          </div>
        )}
      </div>
    </div>
  );
}
