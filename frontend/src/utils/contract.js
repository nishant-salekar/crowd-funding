import { ethers } from "ethers";
import { CONTRACT_ABI } from "./abi.js";
import { CONTRACT_ADDRESS } from "./deployedAddress.js";
import log from "./logger.js";

/**
 * Read-only contract instance backed by a direct JSON-RPC provider.
 * Deliberately does NOT use window.ethereum / MetaMask so that reads
 * always hit the correct chain regardless of which network MetaMask is on.
 *
 * Priority:
 * 1. VITE_RPC_URL  (set in frontend/.env)
 * 2. http://127.0.0.1:8545 (Hardhat Local — default for development)
 */
const READ_RPC = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";

export function getReadOnlyContract() {
  try {
    const provider = new ethers.JsonRpcProvider(READ_RPC);
    log.chain("Read-only contract created", { rpc: READ_RPC, contract: CONTRACT_ADDRESS });
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  } catch (err) {
    log.error("getReadOnlyContract failed", { rpc: READ_RPC, error: err.message });
    console.warn("getReadOnlyContract: could not connect to RPC", READ_RPC, err.message);
    return null;
  }
}

/**
 * Write-enabled contract instance connected to the provided signer.
 * @param {ethers.Signer} signer — from WalletContext
 */
export function getSignedContract(signer) {
  if (!signer) throw new Error("Signer is required");
  log.contract("Signed contract instance created", { contract: CONTRACT_ADDRESS });
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
}

/**
 * Parse the raw 7-tuple returned by getCampaign() into a typed object.
 *
 * Contract return order:
 * [0] owner        address
 * [1] fundingCap   uint256
 * [2] totalFunds   uint256
 * [3] deadline     uint256
 * [4] withdrawn    bool
 * [5] cancelled    bool
 * [6] interestPool uint256
 *
 * @param {number|bigint} id  — campaign ID
 * @param {Array}         raw — return value from getCampaign()
 */
export function parseCampaign(id, raw) {
  const [owner, fundingCap, totalFunds, deadline, withdrawn, cancelled, interestPool] = raw;
  const capEth    = parseFloat(ethers.formatEther(fundingCap));
  const raisedEth = parseFloat(ethers.formatEther(totalFunds));
  const pct       = capEth > 0 ? Math.min((raisedEth / capEth) * 100, 100) : 0;

  const parsed = {
    id:           Number(id),
    owner,
    fundingCap:   capEth,
    totalFunds:   raisedEth,
    deadline:     Number(deadline),
    withdrawn,
    cancelled,
    interestPool: parseFloat(ethers.formatEther(interestPool)),
    progress:     pct,
    isFunded:     raisedEth >= capEth,
    isExpired:    Date.now() / 1000 >= Number(deadline),
  };

  log.chain(`Parsed campaign #${id}`, {
    owner: owner?.slice(0, 10) + "…",
    raised: `${raisedEth} ETH`,
    cap: `${capEth} ETH`,
    progress: `${pct.toFixed(1)}%`,
    isFunded: parsed.isFunded,
    isExpired: parsed.isExpired,
  });

  return parsed;
}

/**
 * Human-readable countdown string.
 * @param {number} deadlineTs — Unix timestamp (seconds)
 */
export function formatTimeLeft(deadlineTs) {
  const diff = deadlineTs - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Ended";

  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);

  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

/**
 * Shorten an Ethereum address for display.
 * @param {string} address
 */
export function shortenAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Re-export for convenience */
export { CONTRACT_ADDRESS, CONTRACT_ABI };