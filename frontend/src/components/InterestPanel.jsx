import { useState, useEffect, useRef } from "react";
import { useContract } from "../hooks/useContract";
import { useWallet } from "../context/WalletContext";

/**
 * InterestPanel
 *
 * Shows the connected user's:
 *  - Contribution amount
 *  - Live interest counter (ticks every second using client-side estimation)
 *  - Interest pool balance
 *  - Claim Interest button
 *  - Fund Interest Pool form (for campaign owner)
 *
 * Interest formula (mirrors Solidity):
 *   interest = contribution × RATE × elapsed / (BPS × YEAR)
 *   RATE = 500, BPS = 10000, YEAR = 31536000 seconds
 *
 * @param {number}   campaignId    — campaign ID
 * @param {boolean}  isOwner       — whether the wallet is the campaign owner
 * @param {boolean}  isCancelled   — whether campaign was cancelled
 * @param {function} onPoolFunded  — callback after owner funds the pool
 */
export default function InterestPanel({ campaignId, isOwner, isCancelled, onPoolFunded }) {
  const { account, isConnected } = useWallet();
  const { fetchInterest, claimInterest, fundInterestPool, pending } = useContract();

  // Data fetched from chain
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);

  // Live ticking interest (client-side)
  const [liveInterest, setLiveInterest] = useState(0n);
  const tickRef = useRef(null);

  // Fund pool form
  const [fundAmount, setFundAmount] = useState("");
  const [showFundForm, setShowFundForm] = useState(false);

  // ── Fetch once from chain ───────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    const result = await fetchInterest(campaignId);
    setData(result);
    setLoading(false);

    if (result) {
      // Initialise live counter from on-chain value
      setLiveInterest(result.interestWei || 0n);
    }
  };

  useEffect(() => {
    if (isConnected && account) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, account, isConnected]);

  // ── Live interest ticker ────────────────────────────────────────────────
  // Approx per-second accrual = contribution × RATE / (BPS × YEAR)
  useEffect(() => {
    if (!data || BigInt(data.interestWei || 0) === 0n) return;

    const RATE = 500n;
    const BPS  = 10000n;
    const YEAR = 31536000n;

    // Parse contribution back to wei (approximate via ETH string)
    const contribEth = parseFloat(data.contributionEth || "0");
    const contribWei = BigInt(Math.floor(contribEth * 1e18));

    const perSecond = (contribWei * RATE) / (BPS * YEAR);

    tickRef.current = setInterval(() => {
      setLiveInterest((prev) => prev + perSecond);
    }, 1000);

    return () => clearInterval(tickRef.current);
  }, [data]);

  // ── Helpers ─────────────────────────────────────────────────────────────
  const formatWei = (wei) => {
    if (!wei && wei !== 0n) return "0.000000";
    const eth = Number(wei) / 1e18;
    return eth.toFixed(6);
  };

  const handleClaim = async () => {
    const res = await claimInterest(campaignId);
    if (res.success) {
      clearInterval(tickRef.current);
      await load();
    }
  };

  const handleFundPool = async () => {
    if (!fundAmount || parseFloat(fundAmount) <= 0) return;
    const res = await fundInterestPool(campaignId, fundAmount);
    if (res.success) {
      setFundAmount("");
      setShowFundForm(false);
      await load();
      onPoolFunded?.();
    }
  };

  // ── Not connected ────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="glass-card p-6 text-center text-slate-400 text-sm">
        Connect your wallet to see your interest rewards.
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="glass-card p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 skeleton rounded-xl" />
        ))}
      </div>
    );
  }

  // ── No contribution ───────────────────────────────────────────────────────
  if (!data || parseFloat(data.contributionEth) === 0) {
    return (
      <div className="glass-card p-6 space-y-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <span>💸</span> Interest Rewards
        </h3>
        <p className="text-sm text-slate-400">
          You haven't contributed to this campaign yet. Contribute to start earning 5% APR interest.
        </p>

        {/* Owner can still fund pool even without contribution */}
        {isOwner && (
          <OwnerFundSection
            fundAmount={fundAmount}
            setFundAmount={setFundAmount}
            showFundForm={showFundForm}
            setShowFundForm={setShowFundForm}
            poolEth={data?.poolEth || "0"}
            onFund={handleFundPool}
            pending={pending}
          />
        )}
      </div>
    );
  }

  const hasInterest = liveInterest > 0n;
  const poolSufficient = parseFloat(data.poolEth) * 1e18 >= Number(liveInterest);

  return (
    <div className="glass-card p-6 space-y-5">
      <h3 className="font-semibold text-white flex items-center gap-2">
        <span>💸</span> Your Interest Rewards
        <span className="badge badge-success text-[10px] ml-1">5% APR</span>
      </h3>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Contribution */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <p className="text-xs text-slate-400 mb-1">Your Contribution</p>
          <p className="text-lg font-bold text-white font-mono">
            {data.contributionEth} <span className="text-sm text-slate-400">ETH</span>
          </p>
        </div>

        {/* Interest Pool */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <p className="text-xs text-slate-400 mb-1">Interest Pool</p>
          <p className={`text-lg font-bold font-mono ${parseFloat(data.poolEth) > 0 ? "text-emerald-400" : "text-red-400"}`}>
            {data.poolEth} <span className="text-sm text-slate-400">ETH</span>
          </p>
        </div>
      </div>

      {/* Live interest counter */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/60 to-purple-950/60 p-5">
        {/* Animated glow pulse */}
        <div className="absolute inset-0 bg-indigo-500/5 animate-pulse rounded-2xl pointer-events-none" />

        <p className="text-xs text-indigo-300 uppercase tracking-widest mb-2">Interest Earned</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold font-mono text-white tabular-nums">
            {formatWei(liveInterest)}
          </span>
          <span className="text-indigo-300">ETH</span>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Live counter • Accruing every second at 5% APR
        </p>

        {!poolSufficient && hasInterest && (
          <div className="mt-3 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            ⚠️ Interest pool may be insufficient for full payout. Owner should top it up.
          </div>
        )}
      </div>

      {/* Claim button */}
      {hasInterest && !isCancelled && (
        <button
          onClick={handleClaim}
          disabled={pending || !poolSufficient}
          className="btn-primary w-full py-3 text-base"
          title={!poolSufficient ? "Pool is empty — ask the campaign owner to fund it" : ""}
        >
          {pending ? "Claiming…" : `💸 Claim ${formatWei(liveInterest)} ETH`}
        </button>
      )}
      {!hasInterest && (
        <p className="text-xs text-center text-slate-500">
          Interest starts accumulating from first contribution. Check back soon!
        </p>
      )}

      {/* Owner fund pool section */}
      {isOwner && (
        <OwnerFundSection
          fundAmount={fundAmount}
          setFundAmount={setFundAmount}
          showFundForm={showFundForm}
          setShowFundForm={setShowFundForm}
          poolEth={data.poolEth}
          onFund={handleFundPool}
          pending={pending}
        />
      )}
    </div>
  );
}

/** Sub-component: interest pool funding form (owner only) */
function OwnerFundSection({ fundAmount, setFundAmount, showFundForm, setShowFundForm, poolEth, onFund, pending }) {
  return (
    <div className="border-t border-white/10 pt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-400">
          🏦 Interest pool: <span className="text-white font-mono">{poolEth} ETH</span>
        </p>
        <button
          onClick={() => setShowFundForm(!showFundForm)}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {showFundForm ? "Cancel" : "+ Fund Pool"}
        </button>
      </div>

      {showFundForm && (
        <div className="space-y-2 mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="relative">
            <input
              type="number"
              step="0.001"
              min="0.001"
              placeholder="0.1"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              className="field pr-14 text-sm"
              disabled={pending}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">ETH</span>
          </div>
          <button
            onClick={onFund}
            disabled={pending || !fundAmount}
            className="btn-primary w-full py-2.5 text-sm"
          >
            {pending ? "Funding…" : "💎 Fund Interest Pool"}
          </button>
        </div>
      )}
    </div>
  );
}
