// Which path's chrome an auth screen (signup / verified / login) should wear. Login is universal:
// the path only picks copy and layout (from ?path=), it never grants or changes access.
export const AUTH_PATHS = ["student", "organisation"] as const;
export type AuthPath = (typeof AUTH_PATHS)[number];

export function parseAuthPath(value: string | string[] | undefined): AuthPath {
  return (AUTH_PATHS as readonly string[]).includes(value as string) ? (value as AuthPath) : "student";
}

export const loginHref = (path: AuthPath) => (path === "student" ? "/login" : `/login?path=${path}`);
export const verifiedNext = (path: AuthPath) => (path === "student" ? "/verified" : `/verified?path=${path}`);
