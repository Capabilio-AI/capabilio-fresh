---
version: 1
slug: "components-roadmap-visual-roadmapexperience-tsx"
primary_target: "components/roadmap/visual/RoadmapExperience.tsx"
related_targets: []
---

# Surface: visual career roadmap (Operate)

Visitor mode: Operate. Student reads own state and picks the next step; advisor reads the same map. Redesign (replacement world) of components/roadmap/visual/. Keep: statuses, list view alternative, drawer, data/logic untouched.

## Direction contract
THESIS: The roadmap is a transit diagram: stages are interchanges on a trunk line, domains are coloured lines, topics are stations. Refuses the yellow-box mind-map chart.
OWN-WORLD: Cool signage-white ground, deep navy ink, eight saturated line colours (one per domain group), station markers drawn as SVG (ring, half, filled-check, dashed, bar-locked, struck), Atkinson Hyperlegible, octilinear 45 degree routes, navy shell header.
STORY: Student sees where they are on every line, what is proven vs not assessed, and the single Next stop; advisor reads the same map.
FIRST VIEWPORT: Navy header band with career name as a line badge and readiness / evidence coverage / position / syllabus; below, view tabs + search + filter + legend of station markers; below that the diagram with the trunk down the centre and domain lines branching left and right; one Next stop flag.
FORM: Metro line map, grounded candidate 6 (assigned) replaced by pick (user chose Impeccable's pick: metro). Seed key ba99bf3b.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
