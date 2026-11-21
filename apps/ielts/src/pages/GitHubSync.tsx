import { useState } from "react";
import { Badge, Button, Card, CardHeader, Input, Link, Text, useToast } from "@my-design/ui-web";
import { useSync, TOKEN_URL } from "../sync";
import { useStore } from "../store";

const time = (d?: Date) => (d ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");

export function GitHubSyncCard() {
  const sync = useSync();
  const { words } = useStore();
  const toast = useToast();
  const [token, setToken] = useState("");
  const on = sync.status !== "off";

  const connect = async () => {
    if (await sync.connect(token)) {
      setToken("");
      toast({ tone: "success", title: "Connected to GitHub", description: `Your ${words.length} words are being saved.` });
    }
  };

  return (
    <Card className="sync-card">
      <CardHeader
        title="Save to GitHub"
        subtitle="Every change is saved to a private file in your GitHub account"
        actions={
          on ? (
            <Badge tone={sync.status === "error" ? "danger" : sync.status === "saved" ? "success" : "info"} dot>
              {sync.status === "saved" ? `Saved ${time(sync.lastSaved)}` : sync.status === "error" ? "Not saved" : "Saving…"}
            </Badge>
          ) : (
            <Badge tone="warning" dot>Off</Badge>
          )
        }
      />
      <div className="md-card__body word-form">
        {on ? (
          <>
            <Text size="sm">
              Connected as <strong>{sync.login ?? "your account"}</strong>. {words.length} words are kept in your file
              {sync.gistUrl ? (
                <>
                  {" "}(
                  <Link href={sync.gistUrl} external>
                    open it on GitHub
                  </Link>
                  )
                </>
              ) : null}
              . On another phone or computer, connect with the same token and your words appear there too.
            </Text>
            {sync.error && <Text size="sm" tone="danger">{sync.error}</Text>}
            <div className="word-form__actions">
              <Button size="sm" variant="outline" icon="refresh" onClick={sync.saveNow}>Save now</Button>
              <Button size="sm" variant="ghost" onClick={sync.disconnect}>Disconnect</Button>
            </div>
          </>
        ) : (
          <>
            <ol className="sync-steps">
              <li>
                <Link href={TOKEN_URL} external>Create a GitHub token</Link>. Only the <strong>gist</strong> box needs to be ticked. Set Expiration to <strong>No expiration</strong>.
              </li>
              <li>Click <strong>Generate token</strong> and copy it (it starts with <code>ghp_</code>).</li>
              <li>Paste it here and press Connect.</li>
            </ol>
            <div className="sync-row">
              <Input size="sm" type="password" placeholder="ghp_…" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
              <Button size="sm" onClick={connect} loading={sync.status === "connecting"} disabled={!token.trim()}>
                Connect
              </Button>
            </div>
            {sync.error && <Text size="sm" tone="danger">{sync.error}</Text>}
            <Text size="sm" tone="muted">The token stays in this browser only. Your words here are uploaded first; nothing is deleted.</Text>
          </>
        )}
      </div>
    </Card>
  );
}
