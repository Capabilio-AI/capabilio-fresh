// Tries the exercise pipeline for real, without storing anything: the model writes exercises for a lesson, each is run on the actual code runner,
// and it says how many survive and why the rest were thrown away.
//   npm run exercises:check -- python lists "Python Lists" "Ordered collections of items you can change."
import { createServiceClient } from "@/lib/supabase/service";
import { generateVerified } from "@/lib/practice/server";
import { isExerciseLanguage, type RunnableLanguage } from "@/lib/practice/practice";

const [language, key, title, summary = ""] = process.argv.slice(2);
if (!isExerciseLanguage(language)) throw new Error("language must be python, java, c or cpp");
const started = Date.now();
const out = await generateVerified(createServiceClient(), null, { key: `check:${key}`, title, summary, language: language as RunnableLanguage });
console.log(`${title} (${language}): ${out.kept.length} verified, ${out.dropped.length} thrown away, ${Math.round((Date.now() - started) / 1000)}s`);
for (const d of out.dropped) console.log(`  dropped "${d.title}"${d.infra ? " [runner trouble]" : ""}: ${d.reason}`);
for (const k of out.kept) console.log(`  kept "${k.title}" (${k.tests.length} tests, ${k.tests.filter((t) => t.hidden).length} hidden)\n    ${k.instructions.replace(/\n/g, " ").slice(0, 160)}`);
