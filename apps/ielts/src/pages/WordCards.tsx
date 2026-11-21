import { useState } from "react";
import { Button, Modal, SearchInput, Text } from "@my-design/ui-web";
import { useStore, type Word } from "../store";
import { PicturePicker, WordMedia } from "../media";
import { pictureCredit } from "../pictures";
import { EditModal } from "./Words";

/** Compact grid of word cards. Shows a few, "Show all" for the rest; click a card for details. */
export function WordCards({ words, initial = 12 }: { words: Word[]; initial?: number }) {
  const { lookingUp } = useStore();
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const found = query ? words.filter((w) => [w.word, w.meaning, w.definition ?? ""].join(" ").toLowerCase().includes(query)) : words;
  const shown = all || query ? found : found.slice(0, initial);
  const current = words.find((w) => w.id === open) ?? null;

  return (
    <>
      {words.length > initial && (
        <div className="wcards__search">
          <SearchInput size="sm" placeholder={`Search ${words.length} words (English or Türkçe)`} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}
      {query && !found.length && <Text size="sm" tone="muted">No word matches “{q}”.</Text>}
      <ul className="wcards">
        {shown.map((w) => {
          const busy = lookingUp.includes(w.id);
          return (
            <li key={w.id}>
              <button type="button" className="wcard" onClick={() => setOpen(w.id)}>
                <CardPicture image={w.image} word={w.word} />
                <span className="wcard__text">
                  <span className="wcard__word">{w.word}</span>
                  <span className="wcard__meaning">{busy ? "Looking up…" : w.meaning || "No meaning yet"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!query && words.length > initial && (
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

/** The card's picture; a letter tile while there is none, or when the picture does not load. */
function CardPicture({ image, word }: { image?: string; word: string }) {
  const [broken, setBroken] = useState<string>();
  if (!image || broken === image) return <span className="wcard__img wcard__img--empty">{word[0]}</span>;
  return <img className="wcard__img" src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(image)} />;
}

function WordDetail({ word: w, onClose }: { word: Word; onClose: () => void }) {
  const { removeWord, relookup, lookingUp, updateWord } = useStore();
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  if (editing) return <EditModal word={w} onClose={() => setEditing(false)} onSave={(p) => (updateWord(w.id, p), setEditing(false))} />;
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
            Find again
          </Button>
          <Button variant="outline" icon="edit" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="wdetail">
        {w.image && <WordMedia image={w.image} word={w.word} size="lg" />}
        {pictureCredit(w.image) && <Text size="sm" tone="muted" className="wdetail__credit">Picture: {pictureCredit(w.image)}</Text>}
        {picking ? (
          <PicturePicker word={w.word} meaning={w.definition} value={w.image} onChange={(url) => updateWord(w.id, { image: url })} />
        ) : (
          <div>
            <Button size="sm" variant="outline" icon="image" onClick={() => setPicking(true)}>
              {w.image ? "Change picture" : "Add a picture"}
            </Button>
          </div>
        )}
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
        <Text size="sm" tone="muted">Wrong meaning or picture? Press “Edit” to change it by hand.</Text>
      </div>
    </Modal>
  );
}
