-- HTML & CSS, JavaScript and C# join the language tracks: the progress table's track list must allow them.
alter table public.language_lesson_progress drop constraint if exists language_lesson_progress_track_check;
alter table public.language_lesson_progress add constraint language_lesson_progress_track_check
  check (track in ('c', 'java', 'python', 'cpp', 'sql', 'html', 'javascript', 'csharp'));
