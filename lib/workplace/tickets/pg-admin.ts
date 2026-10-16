import { BRIGHTCART } from "../worlds/brightcart";
import type { TicketTemplate } from "./types";
import { makeScript, probe } from "./pg-support";

const { cast } = BRIGHTCART;
const AREAS = ["security"];

const D = {
  readOnly: { id: "pg-read-only-role", difficulty: "easy", minLevel: "junior", taskKind: "security", areas: AREAS },
  columns: { id: "pg-column-privileges", difficulty: "medium", minLevel: "mid", taskKind: "security", areas: AREAS },
  rls: { id: "pg-row-level-security", difficulty: "hard", minLevel: "senior", taskKind: "security", areas: AREAS },
} as const satisfies Record<string, Pick<TicketTemplate, "id" | "difficulty" | "minLevel" | "taskKind" | "areas">>;

const priv = (role: string, table: string, p: string) => `has_table_privilege('${role}', '${table}', '${p}')::int`;
const colPriv = (role: string, table: string, col: string) => `has_column_privilege('${role}', '${table}', '${col}', 'SELECT')::int`;

export const PG_ADMIN: TicketTemplate[] = [
  {
    ...D.readOnly,
    build(rng) {
      const role = rng.pick(["report_reader", "analytics_viewer", "finance_readonly"]);
      const check = `SELECT ${priv(role, "orders", "SELECT")} AS orders_read, ${priv(role, "order_items", "SELECT")} AS items_read, ${priv(role, "products", "SELECT")} AS products_read, ${priv(role, "customers", "SELECT")} AS customers_read, ${priv(role, "orders", "UPDATE")} AS orders_write`;
      return makeScript(D.readOnly, ["PostgreSQL", "Roles", "GRANT", "Least privilege"], {
        title: `A read-only role for the reporting tool (${role})`,
        requester: cast.security,
        scenario: "Hi, we are connecting a reporting tool to the database and it must never be able to change data or see customers' personal details. Please create it a login-less role with exactly the access it needs: it reads orders, order items and products, and nothing else.",
        deliverable: `Create a role ${role} that cannot log in. Grant it SELECT on orders, order_items and products only. It must have no access to customers and no write permission anywhere.`,
        referenceScript: `CREATE ROLE ${role} NOLOGIN;\nGRANT SELECT ON orders, order_items, products TO ${role};`,
        mistakeScript: `CREATE ROLE ${role} NOLOGIN;\nGRANT ALL ON ALL TABLES IN SCHEMA public TO ${role};`,
        probes: [probe("The role has exactly the right access", check)],
        previewQuery: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
      });
    },
  },
  {
    ...D.columns,
    build() {
      const check = `SELECT ${colPriv("support_agent", "customers", "customer_id")} AS id_visible, ${colPriv("support_agent", "customers", "city")} AS city_visible, ${colPriv("support_agent", "customers", "segment")} AS segment_visible, ${colPriv("support_agent", "customers", "name")} AS name_visible, ${colPriv("support_agent", "customers", "signup_date")} AS signup_visible`;
      return makeScript(D.columns, ["PostgreSQL", "Column privileges", "Data privacy"], {
        title: "Support agents may see where a customer is, not who they are",
        requester: cast.security,
        scenario: "Hello, our new support agents need to see a customer's id, city and segment to route tickets, but under our privacy policy they must not see names or signup dates. Please set that up at the database level, not in the app.",
        deliverable: "Create a login-less role support_agent and give it SELECT on only the columns customer_id, city and segment of customers. It must not be able to read any other column.",
        referenceScript: "CREATE ROLE support_agent NOLOGIN;\nGRANT SELECT (customer_id, city, segment) ON customers TO support_agent;",
        mistakeScript: "CREATE ROLE support_agent NOLOGIN;\nGRANT SELECT ON customers TO support_agent;",
        probes: [probe("Exactly the right columns are visible", check)],
        previewQuery: "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'customers' ORDER BY ordinal_position",
      });
    },
  },
  {
    ...D.rls,
    build(rng) {
      const city = rng.pick(["Mumbai", "Delhi", "Pune"]);
      const policy = (using: string) => `ALTER TABLE customers ENABLE ROW LEVEL SECURITY;\nCREATE POLICY city_only ON customers FOR SELECT TO city_manager USING (${using});`;
      return makeScript(D.rls, ["PostgreSQL", "Row-level security", "Policies"], {
        title: `City managers see only their own city (${city})`,
        requester: cast.security,
        scenario: `Hi, our ${city} manager logs in with the shared city_manager role and can currently read every customer in the country. Regional managers must only see customers in their own city. The role already exists with read access; the rows it may see are what you need to control.`,
        deliverable: `Turn on row-level security for customers and create a policy that lets city_manager SELECT only the rows where city is exactly '${city}'. Other roles are not affected.`,
        referenceScript: policy(`city = '${city}'`),
        mistakeScript: policy("true"),
        extraSetupSql: "CREATE ROLE city_manager NOLOGIN;\nGRANT SELECT ON customers TO city_manager;",
        probes: [
          probe("Act as the city manager", "SET ROLE city_manager", false),
          probe("The city manager sees only their city", "SELECT COUNT(*) AS visible_customers FROM customers"),
          probe("Stop acting as the city manager", "RESET ROLE", false),
          probe("Everyone else still sees all customers", "SELECT COUNT(*) AS all_customers FROM customers"),
        ],
        previewQuery: "SELECT city, COUNT(*) AS customers FROM customers GROUP BY city ORDER BY city",
      });
    },
  },
];
