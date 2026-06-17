const admin = require('firebase-admin');
admin.initializeApp();

async function initConfig() {
  await admin.firestore()
    .collection('dart_config')
    .doc('limits')
    .set({
      coachEnabled: true,
      ttsEnabled: true,
      videoEnabled: true,
      emergencyStop: false,
      emergencyReason: null,
      dailyBudgetEur: 30,
      perUserDailyLimitCoach: 10,
      perUserDailyLimitTts: 200,
      perUserDailyLimitVideo: 3,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  console.log('dart_config/limits initialisiert.');
  process.exit(0);
}

initConfig().catch(err => { console.error(err); process.exit(1); });
