import { useState } from "react";
import { Button, Modal, Text } from "@my-design/ui-web";
import { useStore, type Word } from "../store";
import { WordMedia } from "../media";

/** Compact grid of word cards. Shows a few, "Show all" for the rest; click a card for details. */
export function WordCards({ words, initial = 12 }: { words: Word[]; initial?: number }) {
  const { lookingUp } = useStore();
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const shown = all ? words : words.slice(0, initial);
  const current = words.find((w) => w.id === open) ?? null;

  return (
    <>
      <ul className="wcards">
        {shown.map((w) => {
          const busy = lookingUp.includes(w.id);
          return (
            <li key={w.id}>
              <button type="button" className="wcard" onClick={() => setOpen(w.id)}>
                {w.image ? <img className="wcard__img" src={w.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="wcard__img wcard__img--empty">{w.word[0]}</span>}
                <span className="wcard__text">
                  <span className="wcard__word">{w.word}</span>
                  <span className="wcard__meaning">{busy ? "Looking up…" : w.meaning || "No meaning yet"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {words.length > initial && (
        <div className="wcards__more">
          <Button size="sm" variant="ghost" iconRight={all ? "chevronUp" : "chevronDown"} onClick={() => setAll((a) => !a)}>
            {all ? "Show less" : `Show all ${words.length} words`}
          </Button>
        </div>
      )}
      {current && <WordDetail word={current} onClose={() => setOpen(null)} />}
    </>
  );
}

function WordDetail({ word: w, onClose }: { word: Word; onClose: () => void }) {
  const { removeWord, relookup, lookingUp } = useStore();
  const busy = lookingUp.includes(w.id);
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={w.word}
      footer={
        <>
          <Button variant="ghost" icon="trash" onClick={() => (removeWord(w.id), onClose())}>
            Delete
          </Button>
          <Button variant="outline" icon="refresh" loading={busy} onClick={() => relookup(w.id)}>
            Find meaning again
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="wdetail">
        {w.image && <WordMedia image={w.image} word={w.word} size="lg" />}
        <div>
          <Text size="sm" tone="muted">Türkçe</Text>
          <Text weight="semibold">{busy ? "Looking up…" : w.meaning || "No meaning yet"}</Text>
        </div>
        {w.definition && w.definition !== w.meaning && (
          <div>
            <Text size="sm" tone="muted">English</Text>
            <Text>{w.definition}</Text>
          </div>
        )}
        {w.example && <p className="wdetail__ex">“{w.example}”</p>}
        {w.video && <WordMedia video={w.video} word={w.word} />}
        <Text size="sm" tone="muted">Wrong meaning? Use “Find meaning again”, or edit it in My words.</Text>
      </div>
    </Modal>
  );
}
