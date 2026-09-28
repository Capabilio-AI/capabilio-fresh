"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Upload } from "lucide-react";

function stripExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx > 0 ? fileName.slice(0, idx) : fileName;
}

export function CertificateUpload() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setSuccess(false);
    setError(null);
    if (picked && !title) setTitle(stripExtension(picked.name));
  }

  async function handleUpload() {
    if (!file || title.trim().length === 0) {
      setError("Choose a file and give it a title.");
      return;
    }
    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());

    const res = await fetch("/api/vault/certificate", { method: "POST", body: formData });
    setUploading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Upload failed — try again.");
      return;
    }
    setSuccess(true);
    setFile(null);
    setTitle("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-app-border bg-white p-5">
      <div className="flex items-center gap-2">
        <Upload size={16} className="text-app-charcoal" />
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Add a certificate</h2>
      </div>
      <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">
        PDF, JPG, or PNG, up to 5MB. Verified uploads appear in your Vault automatically.
      </p>

      <div className="mt-3 flex flex-col gap-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/png,image/jpeg"
          onChange={handleFileChange}
          className="font-lp-body text-[13px] text-app-charcoal file:mr-3 file:rounded-lg file:border-0 file:bg-app-background file:px-3 file:py-1.5 file:font-lp-body file:text-[12.5px] file:text-app-charcoal"
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Certificate title (e.g. AWS Cloud Practitioner)"
          className="w-full rounded-lg border border-app-border bg-white px-3.5 py-2.5 font-lp-body text-[13px] text-app-charcoal placeholder:text-app-muted focus:border-app-blue focus:outline-none focus:ring-2 focus:ring-app-blue/25"
        />
        {error && <p className="font-lp-body text-[12.5px] text-app-warning">{error}</p>}
        {success && (
          <p className="flex items-center gap-1.5 font-lp-body text-[12.5px] text-app-success">
            <CheckCircle2 size={14} />
            Uploaded and added to your Vault.
          </p>
        )}
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || !file}
          className="flex w-fit items-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? "Uploading…" : "Upload certificate"}
        </button>
      </div>
    </div>
  );
}
