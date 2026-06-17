const { onRequest } = require("firebase-functions/v2/https");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();

const COST_PER_COACH_CALL = 0.02;
const COST_PER_TTS_CALL   = 0.001;
const COST_PER_VIDEO_CALL = 0.05;
const DAILY_BUDGET_EUR    = 30;

exports.budgetCheck = onRequest(
  { region: "europe-west1", cors: false, timeoutSeconds: 60 },
  async (req, res) => {
    const db = getFirestore();
    const today = new Date().toISOString().split("T")[0];

    const usageSnap = await db.collection("dart_usage")
      .where("date", "==", today)
      .get();

    let estimatedCost = 0;
    usageSnap.forEach(doc => {
      const d = doc.data();
      estimatedCost += (d.coach || 0) * COST_PER_COACH_CALL;
      estimatedCost += (d.tts   || 0) * COST_PER_TTS_CALL;
      estimatedCost += (d.video || 0) * COST_PER_VIDEO_CALL;
    });

    if (estimatedCost > DAILY_BUDGET_EUR) {
      await db.collection("dart_config").doc("limits").update({
        emergencyStop: true,
        emergencyReason: `Tagesbudget €${DAILY_BUDGET_EUR} überschritten. Geschätzte Kosten: €${estimatedCost.toFixed(2)}`
      });
      console.warn(`Budget exceeded: €${estimatedCost.toFixed(2)} > €${DAILY_BUDGET_EUR}`);
    }

    res.json({
      date: today,
      estimatedCostEur: parseFloat(estimatedCost.toFixed(4)),
      budgetEur: DAILY_BUDGET_EUR,
      budgetExceeded: estimatedCost > DAILY_BUDGET_EUR,
      documentsChecked: usageSnap.size
    });
  }
);
