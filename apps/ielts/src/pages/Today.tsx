import { useEffect, useState } from "react";
import { Alert, Avatar, Button, Card, CardHeader, EmptyState, Icon, IconButton, RevealGroup, Text, TiltCard, TiltLayer } from "@my-design/ui-web";
import type { IconName } from "@my-design/tokens";
import type { Page } from "../App";
import { activeDays, daysToFriday, formatDay, isFriday, streak, useStore } from "../store";
import { greeting, messageOfTheDay } from "../motivation";
import { WordForm, WordListModal } from "./common";
import { WordMedia } from "../media";

export function TodayPage({ go }: { go: (p: Page) => void }) {
  const store = useStore();
  const { words, today, settings, results } = store;
  const [listOpen, setListOpen] = useState(false);
  const todays = words.filter((w) => w.added === today);
  const goal = settings.goal;
  const left = Math.max(goal - todays.length, 0);
  const days = streak(activeDays(store), today);
  const reviewedToday = results.some((r) => r.date === today && r.kind === "daily");
  const toFri = daysToFriday();

  return (
    <>
      <TiltCard variant="brand" max={5} scale={1.01} padding="none" className="hero">
        <div className="hero__inner">
          <TiltLayer depth={24} className="hero__text">
            <div className="hero__who">
              <Avatar name={settings.name.trim() || "Me"} src={settings.photo} size="lg" className="hero__avatar" />
              <div>
                <h1 className="hero__title">{greeting(settings.name)}</h1>
                <p className="hero__date">{formatDay(today, { weekday: "long", day: "numeric", month: "long" })}</p>
              </div>
            </div>
            <p className="hero__quote">{messageOfTheDay(today)}</p>
            <p className="hero__status">
              {left ? `${left} word${left === 1 ? "" : "s"} to go today.` : reviewedToday ? "Goal done and review finished. Well done." : "Goal done. Play the end-of-day review next."}
            </p>
          </TiltLayer>
          <TiltLayer depth={48} className="hero__ring-wrap">
            <GoalRing value={todays.length} goal={goal} />
          </TiltLayer>
        </div>
      </TiltCard>

      {isFriday() ? (
        <Alert tone="info" title="Today is check day" action={<Button size="sm" onClick={() => go("friday")}>Start the check</Button>}>
          Review all the words from this week and see your score.
        </Alert>
      ) : null}

      <RevealGroup className="stat3" stagger={90}>
        <StatTile icon="zap" value={days} label={`day${days === 1 ? "" : "s"} in a row`} onClick={() => go("progress")} />
        <StatTile icon="layers" value={words.length} label="words in total" onClick={() => go("words")} />
        <StatTile icon="task" value={toFri === 0 ? "Today" : toFri} label={toFri === 0 ? "is check day" : `day${toFri === 1 ? "" : "s"} to Friday check`} onClick={() => go("friday")} />
      </RevealGroup>

      {todays.length > 0 && (
        <Card className={`review-cta${left ? "" : " review-cta--ready"}`}>
          <div>
            <Text weight="semibold">End-of-day review</Text>
            <Text size="sm" tone="secondary">
              Round 1 uses today's {todays.length} word{todays.length === 1 ? "" : "s"}. Round 2 mixes in all your words so far.
            </Text>
          </div>
          <Button variant={left ? "outline" : "primary"} iconRight="arrowRight" onClick={() => go("practice")}>
            {reviewedToday ? "Review again" : "Start review"}
          </Button>
        </Card>
      )}

      <div className="two-col">
        <Card>
          <CardHeader
            title="Add a word"
            subtitle="Word, meaning and an example"
            actions={
              <Button size="sm" variant="secondary" icon="list" onClick={() => setListOpen(true)}>
                IELTS list
              </Button>
            }
          />
          <div className="md-card__body">
            <WordForm />
          </div>
        </Card>

        <Card>
          <CardHeader title="Today's words" subtitle={todays.length ? `${todays.length} added` : undefined} />
          {todays.length ? (
            <ul className="word-list">
              {todays.map((w, n) => (
                <li key={w.id} className="word-list__item">
                  <span className="word-list__n">{n + 1}</span>
                  <div className="word-list__text">
                    <strong>{w.word}</strong>
                    {store.lookingUp.includes(w.id) ? (
                      <Text size="sm" tone="muted" className="looking">Finding the meaning and a picture…</Text>
                    ) : (
                      <Text size="sm" tone="secondary">{w.meaning || "No meaning found. Edit it in My words."}</Text>
                    )}
                    {w.definition && w.definition !== w.meaning && <Text size="sm" tone="muted">{w.definition}</Text>}
                    {w.example && <Text size="sm" tone="muted" className="word-list__ex">{w.example}</Text>}
                    {w.video && <WordMedia video={w.video} word={w.word} />}
                  </div>
                  {w.image && <WordMedia image={w.image} word={w.word} size="sm" />}
                  <IconButton size="sm" icon="trash" label={`Remove ${w.word}`} onClick={() => store.removeWord(w.id)} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="edit"
              title="No words yet today"
              description="Add your first word, or choose some from the IELTS list."
              action={<Button size="sm" variant="outline" onClick={() => setListOpen(true)}>Open the IELTS list</Button>}
            />
          )}
        </Card>
      </div>

      <WordListModal open={listOpen} onClose={() => setListOpen(false)} limit={left || 5} />
    </>
  );
}

/** Daily goal ring. Fills once when the page opens, then follows new words. */
function GoalRing({ value, goal }: { value: number; goal: number }) {
  const size = 148;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, value / Math.max(goal, 1));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(t);
  }, [pct]);
  return (
    <div className={`ring${pct >= 1 ? " ring--done" : ""}`} role="img" aria-label={`${value} of ${goal} words today`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="ring__track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle className="ring__fill" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={c * (1 - shown)} />
      </svg>
      <div className="ring__label">
        <strong>{value}</strong>
        <span>of {goal} today</span>
      </div>
    </div>
  );
}

function StatTile({ icon, value, label, onClick }: { icon: IconName; value: number | string; label: string; onClick: () => void }) {
  return (
    <TiltCard max={9} padding="none" className="stat-tile">
      <button type="button" className="stat-tile__btn" onClick={onClick}>
        <TiltLayer depth={30} className="stat-tile__icon">
          <Icon name={icon} size={20} />
        </TiltLayer>
        <TiltLayer depth={18}>
          <span className="stat-tile__num">{value}</span>
          <span className="stat-tile__label">{label}</span>
        </TiltLayer>
      </button>
    </TiltCard>
  );
}
