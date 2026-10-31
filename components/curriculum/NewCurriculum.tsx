"use client";

import type { ExtractionRecord } from "@/lib/roadmap/extract/types";
import { SyllabusExtraction } from "./SyllabusExtraction";

/** The one way to begin: read a syllabus PDF. */
export function NewCurriculum({ extraction, roleKey }: { extraction: ExtractionRecord | null; roleKey: string }) {
  return <SyllabusExtraction initial={extraction} roleKey={roleKey} />;
}
