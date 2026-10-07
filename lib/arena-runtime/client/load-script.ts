const loaded = new Map<string, Promise<void>>();

/** Loads a classic script once and resolves when it has run. A failed load is forgotten so the caller can retry. */
export function loadScript(src: string): Promise<void> {
  const existing = loaded.get(src);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => {
      loaded.delete(src);
      reject(new Error(`Could not load ${src}`));
    };
    document.head.appendChild(el);
  });
  loaded.set(src, promise);
  return promise;
}
