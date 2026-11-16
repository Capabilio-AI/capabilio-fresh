import { describe, expect, it } from "vitest";
import { MAX_BYTES, checkUpload, safeName, sniff, titleFrom } from "./documents";

const bytes = (...b: number[]) => new Uint8Array(b);

describe("sniff and checkUpload", () => {
  it("knows the five allowed types by their first bytes", () => {
    expect(sniff(bytes(0x25, 0x50, 0x44, 0x46, 0x2d))?.ext).toBe("pdf");
    expect(sniff(bytes(0x89, 0x50, 0x4e, 0x47))?.ext).toBe("png");
    expect(sniff(bytes(0xff, 0xd8, 0xff, 0xe0))?.ext).toBe("jpg");
    expect(sniff(bytes(0x50, 0x4b, 0x03, 0x04))?.ext).toBe("docx");
    expect(sniff(bytes(0xd0, 0xcf, 0x11, 0xe0))?.ext).toBe("doc");
  });
  it("does not trust a name: a script renamed to .pdf is refused", () => {
    expect(checkUpload({ name: "resume.pdf", size: 100 }, new TextEncoder().encode("#!/bin/sh\n"))).toMatchObject({ ok: false });
  });
  it("refuses empty and oversize files", () => {
    expect(checkUpload({ name: "a.pdf", size: 0 }, bytes(0x25, 0x50, 0x44, 0x46)).ok).toBe(false);
    expect(checkUpload({ name: "a.pdf", size: MAX_BYTES + 1 }, bytes(0x25, 0x50, 0x44, 0x46)).ok).toBe(false);
    expect(checkUpload({ name: "a.pdf", size: 10 }, bytes(0x25, 0x50, 0x44, 0x46)).ok).toBe(true);
  });
});

describe("names", () => {
  it("makes a safe file name and a readable title", () => {
    expect(safeName("../../Résumé final (2).pdf", "pdf")).toBe("Resume-final-2.pdf");
    expect(safeName("....", "pdf")).toBe("document.pdf");
    expect(titleFrom("aws_saa-cert.pdf")).toBe("aws saa cert");
  });
});
