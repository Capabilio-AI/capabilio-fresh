-- Phase 4: the in-browser code editor / preview and Python notebook workstations exist now (lib/arena-runtime, components/arena/runtime).
-- Enabling them only makes a challenge that uses them startable; no such challenge exists until content is published. The terminal VM and simulators stay off.
update public.runtime_settings set enabled = true, updated_at = now() where runtime_type in ('CODE_EDITOR_PREVIEW', 'NOTEBOOK_PYTHON');
