import { searchPictures } from "./media";

// Fills in a word by itself, using free services that need no key and work from the browser:
//   Turkish meaning  -> MyMemory translation API
//   English meaning and example -> Free Dictionary API (dictionaryapi.dev)
//   Picture          -> Openverse, with Wikimedia Commons as fallback (see media.tsx)
export interface LookupResult {
  tr?: string;
  definition?: string;
  example?: string;
  image?: string;
}

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

async function getJson<T>(url: string, ms = 8000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

export async function translateToTurkish(text: string): Promise<string | undefined> {
  type R = { responseStatus?: number; responseData?: { translatedText?: string } };
  const r = await getJson<R>(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|tr`);
  const out = clean(r.responseData?.translatedText ?? "");
  if (!out || /MYMEMORY|QUERY LENGTH|INVALID/i.test(out) || out.toLowerCase() === text.toLowerCase()) return undefined;
  return out.toLocaleLowerCase("tr-TR") === out ? out : out.charAt(0).toLocaleLowerCase("tr-TR") + out.slice(1);
}

/** Tries the word, then simple singular forms ("plots" -> "plot", "studies" -> "study"). */
function forms(word: string): string[] {
  const w = word.toLowerCase();
  const out = [w];
  if (w.endsWith("ies") && w.length > 4) out.push(w.slice(0, -3) + "y");
  if (w.endsWith("es") && w.length > 3) out.push(w.slice(0, -2));
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) out.push(w.slice(0, -1));
  return out;
}

export async function englishEntry(word: string): Promise<{ definition?: string; example?: string }> {
  type Entry = { meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string }> }> };
  for (const f of forms(word)) {
    try {
      const data = await getJson<Entry[]>(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(f)}`);
      const defs = (data ?? []).flatMap((e) => (e.meanings ?? []).flatMap((m) => (m.definitions ?? []).map((d) => ({ ...d, pos: m.partOfSpeech }))));
      if (!defs.length) continue;
      const first = defs[0];
      const withExample = defs.find((d) => d.example);
      return {
        definition: first.definition ? clean(`${first.pos ? `(${first.pos}) ` : ""}${first.definition}`) : undefined,
        example: withExample?.example ? clean(withExample.example) : undefined,
      };
    } catch {
      /* try the next form */
    }
  }
  return {};
}

export async function lookupWord(word: string): Promise<LookupResult> {
  const [tr, en, pics] = await Promise.allSettled([translateToTurkish(word), englishEntry(word), searchPictures(word)]);
  return {
    tr: tr.status === "fulfilled" ? tr.value : undefined,
    definition: en.status === "fulfilled" ? en.value.definition : undefined,
    example: en.status === "fulfilled" ? en.value.example : undefined,
    image: pics.status === "fulfilled" ? pics.value[0]?.thumb : undefined,
  };
}
