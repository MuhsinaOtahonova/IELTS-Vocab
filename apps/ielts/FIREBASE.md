# Accounts (Firebase)

Sign-in and saving use Firebase on its free plan. Until `src/firebase.ts` has the project's values,
the site runs without accounts and saves in the browser only, as before.

## One-time setup

1. https://console.firebase.google.com → **Add project** (Google Analytics can stay off).
2. **Build → Authentication → Get started → Sign-in method**: enable **Google** and **Email/Password**.
3. **Authentication → Settings → Authorized domains → Add domain**: `muhsinaotahonova.github.io`.
4. **Build → Firestore Database → Create database** (production mode, a European location),
   then **Rules**: paste `firestore.rules` from this folder and press **Publish**.
5. **Project settings → Your apps → Web (`</>`)**: register the app and copy the `firebaseConfig`
   values into `src/firebase.ts`. They are not secret; the rules protect the data.

## Data

- `users/{uid}`: settings (profile), results, removed (deleted words)
- `users/{uid}/words/{id}`: one document per word

Each account keeps its own copy in the browser (`ielts-words.v1.u.<uid>`). Words saved before
accounts (`ielts-words.v1`) are offered to the first account that signs in; that copy is never deleted.

## Testing locally

```
npx firebase-tools emulators:start --only auth,firestore --project demo-word-a-day
VITE_FIREBASE_EMULATOR=localhost pnpm --filter ielts-words dev
```
