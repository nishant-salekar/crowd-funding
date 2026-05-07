import { useState } from "react";
import { useContract } from "../hooks/useContract";
import toast from "react-hot-toast";

/** Proposal type options */
const PROPOSAL_TYPES = [
  { value: 0, label: "💰 Release Funds",     desc: "Allow owner to withdraw raised funds early" },
  { value: 1, label: "📅 Change Deadline",   desc: "Extend the campaign deadline" },
  { value: 2, label: "🚫 Cancel Campaign",   desc: "Cancel campaign + enable refunds" },
];

/**
 * CreateProposalModal
 *
 * Slide-in form that lets the campaign owner create a new DAO proposal.
 *
 * @param {number}   campaignId  — parent campaign
 * @param {number}   deadline    — current campaign deadline (Unix ts)
 * @param {function} onClose     — called to close the modal
 * @param {function} onCreated   — called after a proposal is created
 */
export default function CreateProposalModal({ campaignId, deadline, onClose, onCreated }) {
  const { createProposal, pending } = useContract();

  const [form, setForm] = useState({
    description:     "",
    pType:           0,
    votingDays:      3,
    newDeadlineDate: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.description.trim()) {
      return toast.error("Please enter a proposal description.");
    }

    const votingDuration = parseInt(form.votingDays) * 86400; // days → seconds
    if (votingDuration < 3600) {
      return toast.error("Minimum voting duration is 1 hour.");
    }

    let newDeadlineTs = 0;
    if (Number(form.pType) === 1) {
      if (!form.newDeadlineDate) return toast.error("Please set a new deadline for this proposal type.");
      newDeadlineTs = Math.floor(new Date(form.newDeadlineDate).getTime() / 1000);
      if (newDeadlineTs <= deadline) return toast.error("New deadline must be later than the current one.");
    }

    const res = await createProposal(
      campaignId,
      form.description.trim(),
      Number(form.pType),
      votingDuration,
      newDeadlineTs
    );

    if (res.success) {
      onCreated?.();
      onClose();
    }
  };

  const selectedType = PROPOSAL_TYPES.find((t) => t.value === Number(form.pType));

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="glass-card w-full max-w-lg p-6 border border-indigo-500/30 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">🗳️ Create Proposal</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/20 transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Proposal Type */}
          <div>
            <label className="form-label">Proposal Type</label>
            <select
              name="pType"
              value={form.pType}
              onChange={handleChange}
              className="field appearance-none"
              disabled={pending}
            >
              {PROPOSAL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1.5">{selectedType?.desc}</p>
          </div>

          {/* Description */}
          <div>
            <label className="form-label">Description <span className="text-red-400">*</span></label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Explain why this proposal should pass…"
              className="field min-h-[90px] resize-y"
              maxLength={500}
              disabled={pending}
              required
            />
            <p className="text-[11px] text-slate-500 text-right mt-1">{form.description.length}/500</p>
          </div>

          {/* New Deadline — only for type 1 */}
          {Number(form.pType) === 1 && (
            <div>
              <label className="form-label">New Campaign Deadline <span className="text-red-400">*</span></label>
              <input
                type="datetime-local"
                name="newDeadlineDate"
                value={form.newDeadlineDate}
                onChange={handleChange}
                className="field"
                min={new Date(deadline * 1000 + 86400000).toISOString().slice(0, 16)}
                disabled={pending}
                required
              />
            </div>
          )}

          {/* Voting Duration */}
          <div>
            <label className="form-label">Voting Duration (days)</label>
            <input
              type="number"
              name="votingDays"
              value={form.votingDays}
              onChange={handleChange}
              min={1}
              max={14}
              className="field"
              disabled={pending}
            />
            <p className="text-xs text-slate-500 mt-1">
              Voting window: {form.votingDays} {form.votingDays == 1 ? "day" : "days"}
            </p>
          </div>

          {/* Cancel type warning */}
          {Number(form.pType) === 2 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300">
              ⚠️ If this proposal passes, the campaign will be <strong>permanently cancelled</strong> and contributors will be able to claim refunds.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost flex-1"
              disabled={pending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={pending}
            >
              {pending ? "Creating…" : "Create Proposal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
