import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, writeBatch, type DocumentReference } from "firebase/firestore";
import { fbDb } from "./firebase";
import { KEY, load, mergeStates, snapshot, useStore, type State, type Word } from "./store";

// Saves the signed-in person's words and profile to their account (Firestore):
//   users/{uid}             profile (settings), game results, deleted words
//   users/{uid}/words/{id}  one document per word
// On sign-in the account copy is merged with the copy in this browser (nothing is lost), then
// every change is uploaded about a second later. Changes made on another device arrive live.

export type CloudStatus = "loading" | "saving" | "saved" | "error";

interface Cloud {
  status: CloudStatus;
  error?: string;
  lastSaved?: Date;
  /** Words saved in this browser before signing in, not yet added to an account */
  guestWords: number;
  addGuestWords: () => void;
  skipGuestWords: () => void;
}

const Ctx = createContext<Cloud | null>(null);

/** JSON with sorted keys and no empty values, so two equal words always give the same text. */
function stable(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .filter((k) => x[k] !== undefined)
            .map((k) => [k, x[k]]),
        )
      : x,
  );
}

const metaOf = (s: Partial<State>) => ({
  settings: s.settings ?? {},
  results: s.results ?? [],
  removed: s.removed ?? [],
  reading: s.reading ?? [],
  drills: s.drills ?? [],
  gone: s.gone ?? [],
});

const ADDED_TO = `${KEY}.added-to`;
const skipKey = (uid: string) => `${KEY}.skip.${uid}`;

function readGuest(uid: string): State | null {
  try {
    if (localStorage.getItem(ADDED_TO) || localStorage.getItem(skipKey(uid))) return null;
  } catch {
    return null;
  }
  const g = load(KEY);
  return g.words.length ? g : null;
}

export function CloudProvider({ user, storageKey, children }: { user: User; storageKey: string; children: ReactNode }) {
  const store = useStore();
  const { applyRemote } = store;
  const [status, setStatus] = useState<CloudStatus>("loading");
  const [error, setError] = useState<string>();
  const [lastSaved, setLastSaved] = useState<Date>();
  const [ready, setReady] = useState(false);
  const [guest, setGuest] = useState<State | null>(null);
  const synced = useRef<{ words: Map<string, string>; meta: string }>({ words: new Map(), meta: "" });
  const stateRef = useRef(store.state);
  stateRef.current = store.state;
  const userRef = useRef<DocumentReference>(doc(fbDb(), "users", user.uid));

  // 1. Download the account copy and merge it with the copy in this browser.
  useEffect(() => {
    let off = false;
    const ref = userRef.current;
    (async () => {
      try {
        const [metaSnap, wordsSnap] = await Promise.all([getDoc(ref), getDocs(collection(ref, "words"))]);
        if (off) return;
        const remoteWords = wordsSnap.docs.map((d) => ({ ...(d.data() as Word), id: d.id }));
        const remoteMeta = metaSnap.exists() ? metaOf(metaSnap.data() as Partial<State>) : null;
        synced.current = { words: new Map(remoteWords.map((w) => [w.id, stable(w)])), meta: remoteMeta ? stable(remoteMeta) : "" };
        snapshot(stateRef.current, storageKey);
        applyRemote((local) => {
          const merged = mergeStates(local, { words: remoteWords, ...(remoteMeta ?? {}) } as Partial<State>);
          const st = merged.settings;
          // First Google sign-in: use the Google name and photo until the person sets their own.
          return { ...merged, settings: { ...st, name: st.name || user.displayName || "", photo: st.photo || user.photoURL || undefined } };
        });
        setGuest(readGuest(user.uid));
        setReady(true);
      } catch (e) {
        if (off) return;
        setStatus("error");
        setError((e as Error).message);
      }
    })();
    return () => {
      off = true;
    };
  }, [user, storageKey, applyRemote]);

  // 2. Upload what changed, a moment after each change.
  const pushing = useRef(false);
  const retry = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pushRef = useRef<() => void>(() => {});
  const again = useRef(false);
  const push = useCallback(async () => {
    if (pushing.current) {
      again.current = true;
      return;
    }
    pushing.current = true;
    clearTimeout(retry.current);
    try {
      do {
        again.current = false;
        const s = stateRef.current;
        const ref = userRef.current;
        const ops: Array<{ id?: string; json?: string; word?: Word; meta?: string }> = [];
        const ids = new Set<string>();
        for (const w of s.words) {
          ids.add(w.id);
          const j = stable(w);
          if (synced.current.words.get(w.id) !== j) ops.push({ id: w.id, json: j, word: w });
        }
        for (const id of synced.current.words.keys()) if (!ids.has(id)) ops.push({ id });
        const meta = stable(metaOf(s));
        if (meta !== synced.current.meta) ops.push({ meta });
        if (!ops.length) break;
        setStatus("saving");
        for (let i = 0; i < ops.length; i += 400) {
          const part = ops.slice(i, i + 400);
          const batch = writeBatch(fbDb());
          for (const op of part) {
            if (op.meta !== undefined) batch.set(ref, { ...metaOf(s), updatedAt: serverTimestamp() });
            else if (op.word) batch.set(doc(ref, "words", op.id!), op.word);
            else batch.delete(doc(ref, "words", op.id!));
          }
          await batch.commit();
          for (const op of part) {
            if (op.meta !== undefined) synced.current.meta = op.meta;
            else if (op.json) synced.current.words.set(op.id!, op.json);
            else synced.current.words.delete(op.id!);
          }
        }
        setLastSaved(new Date());
        setError(undefined);
      } while (again.current);
      setStatus("saved");
    } catch (e) {
      setStatus("error");
      setError((e as Error).message);
      retry.current = setTimeout(() => pushRef.current(), 15_000);
    } finally {
      pushing.current = false;
    }
  }, []);

  pushRef.current = push;
  useEffect(() => () => clearTimeout(retry.current), []);
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(push, 1200);
    return () => clearTimeout(t);
  }, [ready, store.state, push]);

  // Try at once when the tab is hidden or closed.
  useEffect(() => {
    if (!ready) return;
    const flush = () => document.visibilityState === "hidden" && push();
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [ready, push]);

  // 3. Changes made on another device.
  useEffect(() => {
    if (!ready) return;
    const ref = userRef.current;
    const stopWords = onSnapshot(collection(ref, "words"), (snap) => {
      if (snap.metadata.hasPendingWrites) return;
      const changed = snap.docChanges().filter((c) =>
        c.type === "removed" ? synced.current.words.has(c.doc.id) : synced.current.words.get(c.doc.id) !== stable({ ...c.doc.data(), id: c.doc.id }),
      );
      if (!changed.length) return;
      for (const c of changed) {
        if (c.type === "removed") synced.current.words.delete(c.doc.id);
        else synced.current.words.set(c.doc.id, stable({ ...c.doc.data(), id: c.doc.id }));
      }
      applyRemote((s) => {
        let words = s.words;
        for (const c of changed) {
          if (c.type === "removed") words = words.filter((w) => w.id !== c.doc.id);
          else {
            const w = { ...(c.doc.data() as Word), id: c.doc.id };
            words = words.some((x) => x.id === w.id) ? words.map((x) => (x.id === w.id ? w : x)) : [...words, w];
          }
        }
        return mergeStates({ ...s, words }, {});
      });
    });
    const stopMeta = onSnapshot(ref, (snap) => {
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      const m = metaOf(snap.data() as Partial<State>);
      const j = stable(m);
      if (j === synced.current.meta) return;
      synced.current.meta = j;
      // The other device's profile wins; results, deleted words and Reading tests are combined.
      applyRemote((s) =>
        mergeStates({ ...s, settings: { ...s.settings, ...(m.settings as State["settings"]) } }, { results: m.results, removed: m.removed, reading: m.reading, drills: m.drills, gone: m.gone }),
      );
    });
    return () => {
      stopWords();
      stopMeta();
    };
  }, [ready, applyRemote]);

  const addGuestWords = useCallback(() => {
    if (!guest) return;
    snapshot(stateRef.current, storageKey);
    // Only words and results: the profile already belongs to this account.
    applyRemote((s) => mergeStates(s, { words: guest.words, results: guest.results, removed: guest.removed, reading: guest.reading, drills: guest.drills, gone: guest.gone }));
    try {
      localStorage.setItem(ADDED_TO, user.uid); // the copy itself stays in this browser, untouched
    } catch {
      /* ignore */
    }
    setGuest(null);
  }, [guest, storageKey, applyRemote, user.uid]);

  const skipGuestWords = useCallback(() => {
    try {
      localStorage.setItem(skipKey(user.uid), "1");
    } catch {
      /* ignore */
    }
    setGuest(null);
  }, [user.uid]);

  return (
    <Ctx.Provider value={{ status, error, lastSaved, guestWords: guest?.words.length ?? 0, addGuestWords, skipGuestWords }}>{children}</Ctx.Provider>
  );
}

/** null when there are no accounts (the site only saves in this browser). */
export function useCloud(): Cloud | null {
  return useContext(Ctx);
}
