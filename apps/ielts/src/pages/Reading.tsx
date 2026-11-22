import { useMemo, useState, type ReactNode } from "react";
import { Badge, Button, Card, CardHeader, IconButton, Input, Modal, Select, Tabs, Text, Textarea, useToast } from "@my-design/ui-web";
import { dayKey, formatDay, uid, useStore } from "../store";
import {
  allNotes,
  band,
  focusType,
  neededFor,
  PASSAGE_TARGET,
  passageMinutes,
  QUESTION_TYPES,
  TARGET_MIN_PER_Q,
  testLabel,
  testMinutes,
  testScore,
  typeName,
  typeStats,
  type Drill,
  type Passage,
  type QType,
  type QuestionSet,
  type ReadingTest,
  type TypeStats,
} from "../reading";
import { PageHeader } from "./common";

type Tab = "overview" | "tests" | "focus" | "notes";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const mins = (m?: number) => (m === undefined ? "–" : `${Math.round(m)} min`);
const typeOptions = QUESTION_TYPES.map((t) => ({ value: t.id, label: t.name }));
const levelBadge: Record<TypeStats["level"], ReactNode> = {
  strong: <Badge tone="success">Strong</Badge>,
  ok: <Badge tone="info">Getting there</Badge>,
  weak: <Badge tone="danger">Needs work</Badge>,
  new: <Badge tone="neutral">Not enough yet</Badge>,
};

export function ReadingPage() {
  const store = useStore();
  const tests = store.reading ?? [];
  const drills = store.drills ?? [];
  const [tab, setTab] = useState<Tab>(tests.length ? "overview" : "tests");
  const [editing, setEditing] = useState<ReadingTest | null>(null);
  const [drillType, setDrillType] = useState<QType>();

  const stats = useMemo(() => typeStats(tests, drills), [tests, drills]);
  const target = Number(store.settings.targetBand) || 8.5;

  const newTest = () => {
    const last = tests[tests.length - 1];
    setEditing({ id: uid(), date: dayKey(), source: last?.source ?? "GoPrep", name: "", passages: [1, 2, 3].map((n) => ({ n, sets: [] })) });
  };

  return (
    <>
      <PageHeader
        title="Reading"
        subtitle={`Log every test passage by passage and see which question types to work on. Aim: band ${target}.`}
        actions={<Button icon="plus" onClick={newTest}>Add a test</Button>}
      />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: "overview", label: "Analysis" },
          { value: "tests", label: "Tests", count: tests.length },
          { value: "focus", label: "Focus practice", count: drills.length },
          { value: "notes", label: "Notes" },
        ]}
      >
        {(t) => (
          <div className="stack-16 reading">
            {t === "overview" && <Overview tests={tests} drills={drills} stats={stats} target={target} onAdd={newTest} onFocus={(ty) => (setDrillType(ty), setTab("focus"))} />}
            {t === "tests" && <TestList tests={tests} onAdd={newTest} onEdit={setEditing} />}
            {t === "focus" && <Focus drills={drills} stats={stats} initialType={drillType} />}
            {t === "notes" && <Notes tests={tests} drills={drills} />}
          </div>
        )}
      </Tabs>
      {editing && <TestForm test={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------
function Overview({ tests, drills, stats, target, onAdd, onFocus }: { tests: ReadingTest[]; drills: Drill[]; stats: TypeStats[]; target: number; onAdd: () => void; onFocus: (t: QType) => void }) {
  const focus = focusType(stats);
  const seen = stats.filter((s) => s.total > 0).sort((a, b) => a.accuracy - b.accuracy);
  const [chartType, setChartType] = useState<string>(focus?.type ?? "all");

  if (!tests.length)
    return (
      <Card>
        <div className="md-card__body stack-16">
          <Text>No tests yet. After each Reading test (for example GoPrep Reading 79), add it here: how long each passage took, and for each question type how many you got right and why.</Text>
          <div><Button icon="plus" onClick={onAdd}>Add your first test</Button></div>
        </div>
      </Card>
    );

  const full = tests.filter((t) => testScore(t).total === 40);
  const last = tests[tests.length - 1];
  const ls = testScore(last);
  const lastBand = ls.total >= 30 ? band(ls.correct, ls.total) : undefined;
  const lastMin = testMinutes(last);

  // Line graph: accuracy of one type in each test (and in focus practice), or the whole score.
  const series =
    chartType === "all"
      ? [{ name: "Score out of 40, as %", points: tests.map((t) => ({ label: testLabel(t), date: t.date, y: testScore(t).total ? testScore(t).correct / testScore(t).total : 0 })) }]
      : [
          { name: "In tests", points: (stats.find((s) => s.type === chartType)?.history ?? []).map((h) => ({ label: h.label, date: h.date, y: h.accuracy })) },
          { name: "Focus practice", points: drills.filter((d) => d.type === chartType && d.total).map((d) => ({ label: "Focus practice", date: d.date, y: d.correct / d.total })) },
        ];

  // Time and accuracy by passage, against the 17/20/23 minute plan.
  const byPassage = [1, 2, 3].map((n) => {
    const ps = tests.map((t) => t.passages.find((p) => p.n === n)).filter((p): p is Passage => !!p && p.sets.length > 0);
    const timed = ps.map(passageMinutes).filter((m): m is number => m !== undefined);
    const tot = ps.reduce((a, p) => a + p.sets.reduce((x, s) => x + s.total, 0), 0);
    const cor = ps.reduce((a, p) => a + p.sets.reduce((x, s) => x + s.correct, 0), 0);
    return { n, avg: timed.length ? timed.reduce((a, m) => a + m, 0) / timed.length : undefined, acc: tot ? cor / tot : undefined, count: ps.length };
  });

  return (
    <>
      <div className="stat-grid">
        <Card className="mini-stat"><span className="mini-stat__num">{tests.length}</span><Text size="sm" tone="secondary">tests logged</Text></Card>
        <Card className="mini-stat">
          <span className="mini-stat__num">{ls.correct}/{ls.total}</span>
          <Text size="sm" tone="secondary">last test{lastBand ? ` · band ${lastBand}` : ""}</Text>
        </Card>
        <Card className="mini-stat"><span className="mini-stat__num">{mins(lastMin)}</span><Text size="sm" tone="secondary">last test time (aim 60)</Text></Card>
        <Card className="mini-stat">
          <span className="mini-stat__num">{neededFor(target)}/40</span>
          <Text size="sm" tone="secondary">needed for band {target}</Text>
        </Card>
      </div>

      {focus && (
        <Card className="reading-focus">
          <div>
            <Text size="sm" tone="secondary">Work on this next</Text>
            <p className="reading-focus__type">{focus.name}</p>
            <Text size="sm" tone="secondary">
              {pct(focus.accuracy)} right in tests ({focus.correct}/{focus.total})
              {focus.minPerQ !== undefined ? ` · ${focus.minPerQ.toFixed(1)} min per question` : ""}. Practise only this type until you get 80% or more, then take a full test again.
            </Text>
          </div>
          <Button onClick={() => onFocus(focus.type)}>Log a focus session</Button>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Progress over tests"
          subtitle="Share of questions you got right in each test."
          actions={
            <Select
              size="sm"
              aria-label="Question type"
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              options={[{ value: "all", label: "Whole test" }, ...seen.map((s) => ({ value: s.type, label: s.name }))]}
            />
          }
        />
        <div className="md-card__body">
          <LineChart series={series} />
        </div>
      </Card>

      <Card>
        <CardHeader title="Question types" subtitle={`Weakest first. Red time means slower than ${TARGET_MIN_PER_Q} min per question, the pace for 40 questions in 60 minutes.`} />
        <div className="qtypes">
          {seen.map((s) => (
            <div key={s.type} className="qtype">
              <div className="qtype__head">
                <strong>{s.name}</strong>
                {levelBadge[s.level]}
              </div>
              <div className="qtype__bar" aria-hidden><span className={`qtype__fill qtype__fill--${s.level}`} style={{ width: pct(s.accuracy) }} /></div>
              <div className="qtype__nums">
                <span>{pct(s.accuracy)} right ({s.correct}/{s.total})</span>
                <span className={s.minPerQ !== undefined && s.minPerQ > TARGET_MIN_PER_Q ? "qtype__slow" : undefined}>
                  {s.minPerQ !== undefined ? `${s.minPerQ.toFixed(1)} min / question` : "time not logged"}
                </span>
                {s.change !== undefined && (
                  <span className={s.change >= 0 ? "qtype__up" : "qtype__down"}>
                    {s.change >= 0 ? "▲" : "▼"} {Math.abs(Math.round(s.change * 100))} pts since your first tests
                  </span>
                )}
                {s.drills > 0 && <span>{s.drills} focus sessions · {formatHours(s.drillMinutes)}</span>}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Time by passage" subtitle="Average minutes and right answers. A common plan is 17, 20 and 23 minutes." />
        <div className="md-card__body passages">
          {byPassage.map((p) => (
            <div key={p.n} className="passage-stat">
              <Text size="sm" tone="secondary">Passage {p.n}</Text>
              <span className="mini-stat__num">{mins(p.avg)}</span>
              <Text size="sm" tone={p.avg !== undefined && p.avg > PASSAGE_TARGET[p.n - 1] + 1 ? "danger" : "secondary"}>
                plan {PASSAGE_TARGET[p.n - 1]} min{p.acc !== undefined ? ` · ${pct(p.acc)} right` : ""}
              </Text>
            </div>
          ))}
        </div>
      </Card>
      {full.length === 0 && <Text size="sm" tone="muted">The band is shown when a test has all 40 questions logged.</Text>}
    </>
  );
}

const formatHours = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ""}`.trim() : `${m} min`);

/** Simple line graph, 0–100%, one line per series. */
function LineChart({ series }: { series: Array<{ name: string; points: Array<{ label: string; date: string; y: number }> }> }) {
  const all = series.flatMap((s) => s.points.map((p) => p.date));
  const dates = Array.from(new Set(all)).sort();
  if (!dates.length) return <Text tone="muted">No results for this type yet.</Text>;
  const W = 900;
  const H = 260;
  const L = 36;
  const R = 12;
  const T = 12;
  const B = 28;
  // Points are spread by order; same-day points sit side by side.
  const x = (date: string) => L + (dates.length === 1 ? 0.5 : dates.indexOf(date) / (dates.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v) * (H - T - B);
  const colors = ["var(--md-data-1)", "var(--md-data-4)"];
  return (
    <div className="linechart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Progress line graph">
        {[0, 0.5, 0.8, 1].map((g) => (
          <g key={g}>
            <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} className={g === 0.8 ? "linechart__goal" : "linechart__grid"} />
            <text x={L - 6} y={y(g) + 4} textAnchor="end" className="linechart__axis">{Math.round(g * 100)}%</text>
          </g>
        ))}
        {dates.length > 1 && [0, dates.length - 1].map((i) => (
          <text key={i} x={x(dates[i])} y={H - 8} textAnchor={i ? "end" : "start"} className="linechart__axis">{formatDay(dates[i], { day: "numeric", month: "short" })}</text>
        ))}
        {series.map((s, si) => {
          if (!s.points.length) return null;
          // Several results on one day: use the day's average.
          const byDay = dates
            .map((d) => {
              const ps = s.points.filter((p) => p.date === d);
              return ps.length ? { d, v: ps.reduce((a, p) => a + p.y, 0) / ps.length, label: ps.map((p) => p.label).join(", ") } : null;
            })
            .filter((p): p is { d: string; v: number; label: string } => !!p);
          const path = byDay.map((p, i) => `${i ? "L" : "M"}${x(p.d)},${y(p.v)}`).join(" ");
          return (
            <g key={s.name}>
              <path d={path} fill="none" stroke={colors[si]} strokeWidth={2.5} strokeDasharray={si ? "5 4" : undefined} strokeLinejoin="round" />
              {byDay.map((p) => (
                <circle key={p.d} cx={x(p.d)} cy={y(p.v)} r={4} fill={colors[si]}>
                  <title>{`${formatDay(p.d)} · ${p.label}: ${Math.round(p.v * 100)}%`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <div className="linechart__legend">
        {series.filter((s) => s.points.length).map((s, si) => (
          <span key={s.name}><i style={{ background: colors[si] }} />{s.name}</span>
        ))}
        <span><i className="linechart__goal-key" />80% goal</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
function TestList({ tests, onAdd, onEdit }: { tests: ReadingTest[]; onAdd: () => void; onEdit: (t: ReadingTest) => void }) {
  if (!tests.length)
    return (
      <Card>
        <div className="md-card__body stack-16">
          <Text>Add a test after you finish it. For each passage write the minutes, then each question type with how many questions there were and how many you got right. A short note on why helps a lot later.</Text>
          <div><Button icon="plus" onClick={onAdd}>Add a test</Button></div>
        </div>
      </Card>
    );
  return (
    <div className="test-list">
      {[...tests].reverse().map((t) => {
        const s = testScore(t);
        const b = s.total >= 30 ? band(s.correct, s.total) : undefined;
        return (
          <Card key={t.id} className="test-card" interactive role="button" tabIndex={0} aria-label={`Open ${testLabel(t)}`} onClick={() => onEdit(t)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onEdit(t))}>
            <div className="test-card__head">
              <div>
                <strong>{testLabel(t)}</strong>
                <Text size="sm" tone="muted">{formatDay(t.date)}{testMinutes(t) !== undefined ? ` · ${mins(testMinutes(t))}` : ""}</Text>
              </div>
              <div className="test-card__score">
                <span>{s.correct}/{s.total}</span>
                {b && <Badge tone="primary">Band {b}</Badge>}
              </div>
            </div>
            <div className="test-card__passages">
              {t.passages.filter((p) => p.sets.length).map((p) => (
                <div key={p.n}>
                  <Text size="sm" weight="semibold">Passage {p.n}{passageMinutes(p) !== undefined ? ` · ${mins(passageMinutes(p))}` : ""}</Text>
                  {p.sets.map((q, i) => (
                    <Text key={i} size="sm" tone="secondary">{typeName(q.type)}: {q.correct}/{q.total}</Text>
                  ))}
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

const num = (v: string) => (v === "" ? undefined : Math.max(0, Math.round(Number(v) * 10) / 10));

function TestForm({ test, onClose }: { test: ReadingTest; onClose: () => void }) {
  const { saveTest, removeReading, reading } = useStore();
  const toast = useToast();
  const [t, setT] = useState<ReadingTest>(test);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const exists = (reading ?? []).some((x) => x.id === test.id);

  const setPassage = (n: number, p: Partial<Passage>) => setT((x) => ({ ...x, passages: x.passages.map((q) => (q.n === n ? { ...q, ...p } : q)) }));
  const setSet = (n: number, i: number, s: Partial<QuestionSet>) =>
    setT((x) => ({ ...x, passages: x.passages.map((q) => (q.n === n ? { ...q, sets: q.sets.map((y, j) => (j === i ? { ...y, ...s } : y)) } : q)) }));
  const addSet = (n: number) => {
    const p = t.passages.find((q) => q.n === n)!;
    const used = new Set(p.sets.map((s) => s.type));
    const type = QUESTION_TYPES.find((q) => !used.has(q.id))?.id ?? "tfng";
    setPassage(n, { sets: [...p.sets, { type, total: 5, correct: 0 }] });
  };
  const dropSet = (n: number, i: number) => setPassage(n, { sets: t.passages.find((q) => q.n === n)!.sets.filter((_, j) => j !== i) });

  const save = () => {
    const sets = t.passages.flatMap((p) => p.sets);
    if (!sets.length) return setError("Add at least one question type.");
    if (sets.some((s) => !s.total || s.correct > s.total)) return setError("Check the numbers: right answers can't be more than the questions.");
    saveTest({ ...t, source: t.source.trim(), name: t.name.trim(), note: t.note?.trim() || undefined, passages: t.passages.map((p) => ({ ...p, sets: p.sets.map((s) => ({ ...s, note: s.note?.trim() || undefined })) })) });
    toast({ tone: "success", title: `${testLabel(t)} saved` });
    onClose();
  };
  const score = testScore(t);

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={exists ? "Edit test" : "Add a test"}
      footer={
        <>
          {exists &&
            (confirm ? (
              <Button variant="danger" className="modal-count" onClick={() => (removeReading(t.id), onClose())}>Yes, delete this test</Button>
            ) : (
              <Button variant="ghost" icon="trash" className="modal-count" onClick={() => setConfirm(true)}>Delete</Button>
            ))}
          <Text size="sm" tone="secondary">{score.correct}/{score.total} right</Text>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </>
      }
    >
      <div className="test-form">
        <div className="test-form__top">
          <Input label="Where from" placeholder="GoPrep" value={t.source} onChange={(e) => setT({ ...t, source: e.target.value })} />
          <Input label="Test" placeholder="e.g. 79" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} />
          <Input label="Day" type="date" value={t.date} onChange={(e) => setT({ ...t, date: e.target.value || dayKey() })} />
        </div>

        {t.passages.map((p) => (
          <section key={p.n} className="pform">
            <div className="pform__head">
              <strong>Passage {p.n}</strong>
              <Input
                size="sm"
                type="number"
                inputMode="decimal"
                min={0}
                aria-label={`Minutes for passage ${p.n}`}
                placeholder={`${PASSAGE_TARGET[p.n - 1]}`}
                suffix="min"
                value={p.minutes ?? ""}
                onChange={(e) => setPassage(p.n, { minutes: num(e.target.value) })}
              />
            </div>
            {p.sets.map((s, i) => (
              <div key={i} className="qset">
                <div className="qset__row">
                  <Select size="sm" aria-label="Question type" value={s.type} onChange={(e) => setSet(p.n, i, { type: e.target.value as QType })} options={typeOptions} />
                  <Input size="sm" type="number" inputMode="numeric" min={0} aria-label="Right answers" value={s.correct} onChange={(e) => setSet(p.n, i, { correct: num(e.target.value) ?? 0 })} />
                  <span className="qset__of">of</span>
                  <Input size="sm" type="number" inputMode="numeric" min={1} aria-label="Questions" value={s.total} onChange={(e) => setSet(p.n, i, { total: num(e.target.value) ?? 0 })} />
                  <Input size="sm" type="number" inputMode="decimal" min={0} aria-label="Minutes (optional)" placeholder="min" value={s.minutes ?? ""} onChange={(e) => setSet(p.n, i, { minutes: num(e.target.value) })} />
                  <IconButton size="sm" icon="trash" label="Remove" onClick={() => dropSet(p.n, i)} />
                </div>
                <Textarea rows={2} placeholder="Why did you get them right or wrong? e.g. Q9: missed the synonym 'decline' = 'fall'" value={s.note ?? ""} onChange={(e) => setSet(p.n, i, { note: e.target.value })} />
              </div>
            ))}
            <Button size="sm" variant="outline" icon="plus" onClick={() => addSet(p.n)}>Add question type</Button>
          </section>
        ))}

        <Textarea label="Note for the whole test" optional rows={2} value={t.note ?? ""} onChange={(e) => setT({ ...t, note: e.target.value })} />
        {error && <Text tone="danger" size="sm">{error}</Text>}
        <Text size="sm" tone="muted">Minutes for one question type are optional. Without them, the passage time is shared by number of questions.</Text>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Focus practice (one question type at a time)
// ---------------------------------------------------------------------------
function Focus({ drills, stats, initialType }: { drills: Drill[]; stats: TypeStats[]; initialType?: QType }) {
  const { saveDrill, removeReading } = useStore();
  const toast = useToast();
  const [type, setType] = useState<QType>(initialType ?? focusType(stats)?.type ?? "tfng");
  const [minutes, setMinutes] = useState("");
  const [total, setTotal] = useState("");
  const [correct, setCorrect] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const add = () => {
    const m = num(minutes) ?? 0;
    const tt = num(total) ?? 0;
    const c = num(correct) ?? 0;
    if (!m) return setError("Write how many minutes you practised.");
    if (c > tt) return setError("Right answers can't be more than the questions.");
    saveDrill({ id: uid(), date: dayKey(), type, minutes: m, total: tt, correct: c, note: note.trim() || undefined });
    toast({ tone: "success", title: `${typeName(type)}: ${m} min saved` });
    setMinutes("");
    setTotal("");
    setCorrect("");
    setNote("");
    setError("");
  };

  const perType = stats.filter((s) => s.drills > 0).sort((a, b) => b.drillMinutes - a.drillMinutes);

  return (
    <>
      <Card>
        <CardHeader title="Log a focus session" subtitle="Your teacher's method: work on one question type only, then check yourself in a full test." />
        <div className="md-card__body word-form">
          <Select label="Question type" value={type} onChange={(e) => setType(e.target.value as QType)} options={typeOptions} />
          <div className="drill-nums">
            <Input label="Minutes" type="number" inputMode="numeric" min={0} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
            <Input label="Questions" type="number" inputMode="numeric" min={0} value={total} onChange={(e) => setTotal(e.target.value)} />
            <Input label="Right" type="number" inputMode="numeric" min={0} value={correct} onChange={(e) => setCorrect(e.target.value)} />
          </div>
          <Textarea label="What did you learn?" optional rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <Text tone="danger" size="sm">{error}</Text>}
          <div><Button onClick={add}>Save session</Button></div>
        </div>
      </Card>

      {perType.length > 0 && (
        <Card>
          <CardHeader title="Time per question type" />
          <ul className="result-list">
            {perType.map((s) => (
              <li key={s.type}>
                <span>{s.name}<Text size="sm" tone="muted" as="span" className="result-list__date">{s.drills} sessions · {s.total ? `${pct(s.accuracy)} right in tests` : "not in a test yet"}</Text></span>
                <span className="result-list__score">{formatHours(s.drillMinutes)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {drills.length > 0 && (
        <Card>
          <CardHeader title="Sessions" />
          <ul className="result-list">
            {[...drills].reverse().slice(0, 30).map((d) => (
              <li key={d.id}>
                <span>
                  {typeName(d.type)} · {d.minutes} min
                  <Text size="sm" tone="muted" as="span" className="result-list__date">{formatDay(d.date)}{d.note ? ` · ${d.note}` : ""}</Text>
                </span>
                <span className="result-list__score">
                  {d.total ? `${d.correct}/${d.total}` : ""}
                  <IconButton size="sm" icon="trash" label="Delete session" onClick={() => removeReading(d.id)} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------
function Notes({ tests, drills }: { tests: ReadingTest[]; drills: Drill[] }) {
  const [type, setType] = useState("all");
  const notes = allNotes(tests, drills).filter((n) => type === "all" || n.type === type);
  return (
    <Card>
      <CardHeader
        title="Your notes"
        subtitle="Read these before your next test of the same type."
        actions={<Select size="sm" aria-label="Question type" value={type} onChange={(e) => setType(e.target.value)} options={[{ value: "all", label: "All types" }, ...typeOptions]} />}
      />
      {notes.length ? (
        <ul className="result-list notes-list">
          {notes.map((n) => (
            <li key={n.id}>
              <span>
                <Text size="sm" tone="muted" as="span" className="result-list__date">{formatDay(n.date)} · {n.where}{n.type ? ` · ${typeName(n.type)}` : ""}</Text>
                {n.text}
              </span>
              {n.score && <span className="result-list__score">{n.score}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="md-card__body"><Text tone="muted">No notes yet. Write them when you add a test or a focus session.</Text></div>
      )}
    </Card>
  );
}
