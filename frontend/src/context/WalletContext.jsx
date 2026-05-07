import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";
import log from "../utils/logger.js";

// Monad Testnet — chain 10143
export const EXPECTED_CHAIN_ID = 31337;

const WalletContext = createContext(null);

/**
 * WalletProvider — manages MetaMask connection, account, signer, and ETH balance.
 * Persists connection state across page reloads via localStorage.
 */
export function WalletProvider({ children }) {
  const [account, setAccount]     = useState(null);    // connected wallet address
  const [provider, setProvider]   = useState(null);    // ethers BrowserProvider
  const [signer, setSigner]       = useState(null);    // ethers Signer
  const [balance, setBalance]     = useState(null);    // ETH balance (string)
  const [chainId, setChainId]     = useState(null);    // current chain ID
  const [connecting, setConnecting] = useState(false); // loading flag

  // ── Internal helpers ──────────────────────────────────────────────────────

  async function refreshBalance(prov, addr) {
    try {
      const bal = await prov.getBalance(addr);
      const formatted = parseFloat(ethers.formatEther(bal)).toFixed(4);
      setBalance(formatted);
      log.wallet("Balance refreshed", { address: addr, balance: `${formatted} ETH` });
    } catch {
      setBalance("0.0000");
      log.warn("Failed to refresh balance", { address: addr });
    }
  }

  async function setupProvider(ethereum) {
    log.wallet("Setting up provider…");
    log.time("provider_setup");
    const prov = new ethers.BrowserProvider(ethereum);
    const sign = await prov.getSigner();
    const net  = await prov.getNetwork();
    const addr = await sign.getAddress();

    setProvider(prov);
    setSigner(sign);
    setAccount(addr);
    setChainId(Number(net.chainId));
    await refreshBalance(prov, addr);
    localStorage.setItem("capdao_connected", "true");

    log.timeEnd("provider_setup", "WALLET");
    log.wallet("Provider ready", {
      account: addr,
      chainId: Number(net.chainId),
      chainName: net.name,
    });

    return { prov, sign, addr };
  }

  // ── Connect wallet ─────────────────────────────────────────────────────────
  const connectWallet = useCallback(async () => {
    log.wallet("Connect wallet requested");
    if (!window.ethereum) {
      log.error("MetaMask not detected");
      toast.error("MetaMask not detected! Please install it.");
      return;
    }
    setConnecting(true);
    log.time("wallet_connect");
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      const { addr } = await setupProvider(window.ethereum);
      log.timeEnd("wallet_connect", "WALLET");
      log.success("Wallet connected", { account: addr });
      toast.success("Wallet connected!");
    } catch (err) {
      log.timeEnd("wallet_connect", "WALLET");
      const msg = err.code === 4001 ? "Connection rejected." : "Failed to connect wallet.";
      log.error("Wallet connection failed", { code: err.code, message: err.message });
      toast.error(msg);
    } finally {
      setConnecting(false);
    }
  }, []);

  // ── Disconnect wallet ──────────────────────────────────────────────────────
  const disconnectWallet = useCallback(() => {
    log.wallet("Wallet disconnected", { account });
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setBalance(null);
    setChainId(null);
    localStorage.removeItem("capdao_connected");
    toast("Wallet disconnected", { icon: "👋" });
  }, [account]);

  // ── Auto-reconnect on page load ────────────────────────────────────────────
  useEffect(() => {
    const wasConnected = localStorage.getItem("capdao_connected");
    if (wasConnected && window.ethereum) {
      log.wallet("Auto-reconnecting from saved session…");
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts) => {
          if (accounts.length > 0) {
            log.wallet("Found existing session", { accounts: accounts.length });
            setupProvider(window.ethereum);
          } else {
            log.wallet("No active accounts found — skipping auto-reconnect");
          }
        })
        .catch((err) => {
          log.warn("Auto-reconnect failed", { message: err.message });
        });
    }
  }, []);

  // ── Listen for MetaMask account / chain changes ────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        log.wallet("All accounts removed — disconnecting");
        disconnectWallet();
      } else {
        log.wallet("Account changed via MetaMask", { newAccount: accounts[0] });
        await setupProvider(window.ethereum);
        toast("Account switched", { icon: "🔄" });
      }
    };

    const handleChainChanged = (newChainId) => {
      log.wallet("Network changed via MetaMask", { newChainId });
      toast("Network changed — refreshing…", { icon: "⛓️" });
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [disconnectWallet]);

  // ── Switch to Monad Testnet ─────────────────────────────────────────────────
  const switchToMonad = useCallback(async () => {
    log.wallet("Switching to Monad Testnet…");
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x279F",           // 10143 in hex
          chainName: "Monad Testnet",
          rpcUrls: ["https://testnet-rpc.monad.xyz/"],
          nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
          blockExplorerUrls: ["https://testnet.monadvision.com/"],
        }],
      });
      log.success("Switched to Monad Testnet");
    } catch (err) {
      log.error("Failed to switch to Monad", { message: err.message });
      toast.error("Failed to switch network: " + err.message);
    }
  }, []);

  // ── Switch to Hardhat Localhost (chainId 31337) ────────────────────────────
  const switchToLocalhost = useCallback(async () => {
    log.wallet("Switching to Hardhat Localhost…");
    if (!window.ethereum) {
      log.error("MetaMask not detected for network switch");
      toast.error("MetaMask not detected!");
      return;
    }
    try {
      // Try switching first (in case network was already added)
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7A69" }], // 31337 in hex
      });
      log.success("Switched to Hardhat Localhost");
    } catch (switchErr) {
      // 4902 = chain not added yet → add it
      if (switchErr.code === 4902) {
        log.wallet("Hardhat not in MetaMask — adding network…");
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: "0x7A69",
              chainName: "Hardhat Localhost",
              rpcUrls: ["http://127.0.0.1:8545"],
              nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
            }],
          });
          log.success("Hardhat Localhost network added & switched");
        } catch (addErr) {
          log.error("Could not add Hardhat network", { message: addErr.message });
          toast.error("Could not add Hardhat network: " + addErr.message);
        }
      } else {
        log.error("Failed to switch to Localhost", { code: switchErr.code, message: switchErr.message });
        toast.error("Failed to switch network: " + switchErr.message);
      }
    }
  }, []);

  const value = {
    account,
    provider,
    signer,
    balance,
    chainId,
    connecting,
    connectWallet,
    disconnectWallet,
    switchToMonad,
    switchToLocalhost,
    isConnected: !!account,
    isMonad:      chainId === 10143,
    isLocalhost:  chainId === 31337,
    isRightNetwork: chainId === EXPECTED_CHAIN_ID,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

/** Hook to consume wallet context */
export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
