import { initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, type Firestore } from "firebase/firestore";

// Accounts and saving run on Firebase (Google), on its free plan.
// These values come from the Firebase console (Project settings > Your apps > Web app).
// They are not secret: every website that uses Firebase shows them. The data is protected by the
// Firestore rules (each person can read and write only their own data), see FIREBASE.md.
export const firebaseConfig = {
  apiKey: "AIzaSyDYD58JMHRDgchSk3YDcc4yibCs1YdDXW4",
  authDomain: "word-a-day-887d1.firebaseapp.com",
  projectId: "word-a-day-887d1",
  storageBucket: "word-a-day-887d1.firebasestorage.app",
  messagingSenderId: "737447430164",
  appId: "1:737447430164:web:bc0dcfb53a0ae76d3b7f01",
};

/** For testing on this computer with the Firebase emulators: VITE_FIREBASE_EMULATOR=localhost */
const emulator = import.meta.env.VITE_FIREBASE_EMULATOR as string | undefined;

/** False until the values above are filled in. Until then the site runs without accounts, as before. */
export const hasAccounts = !!emulator || (!!firebaseConfig.apiKey && !!firebaseConfig.projectId);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

function boot() {
  if (!app) {
    app = initializeApp(emulator ? { apiKey: "demo-key", projectId: "demo-word-a-day", authDomain: "localhost" } : firebaseConfig);
    auth = getAuth(app);
    db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    if (emulator) {
      connectAuthEmulator(auth, `http://${emulator}:9099`, { disableWarnings: true });
      connectFirestoreEmulator(db, emulator, 8080);
    }
  }
}

export function fbAuth(): Auth {
  boot();
  return auth!;
}

export function fbDb(): Firestore {
  boot();
  return db!;
}
