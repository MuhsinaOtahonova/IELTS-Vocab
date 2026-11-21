import { useState, type FormEvent } from "react";
import { Alert, Button, Divider, IconButton, Input, Logo, SegmentedControl, Text, useTheme } from "@my-design/ui-web";
import { authError, useAuth } from "../auth";
import { saveTheme } from "../store";

type Mode = "signin" | "signup";

/** The first page when nobody is signed in: sign in, or create an account. */
export function LoginPage() {
  const auth = useAuth();
  const { theme, setTheme } = useTheme();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | "reset" | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const run = async (kind: "google" | "email" | "reset", fn: () => Promise<void>) => {
    setBusy(kind);
    setError("");
    setNote("");
    try {
      await fn();
      if (kind === "reset") setNote(`We sent a link to ${email.trim()}. Open it to choose a new password.`);
    } catch (e) {
      setError(authError(e));
    } finally {
      setBusy(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Write your email and password.");
    run("email", () => (mode === "signup" ? auth.signUp(name, email, password) : auth.signIn(email, password)));
  };

  const toggleTheme = () => {
    const t = theme === "light" ? "dark" : "light";
    setTheme(t);
    saveTheme(t);
  };

  return (
    <div className="login">
      <div className="login__top">
        <Logo name="Word a Day" short="W" />
        <IconButton icon={theme === "light" ? "moon" : "sun"} label={theme === "light" ? "Night mode" : "Day mode"} onClick={toggleTheme} />
      </div>

      <div className="login__wrap">
        <section className="login__intro" aria-hidden>
          <p className="login__eyebrow">IELTS vocabulary</p>
          <h1>Ten words a day. One short game every evening.</h1>
          <p>Sign in to keep your words, your profile and your streak on every phone and computer you use.</p>
          <ul className="login__words">
            <li><strong>resilient</strong><span>dayanıklı</span></li>
            <li><strong>ubiquitous</strong><span>her yerde olan</span></li>
            <li><strong>mitigate</strong><span>hafifletmek</span></li>
          </ul>
        </section>

        <form className="login__card" onSubmit={submit} noValidate>
          <div>
            <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
            <Text size="sm" tone="muted">{mode === "signin" ? "Sign in to see your words." : "It is free and takes a minute."}</Text>
          </div>

          <SegmentedControl<Mode>
            fullWidth
            aria-label="Sign in or sign up"
            value={mode}
            onChange={(m) => (setMode(m), setError(""), setNote(""))}
            options={[
              { value: "signin", label: "Sign in" },
              { value: "signup", label: "Sign up" },
            ]}
          />

          <Button type="button" variant="outline" fullWidth loading={busy === "google"} onClick={() => run("google", auth.google)}>
            <GoogleMark /> Continue with Google
          </Button>

          <Divider label="or with email" />

          {mode === "signup" && <Input label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
          <Input label="Email" type="email" autoComplete="email" icon="mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            label="Password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            icon="lock"
            hint={mode === "signup" ? "At least 6 characters" : undefined}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && <Alert tone="danger">{error}</Alert>}
          {note && <Alert tone="success">{note}</Alert>}

          <Button type="submit" fullWidth loading={busy === "email"}>
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>

          {mode === "signin" && (
            <button
              type="button"
              className="login__link"
              disabled={busy !== null}
              onClick={() => (email.trim() ? run("reset", () => auth.resetPassword(email)) : setError("Write your email first, then press “Forgot password”."))}
            >
              Forgot password?
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden className="login__g">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
