/**
 * dartAppCheckPing — measurement only. The app calls it at most once a day
 * per device (js/firebase.js) with its App Check token, so the share of
 * valid tokens per platform is visible (dart_appcheck_stats/<day>.ping)
 * even when nobody uses the paid endpoints. It goes through the same gate
 * as the real functions (key "dartAppCheckPing" in dart_config/appcheck),
 * which also makes it a harmless target for testing the enforcement switch.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { appCheckGate } = require("./appCheckGate");

exports.dartAppCheckPing = onRequest(
  {
    region: "europe-west1",
    cors: ["https://danielstrass8482.github.io", "https://darttrainer.app", "https://play.darttrainer.app", "http://localhost", "https://localhost"],
    timeoutSeconds: 10,
    maxInstances: 2,
  },
  async (req, res) => {
    if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }
    const out = {};
    if (!(await appCheckGate("dartAppCheckPing", req, res, out))) return;
    res.json({ status: out.classification.status, platform: out.classification.platform });
  }
);
