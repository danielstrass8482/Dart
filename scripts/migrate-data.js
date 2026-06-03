/**
 * Einmaliges Migrations-Script: fitness-tracker-c6f97 → darttrainer-app
 *
 * Vor Ausführung:
 * 1. Service Account Keys aus beiden Firebase-Projekten laden:
 *    Firebase Console → Projekteinstellungen → Service Accounts → Neuen Schlüssel generieren
 * 2. Als source-service-account.json (fitness-tracker-c6f97)
 *    und target-service-account.json (darttrainer-app) in scripts/ speichern
 * 3. npm install firebase-admin
 * 4. node scripts/migrate-data.js
 *
 * Die Service Account JSON-Dateien sind in .gitignore und kommen NIEMALS ins Repo.
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore }        = require("firebase-admin/firestore");

const sourceApp = initializeApp({
  credential: cert("./scripts/source-service-account.json"),
  projectId: "fitness-tracker-c6f97"
}, "source");

const targetApp = initializeApp({
  credential: cert("./scripts/target-service-account.json"),
  projectId: "darttrainer-app"
}, "target");

const sourceDB = getFirestore(sourceApp);
const targetDB = getFirestore(targetApp);

const COLLECTIONS = [
  "dart_games",
  "dart_players",
  "dart_rooms",
  "dart_coach_analyses",
  "dart_users",
  "dart_config",
  "dart_tournaments",
];

async function migrateCollection(name) {
  console.log(`Migriere ${name}...`);
  const snap = await sourceDB.collection(name).get();
  if (snap.empty) {
    console.log(`  (leer, übersprungen)`);
    return;
  }

  let batch  = targetDB.batch();
  let count  = 0;
  let batches = 0;

  for (const doc of snap.docs) {
    const targetRef = targetDB.collection(name).doc(doc.id);
    batch.set(targetRef, doc.data());
    count++;

    // Firestore batch limit: 500
    if (count % 499 === 0) {
      await batch.commit();
      batches++;
      batch = targetDB.batch();
    }
  }

  if (count % 499 !== 0) {
    await batch.commit();
  }

  console.log(`  ✅ ${count} Dokumente migriert`);

  // Sub-collections für dart_users (subscription/current)
  if (name === "dart_users") {
    for (const userDoc of snap.docs) {
      const subSnap = await sourceDB
        .collection("dart_users").doc(userDoc.id)
        .collection("subscription").get();
      if (!subSnap.empty) {
        const subBatch = targetDB.batch();
        subSnap.docs.forEach(subDoc => {
          const ref = targetDB
            .collection("dart_users").doc(userDoc.id)
            .collection("subscription").doc(subDoc.id);
          subBatch.set(ref, subDoc.data());
        });
        await subBatch.commit();
        console.log(`  ✅ ${userDoc.id}/subscription: ${subSnap.size} Dokument(e) migriert`);
      }
    }
  }
}

async function main() {
  console.log("🚀 Migration startet: fitness-tracker-c6f97 → darttrainer-app");
  for (const col of COLLECTIONS) {
    await migrateCollection(col);
  }
  console.log("\n✅ Migration abgeschlossen!");
  console.log("Nächste Schritte:");
  console.log("  1. Daten in Firebase Console prüfen");
  console.log("  2. window.FIREBASE_CONFIG in index.html eintragen");
  console.log("  3. Cloud Function URLs in js/coach.js aktualisieren");
  console.log("  4. App testen, dann GitHub Pages auf Firebase Hosting umstellen");
}

main().catch(err => {
  console.error("❌ Migration fehlgeschlagen:", err);
  process.exit(1);
});
