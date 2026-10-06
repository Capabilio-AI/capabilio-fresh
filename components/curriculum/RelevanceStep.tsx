import { EmptyState, Panel } from "@/components/org/ui";

/** Career relevance is derived from confirmed skills and career requirements. Careers aren't configured yet, so this says so — it never invents a ranking. */
export function RelevanceStep() {
  return (
    <Panel>
      <EmptyState title="Career requirements aren't configured yet" body="Once Capabilio sets up careers and the skills each one needs, every course will show how strongly its confirmed skills match each career (high, medium or low, with the skills that drove it). It's calculated from your confirmations, never typed in — so confirm your skill mappings first. You can continue without this step." />
    </Panel>
  );
}
