import chosen from "./pictures.json";

// Pictures picked and checked by hand for each word, saved with the site in public/pics.
// Most are free photos from Wikimedia Commons or Openverse (credits in pictures.json);
// a few are drawn, when no photo shows the meaning. Nothing here depends on another
// website being up, so the pictures always load.
export interface StoredPicture {
  file: string;
  credit?: string;
  source?: string;
}

const table = chosen as Record<string, StoredPicture>;

function key(word: string): string | undefined {
  const w = word.trim().toLowerCase();
  if (table[w]) return w;
  const forms = [w.replace(/ies$/, "y"), w.replace(/es$/, ""), w.replace(/s$/, "")];
  return forms.find((f) => table[f]);
}

/** Address of the checked picture for a word, or undefined. */
export function storedPicture(word: string): string | undefined {
  const k = key(word);
  return k ? `pics/${table[k].file}` : undefined;
}

export function pictureCredit(image?: string): string | undefined {
  if (!image?.startsWith("pics/")) return undefined;
  const file = image.slice(5);
  return Object.values(table).find((p) => p.file === file)?.credit;
}
