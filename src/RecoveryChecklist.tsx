import { t } from "./i18n";
import { useState } from "react";
import { Empty, Modal, useMediaQuery } from "./components";
import { chartLabelIndices } from "./chartDomain";
import { recoveryHistory, shortDate } from "./model";

type Row = ReturnType<typeof recoveryHistory>[number];
type Check = Row["warmup"];
const labels = {
  done: "Done",
  partial: "Partial",
  skipped: "Skipped",
  pending: "Pending",
  unplanned: "Not planned",
};
export function RecoveryChecklist({ rows }: { rows: Row[] }) {
  const compact = useMediaQuery("(max-width: 640px)");
  const [selected, setSelected] = useState<{
    row: Row;
    kind: "warmup" | "cooldown";
  } | null>(null);
  const ordered = [...rows].reverse();
  const limit = compact ? 6 : 16;
  const strips = Array.from(
    { length: Math.ceil(ordered.length / limit) },
    (_, i) => ordered.slice(i * limit, (i + 1) * limit),
  );
  const summary = (kind: "warmup" | "cooldown") => {
    const checks = rows.map((r) => r[kind]).filter((check) => check.total > 0);
    return `${checks.filter((check) => check.status === "done").length}/${checks.length}`;
  };
  return rows.length ? (
    <>
      <div className="recovery-summary">
        <span>
          {t("Warm-ups ")}
          <strong>{summary("warmup")}</strong>
        </span>
        <span>
          {t("Cool-downs ")}
          <strong>{summary("cooldown")}</strong>
        </span>
      </div>
      <div
        className="recovery-box-chart"
        aria-label={t("Warm-up and cool-down session history")}
      >
        {strips.map((strip, stripIndex) => {
          const width = compact ? 360 : 760,
            left = compact ? 72 : 88;
          const slot = (width - left - 10) / strip.length;
          const size = Math.min(32, slot - 8);
          const tickIndices = chartLabelIndices(strip.length, compact ? 3 : 8);
          return (
            <svg
              key={stripIndex}
              viewBox={`0 0 ${width} 115`}
              role="group"
              aria-label={t("Session recovery checks")}
            >
              <text x={left - 8} y={32} textAnchor="end" fontSize="12">
                {t("Warm-up")}
              </text>
              <text x={left - 8} y={75} textAnchor="end" fontSize="12">
                {t("Cool-down")}
              </text>
              {strip.map((row, index) => (
                <g key={row.id}>
                  {(["warmup", "cooldown"] as const).map((kind, ri) => {
                    const check: Check = row[kind];
                    const x = left + (index + 0.5) * slot - size / 2,
                      y = 9 + ri * 43;
                    const label = `${row.name} · ${shortDate(row.date)} · ${t(kind === "warmup" ? "Warm-up" : "Cool-down")}: ${t(labels[check.status])}`;
                    const open = () => setSelected({ row, kind });
                    return (
                      <g
                        key={kind}
                        role="button"
                        tabIndex={0}
                        aria-label={label}
                        className="recovery-chart-box"
                        onClick={open}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            open();
                          }
                        }}
                      >
                        <title>{label}</title>
                        <rect
                          x={x - 4}
                          y={y - 4}
                          width={size + 8}
                          height={size + 8}
                          fill="transparent"
                        />
                        <rect
                          x={x}
                          y={y}
                          width={size}
                          height={size}
                          rx={6}
                          fill={
                            check.status === "done"
                              ? "#16836a"
                              : check.status === "partial"
                                ? "#f0bd55"
                                : "#ece9e4"
                          }
                          stroke={
                            check.status === "pending" ? "#aaa5b2" : "none"
                          }
                          strokeDasharray={
                            check.status === "pending" ? "3 2" : undefined
                          }
                        />
                        <text
                          x={x + size / 2}
                          y={y + size / 2 + 6}
                          textAnchor="middle"
                          fontSize="18"
                          fill={check.status === "done" ? "white" : "#777183"}
                        >
                          {check.status === "done"
                            ? "✓"
                            : check.status === "partial"
                              ? "◐"
                              : check.status === "skipped"
                                ? "×"
                                : "–"}
                        </text>
                      </g>
                    );
                  })}
                  {tickIndices.has(index) && (
                    <text
                      x={left + (index + 0.5) * slot}
                      y={109}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#767184"
                    >
                      {shortDate(row.date)}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          );
        })}
      </div>
      <div className="chart-legend">
        <span>
          <i style={{ background: "#16836a" }} />
          {t("Done")}
        </span>
        <span>
          <i style={{ background: "#f0bd55" }} />
          {t("Partial")}
        </span>
        <span>
          <i style={{ background: "#ece9e4" }} />
          {t("Not done / not planned")}
        </span>
      </div>
      {selected && (
        <Modal
          title={selected.kind === "warmup" ? t("Warm-up") : t("Cool-down")}
          onClose={() => setSelected(null)}
        >
          <strong>{selected.row.name}</strong>
          <p>{shortDate(selected.row.date)}</p>
          <p>
            {t(labels[selected.row[selected.kind].status])} ·{" "}
            {selected.row[selected.kind].completed}/
            {selected.row[selected.kind].total}
            {t(" activities completed")}
          </p>
        </Modal>
      )}
    </>
  ) : (
    <Empty
      title={t("Your warm-up checklist starts here")}
      detail={t(
        "Complete a set or recovery activity to add a training session.",
      )}
    />
  );
}
