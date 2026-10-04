import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  Minus,
  XCircle,
} from "lucide-react";
import { Empty } from "./components";
import { recoveryHistory, shortDate } from "./model";

type RecoveryCheck = ReturnType<typeof recoveryHistory>[number]["warmup"];
function RecoveryMark({ check }: { check: RecoveryCheck }) {
  const labels = {
    done: "Done",
    partial: "Partial",
    skipped: "Skipped",
    pending: "Pending",
    unplanned: "Not planned",
  };
  const icons = {
    done: CheckCircle2,
    partial: CircleDashed,
    skipped: XCircle,
    pending: Clock3,
    unplanned: Minus,
  };
  const Icon = icons[check.status];
  return (
    <span className={`recovery-mark ${check.status}`}>
      <Icon size={17} aria-hidden="true" />
      {labels[check.status]}
      {check.total > 1 && (
        <small>
          {check.completed}/{check.total}
        </small>
      )}
    </span>
  );
}
export function RecoveryChecklist({
  rows,
}: {
  rows: ReturnType<typeof recoveryHistory>;
}) {
  return rows.length ? (
    <div className="table-scroll recovery-checklist">
      <table>
        <thead>
          <tr>
            <th>Training</th>
            <th>Warm-up</th>
            <th>Cool-down</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <strong>{row.name}</strong>
                <span className="recovery-session-date">
                  {shortDate(row.date)}
                </span>
              </td>
              <td>
                <RecoveryMark check={row.warmup} />
              </td>
              <td>
                <RecoveryMark check={row.cooldown} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title="Your recovery checklist starts here"
      detail="Complete a set or recovery activity to add a training session."
    />
  );
}
