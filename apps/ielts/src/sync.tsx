import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { snapshot, useStore, type State } from "./store";

// Saves everything to one private file (a secret GitHub Gist) in the user's own GitHub account.
// The token stays in this browser only. Every change is uploaded a few seconds later, and on
// start the file is merged in, so words added on another device show up here too.
// Merging never deletes words (see mergeStates in store.ts).

const CONFIG_KEY = "ielts-words.github";
const FILE = "word-a-day.json";
const DESCRIPTION = "Word a Day: my IELTS words (backup)";
const API = "https://api.github.com";

interface Config {
  token: string;
  gistId: string;
  login?: string;
}

export type SyncStatus = "off" | "connecting" | "syncing" | "saved" | "error";

interface Sync {
  status: SyncStatus;
  login?: string;
  lastSaved?: Date;
  error?: string;
  gistUrl?: string;
  connect: (token: string) => Promise<boolean>;
  disconnect: () => void;
  saveNow: () => void;
}

const Ctx = createContext<Sync | null>(null);

function readConfig(): Config | null {
  try {
    const c = JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "null") as Config | null;
    return c?.token && c.gistId ? c : null;
  } catch {
    return null;
  }
}

async function gh<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
  if (res.status === 401) throw new Error("The token is not valid (or it expired). Create a new one.");
  if (res.status === 403 || res.status === 404) throw new Error("The token cannot use gists. Tick the “gist” box when you create it.");
  if (!res.ok) throw new Error(`GitHub answered ${res.status}. Try again later.`);
  return (await res.json()) as T;
}

type Gist = { id: string; html_url: string; description?: string; files: Record<string, { content?: string; truncated?: boolean; raw_url?: string } | undefined> };

async function readGist(token: string, id: string): Promise<{ data: Partial<State> | null; url: string }> {
  const g = await gh<Gist>(token, `/gists/${id}`);
  const f = g.files[FILE];
  if (!f) return { data: null, url: g.html_url };
  const text = f.truncated && f.raw_url ? await (await fetch(f.raw_url)).text() : f.content ?? "";
  try {
    return { data: JSON.parse(text) as Partial<State>, url: g.html_url };
  } catch {
    return { data: null, url: g.html_url };
  }
}

const toFile = (s: State) => JSON.stringify({ app: "word-a-day", savedAt: new Date().toISOString(), ...s }, null, 1);

export function SyncProvider({ children }: { children: ReactNode }) {
  const store = useStore();
  const [config, setConfig] = useState<Config | null>(readConfig);
  const [status, setStatus] = useState<SyncStatus>(config ? "syncing" : "off");
  const [error, setError] = useState<string>();
  const [lastSaved, setLastSaved] = useState<Date>();
  const [gistUrl, setGistUrl] = useState<string>();
  const [ready, setReady] = useState(false); // true after the first download + merge
  const lastPushed = useRef("");
  const stateRef = useRef(store.state);
  stateRef.current = store.state;

  const push = useCallback(async (cfg: Config, s: State) => {
    const body = JSON.stringify(s);
    if (body === lastPushed.current) return;
    setStatus("syncing");
    try {
      await gh(cfg.token, `/gists/${cfg.gistId}`, { method: "PATCH", body: JSON.stringify({ files: { [FILE]: { content: toFile(s) } } }) });
      lastPushed.current = body;
      setLastSaved(new Date());
      setStatus("saved");
      setError(undefined);
    } catch (e) {
      setStatus("error");
      setError((e as Error).message);
    }
  }, []);

  // On start: download the file and merge it in before uploading anything.
  useEffect(() => {
    if (!config) return;
    let off = false;
    (async () => {
      try {
        const { data, url } = await readGist(config.token, config.gistId);
        if (off) return;
        setGistUrl(url);
        if (data && Array.isArray(data.words)) {
          snapshot(stateRef.current);
          store.mergeIn(data);
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Upload a few seconds after every change.
  useEffect(() => {
    if (!config || !ready) return;
    const t = setTimeout(() => push(config, store.state), 2500);
    return () => clearTimeout(t);
  }, [config, ready, store.state, push]);

  // Try once more when the tab is being closed or hidden.
  useEffect(() => {
    if (!config || !ready) return;
    const flush = () => document.visibilityState === "hidden" && push(config, stateRef.current);
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [config, ready, push]);

  const connect = useCallback(async (raw: string) => {
    const token = raw.trim();
    if (!token) return false;
    setStatus("connecting");
    setError(undefined);
    try {
      const user = await gh<{ login: string }>(token, "/user");
      // Reuse the file if this account already has one (e.g. connected on another device).
      const list = await gh<Gist[]>(token, "/gists?per_page=100");
      let gist = list.find((g) => g.files[FILE]);
      if (!gist) {
        gist = await gh<Gist>(token, "/gists", {
          method: "POST",
          body: JSON.stringify({ description: DESCRIPTION, public: false, files: { [FILE]: { content: toFile(stateRef.current) } } }),
        });
      }
      const cfg = { token, gistId: gist.id, login: user.login };
      localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
      lastPushed.current = "";
      setReady(false);
      setConfig(cfg);
      setStatus("syncing");
      return true;
    } catch (e) {
      setStatus("error");
      setError((e as Error).message);
      return false;
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(CONFIG_KEY);
    setConfig(null);
    setReady(false);
    setStatus("off");
    setError(undefined);
  }, []);

  const saveNow = useCallback(() => {
    if (config) {
      lastPushed.current = "";
      push(config, stateRef.current);
    }
  }, [config, push]);

  return <Ctx.Provider value={{ status, login: config?.login, lastSaved, error, gistUrl, connect, disconnect, saveNow }}>{children}</Ctx.Provider>;
}

export function useSync(): Sync {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSync needs <SyncProvider>");
  return s;
}

export const TOKEN_URL = "https://github.com/settings/tokens/new?scopes=gist&description=Word%20a%20Day%20backup";
