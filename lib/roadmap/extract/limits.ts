/** Safe to import from client components (no PDF parser). Syllabus PDFs go straight to private storage, so they are not bound by the 4.5 MB serverless request-body limit. */
export const SYLLABUS_BUCKET = "curriculum-uploads";
export const MAX_SYLLABUS_MB = 50;
export const MAX_SYLLABUS_BYTES = MAX_SYLLABUS_MB * 1024 * 1024;
