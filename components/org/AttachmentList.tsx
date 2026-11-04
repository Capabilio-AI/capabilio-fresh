import { FileText } from "lucide-react";
import type { ProjectFile } from "@/lib/org/project-files";

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Files a group attached: image thumbnails and PDF chips, each opening its signed link in a new tab. */
export function AttachmentList({ files, urls }: { files: ProjectFile[]; urls: Map<string, string> }) {
  if (files.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-3">
      {files.map((f) => {
        const url = urls.get(f.path);
        const isImage = f.contentType.startsWith("image/");
        const body = isImage && url ? (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL, not optimisable
          <img src={url} alt={f.name} className="h-24 w-32 rounded-lg border border-app-border! object-cover" loading="lazy" />
        ) : (
          <span className="flex h-24 w-32 flex-col items-center justify-center gap-1 rounded-lg border border-app-border! bg-app-background px-2 text-center">
            <FileText size={22} aria-hidden className="text-app-muted" />
            <span className="line-clamp-2 break-all font-lp-body text-[11.5px] text-app-charcoal">{f.name}</span>
          </span>
        );
        return (
          <li key={f.path} className="w-32">
            {url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${f.name}`} className="block transition-opacity hover:opacity-85">{body}</a> : body}
            <p className="mt-1 truncate font-lp-body text-[11.5px] text-app-muted" title={f.name}>{isImage ? f.name : kb(f.size)}</p>
          </li>
        );
      })}
    </ul>
  );
}
