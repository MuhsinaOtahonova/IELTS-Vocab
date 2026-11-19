import { useEffect, useState } from "react";
import { Avatar, BottomNav, Drawer, IconButton, Logo, NavItem, NavSection, Sidebar, Text, Topbar, useTheme } from "@my-design/ui-web";
import { activeDays, isFriday, saveTheme, streak, StoreProvider, useStore } from "./store";
import { TodayPage } from "./pages/Today";
import { PracticePage } from "./pages/Practice";
import { FridayPage } from "./pages/Friday";
import { WordsPage } from "./pages/Words";
import { ProgressPage } from "./pages/Progress";
import { ProfilePage } from "./pages/Profile";

export type Page = "today" | "practice" | "friday" | "words" | "progress" | "profile";
const pages: Page[] = ["today", "practice", "friday", "words", "progress", "profile"];

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const store = useStore();
  const [page, setPage] = useState<Page>(() => {
    const h = window.location.hash.slice(1) as Page;
    return pages.includes(h) ? h : "today";
  });
  const [menuOpen, setMenuOpen] = useState(false);
  // Bumped on every nav click, so tapping the current page leaves a running game.
  const [visit, setVisit] = useState(0);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    window.location.hash = page;
  }, [page]);

  const go = (p: Page) => {
    setPage(p);
    setVisit((v) => v + 1);
    setMenuOpen(false);
  };
  const toggleTheme = () => {
    const t = theme === "light" ? "dark" : "light";
    setTheme(t);
    saveTheme(t);
  };

  const days = streak(activeDays(store), store.today);
  const friday = isFriday();

  const nav = (
    <>
      <NavSection title="Learn">
        <NavItem icon="home" label="Today" active={page === "today"} onClick={() => go("today")} />
        <NavItem icon="zap" label="Practice" active={page === "practice"} onClick={() => go("practice")} />
        <NavItem icon="task" label={friday ? "Check day (today)" : "Friday check"} active={page === "friday"} onClick={() => go("friday")} />
      </NavSection>
      <NavSection title="Me">
        <NavItem icon="list" label="My words" count={store.words.length} active={page === "words"} onClick={() => go("words")} />
        <NavItem icon="chart" label="Progress" active={page === "progress"} onClick={() => go("progress")} />
        <NavItem icon="user" label="Profile" active={page === "profile"} onClick={() => go("profile")} />
      </NavSection>
    </>
  );

  const name = store.settings.name.trim();
  const footer = (
    <button type="button" className="side-profile" onClick={() => go("profile")} aria-label="Open profile">
      <Avatar name={name || "Me"} src={store.settings.photo} size="md" />
      <span className="side-profile__text">
        <span className="side-profile__name">{name || "Set up your profile"}</span>
        <small>
          {days} day{days === 1 ? "" : "s"} in a row · {store.words.length} words
        </small>
      </span>
    </button>
  );

  return (
    <div className="app">
      <Sidebar className="app__sidebar" header={<Logo name="Word a Day" short="W" />} footer={footer}>
        {nav}
      </Sidebar>
      <Drawer open={menuOpen} onClose={() => setMenuOpen(false)} side="left" width={280} title={<Logo name="Word a Day" short="W" />}>
        <div className="app__drawer-nav">{nav}</div>
      </Drawer>

      <div className="app__main">
        <Topbar
          className="app__topbar"
          left={
            <>
              <IconButton className="app__menu" icon="menu" label="Open menu" onClick={() => setMenuOpen(true)} />
              <Text weight="semibold" as="span" className="app__mobile-title">Word a Day</Text>
            </>
          }
          right={
            <>
              <span className="topbar-streak" title="Days in a row">
                <span className="topbar-streak__num">{days}</span> day streak
              </span>
              <IconButton icon={theme === "light" ? "moon" : "sun"} label={theme === "light" ? "Night mode" : "Day mode"} onClick={toggleTheme} />
              <button type="button" className="topbar-avatar" onClick={() => go("profile")} aria-label="Profile">
                <Avatar name={name || "Me"} src={store.settings.photo} size="sm" />
              </button>
            </>
          }
        />
        <main key={`${page}-${visit}`} className="app__content md-page">
          {page === "today" && <TodayPage go={go} />}
          {page === "practice" && <PracticePage go={go} />}
          {page === "friday" && <FridayPage go={go} />}
          {page === "words" && <WordsPage />}
          {page === "progress" && <ProgressPage />}
          {page === "profile" && <ProfilePage />}
        </main>
        <div className="app__bottomnav">
          <BottomNav
            value={page}
            onChange={go}
            items={[
              { value: "today", label: "Today", icon: "home" },
              { value: "practice", label: "Practice", icon: "zap" },
              { value: "friday", label: "Friday", icon: "task", badge: friday ? 1 : undefined },
              { value: "words", label: "Words", icon: "list" },
              { value: "profile", label: "Me", icon: "user" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
