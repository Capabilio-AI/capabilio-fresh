import type { RoleToolkit } from "./types";

/** MCA-04 Cloud and Platform Support Engineer. Two shared workstations (W14, W10 in docs/arena-roles/workstation-design.md) with this role's own areas. */
export const TOOLKIT: RoleToolkit = {
  roleKey: "cloud-platform-support-engineer",
  roleId: "MCA-04",
  stream: "MCA",
  headline: "Fix what a customer sends the support desk: an unsafe container image, a pod that restarts, a Service that routes nowhere, a policy that allows too much and a log that hides the failing service.",
  workstations: [
    {
      name: "Config Editor",
      mirrors: ["VS Code", "kubectl (manifests)", "Docker", "GitHub Actions"],
      toolType: "devops_workspace",
      tier: "A",
      runsIn: "server",
      summary: "Fix the ticket's files; the server checks the text against its rules. Nothing is built, applied or deployed.",
    },
    {
      name: "Code Editor",
      mirrors: ["VS Code", "IntelliJ IDEA", "Jupyter"],
      toolType: "code_workspace",
      tier: "R",
      runsIn: "browser",
      summary: "Write one Python or JavaScript function to the ticket's spec, run it on the cases in your browser, and submit what it returned.",
    },
  ],
  environment: [
    { label: "Config files", detail: "Each ticket opens the customer's Dockerfile, Kubernetes YAML, IAM policy or Compose file; rules are checked on submit." },
    { label: "Runtimes", detail: "Python (Pyodide) and JavaScript run in your browser for the log tickets; nothing has to be installed on your machine." },
    { label: "Customer", detail: "A fictional platform team and its support desk give each ticket a requester and a reason." },
  ],
  firstWeek: [
    "Harden a customer's Node image: pinned base, non-root user, health check",
    "Stop a pod being killed: replicas, memory limits and a readiness probe",
    "Find why a Service answers 'connection refused' although the pods run",
    "Cut a reporting tool's IAM policy down to one bucket and one action",
    "Remove a database password from a Compose file and close its public port",
    "Count log lines by level and rank the services that fail most",
  ],
  portfolioArtifacts: [
    "Graded config tickets with the per-requirement checks that passed",
    "Graded log-triage code tickets with per-case results",
  ],
  honestLimits: [
    "Config files are checked as text: no image is built, no manifest is applied and no policy is evaluated by a real cloud.",
    "There is no live cluster, cloud account, console or CLI; troubleshooting means reading the files and the supplied log lines.",
    "Code runs in your browser (client-run): the server compares the outputs you submit with its own answers and never runs or reads your code.",
    "Monitoring, networking (VPC, DNS, load balancers) and customer communication are not assessed yet.",
  ],
};
