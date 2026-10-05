import { t, exerciseName } from "./i18n";
import { bodyweightDomain, chartLabelIndices } from "./chartDomain";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Minus,
  Check,
  ArrowRight,
  Dumbbell,
  Sparkles,
  Info,
  CalendarDays,
  Copy,
} from "lucide-react";
import type { Session, WorkoutExercise, LiftSet } from "./types";
import {
  number,
  volume,
  doneSets,
  shortDate,
  lastPerformance,
  chartLinePath,
  fullDate,
} from "./model";
export function InfoButton({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="metric-info"
        aria-label={t(`About ${title}`)}
        onClick={() => setOpen(true)}
      >
        <Info size={17} />
      </button>
      {open && (
        <Modal title={t(`About ${title}`)} onClose={() => setOpen(false)}>
          <div className="metric-explanation">{children}</div>
        </Modal>
      )}
    </>
  );
}
export function DateField({
  label,
  value,
  onChange,
  hideLabel = false,
}: {
  label: string;
  hideLabel?: boolean;
  value: string;
  onChange: (date: string) => void;
}) {
  return (
    <label>
      <span className={hideLabel ? "sr-only" : undefined}>{label}</span>
      <span className="date-field">
        <span className="date-display">{fullDate(value)}</span>
        <CalendarDays size={19} aria-hidden="true" />
        <input
          type="date"
          aria-label={label}
          value={value}
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value);
          }}
        />
      </span>
    </label>
  );
}
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select,textarea,a[href],[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", handle);
      prev?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label={t("Close")}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Sparkles size={28} />
      </div>
      <h3>{t(title)}</h3>
      {detail && <p>{t(detail)}</p>}
      {action}
    </div>
  );
}
export function WeekBadge({ week }: { week: string }) {
  return (
    <span className={`badge week-${week.toLowerCase()}`}>
      {t("Week ")}
      {week}
    </span>
  );
}
export function SessionCard({
  session,
  onOpen,
  showWeek = true,
  onDuplicate,
}: {
  onDuplicate?: (s: Session) => void;
  session: Session;
  onOpen: (s: Session) => void;
  showWeek?: boolean;
}) {
  const card = (
    <button className="session-card" onClick={() => onOpen(session)}>
      <span
        className={`session-icon tint-${session.week === "A" ? "yellow" : "pink"}`}
      >
        {session.icon}
      </span>
      <span className="session-copy">
        <strong>{session.name}</strong>
        <span>
          {shortDate(session.date)} ·{" "}
          {session.status === "done"
            ? t(
                `${doneSets(session).length} sets · ${number(volume(session))} kg`,
              )
            : t("Planned")}
        </span>
      </span>
      {showWeek && <WeekBadge week={session.week} />}
      {session.status === "done" ? (
        <span className="tiny-done">
          <Check size={14} />
        </span>
      ) : (
        <ArrowRight size={17} />
      )}
      <ExerciseNames exercises={session.exercises} />
    </button>
  );
  return onDuplicate ? (
    <div className="session-card-wrap">
      {card}
      <button
        className="duplicate-session-button"
        aria-label={t(`Duplicate ${session.name}`)}
        title={t("Duplicate session")}
        onClick={() => onDuplicate(session)}
      >
        <Copy size={18} />
      </button>
    </div>
  ) : (
    card
  );
}
export function ExerciseNames({ exercises }: { exercises: WorkoutExercise[] }) {
  return (
    <span className="exercise-preview">
      {exercises.length ? (
        exercises.map((exercise) => (
          <span key={exercise.id}>
            {exerciseName(exercise.name, exercise.exerciseId)}
          </span>
        ))
      ) : (
        <span className="muted">{t("No exercises planned yet")}</span>
      )}
    </span>
  );
}
export function Counter({
  value,
  onChange,
  step,
  label,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  step: number;
  label: string;
  max: number;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    if (draft !== "" && Number.isFinite(n) && n >= 0 && n <= max)
      onChange(step === 1 ? Math.round(n) : n);
    else setDraft(String(value));
  };
  return (
    <div className="counter">
      <button
        aria-label={t(`Decrease ${label}`)}
        onClick={() =>
          onChange(Math.max(0, Math.round((value - step) * 100) / 100))
        }
      >
        <Minus size={14} />
      </button>
      <input
        aria-label={label}
        inputMode="decimal"
        type="number"
        min="0"
        max={max}
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      <span className="counter-unit">{step === 1 ? "reps" : t("kg")}</span>
      <button
        aria-label={t(`Increase ${label}`)}
        onClick={() =>
          onChange(Math.min(max, Math.round((value + step) * 100) / 100))
        }
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
export function SetRow({
  set,
  index,
  onChange,
  onRemove,
}: {
  set: LiftSet;
  index: number;
  onChange: (s: LiftSet) => void;
  onRemove?: () => void;
}) {
  return (
    <div className={`set-row ${set.done ? "completed" : ""}`}>
      <span className="set-index">{index + 1}</span>
      <Counter
        value={set.weight}
        step={2.5}
        max={2000}
        label={t(`Set ${index + 1} weight in kg`)}
        onChange={(weight) => onChange({ ...set, weight })}
      />
      <span className="unit">{t("kg ×")}</span>
      <Counter
        value={set.reps}
        step={1}
        max={1000}
        label={t(`Set ${index + 1} reps`)}
        onChange={(reps) => onChange({ ...set, reps })}
      />
      <button
        className={`done-button ${set.done ? "checked" : ""}`}
        aria-label={t(
          `Set ${index + 1} ${set.done ? "completed" : "not completed"}`,
        )}
        aria-pressed={set.done}
        onClick={() => onChange({ ...set, done: !set.done })}
      >
        <Check size={18} />
      </button>
      {onRemove && (
        <button
          className="icon-button subtle"
          aria-label={t(`Remove set ${index + 1}`)}
          onClick={onRemove}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
export function LastTime({
  exercise,
  session,
  sessions,
}: {
  exercise: WorkoutExercise;
  session: Session;
  sessions: Session[];
}) {
  const last = lastPerformance(sessions, exercise.exerciseId, session);
  if (!last)
    return (
      <div className="last-time">{t("First time here. Make it count!")}</div>
    );
  const sets = doneSets(last).filter(
    (x) => x.exerciseId === exercise.exerciseId,
  );
  return (
    <div className="last-time">
      {t("Last · ")}
      {shortDate(last.date)} ·{" "}
      {sets.map((s) => `${number(s.weight, 1)} kg × ${s.reps}`).join(" / ")}
    </div>
  );
}
export function DumbbellArt() {
  return (
    <svg className="dumbbell-art" viewBox="0 0 320 160" aria-hidden="true">
      <g
        transform="rotate(12 160 80)"
        stroke="#161719"
        strokeWidth="4"
        strokeLinejoin="round"
      >
        <rect x="72" y="64" width="170" height="38" rx="16" fill="#8ad1ff" />
        <rect x="52" y="33" width="39" height="100" rx="15" fill="#1176ff" />
        <rect x="35" y="48" width="23" height="69" rx="10" fill="#0b4bd8" />
        <rect x="231" y="33" width="39" height="100" rx="15" fill="#1176ff" />
        <rect x="267" y="48" width="23" height="69" rx="10" fill="#0b4bd8" />
        <circle cx="140" cy="77" r="3" fill="#161719" />
        <circle cx="173" cy="77" r="3" fill="#161719" />
        <path d="M143 87 Q158 106 175 87" fill="none" strokeLinecap="round" />
      </g>
      <path
        d="M27 25l-9-12M292 134l12 8M288 24l14-8"
        stroke="#fb6f3c"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <text x="10" y="138" fontSize="35">
        ✦
      </text>
      <text x="267" y="42" fontSize="37" fill="#16b694">
        ✦
      </text>
    </svg>
  );
}
export function Chart({
  series,
  bar = false,
  unit = "kg",
  labels,
  connectGaps = false,
  zeroBaseline = true,
  axisDecimals,
  onPointClick,
  pointLabel,
  selectedPoint,
}: {
  series: { name: string; color: string; values: (number | null)[] }[];
  bar?: boolean;
  unit?: string;
  labels: string[];
  connectGaps?: boolean;
  zeroBaseline?: boolean;
  axisDecimals?: number;
  onPointClick?: (index: number, seriesIndex: number) => void;
  pointLabel?: (index: number, seriesIndex: number) => string;
  selectedPoint?: number;
}) {
  const compact = useMediaQuery("(max-width: 640px)");
  const values = series.flatMap((s) =>
    s.values.filter((v): v is number => v !== null),
  );
  const [min, max] =
    zeroBaseline || bar
      ? [bar ? 0 : Math.min(0, ...values), Math.max(1, ...values)]
      : bodyweightDomain(values);
  const height = compact ? 235 : 210,
    width = compact ? 360 : 700,
    left = 48,
    right = 20,
    bottom = 30,
    top = 15;
  const plotW = width - left - right,
    plotH = height - bottom - top;
  const visibleLabels = chartLabelIndices(labels.length, compact ? 4 : 7);
  const x = (i: number) =>
    left + ((i + 0.5) * plotW) / Math.max(labels.length, 1);
  const y = (v: number) => top + (1 - (v - min) / (max - min)) * plotH;
  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role={onPointClick ? "group" : "img"}
        aria-label={t(`${series.map((s) => s.name).join(" and ")} in ${unit}`)}
      >
        <title>
          {series.map((s) => s.name).join(" and ")} ({unit})
        </title>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1={left}
              x2={width - right}
              y1={top + t * plotH}
              y2={top + t * plotH}
              stroke="#e9e6e1"
              strokeDasharray="4 4"
            />
            <text
              x={left - 8}
              y={top + t * plotH + 4}
              textAnchor="end"
              fill="#868695"
              fontSize={compact ? 12 : 11}
            >
              {number(
                max - t * (max - min),
                axisDecimals ?? (unit === "%" ? 1 : 0),
              )}
              {unit === "%" ? "%" : ""}
            </text>
          </g>
        ))}
        {series.map((s, si) =>
          bar ? (
            s.values.map(
              (v, i) =>
                v !== null && (
                  <rect
                    key={i}
                    x={
                      x(i) -
                      Math.min(24, (plotW / labels.length) * 0.65) / 2 +
                      si * Math.min(16, plotW / labels.length / series.length)
                    }
                    y={y(v)}
                    width={Math.max(
                      2,
                      Math.min(24, (plotW / labels.length) * 0.65) /
                        series.length,
                    )}
                    height={Math.max(0, y(0) - y(v))}
                    fill={s.color}
                    rx="4"
                  >
                    <title>
                      {labels[i]}: {number(v, 1)} {unit}
                    </title>
                  </rect>
                ),
            )
          ) : (
            <g key={s.name}>
              <path
                d={
                  connectGaps
                    ? chartLinePath(s.values, x, y)
                    : s.values
                        .map((v, i) =>
                          v === null
                            ? ""
                            : `${i === 0 || s.values[i - 1] === null ? "M" : "L"}${x(i)},${y(v)}`,
                        )
                        .join(" ")
                }
                stroke={s.color}
                strokeWidth="3"
                fill="none"
              />
              {s.values.map(
                (v, i) =>
                  v !== null && (
                    <g
                      key={i}
                      className={
                        onPointClick ? "chart-clickable-point" : undefined
                      }
                      role={onPointClick ? "button" : undefined}
                      tabIndex={onPointClick ? 0 : undefined}
                      aria-label={
                        onPointClick
                          ? (pointLabel?.(i, si) ??
                            `${labels[i]}: ${number(v, 1)} ${unit}`)
                          : undefined
                      }
                      aria-haspopup={onPointClick ? "dialog" : undefined}
                      onClick={
                        onPointClick ? () => onPointClick(i, si) : undefined
                      }
                      onKeyDown={
                        onPointClick
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onPointClick(i, si);
                              }
                            }
                          : undefined
                      }
                    >
                      {onPointClick && (
                        <circle
                          className="chart-point-hit"
                          cx={x(i)}
                          cy={y(v)}
                          r="16"
                          fill="transparent"
                        />
                      )}
                      <circle
                        className="chart-point-dot"
                        cx={x(i)}
                        cy={y(v)}
                        r={onPointClick && selectedPoint === i ? 5 : 3.5}
                        fill={s.color}
                      >
                        <title>
                          {labels[i]}: {number(v, 1)} {unit}
                        </title>
                      </circle>
                    </g>
                  ),
              )}
            </g>
          ),
        )}
        {labels.map(
          (l, i) =>
            visibleLabels.has(i) && (
              <text
                key={i}
                x={x(i)}
                y={height - 8}
                textAnchor="middle"
                fontSize={compact ? 12 : 11}
                fill="#868695"
              >
                {l.length > 16 ? l.slice(0, 16) + "…" : l}
              </text>
            ),
        )}
      </svg>
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
export function Panel({
  title,
  info,
  action,
  children,
  className = "",
}: {
  title: string;
  info?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-title">
        <div className="panel-heading">
          <h2>{title}</h2>
          {info && <InfoButton title={title}>{info}</InfoButton>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Logo({ name = "LiftLog" }: { name?: string }) {
  return (
    <div className={`logo ${name !== "LiftLog" ? "custom-name" : ""}`}>
      <span className="logo-name">{name}</span>
      <span className="logo-spark">✦</span>
      <small>{t("train together")}</small>
    </div>
  );
}
