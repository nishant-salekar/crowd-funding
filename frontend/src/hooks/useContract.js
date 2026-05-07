import { ethers } from "ethers";
import { getSignedContract, getReadOnlyContract, parseCampaign } from "../utils/contract.js";
import { useWallet } from "../context/WalletContext.jsx";
import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import log from "../utils/logger.js";

/**
 * useContract — CapFund+ hook
 *
 * Provides all methods to interact with the CapFund+ smart contract.
 * Each method returns { success, data?, txHash? } and fires toast notifications.
 */
export function useContract() {
  const { signer, account, isConnected } = useWallet();
  const [pending, setPending] = useState(false);

  /** Guard — require connected wallet before any write */
  function requireWallet() {
    if (!isConnected || !signer) {
      log.warn("Wallet not connected — blocking write operation");
      toast.error("Please connect your wallet first.");
      return false;
    }
    return true;
  }

  // ── createCampaign ─────────────────────────────────────────────────────────
  const createCampaign = useCallback(async (fundingCapEth, deadlineTs) => {
    if (!requireWallet()) return { success: false };
    setPending(true);
    log.contract("createCampaign() called", { fundingCapEth, deadlineTs, deadline: new Date(deadlineTs * 1000).toISOString() });
    log.time("tx_createCampaign");
    const toastId = toast.loading("Creating campaign on-chain…");
    
    try {
      const contract = getSignedContract(signer);
      const capWei   = ethers.parseEther(fundingCapEth.toString());
      log.contract("Sending createCampaign tx…", { capWei: capWei.toString() });
      
      const tx = await contract.createCampaign(capWei, BigInt(deadlineTs));
      log.contract("Transaction submitted", { txHash: tx.hash });
      toast.loading("Waiting for confirmation…", { id: toastId });
      
      const receipt = await tx.wait();
      log.contract("Transaction confirmed", { txHash: receipt.hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed?.toString() });

      // Parse CampaignCreated event to extract campaign ID
      const event = receipt.logs
        .map((l) => { try { return contract.interface.parseLog(l); } catch { return null; } })
        .find((e) => e?.name === "CampaignCreated");

      const campaignId = event ? Number(event.args.id) : null;
      log.success(`Campaign created on-chain`, { campaignId, txHash: receipt.hash });
      log.timeEnd("tx_createCampaign", "CONTRACT");
      toast.success("Campaign created! 🎉", { id: toastId });
      
      return { success: true, campaignId, txHash: receipt.hash };
    } catch (err) {
      log.timeEnd("tx_createCampaign", "CONTRACT");
      log.error("createCampaign failed", { reason: err.reason, message: err.shortMessage || err.message });
      toast.error(err.reason || err.shortMessage || "Transaction failed", { id: toastId });
      return { success: false };
    } finally {
      setPending(false);
    }
  }, [signer, isConnected]);

  // ── contribute ─────────────────────────────────────────────────────────────
  const contribute = useCallback(async (campaignId, amountEth) => {
    if (!requireWallet()) return { success: false };
    setPending(true);
    log.contract("contribute() called", { campaignId, amountEth });
    log.time("tx_contribute");
    const toastId = toast.loading("Sending contribution…");
    
    try {
      const contract = getSignedContract(signer);
      const value    = ethers.parseEther(amountEth.toString());
      log.contract("Sending contribute tx…", { campaignId, valueWei: value.toString() });
      
      const tx = await contract.contribute(BigInt(campaignId), { value });
      log.contract("Transaction submitted", { txHash: tx.hash });
      toast.loading("Confirming transaction…", { id: toastId });
      
      const receipt = await tx.wait();
      log.contract("Transaction confirmed", { txHash: receipt.hash, blockNumber: receipt.blockNumber, gasUsed: receipt.gasUsed?.toString() });

      // Detect partial refund
      const refundEvent = receipt.logs
        .map((l) => { try { return contract.interface.parseLog(l); } catch { return null; } })
        .find((e) => e?.name === "RefundIssued");

      if (refundEvent) {
        const refundAmt = ethers.formatEther(refundEvent.args.amount);
        log.success(`Contribution confirmed with partial refund`, { campaignId, refunded: `${refundAmt} ETH` });
        toast.success(`Contributed! ${refundAmt} ETH refunded (cap reached) 💫`, { id: toastId, duration: 7000 });
      } else {
        log.success(`Contribution confirmed`, { campaignId, amount: `${amountEth} ETH` });
        toast.success("Contribution confirmed! 🚀", { id: toastId });
      }

      log.timeEnd("tx_contribute", "CONTRACT");
      return { success: true, txHash: receipt.hash };
    } catch (err) {
      log.timeEnd("tx_contribute", "CONTRACT");
      log.error("contribute failed", { campaignId, reason: err.reason, message: err.shortMessage || err.message });
      toast.error(err.reason || err.shortMessage || "Transaction failed", { id: toastId });
      return { success: false };
    } finally {
      setPending(false);
    }
  }, [signer, isConnected]);

  // ── withdraw ───────────────────────────────────────────────────────────────
  const withdraw = useCallback(async (campaignId) => {
    if (!requireWallet()) return { success: false };
    setPending(true);
    log.contract("withdraw() called", { campaignId });
    log.time("tx_withdraw");
    const toastId = toast.loading("Withdrawing funds…");
    try {
      const contract = getSignedContract(signer);
      const tx       = await contract.withdraw(BigInt(campaignId));
      toast.loading("Confirming…", { id: toastId });
      const receipt  = await tx.wait();
      log.success("Withdrawal confirmed", { campaignId, txHash: receipt.hash });
      log.timeEnd("tx_withdraw", "CONTRACT");
      toast.success("Funds withdrawn! 💰", { id: toastId });
      return { success: true, txHash: receipt.hash };
    } catch (err) {
      log.timeEnd("tx_withdraw", "CONTRACT");
      toast.error(err.reason || err.shortMessage || "Withdrawal failed", { id: toastId });
      return { success: false };
    } finally {
      setPending(false);
    }
  }, [signer, isConnected]);

  // ── claimRefund ────────────────────────────────────────────────────────────
  const claimRefund = useCallback(async (campaignId) => {
    if (!requireWallet()) return { success: false };
    setPending(true);
    log.contract("claimRefund() called", { campaignId });
    log.time("tx_claimRefund");
    const toastId = toast.loading("Claiming refund…");
    try {
      const contract = getSignedContract(signer);
      const tx       = await contract.claimRefund(BigInt(campaignId));
      toast.loading("Confirming…", { id: toastId });
      const receipt  = await tx.wait();
      log.success("Refund claimed", { campaignId, txHash: receipt.hash });
      log.timeEnd("tx_claimRefund", "CONTRACT");
      toast.success("Refund received! 🔄", { id: toastId });
      return { success: true, txHash: receipt.hash };
    } catch (err) {
      log.timeEnd("tx_claimRefund", "CONTRACT");
      toast.error(err.reason || err.shortMessage || "Refund failed", { id: toastId });
      return { success: false };
    } finally {
      setPending(false);
    }
  }, [signer, isConnected]);

  // ── fundInterestPool ───────────────────────────────────────────────────────
  const fundInterestPool = useCallback(async (campaignId, amountEth) => {
    if (!requireWallet()) return { success: false };
    setPending(true);
    log.interest("fundInterestPool() called", { campaignId, amountEth });
    log.time("tx_fundInterestPool");
    const toastId = toast.loading("Funding interest pool…");
    try {
      const contract = getSignedContract(signer);
      const value    = ethers.parseEther(amountEth.toString());
      const tx       = await contract.fundInterestPool(BigInt(campaignId), { value });
      toast.loading("Confirming…", { id: toastId });
      const receipt  = await tx.wait();
      log.success("Interest pool funded", { campaignId, amount: `${amountEth} ETH`, txHash: receipt.hash });
      log.timeEnd("tx_fundInterestPool", "INTEREST");
      toast.success("Interest pool funded! 💎", { id: toastId });
      return { success: true, txHash: receipt.hash };
    } catch (err) {
      log.timeEnd("tx_fundInterestPool", "INTEREST");
      toast.error(err.reason || err.shortMessage || "Failed", { id: toastId });
      return { success: false };
    } finally {
      setPending(false);
    }
  }, [signer, isConnected]);

  // ── claimInterest ──────────────────────────────────────────────────────────
  const claimInterest = useCallback(async (campaignId) => {
    if (!requireWallet()) return { success: false };
    setPending(true);
    log.interest("claimInterest() called", { campaignId });
    log.time("tx_claimInterest");
    const toastId = toast.loading("Claiming interest rewards…");
    try {
      const contract = getSignedContract(signer);
      const tx       = await contract.claimInterest(BigInt(campaignId));
      toast.loading("Confirming…", { id: toastId });
      const receipt  = await tx.wait();

      const evt = receipt.logs
        .map((l) => { try { return contract.interface.parseLog(l); } catch { return null; } })
        .find((e) => e?.name === "InterestClaimed");

      if (evt) {
        const amt = parseFloat(ethers.formatEther(evt.args.amount)).toFixed(6);
        toast.success(`Claimed ${amt} ETH interest! 💸`, { id: toastId, duration: 6000 });
      } else {
        toast.success("Interest claimed! 💸", { id: toastId });
      }

      log.timeEnd("tx_claimInterest", "INTEREST");
      return { success: true, txHash: receipt.hash };
    } catch (err) {
      log.timeEnd("tx_claimInterest", "INTEREST");
      toast.error(err.reason || err.shortMessage || "Claim failed", { id: toastId });
      return { success: false };
    } finally {
      setPending(false);
    }
  }, [signer, isConnected]);

  // ── createProposal ─────────────────────────────────────────────────────────
  const createProposal = useCallback(async (campaignId, description, pType, votingDuration, newDeadline = 0) => {
    if (!requireWallet()) return { success: false };
    setPending(true);
    log.time("tx_createProposal");
    const toastId = toast.loading("Creating proposal…");
    try {
      const contract = getSignedContract(signer);
      const tx = await contract.createProposal(
        BigInt(campaignId),
        description,
        pType,
        BigInt(votingDuration),
        BigInt(newDeadline)
      );
      toast.loading("Waiting for block…", { id: toastId });
      const receipt = await tx.wait();

      const evt = receipt.logs
        .map((l) => { try { return contract.interface.parseLog(l); } catch { return null; } })
        .find((e) => e?.name === "ProposalCreated");

      const proposalId = evt ? Number(evt.args.proposalId) : null;
      log.timeEnd("tx_createProposal", "DAO");
      toast.success("Proposal created! 🗳️", { id: toastId });
      return { success: true, proposalId, txHash: receipt.hash };
    } catch (err) {
      log.timeEnd("tx_createProposal", "DAO");
      toast.error(err.reason || err.shortMessage || "Failed to create proposal", { id: toastId });
      return { success: false };
    } finally {
      setPending(false);
    }
  }, [signer, isConnected]);

  // ── castVote ───────────────────────────────────────────────────────────────
  const castVote = useCallback(async (campaignId, proposalId, support) => {
    if (!requireWallet()) return { success: false };
    setPending(true);
    log.time("tx_castVote");
    const toastId = toast.loading(`Casting ${support ? "YES ✅" : "NO ❌"} vote…`);
    try {
      const contract = getSignedContract(signer);
      const tx       = await contract.vote(BigInt(campaignId), BigInt(proposalId), support);
      toast.loading("Confirming vote…", { id: toastId });
      const receipt  = await tx.wait();
      log.timeEnd("tx_castVote", "DAO");
      toast.success(`Vote recorded: ${support ? "YES ✅" : "NO ❌"}`, { id: toastId });
      return { success: true, txHash: receipt.hash };
    } catch (err) {
      log.timeEnd("tx_castVote", "DAO");
      toast.error(err.reason || err.shortMessage || "Vote failed", { id: toastId });
      return { success: false };
    } finally {
      setPending(false);
    }
  }, [signer, isConnected]);

  // ── executeProposal ────────────────────────────────────────────────────────
  const executeProposal = useCallback(async (campaignId, proposalId) => {
    if (!requireWallet()) return { success: false };
    setPending(true);
    log.time("tx_executeProposal");
    const toastId = toast.loading("Executing proposal…");
    try {
      const contract = getSignedContract(signer);
      const tx       = await contract.executeProposal(BigInt(campaignId), BigInt(proposalId));
      toast.loading("Confirming…", { id: toastId });
      const receipt  = await tx.wait();

      const evt = receipt.logs
        .map((l) => { try { return contract.interface.parseLog(l); } catch { return null; } })
        .find((e) => e?.name === "ProposalExecuted");

      const passed = evt ? evt.args.passed : false;
      log.timeEnd("tx_executeProposal", "DAO");
      toast.success(
        passed ? "Proposal PASSED and executed! ✅" : "Proposal FAILED (majority NO) ❌",
        { id: toastId, duration: 6000 }
      );
      return { success: true, passed, txHash: receipt.hash };
    } catch (err) {
      log.timeEnd("tx_executeProposal", "DAO");
      toast.error(err.reason || err.shortMessage || "Execution failed", { id: toastId });
      return { success: false };
    } finally {
      setPending(false);
    }
  }, [signer, isConnected]);

  // ── fetchProposals (read) ──────────────────────────────────────────────────
  const fetchProposals = useCallback(async (campaignId) => {
    log.time("fetch_proposals");
    try {
      const contract = getReadOnlyContract();
      if (!contract) return [];

      const count = Number(await contract.getProposalCount(BigInt(campaignId)));
      const TYPES = ["RELEASE_FUNDS", "CHANGE_DEADLINE", "CANCEL"];

      const results = await Promise.all(
        Array.from({ length: count }, async (_, i) => {
          const raw = await contract.getProposal(BigInt(campaignId), BigInt(i));
          const [description, pType, yesVotes, noVotes, votingDeadline, newDeadline, executed, passed] = raw;
          const total = BigInt(yesVotes) + BigInt(noVotes);
          const yesPct = total > 0n ? Number((BigInt(yesVotes) * 100n) / total) : 0;
          const noPct  = total > 0n ? Number((BigInt(noVotes)  * 100n) / total) : 0;
          const isOpen = !executed && Date.now() / 1000 < Number(votingDeadline);

          let userVoted = false;
          if (account) {
            try { userVoted = await contract.hasVoted(BigInt(campaignId), BigInt(i), account); } catch {}
          }

          return {
            id: i,
            description,
            pType: Number(pType),
            pTypeLabel: TYPES[Number(pType)] || "UNKNOWN",
            yesVotes: parseFloat(ethers.formatEther(yesVotes)).toFixed(4),
            noVotes: parseFloat(ethers.formatEther(noVotes)).toFixed(4),
            yesPct,
            noPct,
            total: parseFloat(ethers.formatEther(total)).toFixed(4),
            votingDeadline: Number(votingDeadline),
            newDeadline: Number(newDeadline),
            executed,
            passed,
            isOpen,
            userVoted,
          };
        })
      );
      log.timeEnd("fetch_proposals", "DAO");
      return results;
    } catch (err) {
      console.error("fetchProposals error:", err);
      return [];
    }
  }, [account]);

  // ── fetchInterest (read) ───────────────────────────────────────────────────
  const fetchInterest = useCallback(async (campaignId) => {
    try {
      const contract = getReadOnlyContract();
      if (!contract || !account) return null;

      const [interestWei, contribWei, rawCampaign] = await Promise.all([
        contract.calculateInterest(BigInt(campaignId), account),
        contract.getContribution(BigInt(campaignId), account),
        contract.getCampaign(BigInt(campaignId)),
      ]);

      const poolWei = rawCampaign[6]; // interestPool is index 6

      return {
        interestWei: interestWei,
        interestEth: parseFloat(ethers.formatEther(interestWei)).toFixed(6),
        contributionEth: parseFloat(ethers.formatEther(contribWei)).toFixed(4),
        poolEth: parseFloat(ethers.formatEther(poolWei)).toFixed(4),
      };
    } catch (err) {
      console.error("fetchInterest error:", err);
      return null;
    }
  }, [account]);

  // ── fetchCampaign (read) ───────────────────────────────────────────────────
  const fetchCampaign = useCallback(async (campaignId) => {
    try {
      const contract = getReadOnlyContract();
      if (!contract) return null;
      
      const raw = await contract.getCampaign(BigInt(campaignId));
      return parseCampaign(campaignId, raw);
    } catch (err) {
      console.error("fetchCampaign failed:", err);
      return null;
    }
  }, []);

  return {
    createCampaign,
    contribute,
    withdraw,
    claimRefund,
    fundInterestPool,
    claimInterest,
    createProposal,
    castVote,
    executeProposal,
    fetchProposals,
    fetchInterest,
    fetchCampaign,
    pending,
  };
}