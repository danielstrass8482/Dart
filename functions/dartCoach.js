const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getAppCheck } = require("firebase-admin/app-check");

if (!getApps().length) initializeApp();

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const DAILY_LIMITS = { coach: 10, video: 3 };

// Set to true to hard-enforce App Check (after all clients carry tokens).
const ENFORCE_APP_CHECK = false;

exports.dartCoach = onRequest(
  {
    secrets: [ANTHROPIC_API_KEY],
    region: "europe-west1",
    cors: ["https://danielstrass8482.github.io", "https://darttrainer.app", "http://localhost"],
    timeoutSeconds: 60,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    // ── App Check verification ────────────────────────────────────
    const appCheckToken = req.headers["x-firebase-appcheck"];
    if (appCheckToken) {
      try {
        await getAppCheck().verifyToken(appCheckToken);
      } catch (e) {
        if (ENFORCE_APP_CHECK) {
          res.status(401).json({ error: "App Check verification failed" });
          return;
        }
        console.warn("App Check token invalid:", e.message);
      }
    } else if (ENFORCE_APP_CHECK) {
      res.status(401).json({ error: "App Check token required" });
      return;
    }

    const db = getFirestore();

    // ── Kill-switch / feature flags ──────────────────────────────
    try {
      const config = (await db.collection("dart_config").doc("limits").get()).data();
      if (!config || config.emergencyStop) {
        res.status(503).json({
          error: "service_temporarily_unavailable",
          message: "Coach ist momentan nicht verfügbar."
        });
        return;
      }
      if (!config.coachEnabled) {
        res.status(503).json({
          error: "feature_disabled",
          message: "Coach ist momentan deaktiviert."
        });
        return;
      }
    } catch (e) {
      console.warn("Config fetch failed, proceeding:", e.message);
    }

    // ── Auth → UID ───────────────────────────────────────────────
    // Never trust userId from request body — derive exclusively from verified token.
    const authHeader = req.headers["authorization"];
    let uid = "anonymous";
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = await getAuth().verifyIdToken(authHeader.split(" ")[1]);
        uid = decoded.uid;
      } catch (e) {
        console.warn("Auth token verification failed:", e.message);
      }
    }

    // ── Determine call type ──────────────────────────────────────
    const { model, max_tokens, messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "messages array required" });
      return;
    }
    const hasImages = messages.some(
      m => Array.isArray(m.content) && m.content.some(c => c.type === "image")
    );
    const functionType = req.body.type || (hasImages ? "video" : "coach");
    const limit = DAILY_LIMITS[functionType] ?? 10;

    // ── Per-user rate limiting ───────────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    const usageRef = db.collection("dart_usage").doc(`${uid}_${today}`);
    try {
      const snap = await usageRef.get();
      const currentCount = snap.exists ? (snap.data()[functionType] || 0) : 0;
      if (currentCount >= limit) {
        res.status(429).json({
          error: "daily_limit_reached",
          message: `Maximale Anzahl von ${limit} Analysen pro Tag erreicht.`,
          limit,
          used: currentCount,
          resetsAt: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
        });
        return;
      }
      await usageRef.set(
        { [functionType]: currentCount + 1, date: today, lastUpdated: FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.warn("Usage tracking failed, proceeding:", e.message);
    }

    // ── Anthropic API call ───────────────────────────────────────
    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY.value(),
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-5-20250929",
        max_tokens: max_tokens || 1000,
        messages
      })
    });

    if (!anthropicResp.ok) {
      const errBody = await anthropicResp.text();
      console.error("Anthropic error:", anthropicResp.status, errBody);
      res.status(502).json({ error: "API call failed" });
      return;
    }

    const data = await anthropicResp.json();
    res.json(data);
  }
);
