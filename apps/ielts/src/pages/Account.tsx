import { Badge, Button, Card, CardHeader, Text } from "@my-design/ui-web";
import { hasAccounts } from "../firebase";
import { useAuth } from "../auth";
import { useCloud } from "../cloud";

const time = (d?: Date) => (d ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "");

/** Who is signed in, whether the words are saved, and the sign-out button. */
export function AccountCard() {
  if (!hasAccounts) return null;
  return <SignedIn />;
}

function SignedIn() {
  const { user, logOut } = useAuth();
  const cloud = useCloud();
  if (!user || !cloud) return null;
  const google = user.providerData.some((p) => p.providerId === "google.com");
  return (
    <Card>
      <CardHeader
        title="Account"
        subtitle={google ? "Signed in with Google" : "Signed in with email"}
        actions={
          <Badge tone={cloud.status === "error" ? "warning" : cloud.status === "saved" ? "success" : "info"} dot>
            {cloud.status === "saved" ? `Saved ${time(cloud.lastSaved)}` : cloud.status === "error" ? "Not saved yet" : cloud.status === "loading" ? "Opening…" : "Saving…"}
          </Badge>
        }
      />
      <div className="md-card__body word-form">
        <Text size="sm">{user.email}</Text>
        <Text size="sm" tone="muted">
          Your words and profile are saved to this account. Sign in with the same account on your phone or another computer to see them there.
        </Text>
        {cloud.status === "error" && (
          <Text size="sm" tone="muted">Could not reach the server. Your words are safe in this browser and will be saved when the connection is back.</Text>
        )}
        <div className="word-form__actions">
          <Button size="sm" variant="outline" icon="logout" onClick={logOut}>Sign out</Button>
        </div>
      </div>
    </Card>
  );
}
