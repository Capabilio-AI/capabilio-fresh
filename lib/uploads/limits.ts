/**
 * Most uploads pass through a serverless function, and Vercel rejects any request body over 4.5 MB before our code runs
 * (a bare "413 FUNCTION_PAYLOAD_TOO_LARGE"). 4 MB keeps a margin for the form fields, and lets us show a clear message instead.
 * Larger files must go straight to storage (see lib/roadmap/extract/limits.ts for the syllabus PDF).
 */
export const MAX_UPLOAD_MB = 4;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
