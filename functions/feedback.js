const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const nodemailer = require("nodemailer");

if (!getApps().length) initializeApp();

// Firebase Secret Manager: SMTP-Zugangsdaten für den Feedback-Versand (Dogado Mail-Hosting).
const FEEDBACK_SMTP_HOST = defineSecret("FEEDBACK_SMTP_HOST");
const FEEDBACK_SMTP_USER = defineSecret("FEEDBACK_SMTP_USER");
const FEEDBACK_SMTP_PASS = defineSecret("FEEDBACK_SMTP_PASS");

const FEEDBACK_TO = "support@darttrainer.app";
const FEEDBACK_DAILY_LIMIT = 10;
const MAX_MESSAGE_LENGTH = 2000;

exports.sendFeedback = onRequest(
  {
    secrets: [FEEDBACK_SMTP_HOST, FEEDBACK_SMTP_USER, FEEDBACK_SMTP_PASS],
    region: "europe-west1",
    cors: ["https://danielstrass8482.github.io", "https://darttrainer.app", "http://localhost"],
    timeoutSeconds: 30,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (!message) {
      res.status(400).json({ error: "message required" });
      return;
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      res.status(400).json({ error: "message_too_long" });
      return;
    }

    // ── Auth → UID (Feedback ist auch anonym möglich) ─────────────
    let uid = "anonymous";
    let userEmail = null;
    const authHeader = req.headers["authorization"];
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = await getAuth().verifyIdToken(authHeader.split(" ")[1]);
        uid = decoded.uid;
        userEmail = decoded.email || null;
      } catch (e) {
        console.warn("Auth token verification failed:", e.message);
      }
    }

    const db = getFirestore();

    // ── Per-user Rate-Limiting ─────────────────────────────────────
    const today = new Date().toISOString().split("T")[0];
    const usageRef = db.collection("dart_usage").doc(`${uid}_${today}`);
    try {
      const snap = await usageRef.get();
      const currentCount = snap.exists ? (snap.data().feedback || 0) : 0;
      if (currentCount >= FEEDBACK_DAILY_LIMIT) {
        res.status(429).json({
          error: "daily_limit_reached",
          message: `Maximale Anzahl von ${FEEDBACK_DAILY_LIMIT} Feedbacks pro Tag erreicht.`,
        });
        return;
      }
      await usageRef.set(
        { feedback: currentCount + 1, date: today, lastUpdated: FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.warn("Feedback usage tracking failed, proceeding:", e.message);
    }

    // Feedback zusätzlich in Firestore ablegen, damit nichts verloren geht,
    // falls der E-Mail-Versand fehlschlägt.
    try {
      await db.collection("dart_feedback").add({
        message,
        uid,
        userEmail,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn("Feedback persist failed:", e.message);
    }

    try {
      const transporter = nodemailer.createTransport({
        host: FEEDBACK_SMTP_HOST.value(),
        port: 465,
        secure: true,
        auth: { user: FEEDBACK_SMTP_USER.value(), pass: FEEDBACK_SMTP_PASS.value() },
      });
      await transporter.sendMail({
        from: FEEDBACK_SMTP_USER.value(),
        to: FEEDBACK_TO,
        replyTo: userEmail || undefined,
        subject: `DartTrainer Feedback (${uid})`,
        text: `${message}\n\n---\nUID: ${uid}\nEmail: ${userEmail || "—"}`,
      });
    } catch (e) {
      console.error("Feedback email send failed:", e.message);
      res.status(502).json({ error: "email_send_failed" });
      return;
    }

    res.json({ success: true });
  }
);
