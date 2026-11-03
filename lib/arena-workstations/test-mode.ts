/** Local testing switch: no cooldown between tickets, no ticket deadline, no work clock. Ignored in production builds. */
export const ARENA_TEST_MODE = process.env.NEXT_PUBLIC_ARENA_TEST_MODE === "1" && process.env.NODE_ENV !== "production";
