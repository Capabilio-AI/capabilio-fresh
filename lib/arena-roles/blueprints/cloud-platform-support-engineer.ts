import type { RoleBlueprint } from "../blueprint";

/**
 * MCA-04 Cloud and Platform Support Engineer. Mirrors supabase/migrations/189_cloud_platform_support_engineer_role.sql (not applied).
 * 
 * A fresher on a platform support desk: fixing a customer's container image, Kubernetes manifests, IAM policy and Compose file, and triaging service logs.
 * Config tickets use the shared config workstation (files checked as text against rules, nothing is built or applied); log tickets run the student's function
 * in their own browser on the shared code workstation (lib/workplace/cloud-platform-support).
 */
export const CLOUD_PLATFORM_SUPPORT_ENGINEER: RoleBlueprint = {
  roleId: "MCA-04",
  domainRoleKey: "cloud-platform-support-engineer",
  name: "Cloud and Platform Support Engineer",
  competencies: [
    { id: "cs.containers", label: "Fixing a container image: pinned base, unprivileged user, health check, production-only packages" },
    { id: "cs.k8s", label: "Kubernetes manifests: replicas, resource limits, probes and image tags" },
    { id: "cs.k8s-networking", label: "Troubleshooting a Service that routes to nothing (selector and port mismatch)" },
    { id: "cs.iam", label: "Least-privilege access policies" },
    { id: "cs.secrets", label: "Keeping secrets out of files and limiting network exposure" },
    { id: "cs.logs", label: "Reading service logs: counting by level and ranking failing services" },
  ],
  unassessed: [
    { id: "cs.live-cluster", label: "Working on a live cluster with kubectl, cloud consoles or a CLI" },
    { id: "cs.monitoring", label: "Dashboards, alerts and on-call tooling" },
    { id: "cs.networking", label: "VPCs, DNS, load balancers and firewalls" },
    { id: "cs.customer-comms", label: "Communicating with a customer through a ticket or call" },
    { id: "cs.cost", label: "Cloud cost and billing questions" },
  ],
  areas: [
    { areaKey: "cps-container-fixes", toolType: "devops_workspace", generationVersion: "devops.gen.v1", gradingVersion: "devops.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["cs.containers"] },
    { areaKey: "cps-kubernetes-manifests", toolType: "devops_workspace", generationVersion: "devops.gen.v1", gradingVersion: "devops.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["cs.k8s", "cs.k8s-networking"] },
    { areaKey: "cps-access-and-secrets", toolType: "devops_workspace", generationVersion: "devops.gen.v1", gradingVersion: "devops.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["cs.iam", "cs.secrets"] },
    { areaKey: "cps-log-triage", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["cs.logs"] },
  ],
  limitations: [
    "Config tickets check Dockerfiles, Kubernetes YAML, IAM policy JSON and Compose files as text against rules; no image is built, no manifest is applied and no policy is evaluated by a real cloud.",
    "There is no live cluster, cloud account, console or CLI; troubleshooting is reading the files and the supplied log lines.",
    "Log tickets run the student's function in their own browser; the server compares the outputs it is sent with its own answers and never runs or reads the code, so the explain-your-work interview is the only check that the student understands it.",
    "Monitoring tools, networking (VPC, DNS, load balancers) and talking to a customer are listed as unassessed.",
    "Tickets come only from fixed templates (no AI-written variants), so a student can meet the same ticket again.",
  ],
};
