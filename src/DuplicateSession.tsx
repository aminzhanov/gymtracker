import { t } from "./i18n";
import { useState } from "react";
import type { AppData, Session, Week } from "./types";
import { DateField, Modal } from "./components";
import { addDays, duplicateSession } from "./model";

export function DuplicateSession({
  data,
  source,
  onClose,
  onCreate,
}: {
  data: AppData;
  source: Session;
  onClose: () => void;
  onCreate: (s: Session) => void;
}) {
  const [date, setDate] = useState(addDays(source.date, 7));
  const [week, setWeek] = useState<Week>(source.week);
  return (
    <Modal title={t(`Duplicate ${source.name}`)} onClose={onClose}>
      <p className="muted">
        {t(
          "Copy the exercises, weights and reps to a new planned session. All sets will be unchecked.",
        )}
      </p>
      <DateField
        label={t("New session date")}
        value={date}
        onChange={setDate}
      />
      {data.settings.useABSplit && (
        <label>
          {t("Program week")}
          <select
            value={week}
            onChange={(e) => setWeek(e.target.value as Week)}
          >
            <option value="A">{t("Week A")}</option>
            <option value="B">{t("Week B")}</option>
          </select>
        </label>
      )}
      <div className="modal-actions">
        <button className="button" onClick={onClose}>
          {t("Cancel")}
        </button>
        <button
          className="button primary"
          disabled={!date}
          onClick={() => onCreate(duplicateSession(data, source, date, week))}
        >
          {t("Duplicate & edit")}
        </button>
      </div>
    </Modal>
  );
}
