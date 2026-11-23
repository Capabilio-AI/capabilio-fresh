-- Evidence for the recruiter-facing certificate. When a module is proven we now keep how it was proven: the assessment score of the passing attempt, and for the
-- problem the language, how many of the judge's tests the passing submission met, and the passing code with its SHA-256. The code is only ever shown on a
-- credential page when the student chose to show it, and the credential signs the SHA-256 so shown code can be proven unchanged. Nothing is backfilled: no
-- student has proven a module yet. Service-role only, like the rest of this table.
alter table public.language_module_proof
  add column assessment_correct int check (assessment_correct >= 0),
  add column assessment_total int check (assessment_total >= 1),
  add column problem_tests_passed int check (problem_tests_passed >= 0),
  add column problem_tests_total int check (problem_tests_total >= 1),
  add column problem_language text check (problem_language is null or char_length(problem_language) between 1 and 20),
  add column problem_code text check (problem_code is null or char_length(problem_code) <= 20000),
  add column problem_code_sha256 text check (problem_code_sha256 is null or problem_code_sha256 ~ '^[0-9a-f]{64}$'),
  add constraint language_module_proof_score_check check (assessment_correct is null or assessment_correct <= assessment_total),
  add constraint language_module_proof_tests_check check (problem_tests_passed is null or problem_tests_passed <= problem_tests_total);

-- whether the student chose to show their solutions on the public page; it can change after issue because it is not part of the signed record
alter table public.skill_credentials add column show_code boolean not null default false;
