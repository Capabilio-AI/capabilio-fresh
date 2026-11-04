import { describe, expect, it } from "vitest";
import { cleanFileName, isGroupPath, sniffProjectFile } from "./project-files";

describe("project files", () => {
  it("reads the type from the bytes", () => {
    expect(sniffProjectFile(new TextEncoder().encode("%PDF-1.7 rest"))?.contentType).toBe("application/pdf");
    expect(sniffProjectFile(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))?.contentType).toBe("image/png");
    expect(sniffProjectFile(new TextEncoder().encode("MZ-an-exe"))).toBeNull();
  });
  it("only accepts paths inside the group's own folder", () => {
    expect(isGroupPath("p1/g1/abc.png", "p1", "g1")).toBe(true);
    expect(isGroupPath("p1/g2/abc.png", "p1", "g1")).toBe(false);
    expect(isGroupPath("p1/g1/../g2/x.png", "p1", "g1")).toBe(false);
  });
  it("cleans file names", () => {
    expect(cleanFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
    expect(cleanFileName("   ")).toBe("file");
  });
});
