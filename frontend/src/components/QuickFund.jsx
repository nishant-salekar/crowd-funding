// frontend/src/components/QuickFund.jsx
import { useState } from "react";
import { useContract } from "../hooks/useContract";
import { useWallet } from "../context/WalletContext";
import toast from "react-hot-toast";
import { Rocket } from "lucide-react";

export default function QuickFund() {
  const [campaignId, setCampaignId] = useState("");
  const [amount, setAmount] = useState("");
  
  // Bring in your existing contribute function
  const { contribute, pending } = useContract();
  const { isConnected, isRightNetwork, switchToLocalhost } = useWallet();

  const handleFund = async (e) => {
    e.preventDefault();
    
    if (!isConnected) {
      toast.error("Please connect your wallet first.");
      return;
    }
    if (!isRightNetwork) {
      toast.error("Please switch to the correct network.");
      return;
    }

    // Call the smart contract!
    const result = await contribute(campaignId, amount);
    
    if (result.success) {
      // Clear the form on success
      setCampaignId("");
      setAmount("");
    }
  };

  return (
    <div className="glass-card p-6 border border-brand-500/30">
      <h2 className="text-xl font-bold text-white mb-2">⚡ Quick Fund</h2>
      <p className="text-sm text-slate-400 mb-6">
        Already know the Campaign ID? Enter it below to fund it directly via the smart contract.
      </p>

      <form onSubmit={handleFund} className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
            Campaign ID
          </label>
          <input
            type="number"
            required
            min="0"
            step="1"
            className="field w-full"
            placeholder="e.g. 0"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
            Amount (ETH)
          </label>
          <input
            type="number"
            required
            min="0.001"
            step="0.001"
            className="field w-full"
            placeholder="e.g. 0.5"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={pending}
          />
        </div>

        <div className="flex items-end">
          {!isConnected || !isRightNetwork ? (
             <button
             type="button"
             onClick={switchToLocalhost}
             className="btn-primary bg-amber-500 hover:bg-amber-400 h-[42px] px-6 whitespace-nowrap w-full sm:w-auto"
           >
             ⚠️ Switch Network
           </button>
          ) : (
            <button
              type="submit"
              disabled={pending}
              className="btn-primary h-[42px] px-6 whitespace-nowrap w-full sm:w-auto flex items-center justify-center gap-2"
            >
              {pending ? (
                "Processing..."
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  Direct Fund
                </>
              )}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}