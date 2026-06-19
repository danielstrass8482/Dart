const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

async function initConfig(){
  await db.collection('dart_config').doc('limits').set({
    coachEnabled: true,
    videoEnabled: true,
    emergencyStop: false,
    emergencyReason: null,
    dailyBudgetEur: 30,
    perUserDailyLimitCoach: 10,
    perUserDailyLimitVideo: 3,
  }, { merge: true });
  console.log('Config initialisiert.');
  process.exit(0);
}
initConfig().catch(console.error);
