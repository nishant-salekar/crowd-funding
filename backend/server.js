require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const mongoose = require("mongoose");

// ── ANSI color helpers ──────────────────────────────────────────────────────
const RESET   = "\x1b[0m";
const BOLD    = "\x1b[1m";
const GREEN   = "\x1b[32m";
const YELLOW  = "\x1b[33m";
const RED     = "\x1b[31m";
const CYAN    = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const BLUE    = "\x1b[34m";
const WHITE   = "\x1b[37m";
const GRAY    = "\x1b[90m";

function ts() {
  return GRAY + `[${new Date().toISOString()}]` + RESET;
}

function methodColor(method) {
  const map = { GET: GREEN, POST: BLUE, PUT: YELLOW, PATCH: YELLOW, DELETE: RED };
  return (map[method] || WHITE) + BOLD + method.padEnd(6) + RESET;
}

function statusColor(code) {
  if (code >= 500) return RED + BOLD + code + RESET;
  if (code >= 400) return YELLOW + BOLD + code + RESET;
  return GREEN + BOLD + code + RESET;
}

const log = {
  info:  (...a) => console.log(ts(),  BLUE    + " [INFO]  " + RESET, ...a),
  ok:    (...a) => console.log(ts(),  GREEN   + " [OK]    " + RESET, ...a),
  warn:  (...a) => console.warn(ts(), YELLOW  + " [WARN]  " + RESET, ...a),
  error: (...a) => console.error(ts(),RED     + " [ERROR] " + RESET, ...a),
  db:    (...a) => console.log(ts(),  MAGENTA + " [DB]    " + RESET, ...a),
  req:   (...a) => console.log(ts(),  CYAN    + " [REQ]   " + RESET, ...a),
  res:   (...a) => console.log(ts(),  WHITE   + " [RES]   " + RESET, ...a),
  sep:   ()     => console.log(GRAY + "─".repeat(72) + RESET),
};

// ── App setup ───────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "*" }));
app.use(express.json());

// ── Request / Response logger middleware ────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  const ip    = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

  log.req(`${methodColor(req.method)} ${CYAN}${req.url}${RESET}  from ${GRAY}${ip}${RESET}`);

  if (["POST", "PUT", "PATCH"].includes(req.method) && req.body && Object.keys(req.body).length) {
    const safe = { ...req.body };
    for (const k of Object.keys(safe)) {
      if (typeof safe[k] === "string" && safe[k].length > 80) {
        safe[k] = safe[k].slice(0, 77) + "…";
      }
    }
    console.log(GRAY + "         body →" + RESET, safe);
  }

  const origJson = res.json.bind(res);
  res.json = function (body) {
    const ms  = Date.now() - start;
    const sc  = res.statusCode;
    log.res(
      `${methodColor(req.method)} ${CYAN}${req.url}${RESET}` +
      `  → ${statusColor(sc)}` +
      `  ${GRAY}(${ms}ms)${RESET}`
    );
    if (sc >= 400) {
      const summary = typeof body === "object" ? JSON.stringify(body).slice(0, 120) : String(body).slice(0, 120);
      console.log(GRAY + "         body →" + RESET, summary);
    }
    return origJson(body);
  };

  next();
});

// ── In-memory store ─────────────────────────────────────────────────────────
// Start in memory mode — switch to MongoDB only after successful connection
let useMemory = true;
const memStore = [];
let memId = 0;

// ── MongoDB Schema ──────────────────────────────────────────────────────────
let Campaign;
try {
  const schema = new mongoose.Schema({
    contractId:   { type: String, required: true, unique: true },
    ownerAddress: { type: String, required: true },
    title:        { type: String, required: true, maxlength: 100 },
    description:  { type: String, required: true },
    imageUrl:     { type: String, default: "" },
    category:     { type: String, default: "General" },
    createdAt:    { type: Date,   default: Date.now },
  });
  Campaign = mongoose.model("Campaign", schema);
} catch {
  Campaign = mongoose.model("Campaign");
}

// ── MongoDB connection ──────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "";

// Disable Mongoose query buffering so queries don't hang when DB is not ready
mongoose.set("bufferCommands", false);

if (MONGO_URI) {
  log.db("Connecting to MongoDB…");

  mongoose
    .connect(MONGO_URI, { serverSelectionTimeoutMS: 15000 })
    .then(() => {
      useMemory = false; // ← only disable memory mode after confirmed connection
      log.db(GREEN + "MongoDB connected ✓" + RESET, GRAY + MONGO_URI.replace(/:\/\/.*@/, "://<credentials>@") + RESET);
    })
    .catch((err) => {
      log.warn("MongoDB connection FAILED — staying in memory mode");
      log.error(err.message);
      // useMemory stays true — server still works
    });

  mongoose.connection.on("disconnected", () => {
    log.warn("MongoDB disconnected — switching to memory mode");
    useMemory = true;
  });
  mongoose.connection.on("reconnected", () => {
    log.db(GREEN + "MongoDB reconnected ✓" + RESET);
    useMemory = false;
  });
  mongoose.connection.on("error", (e) => log.error("MongoDB error:", e.message));
} else {
  log.warn("MONGO_URI not set — running in memory mode (campaigns lost on restart)");
}

// ── GET / (health check) ────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status:    "ok",
    mode:      useMemory ? "memory" : "mongodb",
    campaigns: useMemory ? memStore.length : "see /api/campaigns",
    uptime:    `${Math.floor(process.uptime())}s`,
  });
});

// ── GET /api/campaigns ──────────────────────────────────────────────────────
app.get("/api/campaigns", async (req, res) => {
  try {
    if (useMemory) {
      const list = [...memStore].reverse();
      log.db(`Memory read — returning ${list.length} campaign(s)`);
      return res.json({ campaigns: list });
    }
    log.db("Querying MongoDB: Campaign.find({}).sort({ createdAt: -1 })");
    const campaigns = await Campaign.find({}).sort({ createdAt: -1 }).lean();
    log.db(`MongoDB returned ${campaigns.length} campaign(s)`);
    return res.json({ campaigns });
  } catch (err) {
    log.error("GET /api/campaigns →", err.message);
    console.error(err.stack);
    res.status(500).json({ error: "Failed to fetch campaigns", detail: err.message });
  }
});

// ── GET /api/campaigns/:contractId ─────────────────────────────────────────
app.get("/api/campaigns/:contractId", async (req, res) => {
  const { contractId } = req.params;
  try {
    if (useMemory) {
      const camp = memStore.find((c) => c.contractId === contractId);
      if (!camp) {
        log.warn(`Memory lookup — campaign #${contractId} NOT FOUND`);
        return res.status(404).json({ error: "Campaign not found" });
      }
      log.db(`Memory lookup — found campaign #${contractId}: "${camp.title}"`);
      return res.json({ campaign: camp });
    }
    log.db(`MongoDB lookup: Campaign.findOne({ contractId: "${contractId}" })`);
    const camp = await Campaign.findOne({ contractId }).lean();
    if (!camp) {
      log.warn(`MongoDB — campaign #${contractId} NOT FOUND`);
      return res.status(404).json({ error: "Campaign not found" });
    }
    log.db(`MongoDB — found campaign #${contractId}: "${camp.title}"`);
    return res.json({ campaign: camp });
  } catch (err) {
    log.error(`GET /api/campaigns/${contractId} →`, err.message);
    console.error(err.stack);
    res.status(500).json({ error: "Failed to fetch campaign", detail: err.message });
  }
});

// ── POST /api/campaign ──────────────────────────────────────────────────────
app.post("/api/campaign", async (req, res) => {
  const { contractId, ownerAddress, title, description, imageUrl, category } = req.body;

  const errors = [];
  if (contractId === undefined || contractId === null || contractId === "")
    errors.push({ msg: "contractId is required" });
  if (!ownerAddress)
    errors.push({ msg: "ownerAddress is required" });
  if (!title || title.trim().length === 0)
    errors.push({ msg: "title is required" });
  if (!description || description.trim().length === 0)
    errors.push({ msg: "description is required" });

  if (errors.length) {
    log.warn("Validation failed for POST /api/campaign:", errors.map(e => e.msg).join(", "));
    return res.status(400).json({ errors });
  }

  const payload = {
    contractId:   String(contractId),
    ownerAddress: String(ownerAddress).toLowerCase(),
    title:        String(title).trim(),
    description:  String(description).trim(),
    imageUrl:     String(imageUrl || ""),
    category:     String(category || "General"),
  };

  log.info(`Saving campaign #${payload.contractId} — "${payload.title}" (${payload.category})`);
  log.info(`  owner: ${payload.ownerAddress}`);

  try {
    if (useMemory) {
      const existing = memStore.findIndex((c) => c.contractId === payload.contractId);
      if (existing >= 0) {
        memStore[existing] = { ...memStore[existing], ...payload };
        log.db(`Memory UPSERT — updated campaign #${payload.contractId} (store size: ${memStore.length})`);
        return res.status(200).json({ campaign: memStore[existing] });
      }
      const doc = { _id: String(++memId), ...payload, createdAt: new Date().toISOString() };
      memStore.push(doc);
      log.ok(`Memory INSERT — campaign #${payload.contractId} saved (store size: ${memStore.length})`);
      return res.status(201).json({ campaign: doc });
    }

    log.db(`MongoDB: findOneAndUpdate upsert for contractId="${payload.contractId}"`);
    const doc = await Campaign.findOneAndUpdate(
      { contractId: payload.contractId },
      { $set: payload },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    log.ok(`MongoDB INSERT/UPSERT — campaign #${payload.contractId} persisted (_id: ${doc._id})`);
    return res.status(201).json({ campaign: doc });

  } catch (err) {
    if (err.code === 11000) {
      log.warn(`Duplicate key for contractId #${payload.contractId} — already indexed`);
      return res.status(200).json({ message: "Campaign already indexed" });
    }
    log.error("POST /api/campaign →", err.message);
    console.error(err.stack);
    res.status(500).json({ error: "Failed to save campaign", detail: err.message });
  }
});

// ── DELETE /api/campaigns/:contractId (dev utility) ────────────────────────
app.delete("/api/campaigns/:contractId", async (req, res) => {
  const { contractId } = req.params;
  log.warn(`DELETE /api/campaigns/${contractId} requested`);
  try {
    if (useMemory) {
      const idx = memStore.findIndex((c) => c.contractId === contractId);
      if (idx >= 0) {
        memStore.splice(idx, 1);
        log.db(`Memory DELETE — removed campaign #${contractId} (store size: ${memStore.length})`);
      } else {
        log.warn(`Memory DELETE — campaign #${contractId} not found`);
      }
      return res.json({ ok: true });
    }
    const result = await Campaign.deleteOne({ contractId });
    if (result.deletedCount > 0) {
      log.db(`MongoDB DELETE — removed campaign #${contractId}`);
    } else {
      log.warn(`MongoDB DELETE — campaign #${contractId} not found`);
    }
    return res.json({ ok: true });
  } catch (err) {
    log.error(`DELETE /api/campaigns/${contractId} →`, err.message);
    console.error(err.stack);
    res.status(500).json({ error: err.message });
  }
});

// ── 404 catch-all ───────────────────────────────────────────────────────────
app.use((req, res) => {
  log.warn(`404 — ${req.method} ${req.url} not found`);
  res.status(404).json({ error: "Route not found", url: req.url });
});

// ── Global error handler ────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  log.error(`Unhandled error on ${req.method} ${req.url}:`, err.message);
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error", detail: err.message });
});

// ── Startup ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  log.sep();
  console.log(BOLD + GREEN + "  🚀 CapDAO Backend  " + RESET + GREEN + `http://localhost:${PORT}` + RESET);
  log.sep();
  log.info(`Mode      : ${YELLOW}🧠 In-Memory (waiting for MongoDB…)${RESET}`);
  log.info(`Port      : ${PORT}`);
  log.info(`PID       : ${process.pid}`);
  log.info(`Node      : ${process.version}`);
  log.sep();
  log.info("Routes:");
  log.info(`  ${GREEN}GET${RESET}    /                         health check`);
  log.info(`  ${GREEN}GET${RESET}    /api/campaigns            list all campaigns`);
  log.info(`  ${GREEN}GET${RESET}    /api/campaigns/:id        get single campaign`);
  log.info(`  ${BLUE}POST${RESET}   /api/campaign             save campaign metadata`);
  log.info(`  ${RED}DELETE${RESET} /api/campaigns/:id        remove campaign (dev)`);
  log.sep();
});

// ── Graceful shutdown ───────────────────────────────────────────────────────
process.on("SIGINT",  () => { log.warn("SIGINT received — shutting down"); process.exit(0); });
process.on("SIGTERM", () => { log.warn("SIGTERM received — shutting down"); process.exit(0); });
process.on("uncaughtException",  (err) => { log.error("Uncaught exception:",  err.message); console.error(err.stack); });
process.on("unhandledRejection", (err) => { log.error("Unhandled rejection:", err); });
