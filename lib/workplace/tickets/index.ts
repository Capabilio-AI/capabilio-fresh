import { EASY_TEMPLATES } from "./brightcart-easy";
import { MEDIUM_TEMPLATES } from "./brightcart-medium";
import { HARD_TEMPLATES } from "./brightcart-hard";
import { SCRIPT_TEMPLATES } from "./brightcart-script";
import { DEBUG_TEMPLATES } from "./brightcart-debug";
import { EXPERT_TEMPLATES } from "./brightcart-expert";
import type { TicketTemplate } from "./types";

export const BRIGHTCART_SQL_TEMPLATES: readonly TicketTemplate[] = [...EASY_TEMPLATES, ...MEDIUM_TEMPLATES, ...HARD_TEMPLATES, ...SCRIPT_TEMPLATES, ...DEBUG_TEMPLATES, ...EXPERT_TEMPLATES];
export type { TicketDraft, TicketTemplate, QueryDraft, ScriptDraft, TaskKind, Probe } from "./types";
