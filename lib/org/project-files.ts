import { z } from "zod";
import { sniffDocument } from "@/lib/org/media";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/uploads/limits";

export const PROJECT_BUCKET = "project-files";
export const MAX_FILES = 5;
export { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB };

export interface ProjectFile { path: string; name: string; contentType: string; size: number }

export const ProjectFileSchema = z
  .object({ path: z.string().min(10).max(300), name: z.string().trim().min(1).max(120), contentType: z.enum(["image/png", "image/jpeg", "image/webp", "application/pdf"]), size: z.number().int().positive().max(MAX_UPLOAD_BYTES) })
  .strict();
export const ProjectFilesSchema = z.array(ProjectFileSchema).max(MAX_FILES);

/** Where a group's files live. A path outside this prefix can never be attached to the group. */
export const groupFolder = (projectId: string, groupId: string): string => `${projectId}/${groupId}/`;
export const isGroupPath = (path: string, projectId: string, groupId: string): boolean => path.startsWith(groupFolder(projectId, groupId)) && !path.includes("..");

/** Pure. The file's real type from its bytes (PNG, JPG, WebP or PDF); the browser's claim is never trusted. */
export const sniffProjectFile = sniffDocument;

/** A safe display name: no path parts or control characters, at most 120 characters. */
export const cleanFileName = (name: string): string => name.replace(/[\\/\u0000-\u001f]/g, "_").trim().slice(0, 120) || "file";
