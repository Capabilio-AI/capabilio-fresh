# Pathway files

One JSON file per goal (`<key>.v1.json`), validated by `npm run pathway:content -- validate <file>` before it can be saved.
The shape is `PathwaySpec` in `lib/pathways/schema.ts`; the rules are in `lib/pathways/rules.ts`.

**How to write one, in short**
1. Open the official source (the exam body's or institution's own site) and read the rule yourself. Do not copy from a coaching site, a forum, or memory.
2. Put every date, age or attempt limit, fee, vacancy or seat count, and percentage in `facts` with its `sourceUrl` (https, the official page) and `retrievedAt` (the day you read it).
3. In the prose write `{fact:your-key}` where that value belongs. The tool refuses a year, date, amount, percentage, age or count written as plain words.
4. `watch` lists the official pages where notifications appear and how to follow them. `honesty` says what Capabilio can and cannot verify.
5. Import as a DRAFT, have a Capabilio admin review it (`review <id> --as <email>`), then publish. Publishing is refused while any fact has expired.

There is deliberately no example pathway here: a placeholder that looks like real exam data is exactly what this system exists to prevent.
