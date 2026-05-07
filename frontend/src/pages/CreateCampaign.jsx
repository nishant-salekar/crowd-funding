import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContract } from "../hooks/useContract";
import { useWallet } from "../context/WalletContext";
import toast from "react-hot-toast";
import log from "../utils/logger.js";

export default function CreateCampaign() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    fundingCap: "",
    deadline: "",
    imageUrl: "",
    category: "General",
  });

  const { createCampaign, pending } = useContract();
  // ✅ FIX: Imported switchToLocalhost instead of switchToMonad
  const { account, isConnected, isRightNetwork, switchToLocalhost } = useWallet();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    log.ui(`Form field changed: ${name}`, { value: value.length > 50 ? value.slice(0, 50) + "…" : value });
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    log.ui("Campaign creation form submitted");
    log.sep("CREATE CAMPAIGN FLOW");

    if (!isConnected) {
      log.warn("Wallet not connected — blocking campaign creation");
      toast.error("Please connect your wallet first.");
      return;
    }
    if (!isRightNetwork) {
      log.warn("Wrong network — blocking campaign creation");
      toast.error("Please switch to the correct network first.");
      return;
    }
    if (!formData.title || !formData.description || !formData.fundingCap || !formData.deadline) {
      log.warn("Form validation failed — missing required fields");
      toast.error("Please fill all required fields.");
      return;
    }

    log.ui("Form data validated", {
      title: formData.title,
      fundingCap: formData.fundingCap,
      deadline: formData.deadline,
      category: formData.category,
    });

    try {
      // 1. Submit on-chain first
      const deadlineTs = Math.floor(new Date(formData.deadline).getTime() / 1000);
      log.contract("Submitting campaign on-chain…", { fundingCap: formData.fundingCap, deadlineTs });

      const res = await createCampaign(formData.fundingCap, deadlineTs);
      
      if (res.success && res.campaignId !== null) {
        log.success("On-chain campaign created", { campaignId: res.campaignId, txHash: res.txHash });

        // 2. On success, POST metadata to our off-chain backend
        const metadataPayload = {
          contractId: res.campaignId.toString(),
          ownerAddress: account,
          title: formData.title,
          description: formData.description,
          imageUrl: formData.imageUrl,
          category: formData.category,
        };

        log.api("POST /api/campaign — saving metadata to backend", metadataPayload);
        try {
          const backendRes = await fetch("/api/campaign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(metadataPayload),
          });
          if (backendRes.ok) {
            const backendData = await backendRes.json();
            log.api(`POST /api/campaign — ${backendRes.status} OK`, backendData);
          } else {
            const errBody = await backendRes.json().catch(() => ({}));
            log.warn(`POST /api/campaign — ${backendRes.status} FAILED`, errBody);
            console.warn("Backend rejected campaign metadata:", backendRes.status, errBody);
            toast("⚠️ Campaign is on-chain but metadata save failed: " + (errBody?.errors?.[0]?.msg || backendRes.status), { duration: 6000 });
          }
        } catch (backendErr) {
          log.warn("Backend unreachable (non-fatal)", { error: backendErr.message });
          console.warn("Backend unreachable (non-fatal):", backendErr.message);
          toast("⚠️ Backend unreachable — campaign is on-chain but won't appear until backend restarts.", { duration: 6000 });
        }

        log.success("Campaign creation flow complete — navigating to home");
        toast.success("🎉 Campaign created successfully!");
        // Small delay so the toast is visible, then navigate home
        setTimeout(() => {
          log.router("Navigating to / with refresh state");
          navigate("/", { state: { refresh: true } });
        }, 1200);
      } else {
        log.warn("Campaign creation returned unsuccessful", res);
      }
    } catch (err) {
      log.error("Campaign creation failed", { message: err.message });
      console.error(err);
      toast.error("Failed to create campaign.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8 p-6 glass-card border-brand-500/30">
        <h1 className="section-title mb-2">Create a New Campaign</h1>
        <p className="text-slate-400">
          Launch your Web3 project. Once deployed, the smart contract strictly enforces your funding cap and deadline.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="glass-card p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="form-label">Campaign Title <span className="text-red-400">*</span></label>
              <input
                type="text"
                name="title"
                required
                className="field"
                placeholder="My Awesome Project"
                value={formData.title}
                onChange={handleChange}
                maxLength={100}
                disabled={pending}
              />
            </div>
            <div>
              <label className="form-label">Category</label>
              <select
                name="category"
                className="field appearance-none hover:bg-slate-800/50"
                value={formData.category}
                onChange={handleChange}
                disabled={pending}
              >
                <option value="General">General</option>
                <option value="Tech">Tech</option>
                <option value="Art">Art</option>
                <option value="Music">Music</option>
                <option value="Games">Games</option>
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="form-label">Description <span className="text-red-400">*</span></label>
            <textarea
              name="description"
              required
              className="field min-h-[120px] resize-y"
              placeholder="Describe why people should fund your project..."
              value={formData.description}
              onChange={handleChange}
              disabled={pending}
            />
          </div>

          <div className="mb-6">
            <label className="form-label">Cover Image URL</label>
            <input
              type="url"
              name="imageUrl"
              className="field"
              placeholder="https://example.com/image.jpg"
              value={formData.imageUrl}
              onChange={handleChange}
              disabled={pending}
            />
          </div>

          <hr className="divider" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              {/* ✅ FIX: Changed label from MON to ETH/MON */}
              <label className="form-label">Funding Cap (ETH) <span className="text-red-400">*</span></label>
              <input
                type="number"
                name="fundingCap"
                required
                step="0.001"
                min="0.001"
                className="field"
                placeholder="e.g. 5.0"
                value={formData.fundingCap}
                onChange={handleChange}
                disabled={pending}
              />
            </div>
            <div>
              <label className="form-label">Deadline <span className="text-red-400">*</span></label>
              <input
                type="datetime-local"
                name="deadline"
                required
                className="field"
                value={formData.deadline}
                onChange={handleChange}
                min={new Date().toISOString().slice(0, 16)}
                disabled={pending}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          {isConnected && !isRightNetwork ? (
            <button
              type="button"
              // ✅ FIX: Triggers switchToLocalhost and updated logs/text
              onClick={() => { log.wallet("Switch to Hardhat clicked from create page"); switchToLocalhost(); }}
              className="btn-primary w-full md:w-auto min-w-[200px] bg-amber-500 hover:bg-amber-400"
            >
              ⚠️ Switch to Hardhat Local
            </button>
          ) : (
            <button
              type="submit"
              className="btn-primary w-full md:w-auto min-w-[200px]"
              disabled={pending}
            >
              {pending ? "Processing..." : "Launch Campaign"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}