/**
 * CapDAO — Frontend Activity Logger
 *
 * Comprehensive, color-coded console logger that records every frontend
 * activity: wallet operations, contract calls, API requests, UI interactions,
 * routing, DAO actions, interest operations, and more.
 *
 * Usage:
 *   import log from "../utils/logger";
 *   log.wallet("Connected", { account: "0x..." });
 *   log.contract("createCampaign", { cap: "1.5 ETH" });
 *   log.api("POST /api/campaign", { status: 201 });
 */

const COLORS = {
  WALLET:   { badge: "#8b5cf6", text: "#c4b5fd", bg: "#8b5cf620" },
  CONTRACT: { badge: "#6366f1", text: "#a5b4fc", bg: "#6366f120" },
  CHAIN:    { badge: "#06b6d4", text: "#67e8f9", bg: "#06b6d420" },
  API:      { badge: "#10b981", text: "#6ee7b7", bg: "#10b98120" },
  UI:       { badge: "#f59e0b", text: "#fcd34d", bg: "#f59e0b20" },
  ROUTER:   { badge: "#ec4899", text: "#f9a8d4", bg: "#ec489920" },
  DAO:      { badge: "#f97316", text: "#fdba74", bg: "#f9731620" },
  INTEREST: { badge: "#14b8a6", text: "#5eead4", bg: "#14b8a620" },
  ERROR:    { badge: "#ef4444", text: "#fca5a5", bg: "#ef444420" },
  SUCCESS:  { badge: "#22c55e", text: "#86efac", bg: "#22c55e20" },
};

function ts() {
  return new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
}

function _log(category, message, data, level = "log") {
  const c = COLORS[category] || COLORS.UI;
  const prefix = `%c ${category} %c ${ts()} %c ${message}`;
  const styles = [
    `background:${c.badge};color:#fff;padding:2px 6px;border-radius:3px;font-weight:700;font-size:11px`,
    `color:#64748b;font-size:10px`,
    `color:${c.text};font-weight:500`,
  ];

  if (data !== undefined && data !== null) {
    if (typeof data === "object" && Object.keys(data).length > 0) {
      console[level](prefix, ...styles, "\n", data);
    } else {
      console[level](prefix, ...styles, data);
    }
  } else {
    console[level](prefix, ...styles);
  }
}

function _group(category, label, fn) {
  const c = COLORS[category] || COLORS.UI;
  console.groupCollapsed(
    `%c ${category} %c ${ts()} %c ${label}`,
    `background:${c.badge};color:#fff;padding:2px 6px;border-radius:3px;font-weight:700;font-size:11px`,
    `color:#64748b;font-size:10px`,
    `color:${c.text};font-weight:500`
  );
  fn();
  console.groupEnd();
}

// ── Timing helpers ──────────────────────────────────────────────────────────
const timers = {};
function startTimer(label) {
  timers[label] = performance.now();
}
function endTimer(label) {
  if (!timers[label]) return "?ms";
  const ms = (performance.now() - timers[label]).toFixed(1);
  delete timers[label];
  return `${ms}ms`;
}

// ── Public API ──────────────────────────────────────────────────────────────
const log = {
  // ── Wallet activities ───────────────────────────────────────────────────
  wallet: (msg, data) => _log("WALLET", msg, data),

  // ── Smart contract interactions ─────────────────────────────────────────
  contract: (msg, data) => _log("CONTRACT", msg, data),

  // ── Blockchain / chain reads ────────────────────────────────────────────
  chain: (msg, data) => _log("CHAIN", msg, data),

  // ── Backend API calls ───────────────────────────────────────────────────
  api: (msg, data) => _log("API", msg, data),

  // ── UI / user interactions ──────────────────────────────────────────────
  ui: (msg, data) => _log("UI", msg, data),

  // ── React Router navigation ─────────────────────────────────────────────
  router: (msg, data) => _log("ROUTER", msg, data),

  // ── DAO proposals & voting ──────────────────────────────────────────────
  dao: (msg, data) => _log("DAO", msg, data),

  // ── Interest pool operations ────────────────────────────────────────────
  interest: (msg, data) => _log("INTEREST", msg, data),

  // ── Generic success ─────────────────────────────────────────────────────
  success: (msg, data) => _log("SUCCESS", msg, data),

  // ── Errors ──────────────────────────────────────────────────────────────
  error: (msg, data) => _log("ERROR", msg, data, "error"),

  // ── Warnings ────────────────────────────────────────────────────────────
  warn: (msg, data) => _log("ERROR", `⚠ ${msg}`, data, "warn"),

  // ── Grouped logs ────────────────────────────────────────────────────────
  group: _group,

  // ── Timers ──────────────────────────────────────────────────────────────
  time:    startTimer,
  timeEnd: (label, category = "UI") => {
    const elapsed = endTimer(label);
    _log(category, `⏱ ${label} completed in ${elapsed}`);
    return elapsed;
  },

  // ── Table (for arrays/objects) ──────────────────────────────────────────
  table: (label, data) => {
    _log("UI", label);
    console.table(data);
  },

  // ── Separator ───────────────────────────────────────────────────────────
  sep: (label = "") => {
    console.log(
      `%c──────────────────── ${label} ────────────────────`,
      "color:#475569;font-size:10px"
    );
  },

  // ── App boot banner ─────────────────────────────────────────────────────
  boot: () => {
    console.log(
      "%c 🚀 CapDAO Frontend %c v1.0 %c Activity Logger Active ",
      "background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:6px 12px;border-radius:6px 0 0 6px;font-weight:700;font-size:13px",
      "background:#1e1b4b;color:#a5b4fc;padding:6px 8px;font-size:11px",
      "background:#0f172a;color:#64748b;padding:6px 12px;border-radius:0 6px 6px 0;font-size:10px"
    );
    _log("UI", "App initialized", {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent.slice(0, 80),
      viewport: `${window.innerWidth}×${window.innerHeight}`,
      url: window.location.href,
    });
  },
};

export default log;
