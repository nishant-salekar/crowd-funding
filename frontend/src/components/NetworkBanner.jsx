import { useWallet, EXPECTED_CHAIN_ID } from "../context/WalletContext.jsx";

const NETWORK_NAMES = {
  31337: "Hardhat Localhost",
  10143: "Monad Testnet",
  1:     "Ethereum Mainnet",
  11155111: "Sepolia",
};

const EXPECTED_NAME = NETWORK_NAMES[EXPECTED_CHAIN_ID] || `Chain ${EXPECTED_CHAIN_ID}`;

export default function NetworkBanner() {
  const { isConnected, isRightNetwork, chainId, switchToMonad } = useWallet();

  // Only show the banner when the wallet is connected on the WRONG network
  if (!isConnected || isRightNetwork) return null;

  const currentName = NETWORK_NAMES[chainId] || `Chain ${chainId}`;
  const switchFn = switchToMonad;

  return (
    <div
      style={{
        position: "fixed",
        top: "72px",
        left: 0,
        right: 0,
        zIndex: 1000,
        background: "linear-gradient(90deg, #f59e0b22, #ef444422)",
        borderBottom: "1px solid #f59e0b55",
        backdropFilter: "blur(8px)",
        padding: "10px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        fontSize: "13px",
        color: "#fbbf24",
      }}
    >
      <span>⚠️</span>
      <span>
        Wrong network detected: <strong>{currentName}</strong>. Switch to{" "}
        <strong>{EXPECTED_NAME}</strong> to create and fund campaigns.
      </span>
      <button
        onClick={switchFn}
        style={{
          background: "#f59e0b",
          color: "#000",
          border: "none",
          borderRadius: "6px",
          padding: "4px 14px",
          fontWeight: 600,
          fontSize: "12px",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Switch Network
      </button>
    </div>
  );
}
