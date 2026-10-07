# Capabilio Curriculum Template v1

One CSV file describes a college's curriculum for **one branch and one regulation**. Colleges upload it under *Organisation → Curriculum → Upload in the Capabilio template*. It is read exactly as written (no AI, no layout guessing), saved as a draft, then goes through the same review → publish steps as a PDF extraction.

A college that has only a PDF uploads the PDF instead; see "PDFs" below.

## Why a row-per-element CSV

Every syllabus has the same elements (courses, units, topics, outcomes, labs, books, skills) but no two layouts agree. One row per element, tagged by `row_type`, can be produced from any spreadsheet, needs no nesting, and is validated line by line. Row order does not matter.

## Columns

`row_type, year, semester, course_code, course_title, kind, category, credits, lecture_hours, tutorial_hours, practical_hours, prerequisites, ref, text, value`

Only `row_type` and `course_code` must exist in the header; leave out any column with nothing to put in it. Lines starting with `#` are notes and are ignored. Comma or semicolon separated, UTF-8 (Excel: *Save As → CSV UTF-8*).

## Rows

| row_type | Fields used | Notes |
|---|---|---|
| `COURSE` | year, semester, course_code, course_title, kind, category, credits, lecture/tutorial/practical hours, prerequisites | `course_code` unique in the file. `year` 1-4 with `semester` 1-2, **or** leave `year` empty and give `semester` 1-8 for the whole programme. `kind`: course, lab, elective_option, project, audit; empty = worked out from the title and category. |
| `OBJECTIVE` | course_code, text | One objective per row. |
| `OUTCOME` | course_code, ref (`CO1`…), text, value | `value` = Bloom level (Remember…Create) or K1-K6; optional. Empty `ref` numbers them in order. |
| `UNIT` | course_code, ref (unit no.), text, value | `text` = unit title, `value` = hours (optional). |
| `TOPIC` | course_code, ref (unit no.), text | The unit must have a `UNIT` row. |
| `LAB` | course_code, text | One experiment per row. |
| `BOOK` | course_code, ref (`text`/`reference`/`online`), text | |
| `SKILL` | course_code, ref, text, value | `text` = a name from the Capabilio skills list (or one of its aliases). `ref` empty = the whole course, `CO1` = taught by that outcome, a number = taught in that unit. `value` = CORE, SUPPORTING or MINOR (optional). |

Only `COURSE` rows are required. A course with no outcomes, units or skills is filled in by Capabilio's analysis from what it does have, and flagged for review.

## What happens on upload

1. The whole file is checked and **every** problem is returned with its line number (nothing is saved until the file is clean). The two example courses in the downloaded template must be deleted.
2. Skills that match the Capabilio skills list **exactly** (name or alias) become the college's confirmed mappings, with their importance. A merely similar name is *not* accepted; it is reported so the college can correct it, because confirmed mappings drive student roadmaps.
3. A course whose skills the college stated is skipped by the AI skill pass, so the college's list is not diluted with guesses.
4. Courses without outcomes get grounded, derived outcomes and skill suggestions through the normal analysis (suggestions stay *suggested* until a person confirms them).
5. The draft appears in the Curriculum list for the chosen branch and regulation, ready to review and publish.

## PDFs

Any digital syllabus PDF is still accepted. Capabilio reads semester tables, units and topics, outcomes, labs and books deterministically where it recognises the layout and with a text-grounded AI fallback where it does not (every extracted item must appear in the source text), then derives missing outcomes and suggests skills for each course and unit. Scans without a text layer are rejected with a clear message; those colleges should use the template.
