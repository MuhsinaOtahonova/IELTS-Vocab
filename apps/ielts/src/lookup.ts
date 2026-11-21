import { wikiPicture } from "./media";
import { storedPicture } from "./pictures";

// Fills in a word by itself, using free services that need no key and work from the browser:
//   Turkish meaning  -> Google Translate's public web endpoint (dictionary entries, 2-3 meanings),
//                       MyMemory translation API as fallback
//   English meaning and example -> Free Dictionary API (dictionaryapi.dev)
//   Picture          -> the Wikipedia article for the word, only for nouns (see media.tsx).
//                       A checked picture saved with the site (pictures.ts) always comes first.
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

/** Dictionary-style meanings, e.g. gut -> "bağırsak, içgüdü". Also returns the main part of speech. */
async function googleTurkish(word: string): Promise<{ tr?: string; pos?: string }> {
  type G = [Array<[string, ...unknown[]]> | null, Array<[string, string[], ...unknown[]]> | null, ...unknown[]];
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&hl=en&dt=t&dt=bd&q=${encodeURIComponent(word)}`;
  const data = await getJson<G>(url);
  const dict = data?.[1];
  if (Array.isArray(dict) && dict.length) {
    const [pos, terms] = dict[0];
    const top = Array.from(new Set((terms ?? []).map(clean).filter(Boolean))).slice(0, 3);
    if (top.length) return { tr: top.join(", "), pos };
  }
  const main = clean((data?.[0] ?? []).map((x) => (typeof x?.[0] === "string" ? x[0] : "")).join(""));
  if (main && main.toLowerCase() !== word.toLowerCase()) return { tr: main.charAt(0).toLocaleLowerCase("tr-TR") + main.slice(1) };
  return {};
}

export async function turkishMeaning(word: string): Promise<{ tr?: string; pos?: string }> {
  try {
    const g = await googleTurkish(word);
    if (g.tr) return g;
  } catch {
    /* fall back to MyMemory */
  }
  try {
    return { tr: await translateToTurkish(word) };
  } catch {
    return {};
  }
}

export async function translateToTurkish(text: string): Promise<string | undefined> {
  type R = { responseStatus?: number; responseData?: { translatedText?: string } };
  const r = await getJson<R>(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|tr`);
  const out = clean(r.responseData?.translatedText ?? "");
  if (!out || /MYMEMORY|QUERY LENGTH|INVALID/i.test(out) || out.toLowerCase().includes(text.toLowerCase())) return undefined;
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

export async function englishEntry(word: string, pos?: string): Promise<{ definition?: string; example?: string }> {
  type Entry = { meanings?: Array<{ partOfSpeech?: string; definitions?: Array<{ definition?: string; example?: string }> }> };
  for (const f of forms(word)) {
    try {
      const data = await getJson<Entry[]>(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(f)}`);
      const defs = (data ?? []).flatMap((e) => (e.meanings ?? []).flatMap((m) => (m.definitions ?? []).map((d) => ({ ...d, pos: m.partOfSpeech }))));
      if (!defs.length) continue;
      // Use the same part of speech as the Turkish meaning, so both describe the same sense.
      const same = pos ? defs.filter((d) => d.pos === pos.toLowerCase()) : [];
      const pool = same.length ? same : defs;
      const first = pool[0];
      const withExample = pool.find((d) => d.example) ?? defs.find((d) => d.example);
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

export async function lookupWord(word: string, opts: { picture?: boolean; hint?: string } = {}): Promise<LookupResult> {
  const tr = await turkishMeaning(word);
  const wantPicture = opts.picture !== false && (!tr.pos || tr.pos.toLowerCase() === "noun");
  const [en, pic] = await Promise.allSettled([englishEntry(word, tr.pos), wantPicture ? wikiPicture(word, forms(word)) : Promise.resolve(undefined)]);
  const definition = en.status === "fulfilled" ? en.value.definition : undefined;
  const photo = pic.status === "fulfilled" ? pic.value : undefined;
  return {
    tr: tr.tr,
    definition,
    example: en.status === "fulfilled" ? en.value.example : undefined,
    // A checked picture saved with the site comes first; otherwise the Wikipedia photo (nouns only).
    image: opts.picture === false ? undefined : storedPicture(word) || photo,
  };
}
