import { Link } from "react-router-dom";
import ProgressBar from "./ProgressBar";
import { formatTimeLeft } from "../utils/contract";

export default function CampaignCard({ campaign }) {
  const isExpired   = campaign.isExpired;
  const isFunded    = campaign.isFunded;
  const isCancelled = campaign.cancelled;

  // Status badge
  let statusBadge;
  if (isCancelled) {
    statusBadge = <span className="badge badge-danger">Cancelled</span>;
  } else if (isFunded) {
    statusBadge = <span className="badge badge-success">Funded ✓</span>;
  } else if (isExpired) {
    statusBadge = <span className="badge badge-danger">Expired</span>;
  } else {
    statusBadge = <span className="badge badge-warning animate-pulse">Active</span>;
  }

  // Progress bar colour
  const barColor = isCancelled
    ? "from-red-600 to-red-500"
    : isFunded
    ? "from-emerald-600 to-emerald-400"
    : "from-indigo-600 to-purple-500";

  return (
    <Link to={`/campaign/${campaign.contractId ?? campaign.id}`} className="block group">
      <div className="glass-card h-full flex flex-col overflow-hidden transition-all duration-300
                      hover:border-indigo-500/30 hover:-translate-y-1 hover:shadow-2xl">

        {/* Cover image / gradient banner */}
        <div className="h-44 w-full relative overflow-hidden bg-slate-900">
          {campaign.imageUrl ? (
            <img
              src={campaign.imageUrl}
              alt={campaign.title}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundImage: "linear-gradient(135deg,#1e1b4b,#0f172a,#0c1a2e)" }}
            >
              <span className="text-4xl opacity-20">🚀</span>
            </div>
          )}

          {/* Gradient overlay at bottom for text readability */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/80 to-transparent" />

          {/* Status badge top-right */}
          <div className="absolute top-3 right-3">{statusBadge}</div>

          {/* Top Left Badges: Category & ID */}
          <div className="absolute top-3 left-3 flex gap-2 items-center">
            {campaign.category && (
              <span className="badge badge-primary text-[10px]">{campaign.category}</span>
            )}
            
            {/* ✅ NEW: Campaign ID Badge */}
            <div className="inline-flex items-center gap-1 bg-slate-900/60 backdrop-blur-md border border-white/10 text-slate-300 text-[10px] font-mono px-2 py-0.5 rounded-full shadow-sm">
              <span className="text-slate-500">ID:</span> 
              <span className="font-bold text-white">{campaign.contractId ?? campaign.id}</span>
            </div>
          </div>
        </div>

        {/* Card body */}
        <div className="p-5 flex-1 flex flex-col">
          {/* Time left */}
          <p className="text-xs font-mono text-slate-500 mb-2">
            {isCancelled ? "Campaign cancelled" : formatTimeLeft(campaign.deadline)}
          </p>

          {/* Title */}
          <h3 className="text-base font-bold text-white mb-2 line-clamp-1 group-hover:text-indigo-300 transition-colors">
            {campaign.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-slate-400 mb-5 line-clamp-2 flex-1 leading-relaxed">
            {campaign.description}
          </p>

          {/* Funding progress */}
          <div className="mt-auto space-y-2">
            <div className="flex justify-between text-sm">
              {/* ✅ Changed MON to ETH */}
              <span className="font-semibold text-white">{parseFloat(campaign.totalFunds || 0).toFixed(3)} ETH</span>
              <span className="text-slate-400">of {campaign.fundingCap || "?"} ETH</span>
            </div>

            {/* Custom coloured progress bar */}
            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-1000`}
                style={{ width: `${Math.min(campaign.progress || 0, 100)}%` }}
              />
            </div>

            <p className="text-right text-xs text-slate-500">
              {(campaign.progress || 0).toFixed(0)}% funded
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}