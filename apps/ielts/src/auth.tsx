import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { fbAuth } from "./firebase";

interface Auth {
  /** undefined while Firebase checks whether someone is signed in */
  user: User | null | undefined;
  google: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => onAuthStateChanged(fbAuth(), setUser), []);

  const value: Auth = {
    user,
    google: async () => {
      await signInWithPopup(fbAuth(), new GoogleAuthProvider());
    },
    signIn: async (email, password) => {
      await signInWithEmailAndPassword(fbAuth(), email.trim(), password);
    },
    signUp: async (name, email, password) => {
      const cred = await createUserWithEmailAndPassword(fbAuth(), email.trim(), password);
      if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      setUser({ ...cred.user, displayName: name.trim() || cred.user.displayName } as User);
    },
    resetPassword: (email) => sendPasswordResetEmail(fbAuth(), email.trim()),
    logOut: () => signOut(fbAuth()),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const a = useContext(Ctx);
  if (!a) throw new Error("useAuth needs <AuthProvider>");
  return a;
}

/** Plain words for Firebase error codes. */
export function authError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "The email or password is not right.";
  if (code.includes("email-already-in-use")) return "There is already an account with this email. Sign in instead.";
  if (code.includes("weak-password")) return "Use at least 6 characters for the password.";
  if (code.includes("invalid-email")) return "This email address does not look right.";
  if (code.includes("popup-closed") || code.includes("cancelled-popup")) return "The Google window was closed before signing in.";
  if (code.includes("popup-blocked")) return "The browser blocked the Google window. Allow pop-ups for this site and try again.";
  if (code.includes("unauthorized-domain")) return "This website is not allowed yet in Firebase (Authorized domains).";
  if (code.includes("too-many-requests")) return "Too many tries. Wait a few minutes and try again.";
  if (code.includes("network")) return "No internet connection. Try again.";
  return "Something went wrong. Try again.";
}
