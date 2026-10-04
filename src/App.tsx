import { useEffect, useRef, useState } from "react";
import {
  Home,
  Dumbbell,
  CalendarDays,
  ChartNoAxesCombined,
  Users,
  Settings,
  Plus,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  FlaskConical,
  Trash2,
  Check,
  LogOut,
  Search,
  ShieldCheck,
  Cloud,
  AlertCircle,
  ArrowUpRight,
  Menu,
  X,
} from "lucide-react";
import type { AppData, Session, Template, Profile } from "./types";
import {
  supabase,
  loadCloud,
  saveCloud,
  loadProfiles,
  loadLocal,
  DEMO_PROFILES,
} from "./backend";
import {
  dateKey,
  parseDate,
  addDays,
  monday,
  shortDate,
  number,
  currentWeek,
  emptyData,
  demoData,
  newSession,
  id,
  cloneExercises,
  doneSets,
  volume,
  completeSession,
  records,
  changePercent,
  validateBackup,
} from "./model";
import {
  Logo,
  Panel,
  SessionCard,
  WeekBadge,
  Empty,
  Modal,
  SetRow,
  LastTime,
  DumbbellArt,
} from "./components";
import { SessionEditor } from "./SessionEditor";
import { Analytics } from "./Analytics";
type Page =
  "Dashboard" | "Training" | "Calendar" | "Analytics" | "People" | "Settings";
const pages = [
  { name: "Dashboard" as Page, icon: Home },
  { name: "Training" as Page, icon: Dumbbell },
  { name: "Calendar" as Page, icon: CalendarDays },
  { name: "Analytics" as Page, icon: ChartNoAxesCombined },
  { name: "People" as Page, icon: Users },
  { name: "Settings" as Page, icon: Settings },
];
function exportData(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `liftlog-${dateKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function Auth({ onDemo }: { onDemo: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Logo />
        <div className="auth-art">
          <DumbbellArt />
        </div>
        <h1>Welcome back, strong friend.</h1>
        <p>Your next session is waiting.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              const { error } = await supabase!.auth.signInWithPassword({
                email,
                password,
              });
              if (error) throw error;
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="button primary full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <button
          className="text-button"
          onClick={async () => {
            if (!email) {
              setMessage("Enter your email first.");
              return;
            }
            const { error } = await supabase!.auth.resetPasswordForEmail(
              email,
              { redirectTo: window.location.origin + window.location.pathname },
            );
            setMessage(
              error?.message ||
                "If this account exists, a password reset link has been sent.",
            );
          }}
        >
          Forgot password?
        </button>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <hr />
        <button className="button secondary full" onClick={onDemo}>
          <FlaskConical size={16} /> Try the demo
        </button>
        <p className="footnote">Real accounts are invited by your coach.</p>
      </div>
    </div>
  );
}
export default function App() {
  const [authId, setAuthId] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [demo, setDemo] = useState(!supabase);
  const [profiles, setProfiles] = useState<Profile[]>(DEMO_PROFILES);
  const [owner, setOwner] = useState("demo-self");
  const [data, setData] = useState<AppData | null>(null);
  const [page, setPage] = useState<Page>("Dashboard");
  const [editor, setEditor] = useState<Session | null>(null);
  const [templateEditor, setTemplateEditor] = useState<Template | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [confirm, setConfirm] = useState<"demo" | "clear" | "import" | null>(
    null,
  );
  const [imported, setImported] = useState<AppData | null>(null);
  const [invite, setInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [passwordMode, setPasswordMode] = useState(
    new URLSearchParams(window.location.search).get("welcome") === "1",
  );
  const [newPassword, setNewPassword] = useState("");
  const [menu, setMenu] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const dataRef = useRef<AppData | null>(null);
  const queue = useRef(Promise.resolve());
  const blocked = useRef(false);
  const pending = useRef(0);
  const [reload, setReload] = useState(0);
  const [peopleStats, setPeopleStats] = useState<Record<string, AppData>>({});
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      setAuthId(session?.user.id || null);
      setAuthReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthId(session?.user.id || null);
      setAuthReady(true);
      if (
        event === "PASSWORD_RECOVERY" ||
        (event === "SIGNED_IN" && window.location.hash.includes("type=invite"))
      )
        setPasswordMode(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (demo) {
      setProfiles(DEMO_PROFILES);
      setOwner("demo-self");
      return;
    }
    if (!authId) return;
    let active = true;
    setLoading(true);
    loadProfiles()
      .then((p) => {
        if (!active) return;
        if (!p.some((x) => x.id === authId && x.active))
          throw new Error(
            "This account is inactive or has not been set up. Contact your coach.",
          );
        setProfiles(p);
        setOwner(authId);
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [authId, demo]);
  useEffect(() => {
    if (!demo && (!authId || !profiles.some((p) => p.id === owner))) return;
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    dataRef.current = null;
    blocked.current = false;
    setSaveState("saved");
    const p = profiles.find((x) => x.id === owner);
    const load = demo
      ? Promise.resolve().then(() => ({
          data: loadLocal(owner, p?.name || "Athlete"),
          revision: 0,
        }))
      : loadCloud(owner);
    load
      .then((result) => {
        if (!active) return;
        revision.current = result.revision;
        dataRef.current = result.data;
        setData(result.data);
      })
      .catch((e) => {
        if (active) setError(`Could not load training data: ${e.message}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [owner, demo, authId, reload]);
  useEffect(() => {
    const handle = (e: BeforeUnloadEvent) => {
      if (pending.current || blocked.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handle);
    return () => window.removeEventListener("beforeunload", handle);
  }, []);
  const me = demo ? DEMO_PROFILES[0] : profiles.find((p) => p.id === authId);
  const viewing = profiles.find((p) => p.id === owner);
  const coach = me?.role === "coach";
  const change = (next: AppData) => {
    dataRef.current = next;
    setData(next);
    setPeopleStats({});
    if (demo) {
      try {
        localStorage.setItem(`liftlog-v1-${owner}`, JSON.stringify(next));
        setSaveState("saved");
      } catch {
        setSaveState("error");
        setError(
          "Browser storage is full or unavailable. Export your data before leaving.",
        );
        blocked.current = true;
      }
      return;
    }
    if (blocked.current) {
      setSaveState("error");
      return;
    }
    pending.current++;
    setSaveState("saving");
    const target = owner;
    queue.current = queue.current
      .then(async () => {
        if (blocked.current) return;
        try {
          revision.current = await saveCloud(target, next, revision.current);
        } catch (e) {
          blocked.current = true;
          setError(
            `Sync stopped: ${(e as Error).message}. Export your unsaved data before reloading.`,
          );
          setSaveState("error");
        }
      })
      .finally(() => {
        pending.current--;
        if (!pending.current && !blocked.current) setSaveState("saved");
      });
  };
  const saveSession = (s: Session) => {
    const d = dataRef.current!;
    change({ ...d, sessions: [...d.sessions.filter((x) => x.id !== s.id), s] });
  };
  const addCustom = (name: string) => {
    const d = dataRef.current!;
    const eid = id();
    change({
      ...d,
      exercises: [...d.exercises, { id: eid, name, custom: true }],
    });
    return eid;
  };
  const switchOwner = (next: string) => {
    if (pending.current || blocked.current) {
      setError(
        "Finish saving or export and reload your unsaved changes before switching athletes.",
      );
      return;
    }
    setOwner(next);
    setEditor(null);
    setPage("Dashboard");
  };
  useEffect(() => {
    if (page !== "People" || !coach || !data) return;
    let active = true;
    Promise.all(
      profiles.map(async (p) => {
        try {
          return [
            p.id,
            demo ? loadLocal(p.id, p.name) : (await loadCloud(p.id)).data,
          ] as const;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (active)
        setPeopleStats(
          Object.fromEntries(
            results.filter((r): r is readonly [string, AppData] => r !== null),
          ),
        );
    });
    return () => {
      active = false;
    };
  }, [page, profiles, demo, owner]);
  const today = dateKey();
  const todaySessions = data?.sessions.filter((s) => s.date === today) || [];
  const thisMonday = monday(today);
  const prevMonday = addDays(thisMonday, -7);
  const thisWeek =
    data?.sessions.filter(
      (s) => s.date >= thisMonday && s.date <= addDays(thisMonday, 6),
    ) || [];
  const previous =
    data?.sessions.filter((s) => s.date >= prevMonday && s.date < thisMonday) ||
    [];
  const currentVolume = thisWeek.reduce((n, s) => n + volume(s), 0);
  const previousVolume = previous.reduce((n, s) => n + volume(s), 0);
  const percent = changePercent(currentVolume, previousVolume);
  const upcoming =
    data?.sessions
      .filter((s) => s.status === "planned" && s.date > today)
      .sort((a, b) => a.date.localeCompare(b.date)) || [];
  const recent =
    data?.sessions
      .filter((s) => s.status === "done")
      .sort((a, b) => b.date.localeCompare(a.date)) || [];
  const newRecords = data
    ? records(data.sessions.filter((s) => s.date <= today)).events.filter((e) =>
        e.date.startsWith(today.slice(0, 7)),
      ).length
    : 0;
  if (!authReady) return <div className="loading">Opening LiftLog…</div>;
  if (!demo && !authId) return <Auth onDemo={() => setDemo(true)} />;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Logo />
        <nav>
          {pages
            .filter((p) => p.name !== "People" || coach)
            .map((p) => (
              <button
                key={p.name}
                className={page === p.name ? "active" : ""}
                onClick={() => {
                  setPage(p.name);
                  setMenu(false);
                  setSearch("");
                }}
              >
                <p.icon size={21} />
                <span>{p.name}</span>
              </button>
            ))}
        </nav>
        <div className="sidebar-cheer">
          <span>✦</span>
          <strong>
            Strong friends.
            <br />
            Stronger days.
          </strong>
          <small>One rep at a time.</small>
        </div>
        <div className="sidebar-foot">
          Made for showing up <span>↗</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <div className="mobile-logo">
            <Logo />
          </div>
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label="Search sessions"
              placeholder="Find a session…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value) setPage("Training");
              }}
            />
          </div>
          <div className="topbar-right">
            <span className={`save-status ${saveState}`} aria-live="polite">
              {demo ? <FlaskConical size={14} /> : <Cloud size={14} />}{" "}
              {demo
                ? "Local demo"
                : saveState === "saving"
                  ? "Saving…"
                  : saveState === "error"
                    ? "Unsaved changes"
                    : "All saved"}
            </span>
            {coach && (
              <select
                className="athlete-select"
                aria-label="Switch athlete"
                value={owner}
                onChange={(e) => switchOwner(e.target.value)}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.id === (demo ? "demo-self" : authId) ? " · You" : ""}
                    {p.active ? "" : " · inactive"}
                  </option>
                ))}
              </select>
            )}
            <span className="avatar">{viewing?.name.slice(0, 1) || "A"}</span>
            {!demo && (
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={async () => {
                  if (pending.current || blocked.current) {
                    setError("Export unsaved data before signing out.");
                    return;
                  }
                  setData(null);
                  await supabase!.auth.signOut();
                }}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </header>
        <main>
          {demo && (
            <div className="demo-banner">
              <span>
                <FlaskConical size={15} /> Demo mode · profiles and workouts
                stay in this browser
              </span>
              {supabase ? (
                <button
                  onClick={() => {
                    if (saveState === "saved") setDemo(false);
                  }}
                >
                  Use real account →
                </button>
              ) : (
                <a
                  href="https://github.com/aminzhanov/gymtracker#connect-real-accounts"
                  target="_blank"
                  rel="noreferrer"
                >
                  Connect accounts →
                </a>
              )}
            </div>
          )}
          {coach && owner !== (demo ? "demo-self" : authId) && (
            <div className="viewing-banner">
              <ShieldCheck size={17} />
              <strong>Viewing {viewing?.name}'s training</strong>
              <span>You are editing as their coach.</span>
            </div>
          )}
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{error}</span>
              {data && <button onClick={() => exportData(data)}>Export</button>}
              <button
                onClick={() => {
                  if (pending.current) return;
                  if (blocked.current) {
                    if (
                      !window.confirm(
                        "Reload saved data and discard unsaved edits? Export first to keep them.",
                      )
                    )
                      return;
                    setConfirm(null);
                    setReload((n) => n + 1);
                  } else {
                    setReload((n) => n + 1);
                    setError("");
                  }
                }}
              >
                Reload
              </button>
            </div>
          )}
          {loading || !data ? (
            <div className="loading">
              {error
                ? "Resolve the loading error above to continue."
                : "Loading your training…"}
            </div>
          ) : (
            <>
              {page === "Dashboard" && (
                <>
                  <section className="welcome">
                    <div>
                      <span className="eyebrow">
                        LET'S MAKE TODAY A GOOD ONE
                      </span>
                      <h1>
                        Hey {data.settings.name} <span>💪</span>
                      </h1>
                      <p>Ready to move today?</p>
                      <div className="flex">
                        <WeekBadge week={currentWeek(data)} />
                        <span className="welcome-date">
                          {parseDate(today).toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <DumbbellArt />
                    <span className="welcome-stamp">
                      LET'S
                      <br />
                      LIFT! ↗
                    </span>
                  </section>
                  <Panel
                    title="Your stats"
                    action={
                      <span className="muted">This week · Monday start</span>
                    }
                  >
                    <div className="stats-grid">
                      <div className="stat tint-mint">
                        <Home size={22} />
                        <strong>
                          {thisWeek.filter((s) => s.status === "done").length}
                        </strong>
                        <span>Sessions this week</span>
                      </div>
                      <div className="stat tint-pink">
                        <Dumbbell size={22} />
                        <strong>
                          {thisWeek.reduce((n, s) => n + doneSets(s).length, 0)}
                        </strong>
                        <span>Sets completed</span>
                      </div>
                      <div className="stat tint-blue">
                        <span className="stat-doodle">▰</span>
                        <strong>
                          {number(currentVolume)}
                          <small> kg</small>
                        </strong>
                        <span>Training volume</span>
                      </div>
                      <div className="stat tint-mint">
                        <ArrowUpRight size={22} />
                        <strong>
                          {percent === null
                            ? "—"
                            : `${percent >= 0 ? "+" : ""}${number(percent, 1)}%`}
                        </strong>
                        <span>
                          {percent === null
                            ? "No prior-week volume"
                            : "vs previous week"}
                        </span>
                      </div>
                      <div className="stat tint-yellow">
                        <span className="stat-doodle">🏆</span>
                        <strong>{newRecords}</strong>
                        <span>Records this month</span>
                      </div>
                    </div>
                    <div className="alltime">
                      <span>
                        <strong>
                          {
                            data.sessions.filter((s) => s.status === "done")
                              .length
                          }
                        </strong>{" "}
                        sessions all time
                      </span>
                      <span>
                        <strong>
                          {data.sessions.reduce(
                            (n, s) => n + doneSets(s).length,
                            0,
                          )}
                        </strong>{" "}
                        completed sets all time
                      </span>
                      <span>
                        Keep showing up. Progress adds up <span>✦</span>
                      </span>
                    </div>
                  </Panel>
                  <div className="dashboard-grid">
                    <Panel
                      title="Today's workout"
                      className="today-panel"
                      action={
                        <button
                          className="text-button"
                          onClick={() => setCreateDate(today)}
                        >
                          <Plus size={15} /> Plan
                        </button>
                      }
                    >
                      {todaySessions.length ? (
                        todaySessions.map((s) => (
                          <div className="today-session" key={s.id}>
                            <button
                              className="today-heading"
                              onClick={() => setEditor(s)}
                            >
                              <span className="session-icon tint-yellow">
                                {s.icon}
                              </span>
                              <div>
                                <strong>{s.name}</strong>
                                <span>
                                  <WeekBadge week={s.week} /> · {s.status}
                                </span>
                              </div>
                              <ArrowRight size={18} />
                            </button>
                            {s.exercises
                              .filter((e) => e.kind === "strength")
                              .map((e) => (
                                <div className="dashboard-exercise" key={e.id}>
                                  <strong>{e.name}</strong>
                                  <LastTime
                                    exercise={e}
                                    session={s}
                                    sessions={data.sessions}
                                  />
                                  {e.sets.map((set, i) => (
                                    <SetRow
                                      key={set.id}
                                      set={set}
                                      index={i}
                                      onChange={(updated) =>
                                        saveSession({
                                          ...s,
                                          status: !updated.done
                                            ? "planned"
                                            : s.status,
                                          exercises: s.exercises.map((old) =>
                                            old.id === e.id
                                              ? {
                                                  ...old,
                                                  sets: old.sets.map((x) =>
                                                    x.id === set.id
                                                      ? updated
                                                      : x,
                                                  ),
                                                }
                                              : old,
                                          ),
                                        })
                                      }
                                    />
                                  ))}
                                </div>
                              ))}
                            {!s.exercises.length && (
                              <p className="muted">
                                Open the session to add your exercises.
                              </p>
                            )}
                            <div className="today-actions">
                              <button
                                className="button secondary"
                                onClick={() => setEditor(s)}
                              >
                                Open editor
                              </button>
                              {s.status !== "done" && (
                                <button
                                  className="button primary"
                                  onClick={() =>
                                    saveSession(completeSession(s))
                                  }
                                >
                                  <Check size={16} /> Complete session
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <Empty
                          title="A fresh page for today"
                          detail="Plan a session, or enjoy your recovery day."
                          action={
                            <button
                              className="button primary"
                              onClick={() => setCreateDate(today)}
                            >
                              <Plus size={16} /> Plan today's session
                            </button>
                          }
                        />
                      )}
                    </Panel>
                    <div className="dashboard-side">
                      <Panel
                        title="Coming up"
                        action={
                          <button
                            className="text-button"
                            onClick={() => setPage("Calendar")}
                          >
                            Calendar <ArrowRight size={15} />
                          </button>
                        }
                      >
                        {upcoming.length ? (
                          upcoming
                            .slice(0, 4)
                            .map((s) => (
                              <SessionCard
                                key={s.id}
                                session={s}
                                onOpen={setEditor}
                              />
                            ))
                        ) : (
                          <Empty
                            title="Room for your next goal"
                            detail="Plan your next training day."
                          />
                        )}
                      </Panel>
                      <Panel
                        title="Recently completed"
                        action={
                          <button
                            className="text-button"
                            onClick={() => setPage("Training")}
                          >
                            View all <ArrowRight size={15} />
                          </button>
                        }
                      >
                        {recent.length ? (
                          recent
                            .slice(0, 3)
                            .map((s) => (
                              <SessionCard
                                key={s.id}
                                session={s}
                                onOpen={setEditor}
                              />
                            ))
                        ) : (
                          <Empty
                            title="Your history starts here"
                            detail="Complete your first session."
                          />
                        )}
                      </Panel>
                      <div className="cheer-card">
                        <div>
                          <strong>Keep showing up!</strong>
                          <p>Every rep is a little vote for you.</p>
                        </div>
                        <span>☻</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {page === "Training" && (
                <Training
                  data={data}
                  search={search}
                  onChange={change}
                  onOpen={setEditor}
                  onCreate={() => setCreateDate(today)}
                  onTemplateEdit={setTemplateEditor}
                  onUseTemplate={(t) => setEditor(newSession(data, today, t))}
                />
              )}
              {page === "Calendar" && (
                <Calendar
                  data={data}
                  onOpen={setEditor}
                  onCreate={setCreateDate}
                  onMove={(sid, date) => {
                    const s = data.sessions.find((x) => x.id === sid);
                    if (s) saveSession({ ...s, date });
                  }}
                />
              )}
              {page === "Analytics" && (
                <Analytics data={data} onChange={change} />
              )}
              {page === "People" && coach && (
                <>
                  <div className="page-head">
                    <div>
                      <span className="eyebrow">STRONGER TOGETHER</span>
                      <h1>
                        Your training crew <span>✦</span>
                      </h1>
                      <p>Plan their sessions. Celebrate their progress.</p>
                    </div>
                    <button
                      className="button primary"
                      onClick={() => setInvite(true)}
                    >
                      <Plus size={17} /> Invite athlete
                    </button>
                  </div>
                  <div className="people-grid">
                    {profiles
                      .filter((p) => p.id !== (demo ? "demo-self" : authId))
                      .map((p) => {
                        const d = peopleStats[p.id];
                        const next = d?.sessions
                          .filter(
                            (s) => s.date >= today && s.status === "planned",
                          )
                          .sort((a, b) => a.date.localeCompare(b.date))[0];
                        const completed = d?.sessions
                          .filter((s) => s.status === "done")
                          .sort((a, b) => b.date.localeCompare(a.date))[0];
                        const wk =
                          d?.sessions.filter(
                            (s) =>
                              s.date >= thisMonday &&
                              s.date <= addDays(thisMonday, 6),
                          ) || [];
                        return (
                          <Panel
                            key={p.id}
                            title={p.name}
                            action={<span className="avatar">{p.name[0]}</span>}
                          >
                            <div className="flex">
                              <WeekBadge week={d ? currentWeek(d) : "A"} />
                              <span
                                className={`badge ${p.active ? "tint-mint" : "tint-pink"}`}
                              >
                                {p.active ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <p>
                              {d
                                ? `${wk.filter((s) => s.status === "done").length} completed this week · ${number(wk.reduce((n, s) => n + volume(s), 0))} kg`
                                : "Loading training summary…"}
                            </p>
                            <p className="muted">
                              Next:{" "}
                              {next
                                ? `${next.name} · ${shortDate(next.date)}`
                                : "Nothing planned yet"}
                            </p>
                            <p className="muted">
                              Last:{" "}
                              {completed
                                ? `${completed.name} · ${shortDate(completed.date)}`
                                : "No completed session"}
                            </p>
                            <button
                              className="button primary full"
                              onClick={() => switchOwner(p.id)}
                            >
                              Open training <ArrowRight size={16} />
                            </button>
                            {!demo && (
                              <button
                                className="text-button"
                                onClick={async () => {
                                  const { error } = await supabase!.rpc(
                                    "set_athlete_active",
                                    { athlete_id: p.id, is_active: !p.active },
                                  );
                                  if (error) setError(error.message);
                                  else setProfiles(await loadProfiles());
                                }}
                              >
                                {p.active
                                  ? "Deactivate access"
                                  : "Reactivate access"}
                              </button>
                            )}
                          </Panel>
                        );
                      })}
                  </div>
                  {profiles.length <= 1 && (
                    <Empty
                      title="Build your crew"
                      detail="Invite your first athlete to plan training together."
                    />
                  )}
                </>
              )}
              {page === "Settings" && (
                <>
                  <div className="page-head">
                    <div>
                      <span className="eyebrow">YOUR DATA, YOUR JOURNEY</span>
                      <h1>
                        Make it yours <span>✦</span>
                      </h1>
                      <p>
                        Training preferences, backups and your exercise library.
                      </p>
                    </div>
                  </div>
                  <div className="two-col">
                    <Panel title="Program & workload">
                      <label>
                        Display name
                        <input
                          value={data.settings.name}
                          onChange={(e) =>
                            change({
                              ...data,
                              settings: {
                                ...data.settings,
                                name: e.target.value,
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        Week A/B anchor date
                        <input
                          type="date"
                          value={data.settings.anchorDate}
                          onChange={(e) => {
                            if (e.target.value)
                              change({
                                ...data,
                                settings: {
                                  ...data.settings,
                                  anchorDate: e.target.value,
                                },
                              });
                          }}
                        />
                      </label>
                      <label>
                        Anchor program week
                        <select
                          value={data.settings.anchorWeek}
                          onChange={(e) =>
                            change({
                              ...data,
                              settings: {
                                ...data.settings,
                                anchorWeek: e.target.value as "A" | "B",
                              },
                            })
                          }
                        >
                          <option>A</option>
                          <option>B</option>
                        </select>
                      </label>
                      <p className="footnote">
                        Your dashboard alternates A/B from this date's Monday.
                        Existing sessions retain their assigned week.
                      </p>
                      <label>
                        Workload spike threshold (%)
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          value={data.settings.spikeThreshold}
                          onChange={(e) =>
                            change({
                              ...data,
                              settings: {
                                ...data.settings,
                                spikeThreshold: Math.max(
                                  0,
                                  Math.min(1000, Number(e.target.value)),
                                ),
                              },
                            })
                          }
                        />
                      </label>
                      <p className="footnote">
                        Flag weekly volume increases above this threshold.
                        Default: 30%.
                      </p>
                    </Panel>
                    <Panel title="Data & backups">
                      <div className="data-actions">
                        <button onClick={() => exportData(data)}>
                          <span className="data-icon tint-mint">
                            <Download size={20} />
                          </span>
                          <span>
                            <strong>Export all data</strong>
                            <small>
                              Sessions, templates, exercises, bodyweight &
                              settings
                            </small>
                          </span>
                          <ArrowRight size={17} />
                        </button>
                        <button onClick={() => fileRef.current?.click()}>
                          <span className="data-icon tint-blue">
                            <Upload size={20} />
                          </span>
                          <span>
                            <strong>Import JSON backup</strong>
                            <small>
                              Restore everything for {viewing?.name}
                            </small>
                          </span>
                          <ArrowRight size={17} />
                        </button>
                        <button onClick={() => setConfirm("demo")}>
                          <span className="data-icon tint-yellow">
                            <FlaskConical size={20} />
                          </span>
                          <span>
                            <strong>Load demo data</strong>
                            <small>
                              Eight weeks of A/B workouts & progress
                            </small>
                          </span>
                          <ArrowRight size={17} />
                        </button>
                        <button onClick={() => setConfirm("clear")}>
                          <span className="data-icon tint-peach">
                            <Trash2 size={20} />
                          </span>
                          <span>
                            <strong className="danger-text">
                              Clear all training data
                            </strong>
                            <small>Only the selected athlete's data</small>
                          </span>
                          <ArrowRight size={17} />
                        </button>
                      </div>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".json,application/json"
                        hidden
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          try {
                            if (file.size > 10000000)
                              throw new Error(
                                "Backup is too large (10 MB maximum).",
                              );
                            setImported(
                              validateBackup(JSON.parse(await file.text())),
                            );
                            setConfirm("import");
                          } catch (err) {
                            setError((err as Error).message);
                          }
                        }}
                      />
                    </Panel>
                  </div>
                  <ExerciseLibrary data={data} onChange={change} />
                  <Panel title="Account">
                    <p>
                      {demo
                        ? "You are using a local demo. These are simulated profiles; no invitations are sent."
                        : `Signed in as ${me?.name}. Role: ${me?.role}.`}
                    </p>
                    {supabase && (
                      <button
                        className="button secondary"
                        onClick={async () => {
                          if (pending.current || blocked.current) {
                            setError(
                              "Save or export unsaved data before signing out.",
                            );
                            return;
                          }
                          setData(null);
                          setAuthId(null);
                          setDemo(false);
                          await supabase!.auth.signOut();
                        }}
                      >
                        <LogOut size={16} /> {demo ? "Leave demo" : "Sign out"}
                      </button>
                    )}
                    {!supabase && (
                      <p className="muted">
                        See the repository README to connect Supabase for real
                        accounts.
                      </p>
                    )}
                  </Panel>
                </>
              )}
            </>
          )}
        </main>
        <nav className="bottom-nav">
          {pages
            .filter((p) => p.name !== "People" && p.name !== "Settings")
            .map((p) => (
              <button
                key={p.name}
                className={page === p.name ? "active" : ""}
                onClick={() => {
                  setPage(p.name);
                  setSearch("");
                }}
              >
                <p.icon size={20} />
                <span>{p.name}</span>
              </button>
            ))}
          <button
            className={page === "Settings" || page === "People" ? "active" : ""}
            onClick={() => setMenu(!menu)}
          >
            <Menu size={20} />
            <span>More</span>
          </button>
        </nav>
      </div>
      {editor && data && (
        <SessionEditor
          key={editor.id}
          initial={editor}
          data={data}
          onSave={saveSession}
          onClose={() => setEditor(null)}
          onDelete={
            data.sessions.some((s) => s.id === editor.id)
              ? () =>
                  change({
                    ...dataRef.current!,
                    sessions: dataRef.current!.sessions.filter(
                      (s) => s.id !== editor.id,
                    ),
                  })
              : undefined
          }
          onTemplate={(t) =>
            change({
              ...dataRef.current!,
              templates: [...dataRef.current!.templates, t],
            })
          }
          onCustom={addCustom}
        />
      )}
      {templateEditor && data && (
        <SessionEditor
          key={templateEditor.id}
          isTemplate
          initial={{
            ...templateEditor,
            date: today,
            status: "planned",
            difficulty: "",
          }}
          data={data}
          onSave={(s) => {
            const d = dataRef.current!;
            change({
              ...d,
              templates: [
                ...d.templates.filter((t) => t.id !== s.id),
                {
                  id: s.id,
                  name: s.name,
                  icon: s.icon,
                  week: s.week,
                  notes: s.notes,
                  exercises: cloneExercises(s.exercises),
                },
              ],
            });
          }}
          onClose={() => setTemplateEditor(null)}
          onDelete={
            data.templates.some((t) => t.id === templateEditor.id)
              ? () =>
                  change({
                    ...dataRef.current!,
                    templates: dataRef.current!.templates.filter(
                      (t) => t.id !== templateEditor.id,
                    ),
                  })
              : undefined
          }
          onCustom={addCustom}
        />
      )}
      {createDate && data && (
        <Modal title="Plan a session" onClose={() => setCreateDate(null)}>
          <label>
            Date
            <input
              type="date"
              value={createDate}
              onChange={(e) => {
                if (e.target.value) setCreateDate(e.target.value);
              }}
            />
          </label>
          <button
            className="button primary full"
            onClick={() => {
              setEditor(newSession(data, createDate));
              setCreateDate(null);
            }}
          >
            <Plus size={17} /> Start a blank session
          </button>
          {data.templates.length > 0 && (
            <>
              <h3>Or use a template</h3>
              {data.templates.map((t) => (
                <button
                  key={t.id}
                  className="template-option"
                  onClick={() => {
                    setEditor(newSession(data, createDate, t));
                    setCreateDate(null);
                  }}
                >
                  <span>{t.icon}</span>
                  <strong>{t.name}</strong>
                  <WeekBadge week={t.week} />
                  <ArrowRight size={16} />
                </button>
              ))}
            </>
          )}
        </Modal>
      )}
      {confirm && data && (
        <Modal
          title={
            confirm === "clear"
              ? "Clear training data?"
              : confirm === "import"
                ? "Restore this backup?"
                : "Load demo data?"
          }
          onClose={() => setConfirm(null)}
        >
          <p>
            This replaces all training data for <strong>{viewing?.name}</strong>
            . Other athletes are unaffected.
          </p>
          <p className="muted">
            Export a backup first if you want to keep the current data.
          </p>
          <div className="flex">
            <button
              className="button secondary"
              onClick={() => exportData(data)}
            >
              <Download size={16} /> Export first
            </button>
            <button
              className={`button ${confirm === "clear" ? "danger" : "primary"}`}
              onClick={() => {
                const next =
                  confirm === "clear"
                    ? emptyData(viewing?.name)
                    : confirm === "demo"
                      ? demoData(viewing?.name)
                      : imported!;
                change(next);
                setConfirm(null);
                setImported(null);
              }}
            >
              Replace data
            </button>
          </div>
        </Modal>
      )}
      {invite && (
        <Modal title="Invite an athlete" onClose={() => setInvite(false)}>
          {demo ? (
            <>
              <p>
                Invitations need a connected Supabase project and your Coach
                account. Demo profiles are browser-only simulations.
              </p>
              <a
                className="button primary"
                href="https://github.com/aminzhanov/gymtracker#connect-real-accounts"
                target="_blank"
                rel="noreferrer"
              >
                Open setup instructions <ArrowRight size={16} />
              </a>
            </>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setInviteBusy(true);
                try {
                  const { data: result, error } =
                    await supabase!.functions.invoke("invite-athlete", {
                      body: { name: inviteName, email: inviteEmail },
                    });
                  if (error) throw error;
                  if (result.error) throw new Error(result.error);
                  setProfiles(await loadProfiles());
                  setInvite(false);
                  setInviteEmail("");
                  setInviteName("");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setInviteBusy(false);
                }
              }}
            >
              <label>
                Name
                <input
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  maxLength={100}
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </label>
              <p className="muted">
                They'll receive a secure link to set their password.
              </p>
              <button className="button primary full" disabled={inviteBusy}>
                {inviteBusy ? "Sending…" : "Send invitation"}
              </button>
            </form>
          )}
        </Modal>
      )}
      {passwordMode && supabase && (
        <Modal title="Set your password" onClose={() => setPasswordMode(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const { error } = await supabase!.auth.updateUser({
                password: newPassword,
              });
              if (error) setError(error.message);
              else {
                setPasswordMode(false);
                setNewPassword("");
                window.history.replaceState(null, "", window.location.pathname);
              }
            }}
          >
            <label>
              New password
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <button className="button primary full">Save password</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
function Training({
  data,
  search,
  onChange,
  onOpen,
  onCreate,
  onTemplateEdit,
  onUseTemplate,
}: {
  data: AppData;
  search: string;
  onChange: (d: AppData) => void;
  onOpen: (s: Session) => void;
  onCreate: () => void;
  onTemplateEdit: (t: Template) => void;
  onUseTemplate: (t: Template) => void;
}) {
  const [tab, setTab] = useState<"sessions" | "templates">("sessions");
  const [filter, setFilter] = useState("all");
  const sessions = [...data.sessions]
    .filter(
      (s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) &&
        (filter === "all" || s.status === filter),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">SHOW UP. LIFT. REPEAT.</span>
          <h1>
            Your training <span>✦</span>
          </h1>
          <p>A place for every session and every small win.</p>
        </div>
        <button className="button primary" onClick={onCreate}>
          <Plus size={17} /> Create session
        </button>
      </div>
      <div className="training-toolbar">
        <div className="segmented">
          <button
            className={tab === "sessions" ? "active" : ""}
            onClick={() => setTab("sessions")}
          >
            Sessions
          </button>
          <button
            className={tab === "templates" ? "active" : ""}
            onClick={() => setTab("templates")}
          >
            Templates
          </button>
        </div>
        {tab === "sessions" && (
          <select
            aria-label="Session status filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All sessions</option>
            <option value="planned">Planned</option>
            <option value="done">Completed</option>
          </select>
        )}
      </div>
      {tab === "sessions" ? (
        sessions.length ? (
          <div className="training-list">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} onOpen={onOpen} />
            ))}
          </div>
        ) : (
          <Panel title="Sessions">
            <Empty
              title={
                search
                  ? "No matching sessions"
                  : "Your next chapter starts here"
              }
              detail={
                search
                  ? "Try another session name."
                  : "Create a session or load demo data from Settings."
              }
              action={
                <button className="button primary" onClick={onCreate}>
                  <Plus size={16} /> Create session
                </button>
              }
            />
          </Panel>
        )
      ) : (
        <>
          <div className="flex end">
            <button
              className="button secondary"
              onClick={() =>
                onTemplateEdit({
                  id: id(),
                  name: "New template",
                  icon: "🏋️",
                  week: "A",
                  notes: "",
                  exercises: [],
                })
              }
            >
              <Plus size={16} /> Create template
            </button>
          </div>
          {data.templates.length ? (
            <div className="template-grid">
              {data.templates.map((t) => (
                <Panel
                  key={t.id}
                  title={`${t.icon} ${t.name}`}
                  action={<WeekBadge week={t.week} />}
                >
                  <p className="muted">
                    {t.exercises.filter((e) => e.kind === "strength").length}{" "}
                    exercises ·{" "}
                    {t.exercises
                      .filter((e) => e.kind === "strength")
                      .reduce((n, e) => n + e.sets.length, 0)}{" "}
                    sets
                  </p>
                  <p>{t.notes || "Ready for your next session."}</p>
                  <div className="flex">
                    <button
                      className="button primary"
                      onClick={() => onUseTemplate(t)}
                    >
                      Start session <ArrowRight size={16} />
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => onTemplateEdit(t)}
                    >
                      Edit
                    </button>
                  </div>
                </Panel>
              ))}
            </div>
          ) : (
            <Empty
              title="Your routine, ready to repeat"
              detail="Create a template or save one from any session."
            />
          )}
        </>
      )}
    </>
  );
}
function Calendar({
  data,
  onOpen,
  onCreate,
  onMove,
}: {
  data: AppData;
  onOpen: (s: Session) => void;
  onCreate: (date: string) => void;
  onMove: (sid: string, date: string) => void;
}) {
  const [month, setMonth] = useState(dateKey().slice(0, 7));
  const first = `${month}-01`;
  const start = monday(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const move = (n: number) => {
    const d = parseDate(first);
    d.setMonth(d.getMonth() + n);
    setMonth(dateKey(d).slice(0, 7));
  };
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">PLAN. TRAIN. PROGRESS.</span>
          <h1>
            Your training calendar <span>↗</span>
          </h1>
          <p>Make a little space for getting stronger.</p>
        </div>
        <button className="button primary" onClick={() => onCreate(dateKey())}>
          <Plus size={17} /> Add session
        </button>
      </div>
      <Panel
        title={parseDate(first).toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        })}
        action={
          <div className="flex">
            <button
              className="icon-button"
              aria-label="Previous month"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              className="button secondary compact"
              onClick={() => setMonth(dateKey().slice(0, 7))}
            >
              Today
            </button>
            <button
              className="icon-button"
              aria-label="Next month"
              onClick={() => move(1)}
            >
              <ChevronRight size={20} />
            </button>
          </div>
        }
      >
        <div className="calendar-grid">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div className="calendar-label" key={day}>
              {day}
            </div>
          ))}
          {days.map((date) => (
            <div
              key={date}
              className={`calendar-day ${date.slice(0, 7) !== month ? "other-month" : ""} ${date === dateKey() ? "today" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const sid = e.dataTransfer.getData("text/liftlog-session");
                if (sid) onMove(sid, date);
              }}
            >
              <button
                className="day-number"
                aria-label={`Create session on ${date}`}
                onClick={() => onCreate(date)}
              >
                {parseDate(date).getDate()}
              </button>
              {data.sessions
                .filter((s) => s.date === date)
                .map((s) => (
                  <button
                    key={s.id}
                    draggable
                    className={`calendar-session week-${s.week.toLowerCase()}`}
                    onDragStart={(e) =>
                      e.dataTransfer.setData("text/liftlog-session", s.id)
                    }
                    onClick={() => onOpen(s)}
                    title={`${s.name} · Week ${s.week} · ${s.status}`}
                  >
                    <span>
                      {s.icon} <strong>{s.name}</strong>
                    </span>
                    <small>
                      A/B: {s.week} ·{" "}
                      {s.status === "done" ? "✓ Done" : "Planned"}
                    </small>
                  </button>
                ))}
              <button
                className="day-add"
                aria-label={`Add session on ${date}`}
                onClick={() => onCreate(date)}
              >
                <Plus size={14} />
              </button>
            </div>
          ))}
        </div>
        <p className="footnote">
          Tap a date to plan, or a session to open it. Drag a session to
          reschedule on desktop. Use “Move to date” in the editor on mobile.
        </p>
      </Panel>
    </>
  );
}
function ExerciseLibrary({
  data,
  onChange,
}: {
  data: AppData;
  onChange: (d: AppData) => void;
}) {
  const [name, setName] = useState("");
  return (
    <Panel title="Exercise library">
      <form
        className="flex"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (
            !n ||
            data.exercises.some((x) => x.name.toLowerCase() === n.toLowerCase())
          )
            return;
          onChange({
            ...data,
            exercises: [...data.exercises, { id: id(), name: n, custom: true }],
          });
          setName("");
        }}
      >
        <input
          className="grow"
          placeholder="Add your own exercise…"
          aria-label="Custom exercise name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
        />
        <button className="button primary" disabled={!name.trim()}>
          <Plus size={16} /> Add
        </button>
      </form>
      <div className="library-grid">
        {data.exercises.map((e) => (
          <div className="library-item" key={e.id}>
            <span>{e.name}</span>
            {e.custom ? (
              <button
                className="icon-button"
                aria-label={`Delete custom exercise ${e.name}`}
                onClick={() =>
                  onChange({
                    ...data,
                    exercises: data.exercises.filter((x) => x.id !== e.id),
                  })
                }
              >
                <Trash2 size={15} />
              </button>
            ) : (
              <small>Built-in</small>
            )}
          </div>
        ))}
      </div>
      <p className="footnote">
        Removing a custom exercise from the library preserves its logged
        history.
      </p>
    </Panel>
  );
}
