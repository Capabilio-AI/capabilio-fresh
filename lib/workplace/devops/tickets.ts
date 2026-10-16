import type { FileContent, FileDraft, FileTemplate } from "../file-tasks/types";
import { MAX_SUBMISSIONS } from "../file-tasks/types";
import type { Check } from "./checks";

export { MAX_SUBMISSIONS };

export type DevopsContent = FileContent;
export interface DevopsKey {
  checks: Check[];
}
export type DevopsDraft = FileDraft<Check>;
export type DevopsTemplate = FileTemplate<Check>;

const PLATFORM = { name: "Isha Bhatt", title: "Platform Engineering Manager" };
const SRE = { name: "Karthik Menon", title: "Site Reliability Lead" };
const CLOUD = { name: "Meera Pillai", title: "Cloud Security Lead" };
const ARCH = { name: "Rohan Mehta", title: "Cloud Architect" };

const make = (title: string, requester: DevopsDraft["requester"], scenario: string, deliverable: string, tags: string[], files: DevopsContent["files"], checks: Check[]): DevopsDraft => ({
  title, requester, scenario, skillTags: tags,
  content: { files, requirements: checks.map((c) => c.label), deliverable, maxSubmissions: MAX_SUBMISSIONS },
  key: { checks },
});

/** The fixed tickets are the safety net for when the AI cannot produce a valid one; each has a known-good solution that the tests run through the checks. */
export const DEVOPS_TEMPLATES: DevopsTemplate[] = [
  {
    id: "devops-harden-dockerfile", areas: ["containers"], difficulty: "easy", minLevel: "fresher",
    draft: make("Harden the API's Dockerfile", PLATFORM, "Hi, security flagged our API image: it uses a moving base tag, runs as root and rebuilds all dependencies on every code change. Please fix the Dockerfile before the next release.", "Edit the Dockerfile to meet the requirements below.", ["Docker", "Dockerfile", "Container security"],
      [{ name: "Dockerfile", language: "dockerfile", content: "FROM node:latest\nWORKDIR /app\nCOPY . .\nRUN npm install\nEXPOSE 3000\nCMD [\"node\", \"server.js\"]\n" }],
      [
        { kind: "docker", label: "The base image is pinned to a version (not latest)", file: "Dockerfile", instr: "FROM", op: "first_matches", value: "^[\\w./-]+:\\d" },
        { kind: "docker", label: "The container does not run as root (a USER instruction sets another user)", file: "Dockerfile", instr: "USER", op: "last_matches", value: "^(?!root)\\S+" },
        { kind: "docker", label: "Dependencies are installed before the application source is copied", file: "Dockerfile", instr: "RUN", op: "before", value: "npm (ci|install)", other: "COPY \\. \\." },
        { kind: "docker", label: "The app still starts with CMD", file: "Dockerfile", instr: "CMD", op: "exists" },
      ]),
    solution: [{ name: "Dockerfile", content: "FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev\nCOPY . .\nUSER node\nEXPOSE 3000\nCMD [\"node\", \"server.js\"]\n" }],
  },
  {
    id: "devops-github-actions-ci", areas: ["ci-cd"], difficulty: "easy", minLevel: "fresher",
    draft: make("Set up CI for the web app", PLATFORM, "Hello, we have no automated checks: broken code reaches main. Please add a GitHub Actions workflow that tests every push and every pull request.", "Complete .github/workflows/ci.yml to meet the requirements below.", ["GitHub Actions", "CI", "YAML"],
      [{ name: ".github/workflows/ci.yml", language: "yaml", content: "name: CI\non:\n  workflow_dispatch:\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n" }],
      [
        { kind: "yaml", label: "The workflow runs on push", file: ".github/workflows/ci.yml", path: "on.push", op: "exists" },
        { kind: "yaml", label: "The workflow also runs on pull requests", file: ".github/workflows/ci.yml", path: "on.pull_request", op: "exists" },
        { kind: "yaml", label: "Node.js is set up with actions/setup-node", file: ".github/workflows/ci.yml", path: "jobs.test.steps[*].uses", op: "contains", value: "actions/setup-node" },
        { kind: "yaml", label: "Dependencies are installed with npm ci", file: ".github/workflows/ci.yml", path: "jobs.test.steps[*].run", op: "contains", value: "npm ci" },
        { kind: "yaml", label: "The tests are run with npm test", file: ".github/workflows/ci.yml", path: "jobs.test.steps[*].run", op: "contains", value: "npm test" },
      ]),
    solution: [{ name: ".github/workflows/ci.yml", content: "name: CI\non:\n  push:\n  pull_request:\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - run: npm ci\n      - run: npm test\n" }],
  },
  {
    id: "devops-k8s-deployment", areas: ["kubernetes"], difficulty: "medium", minLevel: "junior",
    draft: make("Make the checkout deployment production-ready", SRE, "Hi, the checkout service took the node down last week because it had no resource limits, and a bad release went live because nothing checked it was ready. Please fix the Deployment.", "Edit deployment.yaml to meet the requirements below.", ["Kubernetes", "Deployments", "Probes", "Resource limits"],
      [{ name: "deployment.yaml", language: "yaml", content: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: checkout\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: checkout\n  template:\n    metadata:\n      labels:\n        app: checkout\n    spec:\n      containers:\n        - name: checkout\n          image: registry.example.com/checkout:latest\n          ports:\n            - containerPort: 8080\n" }],
      [
        { kind: "yaml", label: "At least 2 replicas run", file: "deployment.yaml", path: "spec.replicas", op: "matches", value: "^([2-9]|\\d{2,})$" },
        { kind: "yaml", label: "The image is pinned to a version tag (not latest)", file: "deployment.yaml", path: "spec.template.spec.containers[*].image", op: "all_match", value: ":(?!latest$)[\\w.-]+$" },
        { kind: "yaml", label: "The container has a memory limit", file: "deployment.yaml", path: "spec.template.spec.containers[*].resources.limits.memory", op: "exists" },
        { kind: "yaml", label: "The container has a CPU request", file: "deployment.yaml", path: "spec.template.spec.containers[*].resources.requests.cpu", op: "exists" },
        { kind: "yaml", label: "A readiness probe is defined", file: "deployment.yaml", path: "spec.template.spec.containers[*].readinessProbe", op: "exists" },
      ]),
    solution: [{ name: "deployment.yaml", content: "apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: checkout\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: checkout\n  template:\n    metadata:\n      labels:\n        app: checkout\n    spec:\n      containers:\n        - name: checkout\n          image: registry.example.com/checkout:1.4.2\n          ports:\n            - containerPort: 8080\n          resources:\n            requests:\n              cpu: 100m\n            limits:\n              memory: 256Mi\n          readinessProbe:\n            httpGet:\n              path: /healthz\n              port: 8080\n" }],
  },
  {
    id: "devops-compose-healthcheck", areas: ["infrastructure-as-code"], difficulty: "medium", minLevel: "junior",
    draft: make("Make the app wait for its database", SRE, "Hello, our local stack often fails because the app starts before the database is ready, and nothing restarts the app when it crashes. Please fix the compose file.", "Edit docker-compose.yml to meet the requirements below.", ["Docker Compose", "Health checks", "Infrastructure as code"],
      [{ name: "docker-compose.yml", language: "yaml", content: "services:\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD: example\n  app:\n    image: myorg/app:1.0\n    depends_on:\n      - db\n" }],
      [
        { kind: "yaml", label: "The database has a healthcheck", file: "docker-compose.yml", path: "services.db.healthcheck.test", op: "exists" },
        { kind: "yaml", label: "The app waits until the database is healthy", file: "docker-compose.yml", path: "services.app.depends_on.db.condition", op: "equals", value: "service_healthy" },
        { kind: "yaml", label: "The app restarts unless it is stopped on purpose", file: "docker-compose.yml", path: "services.app.restart", op: "equals", value: "unless-stopped" },
        { kind: "yaml", label: "The database keeps its data in a named volume", file: "docker-compose.yml", path: "services.db.volumes", op: "exists" },
      ]),
    solution: [{ name: "docker-compose.yml", content: "services:\n  db:\n    image: postgres:16\n    environment:\n      POSTGRES_PASSWORD: example\n    volumes:\n      - dbdata:/var/lib/postgresql/data\n    healthcheck:\n      test: [\"CMD-SHELL\", \"pg_isready -U postgres\"]\n      interval: 5s\n      retries: 5\n  app:\n    image: myorg/app:1.0\n    restart: unless-stopped\n    depends_on:\n      db:\n        condition: service_healthy\nvolumes:\n  dbdata:\n" }],
  },
  {
    id: "devops-debug-workflow", areas: ["config-debugging"], difficulty: "medium", minLevel: "junior",
    draft: make("Fix: the pipeline never runs the tests properly", PLATFORM, "Hi, our workflow goes green but the tests never really run, and one step fails randomly. Someone made a few mistakes in the file. Please find them and fix the workflow.", "Fix .github/workflows/ci.yml so it meets the requirements below.", ["GitHub Actions", "Debugging", "YAML"],
      [{ name: ".github/workflows/ci.yml", language: "yaml", content: "name: CI\non: [push]\njobs:\n  test:\n    runs_on: ubuntu-latest\n    steps:\n      - uses: actions/checkout\n      - run: npm test\n      - run: npm ci\n" }],
      [
        { kind: "yaml", label: "The job picks its runner with runs-on (with a hyphen)", file: ".github/workflows/ci.yml", path: "jobs.test.runs-on", op: "exists" },
        { kind: "yaml", label: "Checkout uses a pinned version (actions/checkout@v4)", file: ".github/workflows/ci.yml", path: "jobs.test.steps[*].uses", op: "matches", value: "^actions/checkout@v\\d+" },
        { kind: "yaml", label: "npm ci runs before npm test", file: ".github/workflows/ci.yml", path: "jobs.test.steps[1].run", op: "contains", value: "npm ci" },
        { kind: "yaml", label: "npm test is still run", file: ".github/workflows/ci.yml", path: "jobs.test.steps[*].run", op: "contains", value: "npm test" },
      ]),
    solution: [{ name: ".github/workflows/ci.yml", content: "name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci\n      - run: npm test\n" }],
  },
  // ---- Cloud (AWS) ----
  {
    id: "cloud-iam-least-privilege", areas: ["iam-security"], difficulty: "easy", minLevel: "fresher",
    draft: make("Give the report job only the access it needs", CLOUD, "Hi, the nightly report job uses an IAM policy that allows everything on S3 for every bucket. Security wants it cut down to reading from the reports-prod bucket only.", "Edit policy.json to meet the requirements below.", ["AWS IAM", "Least privilege", "Policies"],
      [{ name: "policy.json", language: "json", content: "{\n  \"Version\": \"2012-10-17\",\n  \"Statement\": [\n    {\n      \"Effect\": \"Allow\",\n      \"Action\": \"s3:*\",\n      \"Resource\": \"*\"\n    }\n  ]\n}\n" }],
      [
        { kind: "yaml", label: "The policy language version is 2012-10-17", file: "policy.json", path: "Version", op: "equals", value: "2012-10-17" },
        { kind: "yaml", label: "Actions are a list of only s3:GetObject and s3:ListBucket", file: "policy.json", path: "Statement[*].Action[*]", op: "all_match", value: "^s3:(GetObject|ListBucket)$" },
        { kind: "yaml", label: "Resources are only the reports-prod bucket and its objects", file: "policy.json", path: "Statement[*].Resource[*]", op: "all_match", value: "^arn:aws:s3:::reports-prod(/\\*)?$" },
        { kind: "yaml", label: "Every statement is an Allow", file: "policy.json", path: "Statement[*].Effect", op: "all_match", value: "^Allow$" },
      ]),
    solution: [{ name: "policy.json", content: "{\n  \"Version\": \"2012-10-17\",\n  \"Statement\": [\n    {\n      \"Effect\": \"Allow\",\n      \"Action\": [\"s3:GetObject\", \"s3:ListBucket\"],\n      \"Resource\": [\"arn:aws:s3:::reports-prod\", \"arn:aws:s3:::reports-prod/*\"]\n    }\n  ]\n}\n" }],
  },
  {
    id: "cloud-security-group", areas: ["networking"], difficulty: "medium", minLevel: "junior",
    draft: make("Close the security group that is open to the internet", CLOUD, "Hello, a scan found SSH and the database port open to the whole internet on our app servers. SSH should only be reachable from the corporate network 10.0.0.0/16 and MySQL only from the app subnet 10.0.1.0/24.", "Edit template.yml to meet the requirements below.", ["AWS VPC", "Security groups", "CloudFormation"],
      [{ name: "template.yml", language: "yaml", content: "AWSTemplateFormatVersion: \"2010-09-09\"\nResources:\n  AppSecurityGroup:\n    Type: AWS::EC2::SecurityGroup\n    Properties:\n      GroupDescription: App servers\n      VpcId: !Ref VpcId\n      SecurityGroupIngress:\n        - IpProtocol: tcp\n          FromPort: 22\n          ToPort: 22\n          CidrIp: 0.0.0.0/0\n        - IpProtocol: tcp\n          FromPort: 3306\n          ToPort: 3306\n          CidrIp: 0.0.0.0/0\n" }],
      [
        { kind: "yaml", label: "No ingress rule is open to 0.0.0.0/0", file: "template.yml", path: "Resources.*.Properties.SecurityGroupIngress[*].CidrIp", op: "all_match", value: "^(?!0\\.0\\.0\\.0/0$)" },
        { kind: "yaml", label: "SSH (port 22) is allowed only from 10.0.0.0/16", file: "template.yml", path: "Resources.*.Properties.SecurityGroupIngress[*].CidrIp", op: "contains", value: "10.0.0.0/16" },
        { kind: "yaml", label: "MySQL (port 3306) is allowed only from 10.0.1.0/24", file: "template.yml", path: "Resources.*.Properties.SecurityGroupIngress[*].CidrIp", op: "contains", value: "10.0.1.0/24" },
        { kind: "yaml", label: "The security group keeps its description", file: "template.yml", path: "Resources.*.Properties.GroupDescription", op: "exists" },
      ]),
    solution: [{ name: "template.yml", content: "AWSTemplateFormatVersion: \"2010-09-09\"\nResources:\n  AppSecurityGroup:\n    Type: AWS::EC2::SecurityGroup\n    Properties:\n      GroupDescription: App servers\n      VpcId: !Ref VpcId\n      SecurityGroupIngress:\n        - IpProtocol: tcp\n          FromPort: 22\n          ToPort: 22\n          CidrIp: 10.0.0.0/16\n        - IpProtocol: tcp\n          FromPort: 3306\n          ToPort: 3306\n          CidrIp: 10.0.1.0/24\n" }],
  },
  {
    id: "cloud-s3-secure-bucket", areas: ["storage-and-data"], difficulty: "easy", minLevel: "fresher",
    draft: make("Make the invoices bucket safe to hold customer data", CLOUD, "Hi, the invoices bucket was created with defaults, so it has no encryption, no version history and nothing stopping someone from making it public. Please fix the template.", "Edit template.yml to meet the requirements below.", ["Amazon S3", "Encryption", "CloudFormation"],
      [{ name: "template.yml", language: "yaml", content: "AWSTemplateFormatVersion: \"2010-09-09\"\nResources:\n  InvoicesBucket:\n    Type: AWS::S3::Bucket\n    Properties:\n      BucketName: acme-invoices\n" }],
      [
        { kind: "yaml", label: "Versioning is enabled", file: "template.yml", path: "Resources.*.Properties.VersioningConfiguration.Status", op: "equals", value: "Enabled" },
        { kind: "yaml", label: "Default encryption is configured", file: "template.yml", path: "Resources.*.Properties.BucketEncryption.ServerSideEncryptionConfiguration[*].ServerSideEncryptionByDefault.SSEAlgorithm", op: "exists" },
        { kind: "yaml", label: "Public ACLs are blocked", file: "template.yml", path: "Resources.*.Properties.PublicAccessBlockConfiguration.BlockPublicAcls", op: "equals", value: true },
        { kind: "yaml", label: "Public bucket policies are restricted", file: "template.yml", path: "Resources.*.Properties.PublicAccessBlockConfiguration.RestrictPublicBuckets", op: "equals", value: true },
        { kind: "yaml", label: "It is still an S3 bucket", file: "template.yml", path: "Resources.*.Type", op: "equals", value: "AWS::S3::Bucket" },
      ]),
    solution: [{ name: "template.yml", content: "AWSTemplateFormatVersion: \"2010-09-09\"\nResources:\n  InvoicesBucket:\n    Type: AWS::S3::Bucket\n    Properties:\n      BucketName: acme-invoices\n      VersioningConfiguration:\n        Status: Enabled\n      BucketEncryption:\n        ServerSideEncryptionConfiguration:\n          - ServerSideEncryptionByDefault:\n              SSEAlgorithm: AES256\n      PublicAccessBlockConfiguration:\n        BlockPublicAcls: true\n        BlockPublicPolicy: true\n        IgnorePublicAcls: true\n        RestrictPublicBuckets: true\n" }],
  },
  {
    id: "cloud-lambda-config", areas: ["serverless-and-compute"], difficulty: "medium", minLevel: "junior",
    draft: make("Fix the order-processing Lambda before it times out again", ARCH, "Hello, the order Lambda runs on an end-of-life runtime, times out after 3 seconds under load and we cannot see where time is spent. Please fix its definition.", "Edit template.yml to meet the requirements below.", ["AWS Lambda", "Serverless", "SAM"],
      [{ name: "template.yml", language: "yaml", content: "AWSTemplateFormatVersion: \"2010-09-09\"\nTransform: AWS::Serverless-2016-10-31\nResources:\n  OrderFunction:\n    Type: AWS::Serverless::Function\n    Properties:\n      Handler: app.handler\n      Runtime: python3.7\n      Timeout: 3\n      MemorySize: 128\n" }],
      [
        { kind: "yaml", label: "The runtime is Python 3.11 or 3.12", file: "template.yml", path: "Resources.*.Properties.Runtime", op: "matches", value: "^python3\\.(11|12)$" },
        { kind: "yaml", label: "The timeout is between 10 and 59 seconds", file: "template.yml", path: "Resources.*.Properties.Timeout", op: "matches", value: "^([1-5]\\d)$" },
        { kind: "yaml", label: "Memory is 256 or 512 MB", file: "template.yml", path: "Resources.*.Properties.MemorySize", op: "matches", value: "^(256|512)$" },
        { kind: "yaml", label: "X-Ray tracing is active", file: "template.yml", path: "Resources.*.Properties.Tracing", op: "equals", value: "Active" },
      ]),
    solution: [{ name: "template.yml", content: "AWSTemplateFormatVersion: \"2010-09-09\"\nTransform: AWS::Serverless-2016-10-31\nResources:\n  OrderFunction:\n    Type: AWS::Serverless::Function\n    Properties:\n      Handler: app.handler\n      Runtime: python3.12\n      Timeout: 20\n      MemorySize: 256\n      Tracing: Active\n" }],
  },
  {
    id: "cloud-rds-resilience", areas: ["cost-and-reliability"], difficulty: "medium", minLevel: "junior",
    draft: make("Make the orders database survive a failure", ARCH, "Hi, last month a single database failure took the shop down for two hours and we had no backup to restore from. Please make the RDS instance resilient.", "Edit template.yml to meet the requirements below.", ["Amazon RDS", "High availability", "Backups"],
      [{ name: "template.yml", language: "yaml", content: "AWSTemplateFormatVersion: \"2010-09-09\"\nResources:\n  OrdersDb:\n    Type: AWS::RDS::DBInstance\n    Properties:\n      Engine: postgres\n      DBInstanceClass: db.t3.medium\n      AllocatedStorage: 50\n      MultiAZ: false\n      BackupRetentionPeriod: 0\n      StorageEncrypted: false\n      DeletionProtection: false\n" }],
      [
        { kind: "yaml", label: "The database runs in more than one availability zone (MultiAZ)", file: "template.yml", path: "Resources.*.Properties.MultiAZ", op: "equals", value: true },
        { kind: "yaml", label: "Backups are kept for at least 7 days", file: "template.yml", path: "Resources.*.Properties.BackupRetentionPeriod", op: "matches", value: "^([7-9]|[1-3]\\d)$" },
        { kind: "yaml", label: "Storage is encrypted", file: "template.yml", path: "Resources.*.Properties.StorageEncrypted", op: "equals", value: true },
        { kind: "yaml", label: "Deletion protection is on", file: "template.yml", path: "Resources.*.Properties.DeletionProtection", op: "equals", value: true },
      ]),
    solution: [{ name: "template.yml", content: "AWSTemplateFormatVersion: \"2010-09-09\"\nResources:\n  OrdersDb:\n    Type: AWS::RDS::DBInstance\n    Properties:\n      Engine: postgres\n      DBInstanceClass: db.t3.medium\n      AllocatedStorage: 50\n      MultiAZ: true\n      BackupRetentionPeriod: 7\n      StorageEncrypted: true\n      DeletionProtection: true\n" }],
  },
  {
    id: "cloud-debug-policy", areas: ["cloud-debugging"], difficulty: "medium", minLevel: "junior",
    draft: make("Fix: the invoice reader gets Access Denied", CLOUD, "Hi, the invoice service cannot read its files and gets Access Denied even though we attached a policy. It looks fine to me, so someone made a few small mistakes in it.", "Fix policy.json so it meets the requirements below.", ["AWS IAM", "Debugging", "Policies"],
      [{ name: "policy.json", language: "json", content: "{\n  \"Version\": \"2012-10-17\",\n  \"Statement\": [\n    {\n      \"Effect\": \"allow\",\n      \"Action\": [\"s3:GetObjects\"],\n      \"Resource\": [\"arn:aws:s3:::invoices-prod\"]\n    }\n  ]\n}\n" }],
      [
        { kind: "yaml", label: "The policy language version is 2012-10-17", file: "policy.json", path: "Version", op: "equals", value: "2012-10-17" },
        { kind: "yaml", label: "The effect is written exactly as Allow", file: "policy.json", path: "Statement[*].Effect", op: "equals", value: "Allow" },
        { kind: "yaml", label: "The action is the real S3 action s3:GetObject", file: "policy.json", path: "Statement[*].Action[*]", op: "equals", value: "s3:GetObject" },
        { kind: "yaml", label: "The resource covers the objects inside invoices-prod (/*)", file: "policy.json", path: "Statement[*].Resource[*]", op: "contains", value: ":::invoices-prod/*" },
      ]),
    solution: [{ name: "policy.json", content: "{\n  \"Version\": \"2012-10-17\",\n  \"Statement\": [\n    {\n      \"Effect\": \"Allow\",\n      \"Action\": [\"s3:GetObject\"],\n      \"Resource\": [\"arn:aws:s3:::invoices-prod/*\"]\n    }\n  ]\n}\n" }],
  },
];
