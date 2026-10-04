import { t } from "./i18n";
import { chartLabelIndices } from "./chartDomain";
import { number } from "./model";
import { useMediaQuery } from "./components";
import type { VolumeRow } from "./analyticsVolume";
const A = "#1369df",
  B = "#b54c9b",
  DONE = "#16836a";
type PlotRow = Pick<
  VolumeRow,
  | "key"
  | "label"
  | "week"
  | "from"
  | "to"
  | "a"
  | "b"
  | "done"
  | "planned"
  | "total"
>;
export function VolumePlot({
  rows,
  view,
  split,
  training,
  title,
  range,
}: {
  rows: PlotRow[];
  view: "bars" | "line";
  split: boolean;
  training: boolean;
  title: string;
  range: (row: PlotRow) => string;
}) {
  const compact = useMediaQuery("(max-width: 640px)");
  const width = compact ? 360 : 760,
    height = 260;
  const left = 55,
    right = 15,
    top = 18,
    bottom = 30;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const visibleLabels = chartLabelIndices(
    rows.length,
    compact ? (training ? 6 : 4) : training ? 10 : 8,
  );
  const label = (row: PlotRow) =>
    training ? row.label.replace(/^Week /, "").replace(" · ", "") : range(row);
  const max = Math.max(1, ...rows.map((row) => row.total)) * 1.1;
  const x = (index: number) => left + ((index + 0.5) * plotWidth) / rows.length;
  const y = (value: number) => top + (1 - value / max) * plotHeight;
  const path = (field: "done" | "total") =>
    rows
      .map((row, index) => {
        if (field === "done" && row.done === 0 && row.planned > 0) return "";
        const previous = rows[index - 1];
        const gap =
          !previous ||
          (field === "done" && previous.done === 0 && previous.planned > 0);
        return `${gap ? "M" : "L"}${x(index)},${y(row[field])}`;
      })
      .join(" ");
  return (
    <div className="chart-wrap calendar-volume-chart">
      <div className="volume-chart-scroll">
        <svg
          style={{ width: "100%", display: "block" }}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={t(
            `${title} completed and planned training volume in kg, ${view}`,
          )}
        >
          <title>{title}</title>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line
                x1={left}
                x2={width - right}
                y1={top + t * plotHeight}
                y2={top + t * plotHeight}
                stroke="#e9e6e1"
                strokeDasharray="4 4"
              />
              <text
                x={left - 7}
                y={top + t * plotHeight + 4}
                textAnchor="end"
                fill="#767184"
                fontSize={compact ? 14 : 12}
              >
                {number(max * (1 - t))}
              </text>
            </g>
          ))}
          {view === "bars" ? (
            rows.map((row, index) => {
              const buckets = training
                ? [
                    {
                      name: row.label,
                      color: row.week === "A" ? A : B,
                      done: row.done,
                      planned: row.planned,
                    },
                  ]
                : split
                  ? [
                      { name: "Week A", color: A, ...row.a },
                      { name: "Week B", color: B, ...row.b },
                    ]
                  : [
                      {
                        name: "All sessions",
                        color: A,
                        done: row.done,
                        planned: row.planned,
                      },
                    ];
              const barWidth = Math.min(
                28,
                plotWidth / rows.length / (split && !training ? 3.2 : 2),
              );
              return (
                <g key={row.key}>
                  {buckets.map((bucket, bi) => {
                    const bx =
                      x(index) +
                      (bi - (buckets.length - 1) / 2) * (barWidth * 1.15) -
                      barWidth / 2;
                    return (
                      <g key={bucket.name}>
                        <rect
                          x={bx}
                          y={y(bucket.done)}
                          width={barWidth}
                          height={Math.max(0, y(0) - y(bucket.done))}
                          fill={bucket.color}
                        >
                          <title>
                            {range(row)} · {bucket.name}
                            {t(" completed:")} {number(bucket.done)}
                            {t(" kg")}
                          </title>
                        </rect>
                        <rect
                          x={bx}
                          y={y(bucket.done + bucket.planned)}
                          width={barWidth}
                          height={Math.max(
                            0,
                            y(bucket.done) - y(bucket.done + bucket.planned),
                          )}
                          fill={bucket.color}
                          fillOpacity="0.25"
                          stroke={bucket.color}
                          strokeDasharray="3 3"
                        >
                          <title>
                            {range(row)} · {bucket.name}
                            {t(" planned:")} {number(bucket.planned)}
                            {t(" kg; projection:")}{" "}
                            {number(bucket.done + bucket.planned)}
                            {t(" kg")}
                          </title>
                        </rect>
                      </g>
                    );
                  })}
                </g>
              );
            })
          ) : (
            <>
              <path
                d={path("total")}
                fill="none"
                stroke={A}
                strokeWidth="3"
                strokeDasharray="7 5"
                opacity="0.6"
              />
              <path
                d={path("done")}
                fill="none"
                stroke={DONE}
                strokeWidth="3"
              />
              {rows.map((row, index) => (
                <g key={row.key}>
                  <circle
                    cx={x(index)}
                    cy={y(row.total)}
                    r="4"
                    fill="white"
                    stroke={training && row.week === "B" ? B : A}
                    strokeWidth="2"
                  >
                    <title>
                      {range(row)}
                      {t(" projection: ")}
                      {number(row.total)}
                      {t(" kg")}
                    </title>
                  </circle>
                  {(row.done > 0 || row.planned === 0) && (
                    <circle
                      cx={x(index)}
                      cy={y(row.done)}
                      r="3.5"
                      fill={training ? (row.week === "B" ? B : A) : DONE}
                    >
                      <title>
                        {range(row)}
                        {t(" completed: ")}
                        {number(row.done)}
                        {t(" kg")}
                      </title>
                    </circle>
                  )}
                </g>
              ))}
            </>
          )}
          {rows.map(
            (row, index) =>
              visibleLabels.has(index) && (
                <text
                  key={row.key}
                  x={x(index)}
                  y={height - 7}
                  textAnchor="middle"
                  fontSize={compact ? 12 : 11}
                  fill="#767184"
                >
                  {label(row)}
                </text>
              ),
          )}
        </svg>
      </div>
      <div className="chart-legend">
        {view === "bars" ? (
          <>
            <span>
              <i style={{ background: A }} />
              {split ? t("Week A") : t("Sessions")}
            </span>
            {split && (
              <span>
                <i style={{ background: B }} />
                {t("Week B")}
              </span>
            )}
            <span>
              <i style={{ background: "#767184" }} />
              {t("Completed")}
            </span>
            <span>
              <i className="planned-legend" />
              {t("Planned")}
            </span>
          </>
        ) : (
          <>
            <span>
              <i style={{ background: DONE }} />
              {t("Completed")}
            </span>
            <span>
              <i className="projection-legend" />
              {t("Projection")}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
