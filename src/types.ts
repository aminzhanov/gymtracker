export type Week = "A" | "B";
export type Kind = "strength" | "warmup" | "cooldown";
export type Difficulty = "" | "easy" | "solid" | "hard" | "brutal";
export interface LiftSet {
  id: string;
  weight: number;
  reps: number;
  done: boolean;
}
export interface Exercise {
  id: string;
  name: string;
  custom: boolean;
}
export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  name: string;
  kind: Kind;
  duration: number;
  notes: string;
  sets: LiftSet[];
  done: boolean;
}
export interface Session {
  id: string;
  date: string;
  name: string;
  icon: string;
  week: Week;
  status: "planned" | "done";
  difficulty: Difficulty;
  notes: string;
  exercises: WorkoutExercise[];
  createdBy?: string;
}
export interface Template {
  id: string;
  name: string;
  icon: string;
  week: Week;
  notes: string;
  exercises: WorkoutExercise[];
}
export interface Bodyweight {
  date: string;
  weight: number;
}
export interface Settings {
  spikeThreshold: number;
  anchorDate: string;
  anchorWeek: Week;
  name: string;
}
export interface AppData {
  version: 1;
  sessions: Session[];
  templates: Template[];
  exercises: Exercise[];
  bodyweight: Bodyweight[];
  settings: Settings;
}
export interface Profile {
  id: string;
  name: string;
  role: "coach" | "athlete";
  active: boolean;
}
