import { illustrationSource } from "./illustrationAssets";
import { TodayEmpty } from "./SectionIllustrations";
import catBack from "./assets/cat-back.webp";
import { IllustrationEditor } from "./ProfileIllustrations";
import { DEFAULT_ILLUSTRATIONS, illustrationVariables } from "./illustrations";
import type { ProfileIllustrations } from "./types";
import type { CSSProperties } from "react";
import { SearchResults } from "./SearchResults";
import { librarySessionWeeks } from "./libraryWeeks";
import { CoachInbox } from "./CoachInbox";
import { syncLocalReviewEvents, capReviewed, type ReviewItem } from "./reviews";
import {
  t,
  exerciseName,
  setAppLanguage,
  readLanguage,
  rememberLanguage,
  type Language,
} from "./i18n";
import { DashboardOverview } from "./DashboardOverview";
import { DuplicateSession } from "./DuplicateSession";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { assignTrainingWeeks } from "./trainingWeeks";
import { CompletedWorkout, CompletionToast } from "./CompletedWorkout";
import {
  Home,
  Bell,
  Inbox,
  Dumbbell,
  CalendarDays,
  ChartNoAxesCombined,
  Users,
  Settings,
  Plus,
  ArrowRight,
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
import type {
  AppData,
  Session,
  Template,
  Profile,
  CoachMessages,
  TechniqueVideos,
  Exercise,
} from "./types";
import {
  supabase,
  loadCloud,
  saveCloud,
  loadProfiles,
  loadReviewInbox,
  saveWorkoutReview,
  loadLocal,
  loadLocalMessages,
  loadLocalIllustrations,
  saveProfileIllustrations,
  saveCoachMessages,
  loadSharedLibrary,
  loadLocalSharedLibrary,
  addSharedExercise,
  archiveSharedExercise,
  saveLocalSharedVideo,
  setLocalLibraryArchive,
  saveTechniqueVideo,
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
  updateSessionExercise,
} from "./model";
import {
  DateField,
  Logo,
  Panel,
  SessionCard,
  WeekBadge,
  Empty,
  Modal,
  InfoButton,
  DumbbellArt,
} from "./components";
import { SessionEditor } from "./SessionEditor";
import { WorkoutExerciseCard } from "./WorkoutExerciseCard";
import { TechniqueVideo, TechniqueVideoEditor } from "./TechniqueVideo";
import { CoachMessageEditor } from "./CoachMessages";
import { DEFAULT_MESSAGES } from "./messages";
import { Analytics } from "./Analytics";
import { Calendar } from "./Calendar";
import { exerciseNameKey } from "./library";
import {
  monthLabel,
  trainingGroups,
  trainingMonths,
  type TrainingScope,
} from "./planning";
type Page =
  | "Search"
  | "Dashboard"
  | "Training"
  | "Calendar"
  | "Analytics"
  | "People"
  | "Settings"
  | "Inbox";
const pages = [
  { name: "Dashboard" as Page, icon: Home },
  { name: "Training" as Page, icon: Dumbbell },
  { name: "Calendar" as Page, icon: CalendarDays },
  { name: "Analytics" as Page, icon: ChartNoAxesCombined },
  { name: "People" as Page, icon: Users },
  { name: "Inbox" as Page, icon: Inbox },
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
        <h1>{t("Welcome back, strong friend.")}</h1>
        <p>{t("Your next session is waiting.")}</p>
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
            {t("Email")}
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            {t("Password")}
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
            {busy ? t("Signing in…") : t("Sign in")}
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
          {t("Forgot password?")}
        </button>
        {message && (
          <p role="status" className="notice">
            {t(message)}
          </p>
        )}
        <hr />
        <button className="button secondary full" onClick={onDemo}>
          <FlaskConical size={16} />
          {t(" Try the demo")}
        </button>
        <p className="footnote">
          {t("Real accounts are invited by your coach.")}
        </p>
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
  const [trainingWeeksReady, setTrainingWeeksReady] = useState(!supabase);
  const [programPreferenceReady, setProgramPreferenceReady] =
    useState(!supabase);
  const [messages, setMessages] = useState<CoachMessages>(DEFAULT_MESSAGES);
  const [illustrations, setIllustrations] = useState<ProfileIllustrations>(
    DEFAULT_ILLUSTRATIONS,
  );
  const [illustrationsReady, setIllustrationsReady] = useState(!supabase);
  const [illustrationSectionsReady, setIllustrationSectionsReady] =
    useState(!supabase);
  const [messagesReady, setMessagesReady] = useState(!supabase);
  const [languageReady, setLanguageReady] = useState(!supabase);
  const [appNameReady, setAppNameReady] = useState(!supabase);
  const [techniqueVideos, setTechniqueVideos] = useState<TechniqueVideos>({});
  const [techniqueVideosReady, setTechniqueVideosReady] = useState(!supabase);
  const [sharedLibraryReady, setSharedLibraryReady] = useState(!supabase);
  const libraryRequest = useRef(0);
  useEffect(() => {
    const name = (demo || authId) && data ? messages.appName : "LiftLog";
    document.title = `${name} · ${t("train together")}`;
    for (const metaName of ["apple-mobile-web-app-title", "application-name"])
      document
        .querySelector<HTMLMetaElement>(`meta[name="${metaName}"]`)
        ?.setAttribute("content", name);
  }, [messages.appName, data, demo, authId]);
  const messageOwner = useRef(owner);
  messageOwner.current = owner;
  const [page, setPage] = useState<Page>("Dashboard");
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [inboxReady, setInboxReady] = useState(false);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState("");
  const reviewRequest = useRef(0);
  const reviewScope = useRef("");
  const [duplicate, setDuplicate] = useState<Session | null>(null);
  const [editor, setEditor] = useState<Session | null>(null);
  const [templateEditor, setTemplateEditor] = useState<Template | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [completion, setCompletion] = useState<{
    sessionId: string;
    name: string;
    owner: string;
  } | null>(null);
  useEffect(() => {
    if (!completion || saveState === "saving") return;
    const timer = window.setTimeout(() => setCompletion(null), 6000);
    return () => window.clearTimeout(timer);
  }, [completion, saveState]);
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
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);
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
    setMessages(DEFAULT_MESSAGES);
    setIllustrations(DEFAULT_ILLUSTRATIONS);
    setIllustrationsReady(false);
    setIllustrationSectionsReady(false);
    setMessagesReady(false);
    setLanguageReady(false);
    setAppNameReady(false);
    setTechniqueVideos({});
    setTechniqueVideosReady(false);
    setSharedLibraryReady(false);
    libraryRequest.current++;
    dataRef.current = null;
    blocked.current = false;
    setSaveState("saved");
    setCompletion(null);
    const p = profiles.find((x) => x.id === owner);
    const load = demo
      ? Promise.resolve().then(() => ({
          data: {
            ...loadLocal(owner, p?.name || "Athlete"),
            exercises: loadLocalSharedLibrary(owner).exercises,
          },
          sharedLibraryReady: true,
          revision: 0,
          languageReady: true,
          programPreferenceReady: true,
          trainingWeeksReady: true,
          messages: loadLocalMessages(owner),
          illustrations: loadLocalIllustrations(owner),
          illustrationsReady: true,
          illustrationSectionsReady: true,
          messagesReady: true,
          appNameReady: true,
          techniqueVideos: loadLocalSharedLibrary(owner).techniqueVideos,
          techniqueVideosReady: true,
        }))
      : loadCloud(owner);
    load
      .then((result) => {
        if (!active) return;
        revision.current = result.revision;
        setProgramPreferenceReady(result.programPreferenceReady);
        setTrainingWeeksReady(result.trainingWeeksReady);
        setMessages(result.messages);
        setIllustrations(result.illustrations);
        setIllustrationsReady(result.illustrationsReady);
        setIllustrationSectionsReady(result.illustrationSectionsReady);
        setMessagesReady(result.messagesReady);
        setAppNameReady(result.appNameReady);
        setLanguageReady(result.languageReady);
        setTechniqueVideos(result.techniqueVideos);
        setTechniqueVideosReady(result.techniqueVideosReady);
        setSharedLibraryReady(result.sharedLibraryReady);
        const loaded = {
          ...result.data,
          sessions: assignTrainingWeeks(result.data.sessions),
        };
        if (demo)
          syncLocalReviewEvents(localStorage, owner, loaded.sessions, true);
        dataRef.current = loaded;
        setData(loaded);
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
  useEffect(() => {
    if (demo || !authId || !coach || page !== "People") return;
    let active = true;
    let busy = false;
    const refresh = async () => {
      if (!active || busy || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const next = await loadProfiles();
        if (active)
          setProfiles((old) =>
            JSON.stringify(old) === JSON.stringify(next) ? old : next,
          );
      } catch (error) {
        if (active) setError((error as Error).message);
      } finally {
        busy = false;
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [authId, demo, coach, page]);
  const reviewerId = demo ? "demo-self" : (authId ?? "");
  const refreshReviews = async () => {
    if (!coach || !reviewerId) return;
    const request = ++reviewRequest.current;
    setInboxLoading(true);
    try {
      const result = await loadReviewInbox(demo, reviewerId);
      if (request !== reviewRequest.current) return;
      setReviewItems(result.items);
      setInboxReady(result.ready);
      setInboxError("");
    } catch (e) {
      if (request === reviewRequest.current)
        setInboxError((e as Error).message);
    } finally {
      if (request === reviewRequest.current) setInboxLoading(false);
    }
  };
  useEffect(() => {
    const scope = `${demo ? "demo" : "cloud"}:${reviewerId}:${coach}`;
    if (scope !== reviewScope.current) {
      reviewScope.current = scope;
      setReviewItems([]);
      setInboxError("");
      setInboxReady(demo);
    }
    if (!coach || !reviewerId) return;
    void refreshReviews();
    const refresh = () => {
      if (document.visibilityState === "visible") void refreshReviews();
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      reviewRequest.current++;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [demo, reviewerId, coach, saveState]);
  const setReview = async (item: ReviewItem, reviewed: boolean) => {
    const scope = reviewScope.current;
    await saveWorkoutReview(demo, reviewerId, item, reviewed);
    if (scope !== reviewScope.current) return;
    setReviewItems((old) =>
      capReviewed(
        old.map((current) =>
          current.ownerId === item.ownerId &&
          current.session.id === item.session.id &&
          current.version === item.version
            ? {
                ...current,
                reviewed,
                reviewedAt: reviewed ? new Date().toISOString() : null,
              }
            : current,
        ),
      ),
    );
    await refreshReviews();
  };
  const unreadReviews = reviewItems.filter((item) => !item.reviewed).length;
  const refreshLibrary = async (target = owner) => {
    const request = ++libraryRequest.current;
    const library = demo
      ? loadLocalSharedLibrary(target)
      : await loadSharedLibrary(target);
    if (
      library &&
      messageOwner.current === target &&
      request === libraryRequest.current &&
      dataRef.current &&
      !pending.current &&
      !blocked.current
    ) {
      const current = dataRef.current;
      if (
        JSON.stringify(current.exercises) !== JSON.stringify(library.exercises)
      ) {
        const next = { ...current, exercises: library.exercises };
        dataRef.current = next;
        setData(next);
      }
      setTechniqueVideos((old) =>
        JSON.stringify(old) === JSON.stringify(library.techniqueVideos)
          ? old
          : library.techniqueVideos,
      );
    }
    return library;
  };
  useEffect(() => {
    if (!sharedLibraryReady) return;
    let active = true;
    const refresh = () => {
      if (
        !active ||
        document.visibilityState === "hidden" ||
        pending.current ||
        blocked.current
      )
        return;
      void refreshLibrary(owner).catch((error) => {
        if (active)
          setError(
            `Could not refresh the shared exercise library: ${error.message}`,
          );
      });
    };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      libraryRequest.current++;
    };
  }, [owner, demo, sharedLibraryReady]);
  const saveTechnique = async (exerciseId: string, url: string) => {
    if (!coach || !techniqueVideosReady)
      throw new Error("Coach access required");
    await queue.current;
    if (blocked.current)
      throw new Error("Finish syncing training changes before saving a video.");
    if (demo) saveLocalSharedVideo(owner, exerciseId, url);
    else await saveTechniqueVideo(owner, exerciseId, url);
    if (sharedLibraryReady) {
      await refreshLibrary(owner);
      return;
    }
    if (messageOwner.current === owner)
      setTechniqueVideos((old) => {
        const next = { ...old };
        if (url) next[exerciseId] = url;
        else delete next[exerciseId];
        return next;
      });
  };
  const change = (next: AppData) => {
    rememberLanguage(next.settings.language ?? "en", owner);
    if (next.settings.useABSplit)
      next = { ...next, sessions: assignTrainingWeeks(next.sessions) };
    dataRef.current = next;
    setData(next);
    setPeopleStats({});
    if (demo) {
      try {
        localStorage.setItem(`liftlog-v1-${owner}`, JSON.stringify(next));
        syncLocalReviewEvents(localStorage, owner, next.sessions);
        void refreshReviews();
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
        if (!pending.current && !blocked.current) {
          setSaveState("saved");
          if (sharedLibraryReady)
            void refreshLibrary(target).catch((error) =>
              setError(
                `Could not refresh the shared exercise library: ${error.message}`,
              ),
            );
        }
      });
  };
  const saveSession = (s: Session) => {
    const d = dataRef.current!;
    const previous = d.sessions.find((session) => session.id === s.id);
    if (s.status === "done" && previous?.status !== "done")
      setCompletion({ sessionId: s.id, name: s.name, owner });
    else if (s.status !== "done" && completion?.sessionId === s.id)
      setCompletion(null);
    change({ ...d, sessions: [...d.sessions.filter((x) => x.id !== s.id), s] });
  };
  const addCustom = async (name: string) => {
    const target = owner;
    const d = dataRef.current!;
    const existing = d.exercises.find(
      (exercise) => exerciseNameKey(exercise.name) === exerciseNameKey(name),
    );
    if (existing) return existing.id;
    const eid = id();
    if (!demo && sharedLibraryReady) {
      const result = await addSharedExercise(target, name, eid);
      await refreshLibrary(target);
      return result;
    }
    if (demo) setLocalLibraryArchive(name, false);
    change({
      ...d,
      exercises: [...d.exercises, { id: eid, name, custom: true }],
    });
    return eid;
  };
  const removeLibraryExercise = async (exercise: Exercise) => {
    if (sharedLibraryReady) {
      if (!coach)
        throw new Error("Only your coach can remove shared exercises.");
      if (demo) setLocalLibraryArchive(exercise.name, true);
      else await archiveSharedExercise(owner, exercise.id);
      await refreshLibrary(owner);
    } else {
      const d = dataRef.current!;
      change({
        ...d,
        exercises: d.exercises.filter((old) => old.id !== exercise.id),
      });
    }
  };
  const switchOwner = (next: string) => {
    if (pending.current || blocked.current) {
      setError(
        "Finish saving or export and reload your unsaved changes before switching athletes.",
      );
      return;
    }
    setOwner(next);
    setSearch("");
    setDuplicate(null);
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
  const language = data?.settings.language ?? readLanguage();
  setAppLanguage(language);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `${messages.appName} · ${t("train together")}`;
  }, [language, messages.appName]);
  const today = dateKey();
  const thisMonday = monday(today);
  const todaySessions = data?.sessions.filter((s) => s.date === today) || [];
  const upcoming =
    data?.sessions
      .filter((s) => s.status === "planned" && s.date > today)
      .sort((a, b) => a.date.localeCompare(b.date)) || [];
  const recent =
    data?.sessions
      .filter((s) => s.status === "done")
      .sort((a, b) => b.date.localeCompare(a.date)) || [];
  if (!authReady) return <div className="loading">{t("Opening LiftLog…")}</div>;
  if (!demo && !authId) return <Auth onDemo={() => setDemo(true)} />;
  return (
    <div className="app-shell">
      {menu && (
        <button
          type="button"
          className="nav-backdrop"
          aria-label={t("Close navigation")}
          onClick={() => setMenu(false)}
        />
      )}
      <aside id="main-navigation" className={`sidebar ${menu ? "open" : ""}`}>
        <Logo name={messages.appName} />
        <nav>
          {pages
            .filter((p) => (p.name !== "People" && p.name !== "Inbox") || coach)
            .map((p) => (
              <button
                key={t(p.name)}
                className={page === p.name ? "active" : ""}
                onClick={() => {
                  setPage(p.name);
                  setMenu(false);
                  setSearch("");
                }}
              >
                <p.icon size={21} />
                <span>
                  {t(
                    p.name === "Calendar"
                      ? "Planner"
                      : p.name === "Training"
                        ? "Library"
                        : p.name,
                  )}
                </span>
              </button>
            ))}
        </nav>
        <div className="sidebar-cheer-scene">
          <img
            className="sidebar-cat"
            src={illustrationSource(illustrations.menu, catBack)}
            style={illustrationVariables(illustrations.menu) as CSSProperties}
            width={512}
            height={512}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
          <div className="sidebar-cheer">
            <span>✦</span>
            <strong className="personal-message">
              {messages.sidebar === DEFAULT_MESSAGES.sidebar
                ? t(messages.sidebar)
                : messages.sidebar}
            </strong>
            <small>{t("One rep at a time.")}</small>
          </div>
        </div>
        <div className="sidebar-foot">
          {t("Made for showing up ")}
          <span>↗</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label={t(menu ? "Close navigation" : "Open navigation")}
            aria-expanded={menu}
            aria-controls="main-navigation"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <div className="mobile-logo">
            <Logo name={messages.appName} />
          </div>
          <div className="search-field">
            <Search size={18} />
            <input
              aria-label={t("Search sessions and exercises")}
              placeholder={t("Find a session or exercise…")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value.trim()) setPage("Search");
              }}
            />
          </div>
          <button
            className="icon-button mobile-search-button"
            aria-label={t("Open search")}
            onClick={() => setPage("Search")}
          >
            <Search size={20} />
          </button>
          <div className="topbar-right">
            <span className={`save-status ${saveState}`} aria-live="polite">
              {demo ? <FlaskConical size={14} /> : <Cloud size={14} />}{" "}
              {demo
                ? t("Local demo")
                : saveState === "saving"
                  ? t("Saving…")
                  : saveState === "error"
                    ? t("Unsaved changes")
                    : t("All saved")}
            </span>
            {coach && (
              <button
                className="icon-button inbox-bell"
                aria-label={`${t("Inbox")} · ${unreadReviews} ${t("unread")}`}
                onClick={() => {
                  setPage("Inbox");
                  setMenu(false);
                  setSearch("");
                }}
              >
                <Bell size={20} />
                {unreadReviews > 0 && (
                  <span className="inbox-count">
                    {unreadReviews > 99 ? "99+" : unreadReviews}
                  </span>
                )}
              </button>
            )}
            {coach && page !== "Inbox" && (
              <select
                className="athlete-select"
                aria-label={t("Switch athlete")}
                value={owner}
                onChange={(e) => switchOwner(e.target.value)}
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.id === (demo ? "demo-self" : authId)
                      ? ` · ${t("You")}`
                      : ""}
                    {p.active ? "" : ` · ${t("inactive")}`}
                  </option>
                ))}
              </select>
            )}
            <span className="avatar">{viewing?.name.slice(0, 1) || "A"}</span>
            {!demo && (
              <button
                className="icon-button"
                aria-label={t("Sign out")}
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
                <FlaskConical size={15} />
                {t(" Demo mode · profiles and workouts stay in this browser")}
              </span>
              {supabase ? (
                <button
                  onClick={() => {
                    if (saveState === "saved") setDemo(false);
                  }}
                >
                  {t("Use real account →")}
                </button>
              ) : (
                <a
                  href="https://github.com/aminzhanov/gymtracker#connect-real-accounts"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("Connect accounts →")}
                </a>
              )}
            </div>
          )}
          {coach &&
            page !== "Inbox" &&
            owner !== (demo ? "demo-self" : authId) && (
              <div className="viewing-banner">
                <ShieldCheck size={17} />
                <strong>
                  {t("Viewing ")}
                  {viewing?.name}
                  {t("'s training")}
                </strong>
                <span>{t("You are editing as their coach.")}</span>
              </div>
            )}
          {error && (
            <div className="error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{t(error)}</span>
              {data && (
                <button onClick={() => exportData(data)}>{t("Export")}</button>
              )}
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
                {t("Reload")}
              </button>
            </div>
          )}
          {loading || !data ? (
            <div className="loading">
              {error
                ? t("Resolve the loading error above to continue.")
                : t("Loading your training…")}
            </div>
          ) : (
            <>
              {page === "Inbox" && coach && (
                <CoachInbox
                  items={reviewItems}
                  illustration={illustrations.inboxEmpty}
                  ready={inboxReady}
                  loading={inboxLoading}
                  error={inboxError}
                  onRefresh={refreshReviews}
                  onSetReview={setReview}
                />
              )}
              {page === "Dashboard" && (
                <>
                  <DashboardOverview
                    key={owner}
                    data={data}
                    message={messages.dashboard}
                    illustration={illustrations.dashboard}
                    onSession={setEditor}
                  />
                  <div className="dashboard-grid">
                    <Panel
                      title={t("Today's workout")}
                      className="today-panel"
                      action={
                        <button
                          className="text-button"
                          onClick={() => setCreateDate(today)}
                        >
                          <Plus size={15} />
                          {t(" Plan")}
                        </button>
                      }
                    >
                      {todaySessions.length ? (
                        todaySessions.map((s) =>
                          s.status === "done" ? (
                            <CompletedWorkout
                              key={s.id}
                              session={s}
                              showWeek={data.settings.useABSplit}
                              saveState={saveState}
                              celebrate={
                                completion?.owner === owner &&
                                completion.sessionId === s.id
                              }
                              onEdit={() => setEditor(s)}
                            />
                          ) : (
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
                                    {data.settings.useABSplit && (
                                      <>
                                        <WeekBadge week={s.week} /> ·{" "}
                                      </>
                                    )}
                                    {t(s.status)}
                                  </span>
                                </div>
                                <ArrowRight size={18} />
                              </button>
                              {s.exercises.map((exercise) => (
                                <WorkoutExerciseCard
                                  key={exercise.id}
                                  exercise={exercise}
                                  library={data.exercises}
                                  onCustom={addCustom}
                                  session={s}
                                  sessions={data.sessions}
                                  isTemplate={false}
                                  canSave={Boolean(s.name.trim())}
                                  techniqueUrl={
                                    techniqueVideos[exercise.exerciseId]
                                  }
                                  techniqueReady={techniqueVideosReady}
                                  onSaveTechnique={
                                    coach
                                      ? (url) =>
                                          saveTechnique(
                                            exercise.exerciseId,
                                            url,
                                          )
                                      : undefined
                                  }
                                  onChange={(updated) =>
                                    saveSession(
                                      updateSessionExercise(s, updated),
                                    )
                                  }
                                  onSave={() => {}}
                                />
                              ))}
                              {!s.exercises.length && (
                                <p className="muted">
                                  {t("Open the session to add your exercises.")}
                                </p>
                              )}
                              <div className="today-actions">
                                <button
                                  className="button secondary"
                                  onClick={() => setEditor(s)}
                                >
                                  {t("Open editor")}
                                </button>
                                <button
                                  className="button primary"
                                  onClick={() =>
                                    saveSession(completeSession(s))
                                  }
                                >
                                  <Check size={16} />
                                  {t(" Complete session")}
                                </button>
                              </div>
                            </div>
                          ),
                        )
                      ) : (
                        <TodayEmpty
                          illustration={illustrations.todayEmpty}
                          onPlan={() => setCreateDate(today)}
                        />
                      )}
                    </Panel>
                    <div className="dashboard-side">
                      <Panel
                        title={t("Coming up")}
                        action={
                          <button
                            className="text-button"
                            onClick={() => setPage("Calendar")}
                          >
                            {t("Planner ")}
                            <ArrowRight size={15} />
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
                                showWeek={data.settings.useABSplit}
                                onOpen={setEditor}
                              />
                            ))
                        ) : (
                          <Empty
                            title={t("Room for your next goal")}
                            detail={t("Plan your next training day.")}
                          />
                        )}
                      </Panel>
                      <Panel
                        title={t("Recently completed")}
                        action={
                          <button
                            className="text-button"
                            onClick={() => setPage("Training")}
                          >
                            {t("View all ")}
                            <ArrowRight size={15} />
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
                                showWeek={data.settings.useABSplit}
                                onOpen={setEditor}
                              />
                            ))
                        ) : (
                          <Empty
                            title={t("Your history starts here")}
                            detail={t("Complete your first session.")}
                          />
                        )}
                      </Panel>
                      <div className="cheer-card">
                        <div>
                          <strong>{t("Keep showing up!")}</strong>
                          <p>{t("Every rep is a little vote for you.")}</p>
                        </div>
                        <span>☻</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {page === "Search" && (
                <SearchResults
                  key={`${demo ? "demo" : authId}:${owner}`}
                  data={data}
                  query={search}
                  onQuery={setSearch}
                  onSave={saveSession}
                  onOpen={setEditor}
                  onDuplicate={setDuplicate}
                />
              )}
              {page === "Training" && (
                <Training
                  key={owner}
                  data={data}
                  search={search}
                  onChange={change}
                  onOpen={setEditor}
                  onDuplicate={setDuplicate}
                  onCreate={() => setCreateDate(today)}
                  onTemplateEdit={setTemplateEditor}
                  onUseTemplate={(t) => setEditor(newSession(data, today, t))}
                  library={
                    <ExerciseLibrary
                      data={data}
                      onAdd={addCustom}
                      onRemove={removeLibraryExercise}
                      sharedReady={sharedLibraryReady}
                      canRemove={coach || !sharedLibraryReady}
                      techniqueVideos={techniqueVideos}
                      techniqueReady={techniqueVideosReady}
                      onSaveTechnique={coach ? saveTechnique : undefined}
                    />
                  }
                />
              )}
              {page === "Calendar" && (
                <Calendar
                  illustration={illustrations.planner}
                  key={`${demo ? "demo" : authId}:${owner}`}
                  onSave={saveSession}
                  onDuplicate={setDuplicate}
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
                <Analytics
                  illustration={illustrations.analytics}
                  key={`${demo ? "demo" : authId}:${owner}`}
                  preferenceKey={`${demo ? "demo" : authId}:${owner}`}
                  onSession={setEditor}
                  data={data}
                  onChange={change}
                />
              )}
              {page === "People" && coach && (
                <>
                  <div className="page-head">
                    <div>
                      <span className="eyebrow">{t("STRONGER TOGETHER")}</span>
                      <h1>
                        {t("Your training library crew ")}
                        <span>✦</span>
                      </h1>
                      <p>
                        {t("Plan their sessions. Celebrate their progress.")}
                      </p>
                    </div>
                    <button
                      className="button primary"
                      onClick={() => setInvite(true)}
                    >
                      <Plus size={17} />
                      {t(" Invite athlete")}
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
                              {p.role === "coach" && (
                                <span className="badge tint-sky">
                                  {t("Coach")}
                                </span>
                              )}
                              {d?.settings.useABSplit && (
                                <WeekBadge week={currentWeek(d)} />
                              )}
                              <span
                                className={`badge ${p.active ? "tint-mint" : "tint-pink"}`}
                              >
                                {p.active ? t("Active") : t("Inactive")}
                              </span>
                            </div>
                            {p.coachName && (
                              <p className="muted">
                                {t("Coach:")} {p.coachName}
                              </p>
                            )}
                            <p>
                              {d
                                ? t(
                                    `${wk.filter((s) => s.status === "done").length} completed this week · ${number(wk.reduce((n, s) => n + volume(s), 0))} kg`,
                                  )
                                : t("Loading training summary…")}
                            </p>
                            <p className="muted">
                              {t("Next:")}{" "}
                              {next
                                ? t(`${next.name} · ${shortDate(next.date)}`)
                                : t("Nothing planned yet")}
                            </p>
                            <p className="muted">
                              {t("Last:")}{" "}
                              {completed
                                ? t(
                                    `${completed.name} · ${shortDate(completed.date)}`,
                                  )
                                : t("No completed session")}
                            </p>
                            <button
                              className="button primary full"
                              onClick={() => switchOwner(p.id)}
                            >
                              {t("Open training")} <ArrowRight size={16} />
                            </button>
                            {!demo &&
                              p.role === "athlete" &&
                              (p.coachId === undefined ||
                                p.coachId === authId) && (
                                <button
                                  className="text-button"
                                  onClick={async () => {
                                    const { error } = await supabase!.rpc(
                                      "set_athlete_active",
                                      {
                                        athlete_id: p.id,
                                        is_active: !p.active,
                                      },
                                    );
                                    if (error) setError(error.message);
                                    else setProfiles(await loadProfiles());
                                  }}
                                >
                                  {p.active
                                    ? t("Deactivate access")
                                    : t("Reactivate access")}
                                </button>
                              )}
                          </Panel>
                        );
                      })}
                  </div>
                  {profiles.length <= 1 && (
                    <Empty
                      title={t("Build your crew")}
                      detail={t(
                        "Invite your first athlete to plan training together.",
                      )}
                    />
                  )}
                </>
              )}
              {page === "Settings" && (
                <>
                  <div className="page-head">
                    <div>
                      <span className="eyebrow">
                        {t("YOUR DATA, YOUR JOURNEY")}
                      </span>
                      <h1>
                        {t("Make it yours ")}
                        <span>✦</span>
                      </h1>
                      <p>{t("Training preferences and backups.")}</p>
                    </div>
                  </div>
                  {coach && (
                    <Panel
                      title={t(
                        `Personal app for ${viewing?.name || data.settings.name}`,
                      )}
                    >
                      <p className="muted">
                        {t(
                          "Choose an athlete at the top to personalize their app name, dashboard and menu.",
                        )}
                      </p>
                      <CoachMessageEditor
                        key={owner}
                        messages={messages}
                        ready={messagesReady}
                        appNameReady={appNameReady}
                        onSave={async (next) => {
                          if (demo)
                            localStorage.setItem(
                              `liftlog-messages-${owner}`,
                              JSON.stringify(next),
                            );
                          else
                            await saveCoachMessages(owner, next, appNameReady);
                          if (messageOwner.current === owner) setMessages(next);
                        }}
                      />
                      <IllustrationEditor
                        key={`illustrations-${owner}`}
                        value={illustrations}
                        ready={illustrationsReady}
                        sectionsReady={illustrationSectionsReady}
                        messages={messages}
                        data={data}
                        onSave={async (next) => {
                          if (demo)
                            localStorage.setItem(
                              `liftlog-illustrations-${owner}`,
                              JSON.stringify(next),
                            );
                          else
                            await saveProfileIllustrations(
                              owner,
                              next,
                              illustrationSectionsReady,
                            );
                          if (messageOwner.current === owner)
                            setIllustrations(next);
                        }}
                      />
                    </Panel>
                  )}
                  <div className="two-col">
                    <Panel title={t("Program & workload")}>
                      <label>
                        {t("Language")}
                        <select
                          aria-label={t("Language")}
                          value={data.settings.language || "en"}
                          onChange={(e) => {
                            const nextLanguage = e.target.value as Language;
                            rememberLanguage(nextLanguage, owner);
                            change({
                              ...data,
                              settings: {
                                ...data.settings,
                                language: nextLanguage,
                              },
                            });
                          }}
                        >
                          <option value="en">{t("English")}</option>
                          <option value="ru">{t("Русский")}</option>
                        </select>
                      </label>
                      <p className="footnote">
                        {t(
                          demo
                            ? "Language is saved separately for each demo athlete on this device."
                            : languageReady
                              ? "Language is synced with this athlete's account."
                              : "Language is saved on this device until the account language update is applied.",
                        )}
                      </p>
                      <label>
                        {t("Display name")}
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
                      <label className="program-switch">
                        <span>
                          <strong>{t("Use A/B split")}</strong>
                          <small>
                            {t("Alternate between Week A and Week B.")}
                          </small>
                        </span>
                        <input
                          type="checkbox"
                          role="switch"
                          aria-label={t("Use A/B split")}
                          checked={data.settings.useABSplit}
                          disabled={!programPreferenceReady}
                          onChange={(event) =>
                            change({
                              ...data,
                              settings: {
                                ...data.settings,
                                useABSplit: event.target.checked,
                              },
                            })
                          }
                        />
                      </label>
                      {!programPreferenceReady && (
                        <p className="footnote">
                          {t(
                            "This preference needs an account settings update before it can be changed.",
                          )}
                        </p>
                      )}
                      {!data.settings.useABSplit && (
                        <p className="muted">
                          {t(
                            "Plan freely, with all sessions in one program. Your existing workouts are kept.",
                          )}
                        </p>
                      )}
                      {data.settings.useABSplit && (
                        <>
                          <DateField
                            label={t("Week A/B anchor date")}
                            value={data.settings.anchorDate}
                            onChange={(anchorDate) =>
                              change({
                                ...data,
                                settings: { ...data.settings, anchorDate },
                              })
                            }
                          />
                          <label>
                            {t("Anchor program week")}
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
                            {t(
                              "Your dashboard alternates A/B from this date's Monday. Existing sessions retain their assigned week.",
                            )}
                          </p>
                        </>
                      )}
                      <label>
                        {t("Workload spike threshold (%)")}
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
                        {t(
                          "Flag weekly volume increases above this threshold. Default: 30%.",
                        )}
                      </p>
                    </Panel>
                    <Panel title={t("Data & backups")}>
                      <div className="data-actions">
                        <button onClick={() => exportData(data)}>
                          <span className="data-icon tint-mint">
                            <Download size={20} />
                          </span>
                          <span>
                            <strong>{t("Export all data")}</strong>
                            <small>
                              {t(
                                "Sessions, templates, exercises, bodyweight & settings",
                              )}
                            </small>
                          </span>
                          <ArrowRight size={17} />
                        </button>
                        <button onClick={() => fileRef.current?.click()}>
                          <span className="data-icon tint-blue">
                            <Upload size={20} />
                          </span>
                          <span>
                            <strong>{t("Import JSON backup")}</strong>
                            <small>
                              {t("Restore everything for ")}
                              {viewing?.name}
                            </small>
                          </span>
                          <ArrowRight size={17} />
                        </button>
                        <button onClick={() => setConfirm("demo")}>
                          <span className="data-icon tint-yellow">
                            <FlaskConical size={20} />
                          </span>
                          <span>
                            <strong>{t("Load demo data")}</strong>
                            <small>
                              {t("Eight weeks of A/B workouts & progress")}
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
                              {t("Clear all training data")}
                            </strong>
                            <small>
                              {t("Only the selected athlete's data")}
                            </small>
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
                  <Panel title={t("Account")}>
                    <p>
                      {demo
                        ? t(
                            "You are using a local demo. These are simulated profiles; no invitations are sent.",
                          )
                        : t(`Signed in as ${me?.name}. Role: ${me?.role}.`)}
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
                        <LogOut size={16} />{" "}
                        {demo ? t("Leave demo") : t("Sign out")}
                      </button>
                    )}
                    {!supabase && (
                      <p className="muted">
                        {t(
                          "See the repository README to connect Supabase for real accounts.",
                        )}
                      </p>
                    )}
                  </Panel>
                </>
              )}
            </>
          )}
        </main>
        {completion?.owner === owner &&
          data?.sessions.some(
            (session) =>
              session.id === completion.sessionId && session.status === "done",
          ) && (
            <CompletionToast
              name={completion.name}
              saveState={saveState}
              onDismiss={() => setCompletion(null)}
            />
          )}
        <nav className="bottom-nav">
          {pages
            .filter(
              (p) =>
                p.name !== "People" &&
                p.name !== "Settings" &&
                p.name !== "Inbox",
            )
            .map((p) => (
              <button
                key={t(p.name)}
                className={page === p.name ? "active" : ""}
                onClick={() => {
                  setPage(p.name);
                  setMenu(false);
                  setSearch("");
                }}
              >
                <p.icon size={20} />
                <span>
                  {t(
                    p.name === "Calendar"
                      ? "Planner"
                      : p.name === "Training"
                        ? "Library"
                        : p.name,
                  )}
                </span>
              </button>
            ))}
          <button
            className={page === "Settings" || page === "People" ? "active" : ""}
            onClick={() => setMenu(!menu)}
          >
            <Menu size={20} />
            <span>{t("More")}</span>
          </button>
        </nav>
      </div>
      {editor && data && (
        <SessionEditor
          key={editor.id}
          initial={editor}
          trainingWeeksReady={trainingWeeksReady}
          data={data}
          onSave={saveSession}
          techniqueVideos={techniqueVideos}
          techniqueReady={techniqueVideosReady}
          onSaveTechnique={coach ? saveTechnique : undefined}
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
          techniqueVideos={techniqueVideos}
          techniqueReady={techniqueVideosReady}
          onSaveTechnique={coach ? saveTechnique : undefined}
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
      {duplicate && data && (
        <DuplicateSession
          key={duplicate.id}
          source={duplicate}
          data={data}
          onClose={() => setDuplicate(null)}
          onCreate={(copy) => {
            saveSession(copy);
            setDuplicate(null);
            setEditor(copy);
          }}
        />
      )}
      {createDate && data && (
        <Modal title={t("Plan a session")} onClose={() => setCreateDate(null)}>
          <label>
            {t("Date")}
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
            <Plus size={17} />
            {t(" Start a blank session")}
          </button>
          {data.templates.length > 0 && (
            <>
              <h3>{t("Or use a template")}</h3>
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
                  {data.settings.useABSplit && <WeekBadge week={t.week} />}
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
              ? t("Clear training data?")
              : confirm === "import"
                ? t("Restore this backup?")
                : t("Load demo data?")
          }
          onClose={() => setConfirm(null)}
        >
          <p>
            {t("This replaces all training data for ")}
            <strong>{viewing?.name}</strong>
            {t(". Other athletes are unaffected.")}
          </p>
          <p className="muted">
            {t("Export a backup first if you want to keep the current data.")}
          </p>
          <div className="flex">
            <button
              className="button secondary"
              onClick={() => exportData(data)}
            >
              <Download size={16} />
              {t(" Export first")}
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
              {t("Replace data")}
            </button>
          </div>
        </Modal>
      )}
      {invite && (
        <Modal title={t("Invite an athlete")} onClose={() => setInvite(false)}>
          {demo ? (
            <>
              <p>
                {t(
                  "Invitations need a connected Supabase project and your Coach account. Demo profiles are browser-only simulations.",
                )}
              </p>
              <a
                className="button primary"
                href="https://github.com/aminzhanov/gymtracker#connect-real-accounts"
                target="_blank"
                rel="noreferrer"
              >
                {t("Open setup instructions ")}
                <ArrowRight size={16} />
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
                {t("Name")}
                <input
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  maxLength={100}
                />
              </label>
              <label>
                {t("Email")}
                <input
                  required
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </label>
              <p className="muted">
                {t("They'll receive a secure link to set their password.")}
              </p>
              <button className="button primary full" disabled={inviteBusy}>
                {inviteBusy ? t("Sending…") : t("Send invitation")}
              </button>
            </form>
          )}
        </Modal>
      )}
      {passwordMode && supabase && (
        <Modal
          title={t("Set your password")}
          onClose={() => setPasswordMode(false)}
        >
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
              {t("New password")}
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <button className="button primary full">
              {t("Save password")}
            </button>
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
  onDuplicate,
  onCreate,
  onTemplateEdit,
  onUseTemplate,
  library,
}: {
  data: AppData;
  search: string;
  onChange: (d: AppData) => void;
  onOpen: (s: Session) => void;
  onDuplicate: (s: Session) => void;
  onCreate: () => void;
  onTemplateEdit: (t: Template) => void;
  onUseTemplate: (t: Template) => void;
  library: ReactNode;
}) {
  const [tab, setTab] = useState<"sessions" | "templates" | "library">(
    "sessions",
  );
  const [filter, setFilter] = useState("all");
  const [scope, setScope] = useState<TrainingScope>(search ? "all" : "current");
  const [selectedMonth, setSelectedMonth] = useState("all");
  const currentMonth = dateKey().slice(0, 7);
  const availableMonths = trainingMonths(data.sessions).filter(
    (month) => scope !== "past" || month < currentMonth,
  );
  const monthFilter = availableMonths.includes(selectedMonth)
    ? selectedMonth
    : "all";
  const groups = trainingGroups(
    data.sessions,
    scope,
    monthFilter,
    filter,
    search,
  );
  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{t("SHOW UP. LIFT. REPEAT.")}</span>
          <h1>
            {t("Your library ")}
            <span>✦</span>
          </h1>
          <p>{t("A place for every session and every small win.")}</p>
        </div>
        <button className="button primary" onClick={onCreate}>
          <Plus size={17} />
          {t(" Create session")}
        </button>
      </div>
      <div className="training-toolbar">
        <div className="segmented">
          <button
            aria-pressed={tab === "sessions"}
            className={tab === "sessions" ? "active" : ""}
            onClick={() => setTab("sessions")}
          >
            {t("Sessions")}
          </button>
          <button
            aria-pressed={tab === "templates"}
            className={tab === "templates" ? "active" : ""}
            onClick={() => setTab("templates")}
          >
            {t("Templates")}
          </button>
          <button
            aria-pressed={tab === "library"}
            className={tab === "library" ? "active" : ""}
            onClick={() => setTab("library")}
          >
            {t("Exercise library")}
          </button>
        </div>
        {tab === "sessions" && (
          <select
            aria-label={t("Session status filter")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{t("All sessions")}</option>
            <option value="planned">{t("Planned")}</option>
            <option value="done">{t("Completed")}</option>
          </select>
        )}
      </div>
      {tab === "sessions" && (
        <div className="training-period-toolbar">
          <div className="segmented" aria-label={t("Training history period")}>
            {(
              [
                ["current", t("This month")],
                ["past", t("Past months")],
                ["all", t("All history")],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={scope === value}
                className={scope === value ? "active" : ""}
                onClick={() => {
                  setScope(value);
                  setSelectedMonth("all");
                }}
              >
                {t(label)}
              </button>
            ))}
          </div>
          {scope !== "current" && (
            <label className="training-month-filter">
              {t("Month")}
              <select
                aria-label={t("Training month filter")}
                value={monthFilter}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="all">
                  {scope === "past" ? t("All past months") : t("All months")}
                </option>
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {monthLabel(month)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
      {tab === "sessions" ? (
        groups.length ? (
          <div className="training-months">
            {groups.map((group) => (
              <section
                key={group.month}
                className="training-month-group"
                aria-label={monthLabel(group.month)}
              >
                <div className="training-month-heading">
                  <h2>{monthLabel(group.month)}</h2>
                  <span>
                    {group.sessions.length}{" "}
                    {t(group.sessions.length === 1 ? "session" : "sessions")}
                  </span>
                </div>
                <div className="training-week-groups">
                  {librarySessionWeeks(
                    data.sessions,
                    group.sessions,
                    group.month,
                    data.settings.useABSplit,
                  ).map((week) => (
                    <section
                      className="training-week-group"
                      key={week.key}
                      aria-label={t(week.label)}
                    >
                      <div className="training-week-heading">
                        <h3>
                          <span
                            className={`training-week-label ${week.week ? `training-week-${week.week.toLowerCase()}` : ""}`}
                          >
                            {t(week.label)}
                          </span>
                          <small>
                            {shortDate(week.from)}
                            {week.to !== week.from &&
                              ` – ${shortDate(week.to)}`}
                          </small>
                        </h3>
                        <span>
                          {week.sessions.length}{" "}
                          {t(
                            week.sessions.length === 1 ? "session" : "sessions",
                          )}
                        </span>
                      </div>
                      <div className="training-list">
                        {week.sessions.map((s) => (
                          <SessionCard
                            key={s.id}
                            session={s}
                            showWeek={data.settings.useABSplit}
                            onOpen={onOpen}
                            onDuplicate={onDuplicate}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <Panel title={t("Sessions")}>
            <Empty
              title={
                search
                  ? t("No matching sessions")
                  : data.sessions.length
                    ? t("No sessions in this view")
                    : t("Your next chapter starts here")
              }
              detail={
                search
                  ? t(
                      "Try another session name or switch the month or history period.",
                    )
                  : data.sessions.length
                    ? t(
                        "Choose another month, All history, or a different status filter. You can also plan a new session.",
                      )
                    : t("Create a session or load demo data from Settings.")
              }
              action={
                <button className="button primary" onClick={onCreate}>
                  <Plus size={16} />
                  {t(" Create session")}
                </button>
              }
            />
          </Panel>
        )
      ) : tab === "library" ? (
        library
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
              <Plus size={16} />
              {t(" Create template")}
            </button>
          </div>
          {data.templates.length ? (
            <div className="template-grid">
              {data.templates.map((template) => (
                <Panel
                  key={template.id}
                  title={t(`${template.icon} ${template.name}`)}
                  action={
                    data.settings.useABSplit ? (
                      <WeekBadge week={template.week} />
                    ) : undefined
                  }
                >
                  <p className="muted">
                    {
                      template.exercises.filter((e) => e.kind === "strength")
                        .length
                    }{" "}
                    {t("exercises ·")}{" "}
                    {template.exercises
                      .filter((e) => e.kind === "strength")
                      .reduce((n, e) => n + e.sets.length, 0)}{" "}
                    {t("sets")}
                  </p>
                  <p>{template.notes || "Ready for your next session."}</p>
                  <div className="flex">
                    <button
                      className="button primary"
                      onClick={() => onUseTemplate(template)}
                    >
                      {t("Start session ")}
                      <ArrowRight size={16} />
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => onTemplateEdit(template)}
                    >
                      {t("Edit")}
                    </button>
                  </div>
                </Panel>
              ))}
            </div>
          ) : (
            <Empty
              title={t("Your routine, ready to repeat")}
              detail={t("Create a template or save one from any session.")}
            />
          )}
        </>
      )}
    </>
  );
}
function ExerciseLibrary({
  data,
  onAdd,
  onRemove,
  sharedReady,
  canRemove,
  techniqueVideos,
  techniqueReady,
  onSaveTechnique,
}: {
  data: AppData;
  onAdd: (name: string) => Promise<string>;
  onRemove: (exercise: Exercise) => Promise<void>;
  sharedReady: boolean;
  canRemove: boolean;
  techniqueVideos: TechniqueVideos;
  techniqueReady: boolean;
  onSaveTechnique?: (exerciseId: string, url: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);
  const [videoExercise, setVideoExercise] = useState<Exercise | null>(null);
  return (
    <Panel title={t("Exercise library")}>
      <p className="library-sharing-note">
        {sharedReady
          ? t(
              "Shared with your coach and their athletes. Everyone can add exercises; your coach manages videos and removes exercises.",
            )
          : t(
              "Shared exercises will be available after your coach enables the library update. Your current library still works.",
            )}
      </p>
      <form
        className="flex"
        onSubmit={async (e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n || busy) return;
          setBusy(true);
          setFeedback("");
          setFailed(false);
          try {
            await onAdd(n);
            setName("");
            setFeedback("Exercise added to the library.");
          } catch (error) {
            setFailed(true);
            setFeedback((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          className="grow"
          placeholder={t("Add your own exercise…")}
          aria-label={t("Custom exercise name")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          disabled={busy}
        />
        <button className="button primary" disabled={!name.trim() || busy}>
          <Plus size={16} /> {busy ? t("Saving…") : t("Add")}
        </button>
      </form>
      {feedback && (
        <p
          role={failed ? "alert" : "status"}
          className={failed ? "danger-text" : "positive"}
        >
          {feedback}
        </p>
      )}
      <div className="library-grid">
        {data.exercises.map((e) => (
          <div className="library-item" key={e.id}>
            <span className="grow">{exerciseName(e.name, e.id)}</span>
            {(onSaveTechnique || techniqueVideos[e.id]) && (
              <button
                type="button"
                className="text-button library-video-button"
                aria-label={t(
                  `${onSaveTechnique ? "Manage" : "Watch"} technique for ${e.name}`,
                )}
                onClick={() => setVideoExercise(e)}
              >
                {onSaveTechnique
                  ? techniqueVideos[e.id]
                    ? t("Edit video")
                    : t("Add video")
                  : t("Watch technique")}
              </button>
            )}
            {e.custom && canRemove ? (
              <button
                className="icon-button"
                aria-label={t(`Delete custom exercise ${e.name}`)}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setFailed(false);
                  setFeedback("");
                  try {
                    await onRemove(e);
                    setFeedback(
                      "Exercise removed. Logged history is preserved.",
                    );
                  } catch (error) {
                    setFailed(true);
                    setFeedback((error as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Trash2 size={15} />
              </button>
            ) : (
              <small>{e.custom ? t("Shared") : t("Built-in")}</small>
            )}
          </div>
        ))}
      </div>
      <p className="footnote">
        {t("Removing a custom exercise preserves its logged history.")}{" "}
        {sharedReady &&
          "It removes the entry for the coach’s group. Your coach can re-add the same name to restore it."}
      </p>
      {videoExercise && (
        <Modal
          title={t(`Technique · ${videoExercise.name}`)}
          onClose={() => setVideoExercise(null)}
        >
          {onSaveTechnique && (
            <TechniqueVideoEditor
              name={videoExercise.name}
              url={techniqueVideos[videoExercise.id]}
              ready={techniqueReady}
              onSave={(url) => onSaveTechnique(videoExercise.id, url)}
            />
          )}
          <TechniqueVideo
            name={videoExercise.name}
            url={techniqueVideos[videoExercise.id]}
          />
        </Modal>
      )}
    </Panel>
  );
}
