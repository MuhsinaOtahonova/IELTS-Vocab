// IELTS Reading practice log: each test, each passage, each question type, and what the
// numbers say about it. Saved with the words (store.ts) and to the account (cloud.tsx).

export const QUESTION_TYPES = [
  { id: "tfng", name: "True / False / Not Given" },
  { id: "ynng", name: "Yes / No / Not Given" },
  { id: "headings", name: "Matching headings" },
  { id: "info", name: "Matching information" },
  { id: "features", name: "Matching features" },
  { id: "endings", name: "Matching sentence endings" },
  { id: "mcq", name: "Multiple choice" },
  { id: "sentence", name: "Sentence completion" },
  { id: "summary", name: "Summary completion" },
  { id: "notes", name: "Note / table / flow-chart completion" },
  { id: "diagram", name: "Diagram label completion" },
  { id: "short", name: "Short answers" },
] as const;

export type QType = (typeof QUESTION_TYPES)[number]["id"];
export const typeName = (id: string) => QUESTION_TYPES.find((t) => t.id === id)?.name ?? id;

/** One group of questions of the same type inside a passage, e.g. 5 True/False questions. */
export interface QuestionSet {
  type: QType;
  total: number;
  correct: number;
  /** Minutes spent on just this group, if you timed it */
  minutes?: number;
  /** Why you got them right or wrong */
  note?: string;
}

export interface Passage {
  /** 1, 2 or 3 */
  n: number;
  minutes?: number;
  sets: QuestionSet[];
}

export interface ReadingTest {
  id: string;
  /** Day you did it, YYYY-MM-DD */
  date: string;
  /** Where the test is from, e.g. "GoPrep" */
  source: string;
  /** Test name or number, e.g. "79" */
  name: string;
  passages: Passage[];
  note?: string;
  updated?: number;
}

/** A short session working on one question type only. */
export interface Drill {
  id: string;
  date: string;
  type: QType;
  minutes: number;
  total: number;
  correct: number;
  note?: string;
  updated?: number;
}

/** Suggested minutes for each passage in the 60-minute Academic test (passages get harder). */
export const PASSAGE_TARGET = [17, 20, 23];
/** 60 minutes for 40 questions. */
export const TARGET_MIN_PER_Q = 1.5;

export const testScore = (t: ReadingTest) => {
  let total = 0;
  let correct = 0;
  for (const p of t.passages) for (const s of p.sets) (total += s.total), (correct += s.correct);
  return { total, correct };
};

export const passageMinutes = (p: Passage) => p.minutes ?? (p.sets.some((s) => s.minutes) ? p.sets.reduce((m, s) => m + (s.minutes ?? 0), 0) : undefined);

export const testMinutes = (t: ReadingTest) => {
  const m = t.passages.map(passageMinutes);
  return m.some((x) => x !== undefined) ? m.reduce<number>((a, x) => a + (x ?? 0), 0) : undefined;
};

/** Academic Reading band for a score out of 40 (the usual published table). */
export function band(correct: number, total = 40): number | undefined {
  if (!total) return undefined;
  const raw = total === 40 ? correct : Math.round((correct / total) * 40);
  const table: Array<[number, number]> = [
    [39, 9], [37, 8.5], [35, 8], [33, 7.5], [30, 7], [27, 6.5], [23, 6], [19, 5.5], [15, 5], [13, 4.5], [10, 4], [8, 3.5], [6, 3], [4, 2.5],
  ];
  return table.find(([min]) => raw >= min)?.[1] ?? 2;
}

/** Correct answers needed out of 40 for a band. */
export function neededFor(target: number): number {
  const table: Record<string, number> = { "9": 39, "8.5": 37, "8": 35, "7.5": 33, "7": 30, "6.5": 27, "6": 23, "5.5": 19, "5": 15 };
  return table[String(target)] ?? 30;
}

export interface TypeStats {
  type: QType;
  name: string;
  total: number;
  correct: number;
  /** 0..1 */
  accuracy: number;
  /** Minutes per question, when the time is known */
  minPerQ?: number;
  /** Accuracy in each test (oldest first), for the line graph */
  history: Array<{ date: string; label: string; accuracy: number; total: number; correct: number }>;
  /** Accuracy in the last 3 tests minus the first 3, when there are at least 4 */
  change?: number;
  drillMinutes: number;
  drills: number;
  level: "strong" | "ok" | "weak" | "new";
}

/**
 * Time for each question group: its own minutes when timed, otherwise its share of the
 * passage time by number of questions.
 */
function setMinutes(p: Passage, s: QuestionSet): number | undefined {
  if (s.minutes) return s.minutes;
  const pm = passageMinutes(p);
  if (!pm) return undefined;
  const timed = p.sets.filter((x) => x.minutes);
  const rest = pm - timed.reduce((a, x) => a + (x.minutes ?? 0), 0);
  const restQ = p.sets.filter((x) => !x.minutes).reduce((a, x) => a + x.total, 0);
  return restQ ? (rest * s.total) / restQ : undefined;
}

export function typeStats(tests: ReadingTest[], drills: Drill[]): TypeStats[] {
  const out: TypeStats[] = [];
  const sorted = [...tests].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  for (const { id, name } of QUESTION_TYPES) {
    let total = 0;
    let correct = 0;
    let timedQ = 0;
    let mins = 0;
    const history: TypeStats["history"] = [];
    for (const t of sorted) {
      let tt = 0;
      let tc = 0;
      for (const p of t.passages)
        for (const s of p.sets) {
          if (s.type !== id || !s.total) continue;
          tt += s.total;
          tc += s.correct;
          const m = setMinutes(p, s);
          if (m !== undefined) (mins += m), (timedQ += s.total);
        }
      if (tt) history.push({ date: t.date, label: testLabel(t), accuracy: tc / tt, total: tt, correct: tc });
      total += tt;
      correct += tc;
    }
    const ds = drills.filter((d) => d.type === id);
    const avg = (h: typeof history) => h.reduce((a, x) => a + x.correct, 0) / Math.max(1, h.reduce((a, x) => a + x.total, 0));
    const accuracy = total ? correct / total : 0;
    out.push({
      type: id,
      name,
      total,
      correct,
      accuracy,
      minPerQ: timedQ ? mins / timedQ : undefined,
      history,
      change: history.length >= 4 ? avg(history.slice(-3)) - avg(history.slice(0, 3)) : undefined,
      drillMinutes: ds.reduce((a, d) => a + d.minutes, 0),
      drills: ds.length,
      level: total < 3 ? "new" : accuracy >= 0.8 ? "strong" : accuracy >= 0.6 ? "ok" : "weak",
    });
  }
  return out;
}

export const testLabel = (t: ReadingTest) => [t.source, t.name].filter(Boolean).join(" ") || "Test";

/** The question type to practise next: lowest accuracy among the ones seen at least 3 times. */
export function focusType(stats: TypeStats[]): TypeStats | undefined {
  const seen = stats.filter((s) => s.total >= 3);
  return [...seen].sort((a, b) => a.accuracy - b.accuracy || (b.minPerQ ?? 0) - (a.minPerQ ?? 0))[0];
}

/** Every note you wrote, newest first, so you can read back why you got things wrong. */
export function allNotes(tests: ReadingTest[], drills: Drill[]) {
  const notes: Array<{ id: string; date: string; type?: QType; where: string; text: string; score?: string }> = [];
  for (const t of tests) {
    if (t.note?.trim()) notes.push({ id: `${t.id}-n`, date: t.date, where: testLabel(t), text: t.note.trim() });
    for (const p of t.passages)
      p.sets.forEach((s, i) => {
        if (s.note?.trim()) notes.push({ id: `${t.id}-${p.n}-${i}`, date: t.date, type: s.type, where: `${testLabel(t)} · Passage ${p.n}`, text: s.note.trim(), score: `${s.correct}/${s.total}` });
      });
  }
  for (const d of drills) if (d.note?.trim()) notes.push({ id: d.id, date: d.date, type: d.type, where: "Focus practice", text: d.note.trim(), score: `${d.correct}/${d.total}` });
  return notes.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
