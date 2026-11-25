// Runs every example of every role lesson on Pyodide 0.26.4 (the Python learners get in the browser) and fails when its stored output differs.
//   npm i --no-save pyodide@0.26.4 && node --import tsx scripts/verify-role-lessons.mts
import { ROLE_LESSONS } from "../lib/role-lessons/index";

const pyodideModule = "pyodide"; // not a project dependency: installed with --no-save only to run this check
const { loadPyodide } = (await import(pyodideModule)) as { loadPyodide: () => Promise<any> };
const py = await loadPyodide();
await py.loadPackage(["numpy", "pandas"]);
let bad = 0;
for (const [role, lessons] of Object.entries(ROLE_LESSONS)) {
  for (const l of lessons) for (const s of l.sections) {
    const out: string[] = [];
    py.setStdout({ batched: (x: string) => out.push(x) });
    py.setStderr({ batched: (x: string) => out.push(x) });
    try { await py.runPythonAsync("import warnings\nwarnings.filterwarnings('ignore')\n" + s.example.code); } catch (e) { out.push("ERROR: " + (e as Error).message); }
    const got = out.join("\n");
    if (got !== s.example.output) { bad++; console.error(`DIFFERENT ${role}/${l.key} / ${s.heading}\n--- stored\n${s.example.output}\n--- run\n${got}`); }
  }
}
console.log(bad === 0 ? "all examples match" : `${bad} example(s) differ`);
process.exit(bad === 0 ? 0 : 1);
