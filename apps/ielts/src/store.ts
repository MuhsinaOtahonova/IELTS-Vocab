import { lookupWord } from "./lookup";
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// Everything is saved in this browser (localStorage). No account, no server.

export interface Word {
  id: string;
  word: string;
  meaning: string;
  example: string;
  /** Picture URL (found with "Find pictures" or pasted) */
  image?: string;
  /** Video link, e.g. YouTube */
  video?: string;
  /** English dictionary meaning (filled in by itself) */
  definition?: string;
  /** True once the site tried to fill in the meaning, example and picture */
  looked?: boolean;
  /** Version of the lookup that filled this word; older ones are looked up again */
  lv?: number;
  /** The user typed the meaning, so it is never replaced */
  ownMeaning?: boolean;
  /** The user chose the picture (or chose none), so it is never replaced */
  ownImage?: boolean;
  /** Day the word was added, YYYY-MM-DD in local time */
  added: string;
  right: number;
  wrong: number;
}

export type ResultKind = "daily" | "practice" | "friday";

export interface Result {
  date: string;
  kind: ResultKind;
  label: string;
  score: number;
  total: number;
}

export interface Settings {
  name: string;
  goal: number;
  /** Profile photo as a small JPEG data URL */
  photo?: string;
  city?: string;
  nativeLanguage?: string;
  about?: string;
  /** IELTS band you are aiming for, e.g. "7.0" */
  targetBand?: string;
  /** Exam day, YYYY-MM-DD */
  examDate?: string;
}

export interface State {
  words: Word[];
  results: Result[];
  settings: Settings;
  /** Words deleted on purpose (lower case), so a sync does not bring them back */
  removed?: string[];
}

const KEY = "ielts-words.v1";
const THEME_KEY = "ielts-words.theme";
const empty: State = { words: [], results: [], settings: { name: "", goal: 10 } };

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const s = JSON.parse(raw) as Partial<State>;
    return { words: s.words ?? [], results: s.results ?? [], settings: { ...empty.settings, ...s.settings }, removed: s.removed ?? [] };
  } catch {
    return empty;
  }
}

/**
 * Combines two saved copies (this browser + GitHub, or + a backup file) without losing words.
 * Every word from both sides is kept, unless it was deleted on purpose. When the same word is on
 * both sides, the copy with more practice wins, and empty fields are filled from the other copy.
 */
export function mergeStates(a: State, b: Partial<State>): State {
  const removed = Array.from(new Set([...(a.removed ?? []), ...(b.removed ?? [])]));
  const gone = new Set(removed);
  const byWord = new Map<string, Word>();
  for (const w of [...a.words, ...(b.words ?? [])]) {
    if (!w || typeof w.word !== "string") continue;
    const k = w.word.toLowerCase();
    const old = byWord.get(k);
    if (!old) {
      byWord.set(k, w);
      continue;
    }
    const [win, other] = w.right + w.wrong > old.right + old.wrong ? [w, old] : [old, w];
    byWord.set(k, {
      ...other,
      ...Object.fromEntries(Object.entries(win).filter(([, v]) => v !== undefined && v !== "")),
      added: old.added < w.added ? old.added : w.added,
    } as Word);
  }
  const words = [...byWord.values()].filter((w) => !gone.has(w.word.toLowerCase())).sort((x, y) => (x.added < y.added ? -1 : x.added > y.added ? 1 : 0));
  const seen = new Set<string>();
  const results = [...a.results, ...(b.results ?? [])].filter((r) => {
    const k = `${r.date}|${r.kind}|${r.label}|${r.score}|${r.total}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const settings = { ...empty.settings, ...b.settings, ...Object.fromEntries(Object.entries(a.settings).filter(([, v]) => v !== undefined && v !== "")) } as Settings;
  return { words, results, settings, removed };
}

/** Keeps the last copy before a big change, just in case. */
export function snapshot(s: State) {
  try {
    localStorage.setItem(KEY + ".before-sync", JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function loadTheme(): "light" | "dark" {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "light" || t === "dark") return t;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function saveTheme(t: "light" | "dark") {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Dates (local time, so "today" changes at the user's midnight)
// ---------------------------------------------------------------------------
export function dayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

export function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const isFriday = (d = new Date()) => d.getDay() === 5;

/** Days until the next Friday (0 when today is Friday). */
export function daysToFriday(d = new Date()): number {
  return (5 - d.getDay() + 7) % 7;
}

/** The 7 days that end on `end` (Saturday to Friday when end is a Friday). */
export function weekRange(end = dayKey()): { from: string; to: string } {
  return { from: addDays(end, -6), to: end };
}

export function formatDay(key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return parseDay(key).toLocaleDateString("en-GB", opts);
}

// ---------------------------------------------------------------------------
// Derived numbers
// ---------------------------------------------------------------------------
export function activeDays(s: State): Set<string> {
  const set = new Set<string>();
  s.words.forEach((w) => set.add(w.added));
  s.results.forEach((r) => set.add(r.date));
  return set;
}

/** Days in a row with some activity, ending today (or yesterday, if today is still empty). */
export function streak(days: Set<string>, today = dayKey()): number {
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function bestStreak(days: Set<string>): number {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

/** A word counts as learned after 3 more right answers than wrong ones. */
export const isLearned = (w: Word) => w.right - w.wrong >= 3;

export type WordInput = Pick<Word, "word" | "meaning" | "example" | "image" | "video"> & { definition?: string };

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
interface Store extends State {
  today: string;
  /** Ids of words whose meaning and picture are being looked up now */
  lookingUp: string[];
  addWord: (w: WordInput, added?: string) => boolean;
  updateWord: (id: string, patch: Partial<WordInput>) => void;
  removeWord: (id: string) => void;
  /** Look up the meaning, English meaning and example again */
  relookup: (id: string) => void;
  mark: (id: string, correct: boolean) => void;
  addResult: (r: Omit<Result, "date">) => void;
  setSettings: (p: Partial<Settings>) => void;
  replaceAll: (s: unknown) => boolean;
  /** Adds words from another copy (e.g. GitHub) without deleting anything */
  mergeIn: (remote: Partial<State>) => void;
  /** The whole saved state, for syncing */
  state: State;
  exportJson: () => string;
}

const Ctx = createContext<Store | null>(null);

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(load);
  const [today, setToday] = useState(dayKey);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  }, [state]);

  // Notice when midnight passes while the tab stays open.
  useEffect(() => {
    const t = setInterval(() => setToday(dayKey()), 60_000);
    return () => clearInterval(t);
  }, []);

  const ref = useRef(state);
  ref.current = state;
  const addWord = useCallback<Store["addWord"]>((w, added) => {
    const word = w.word.trim();
    const same = (x: Word) => x.word.toLowerCase() === word.toLowerCase();
    if (!word || ref.current.words.some(same)) return false;
    const next: Word = { id: uid(), word, meaning: w.meaning.trim(), example: w.example.trim(), image: w.image?.trim() || undefined, video: w.video?.trim() || undefined, definition: w.definition?.trim() || undefined, ownMeaning: !!w.meaning.trim() || undefined, ownImage: !!w.image?.trim() || undefined, added: added ?? dayKey(), right: 0, wrong: 0 };
    setState((s) => (s.words.some(same) ? s : { ...s, words: [...s.words, next], removed: (s.removed ?? []).filter((r) => r !== word.toLowerCase()) }));
    return true;
  }, []);

  // Version 2 switched to dictionary-style Turkish meanings. Version 3 replaced the random photo
  // search with matching pictures (Wikipedia, or a drawn one). Older words are refreshed once.
  const LOOKUP_VERSION = 3;
  // Fill in missing Turkish meaning, English meaning, example and picture, one word at a time.
  const busy = useRef(new Set<string>());
  const [lookingUp, setLookingUp] = useState<string[]>([]);
  useEffect(() => {
    const next = state.words.find((w) => !busy.current.has(w.id) && (w.lv ?? 0) < LOOKUP_VERSION);
    if (!next) return;
    busy.current.add(next.id);
    setLookingUp((l) => [...l, next.id]);
    lookupWord(next.word, { picture: !next.ownImage, hint: next.definition })
      .catch(() => ({}) as Awaited<ReturnType<typeof lookupWord>>)
      .then((r) => {
        setState((s) => ({
          ...s,
          words: s.words.map((w) =>
            w.id === next.id
              ? {
                  ...w,
                  meaning: w.ownMeaning ? w.meaning : r.tr || w.meaning || w.definition || r.definition?.replace(/^\([a-z]+\) /, "") || "",
                  // Keep a hand-made English meaning (IELTS list or typed); refresh one that came from the dictionary.
                  definition: w.definition && !/^\([a-z]+\) /.test(w.definition) ? w.definition : r.definition || w.definition,
                  example: w.example || r.example || "",
                  image: w.ownImage ? w.image : r.image || w.image,
                  looked: true,
                  lv: LOOKUP_VERSION,
                }
              : w,
          ),
        }));
        setLookingUp((l) => l.filter((id) => id !== next.id));
      });
  }, [state.words]);

  const value = useMemo<Store>(
    () => ({
      ...state,
      state,
      today,
      lookingUp,
      addWord,
      updateWord: (id, patch) =>
        setState((s) => ({
          ...s,
          words: s.words.map((w) =>
            w.id === id
              ? {
                  ...w,
                  ...patch,
                  ownMeaning: patch.meaning !== undefined && patch.meaning !== w.meaning ? true : w.ownMeaning,
                  ownImage: "image" in patch && patch.image !== w.image ? true : w.ownImage,
                }
              : w,
          ),
        })),
      relookup: (id) => {
        busy.current.delete(id);
        setState((s) => ({ ...s, words: s.words.map((w) => (w.id === id ? { ...w, lv: 0, looked: false, ownMeaning: false } : w)) }));
      },
      removeWord: (id) =>
        setState((s) => {
          const w = s.words.find((x) => x.id === id);
          return { ...s, words: s.words.filter((x) => x.id !== id), removed: w ? [...(s.removed ?? []), w.word.toLowerCase()] : s.removed };
        }),
      mark: (id, correct) =>
        setState((s) => ({ ...s, words: s.words.map((w) => (w.id === id ? { ...w, right: w.right + (correct ? 1 : 0), wrong: w.wrong + (correct ? 0 : 1) } : w)) })),
      addResult: (r) => setState((s) => ({ ...s, results: [...s.results, { ...r, date: dayKey() }] })),
      setSettings: (p) => setState((s) => ({ ...s, settings: { ...s.settings, ...p } })),
      exportJson: () => JSON.stringify(state, null, 2),
      replaceAll: (raw) => {
        const s = raw as Partial<State> | null;
        if (!s || !Array.isArray(s.words)) return false;
        // Restoring adds the backup's words to the ones here; nothing is deleted.
        snapshot(ref.current);
        setState((cur) => mergeStates(cur, s));
        return true;
      },
      mergeIn: (remote) => setState((cur) => mergeStates(cur, remote)),
    }),
    [state, today, addWord, lookingUp],
  );

  return createElement(Ctx.Provider, { value }, children);
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore needs <StoreProvider>");
  return s;
}
