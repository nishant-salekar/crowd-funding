import { useState } from "react";
import { useWallet } from "../context/WalletContext";
import { shortenAddress } from "../utils/contract";
import { Wallet, LogOut, AlertTriangle, Zap } from "lucide-react";

// ✅ Removed the hardcoded MONAD_CHAIN_ID since context handles this now!

export default function WalletButton() {
  const {
    account, balance, chainId,
    isConnected, connecting, isRightNetwork, // ✅ Destructured isRightNetwork
    connectWallet, disconnectWallet, switchToLocalhost, // ✅ Changed to switchToLocalhost
  } = useWallet();
  const [isOpen, setIsOpen] = useState(false);

  if (connecting) {
    return (
      <button className="btn-ghost animate-pulse" disabled>
        Connecting…
      </button>
    );
  }

  if (!isConnected) {
    return (
      <button className="btn-primary" onClick={connectWallet}>
        <Wallet className="w-4 h-4" />
        Connect Wallet
      </button>
    );
  }

  /* ── Wrong network banner ─────────────────────────────────────────── */
  // ✅ Dynamically checks if you are on the expected chain from WalletContext
  const isWrongNetwork = chainId !== null && !isRightNetwork;
  
  if (isWrongNetwork) {
    return (
      <button
        onClick={switchToLocalhost} // ✅ Triggers Hardhat switch
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold
                   border border-amber-500/40 text-amber-400 hover:text-white
                   hover:border-amber-400 transition-all duration-200"
        style={{ background: "rgba(245,158,11,0.12)" }}
        title="Click to switch to Hardhat Local"
      >
        <AlertTriangle className="w-4 h-4" />
        Wrong Network — Switch to Hardhat
      </button>
    );
  }

  /* ── Connected + correct network ──────────────────────────────────── */
  return (
    <div className="relative">
      {/* Network pill */}
      <div className="hidden sm:flex absolute -top-5 right-0 items-center gap-1
                      text-[10px] font-semibold px-2 py-0.5 rounded-full
                      text-emerald-300 border border-emerald-500/30"
           style={{ background: "rgba(16,185,129,0.10)" }}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Hardhat Local {/* ✅ Changed text */}
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-ghost flex items-center gap-2"
      >
        <div className="flex flex-col items-end mr-1 text-right">
          <span className="text-xs font-mono text-slate-300">
            {shortenAddress(account)}
          </span>
          <span className="text-[10px] text-slate-500">{balance} ETH</span> {/* ✅ Changed MON to ETH */}
        </div>
        <div className="h-8 w-8 rounded-full flex items-center justify-center
                        text-white border-2 border-slate-700"
             style={{ background: "linear-gradient(135deg,#836ef9,#06b6d4)" }}>
          <Wallet className="w-4 h-4" />
        </div>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 py-2 bg-dark-800 border border-slate-700 rounded-xl shadow-glass z-50">
          <div className="px-4 py-2 border-b border-slate-700/50 mb-1">
            <p className="text-xs text-slate-400">Balance</p>
            <p className="text-sm font-semibold">{balance} ETH</p> {/* ✅ Changed MON to ETH */}
          </div>
          <button
            onClick={() => { disconnectWallet(); setIsOpen(false); }}
            className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-800 flex items-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}