import { ru } from "./ru.ts";
export type Language = "en" | "ru";
let language: Language = "en";
export const appLocale = () => (language === "ru" ? "ru-RU" : "en-GB");
export const setAppLanguage = (next: Language) => {
  language = next;
};
export function readLanguage(key = "liftlog-language"): Language {
  try {
    return localStorage.getItem(key) === "ru" ? "ru" : "en";
  } catch {
    return "en";
  }
}
export function rememberLanguage(next: Language, owner?: string) {
  try {
    localStorage.setItem("liftlog-language", next);
    if (owner) localStorage.setItem(`liftlog-language:${owner}`, next);
  } catch {
    /* Training data keeps its existing save/error handling. */
  }
}
export function t(text: string): string {
  if (language !== "ru") return text;
  const key = text.replace(/\s+/g, " ").trim();
  const leading = text.match(/^\s*/)?.[0] ?? "",
    trailing = text.match(/\s*$/)?.[0] ?? "";
  if (ru[key]) return leading + ru[key] + trailing;
  const patterns: [RegExp, (...parts: string[]) => string][] = [
    [
      /^Week ([AB])(?: · (\d+))?$/,
      (_, week, n) => `Неделя ${week}${n ? ` · ${n}` : ""}`,
    ],
    [/^([+\-]?[\d\s.,]+) kg$/, (_, value) => `${value} кг`],
    [/^Week (\d+)$/, (_, n) => `Неделя ${n}`],
    [/^Week ([AB]) only$/, (_, week) => `Только неделя ${week}`],
    [/^About (.+)$/, (_, title) => `О разделе «${t(title)}»`],
    [/^Personal app for (.+)$/, (_, name) => `Личное приложение: ${name}`],
    [
      /^Duplicate (.+) on (\d{4}-\d{2}-\d{2})$/,
      (_, name, date) => `Дублировать ${name} · ${date}`,
    ],
    [/^Duplicate (.+)$/, (_, name) => `Дублировать ${name}`],
    [/^Edit workout: (.+)$/, (_, name) => `Изменить тренировку: ${name}`],
    [
      /^(Decrease|Increase) (.+)$/,
      (_, action, label) =>
        `${action === "Decrease" ? "Уменьшить" : "Увеличить"}: ${t(label)}`,
    ],
    [/^Edit (.+)$/, (_, name) => `Изменить ${name}`],
    [/^Close (.+) and save$/, (_, name) => `Закрыть ${name} и сохранить`],
    [/^Remove (.+)$/, (_, name) => `Удалить ${name}`],
    [/^(Complete|Reopen) (.+)$/, (_, action, name) => `${t(action)} ${name}`],
    [
      /^(Read|Hide) notes for (.+)$/,
      (_, action, name) => `${t(action)} заметки: ${name}`,
    ],
    [/^Notes for (.+)$/, (_, name) => `Заметки: ${name}`],
    [
      /^Move (.+) (up|down)$/,
      (_, name, direction) =>
        `Переместить ${name} ${direction === "up" ? "вверх" : "вниз"}`,
    ],
    [/^Drag to reorder (.+)$/, (_, name) => `Перетащить ${name}`],
    [
      /^(\d+)\/(\d+) sets done$/,
      (_, n, total) => `${n}/${total} подходов выполнено`,
    ],
    [
      /^(\d+) sets · (.+) kg$/,
      (_, sets, weight) => `${sets} подходов · ${weight} кг`,
    ],
    [
      /^Week ([AB]) · (\d+) · (\d+) sessions?$/,
      (_, week, n, sessions) =>
        `Неделя ${week} · ${n} · тренировок: ${sessions}`,
    ],
    [/^Start a new Week ([AB])$/, (_, week) => `Начать новую неделю ${week}`],
    [
      /^(Previous|Next) (month|week)$/,
      (_, dir, period) =>
        `${dir === "Previous" ? "Предыдущий" : "Следующий"} ${period === "month" ? "месяц" : "период"}`,
    ],
    [
      /^(Create|Add) session on (.+)$/,
      (_, action, date) =>
        `${action === "Create" ? "Создать" : "Добавить"} тренировку · ${date}`,
    ],
    [/^Volume outlook · (.+)$/, (_, month) => `Прогноз объёма · ${month}`],
    [/^Weight for set (\d+)$/, (_, n) => `Вес подхода ${n}`],
    [/^Reps for set (\d+)$/, (_, n) => `Повторения подхода ${n}`],
    [/^Set (\d+) complete$/, (_, n) => `Подход ${n} выполнен`],
    [/^Remove set (\d+)$/, (_, n) => `Удалить подход ${n}`],
    [/^(.+) complete$/, (_, name) => `${name}: выполнено`],
  ];
  for (const [pattern, replacement] of patterns) {
    const match = key.match(pattern);
    if (match) return leading + replacement(...match) + trailing;
  }
  return text;
}
export function exerciseName(name: string, id: string): string {
  return id.startsWith("default-") || id === "warmup" || id === "cooldown"
    ? t(name)
    : name;
}
