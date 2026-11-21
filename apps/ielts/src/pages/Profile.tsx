import { useRef, useState } from "react";
import { Button, Card, CardHeader, Input, ProfileHeader, Select, Text, Textarea, useToast } from "@my-design/ui-web";
import { activeDays, dayKey, formatDay, isLearned, parseDay, streak, useStore } from "../store";
import { PageHeader } from "./common";
import { GitHubSyncCard } from "./GitHubSync";

const bands = ["5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5", "9.0"];

/** Crops the picture to a centred square and shrinks it, so it fits in browser storage. */
function toAvatar(file: File, size = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => (URL.revokeObjectURL(url), reject(new Error("not an image")));
    img.src = url;
  });
}

export function daysUntil(key?: string): number | null {
  if (!key) return null;
  const ms = parseDay(key).getTime() - parseDay(dayKey()).getTime();
  return Math.round(ms / 86_400_000);
}

export function ProfilePage() {
  const store = useStore();
  const { settings, setSettings, words, results, today } = store;
  const toast = useToast();
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const name = settings.name.trim() || "Your name";
  const left = daysUntil(settings.examDate);
  const firstDay = words.map((w) => w.added).sort()[0];
  const learned = words.filter(isLearned).length;

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      setSettings({ photo: await toAvatar(file) });
      toast({ tone: "success", title: "Photo updated" });
    } catch {
      toast({ tone: "danger", title: "This file is not a picture" });
    } finally {
      setBusy(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  };

  const exportFile = () => {
    const blob = new Blob([store.exportJson()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ielts-words-${today}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importFile = async (file: File) => {
    try {
      const ok = store.replaceAll(JSON.parse(await file.text()));
      toast(ok ? { tone: "success", title: "Backup restored" } : { tone: "danger", title: "This file is not a Word a Day backup" });
    } catch {
      toast({ tone: "danger", title: "Could not read this file" });
    }
  };

  const goalLine = [settings.targetBand && `Aiming for band ${settings.targetBand}`, left != null && left >= 0 && (left === 0 ? "exam is today" : `exam in ${left} day${left === 1 ? "" : "s"}`)]
    .filter(Boolean)
    .join(" · ");

  const meta = [
    settings.city ? { icon: "mapPin" as const, value: settings.city } : null,
    settings.nativeLanguage ? { icon: "globe" as const, value: `Speaks ${settings.nativeLanguage}` } : null,
    firstDay ? { icon: "calendar" as const, value: `Learning since ${formatDay(firstDay, { day: "numeric", month: "long", year: "numeric" })}` } : null,
  ].filter((m): m is NonNullable<typeof m> => !!m);

  return (
    <>
      <PageHeader title="Profile" subtitle="Your photo, your details and your IELTS goal. Changes are saved as you type." />

      <Card padding="none" className="profile-card">
        <ProfileHeader
          name={name}
          src={settings.photo}
          title={goalLine || "Add your target band and exam date below"}
          meta={meta}
          actions={
            <>
              <Button size="sm" variant="secondary" icon="image" loading={busy} onClick={() => photoRef.current?.click()}>
                {settings.photo ? "Change photo" : "Upload photo"}
              </Button>
              {settings.photo && (
                <Button size="sm" variant="ghost" onClick={() => setSettings({ photo: undefined })}>
                  Remove
                </Button>
              )}
            </>
          }
        />
        <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
        <div className="profile-stats">
          <div><strong>{words.length}</strong><span>words</span></div>
          <div><strong>{learned}</strong><span>learned</span></div>
          <div><strong>{streak(activeDays(store), today)}</strong><span>day streak</span></div>
          <div><strong>{results.length}</strong><span>games played</span></div>
        </div>
      </Card>

      <div className="two-col">
        <Card>
          <CardHeader title="Personal information" />
          <div className="md-card__body word-form">
            <Input label="Name" placeholder="Used in the greeting" value={settings.name} onChange={(e) => setSettings({ name: e.target.value })} />
            <Input label="City or country" optional placeholder="e.g. Istanbul" value={settings.city ?? ""} onChange={(e) => setSettings({ city: e.target.value })} />
            <Input label="Native language" optional placeholder="e.g. Uzbek" value={settings.nativeLanguage ?? ""} onChange={(e) => setSettings({ nativeLanguage: e.target.value })} />
            <Textarea label="Why I'm learning English" optional rows={3} placeholder="A sentence to read on hard days" value={settings.about ?? ""} onChange={(e) => setSettings({ about: e.target.value })} />
          </div>
        </Card>

        <div className="stack-16">
          <Card>
            <CardHeader title="IELTS goal" />
            <div className="md-card__body word-form">
              <Select
                label="Target band"
                placeholder="Choose a band"
                value={settings.targetBand ?? ""}
                onChange={(e) => setSettings({ targetBand: e.target.value })}
                options={bands}
              />
              <Input label="Exam date" optional type="date" min={today} value={settings.examDate ?? ""} onChange={(e) => setSettings({ examDate: e.target.value || undefined })} />
              <Select
                label="Words per day"
                value={String(settings.goal)}
                onChange={(e) => setSettings({ goal: Number(e.target.value) })}
                options={["5", "10", "15", "20"].map((v) => ({ value: v, label: `${v} words${v === "10" ? " (recommended)" : ""}` }))}
              />
              {left != null && left > 0 && (
                <Text size="sm" tone="secondary">
                  At {settings.goal} words a day you can add about <strong>{left * settings.goal}</strong> more words before the exam.
                </Text>
              )}
              {settings.about && <blockquote className="profile-why">{settings.about}</blockquote>}
            </div>
          </Card>

          <GitHubSyncCard />

          <Card>
            <CardHeader title="Backup file" />
            <div className="md-card__body word-form">
              <Text size="sm" tone="muted">Download a copy of everything as a file. Restore adds the words from a file to the ones here; it never deletes any.</Text>
              <div className="word-form__actions">
                <Button size="sm" variant="outline" icon="download" onClick={exportFile}>Download backup</Button>
                <Button size="sm" variant="ghost" icon="upload" onClick={() => fileRef.current?.click()}>Restore</Button>
                <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
