-- The exam lock (fullscreen, tab and shortcut guard for assessments, the CRT exam and Arena challenges) reports through the same
-- integrity_events table: two new areas, and the strikes it counts plus the tests it ended.
alter table public.integrity_events drop constraint if exists integrity_events_area_check;
alter table public.integrity_events add constraint integrity_events_area_check check (area in ('skillstudio', 'arena', 'assessment', 'crt'));
alter table public.integrity_events drop constraint if exists integrity_events_kind_check;
alter table public.integrity_events add constraint integrity_events_kind_check
  check (kind in ('paste', 'copy', 'cut', 'screenshot', 'print', 'blur', 'fullscreen_exit', 'tab_switch', 'devtools', 'exam_ended'));
