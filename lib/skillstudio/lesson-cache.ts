// A small in-memory cache for generated lessons. The lesson for a topic is the same for every learner, so one generation serves everyone
// on this server instance, and learners who open the same lesson together wait on one model call instead of many. It is a prototype
// cache: it empties when the instance restarts. A stored, reviewed lesson would replace it.
const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 300;

const done = new Map<string, { at: number; value: unknown }>();
const running = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, make: () => Promise<T>, now: number = Date.now()): Promise<T> {
  const hit = done.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value as T;
  const pending = running.get(key);
  if (pending) return pending as Promise<T>;

  const p = make()
    .then((value) => {
      if (done.size >= MAX_ENTRIES) done.delete(done.keys().next().value as string); // oldest first
      done.set(key, { at: now, value });
      return value;
    })
    .finally(() => running.delete(key));
  running.set(key, p);
  return p;
}

export const clearLessonCache = () => {
  done.clear();
  running.clear();
};
