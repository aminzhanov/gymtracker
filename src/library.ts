import type { AppData, Exercise, TechniqueVideos } from "./types.ts";

export const exerciseNameKey = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();
export type SharedLibrary = {
  exercises: Exercise[];
  techniqueVideos: TechniqueVideos;
};

/** Local demo follows the same name merging and per-owner ID preservation as cloud. */
export function mergeLocalLibraries(
  members: { owner: string; data: AppData; videos: TechniqueVideos }[],
  owner: string,
  sharedVideos: Record<string, string>,
  archived: string[],
): SharedLibrary {
  const current = members.find((member) => member.owner === owner)!;
  const names = new Map<string, Exercise>();
  for (const member of [
    current,
    ...members.filter((member) => member !== current),
  ])
    for (const exercise of member.data.exercises) {
      const key = exerciseNameKey(exercise.name);
      if (!names.has(key)) names.set(key, exercise);
    }
  const videosByName: Record<string, string> = {};
  // Coach's existing demonstration takes priority when initially merging.
  for (const member of [...members].reverse())
    for (const exercise of member.data.exercises)
      if (member.videos[exercise.id])
        videosByName[exerciseNameKey(exercise.name)] =
          member.videos[exercise.id];
  Object.assign(videosByName, sharedVideos); // Empty strings deliberately remove a shared video.
  const techniqueVideos = { ...current.videos };
  const references = [
    ...current.data.exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
    })),
    ...names.values(),
    ...current.data.sessions.flatMap((session) =>
      session.exercises.map((exercise) => ({
        id: exercise.exerciseId,
        name: exercise.name,
      })),
    ),
    ...current.data.templates.flatMap((template) =>
      template.exercises.map((exercise) => ({
        id: exercise.exerciseId,
        name: exercise.name,
      })),
    ),
  ];
  for (const exercise of references) {
    const key = exerciseNameKey(exercise.name);
    if (Object.hasOwn(videosByName, key)) {
      if (videosByName[key]) techniqueVideos[exercise.id] = videosByName[key];
      else delete techniqueVideos[exercise.id];
    }
  }
  return {
    exercises: [...names]
      .filter(([key]) => !archived.includes(key))
      .map(([, exercise]) => exercise)
      .sort((a, b) => a.name.localeCompare(b.name)),
    techniqueVideos,
  };
}
