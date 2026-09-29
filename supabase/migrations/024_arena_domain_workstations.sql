-- Domain Challenges: professional role workstations, starting with Data
-- Analyst. Tickets live in arena_challenges (track 'domain', kind 'sql') so
-- completions, history, leaderboard and evidence are shared with Stream.

alter table public.arena_challenges
  add column ground_truth_query text,
  add column requester text,
  add column sequence integer;

alter table public.arena_challenges drop constraint arena_challenges_kind_check;
alter table public.arena_challenges add constraint arena_challenges_kind_check check (kind in ('code', 'numeric', 'sql'));

-- Security: the old read_all policy exposed every column to the browser,
-- including expected_output (Stream answer keys) and now ground_truth_query.
-- Students may only read the non-secret columns; the API routes use the
-- service role and are unaffected.
revoke select on public.arena_challenges from anon, authenticated;
grant select (id, track, scope_key, kind, title, category, difficulty, time_limit_minutes, scenario, objective, language, starter_code, stdin, answer_unit, skill_tags, requester, sequence, active, created_at) on public.arena_challenges to authenticated;

-- One row per ticket handed to a student. An open ticket (completed_at null)
-- stays until solved; the next unlocks at next_available_at (completion + 24h).
create table public.arena_domain_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role_key text not null,
  challenge_id uuid not null references public.arena_challenges(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  completed_at timestamptz,
  next_available_at timestamptz,
  unique (user_id, challenge_id)
);

-- At most one open ticket per student per role, enforced by the database
-- (two tabs loading at once can't both hand out a ticket).
create unique index arena_domain_assignments_one_open on public.arena_domain_assignments(user_id, role_key) where completed_at is null;

alter table public.arena_domain_assignments enable row level security;
create policy arena_domain_assignments_self_read on public.arena_domain_assignments for select using (user_id = auth.uid());

insert into public.arena_challenges (track, scope_key, kind, sequence, title, category, difficulty, time_limit_minutes, scenario, objective, language, starter_code, expected_output, ground_truth_query, requester, skill_tags) values
  ('domain', 'data-analyst', 'sql', 1, 'August sales number for the Monday stand-up', 'Sales Reporting', 'easy', 15, 'Hi! Welcome aboard. For Monday''s stand-up I need the headline August number. Leadership only counts orders that were actually delivered — cancelled and returned orders don''t count as sales.', 'Return ONE row with two columns: delivered_orders (count of delivered orders placed in August 2026) and revenue (sum of their amount, rounded to 2 decimals).', 'sql', '-- UrbanKart analytics warehouse (SQLite). Tables: customers, products, orders.
-- Run as often as you like (Ctrl/Cmd + Enter), then Submit when your result matches the deliverable.

', '', 'SELECT COUNT(*) AS delivered_orders, ROUND(SUM(amount), 2) AS revenue FROM orders WHERE status = ''delivered'' AND order_date BETWEEN ''2026-08-01'' AND ''2026-08-31''', 'Priya Menon · Sales Operations Manager', array['SQL', 'Aggregation', 'Filtering']),
  ('domain', 'data-analyst', 'sql', 2, 'Revenue by category for the monthly business review', 'Sales Reporting', 'easy', 20, 'The category heads want to see how their categories did this quarter (June–August). Same rule as always: delivered orders only.', 'Return one row per product category with columns: category, orders (count of delivered orders), revenue (sum of amount, rounded to 2 decimals). Sort by revenue, highest first.', 'sql', '-- UrbanKart analytics warehouse (SQLite). Tables: customers, products, orders.
-- Run as often as you like (Ctrl/Cmd + Enter), then Submit when your result matches the deliverable.

', '', 'SELECT p.category, COUNT(*) AS orders, ROUND(SUM(o.amount), 2) AS revenue FROM orders o JOIN products p ON p.product_id = o.product_id WHERE o.status = ''delivered'' GROUP BY p.category ORDER BY revenue DESC', 'Priya Menon · Sales Operations Manager', array['SQL', 'JOIN', 'GROUP BY']),
  ('domain', 'data-analyst', 'sql', 3, 'Data quality check before the CRM dashboard refresh', 'Data Quality', 'easy', 20, 'Before we refresh the customer dashboard I want a quick health check on the customers table. Last month duplicate sign-ups inflated our customer count and nobody noticed until the CEO asked.', 'Return ONE row with three columns: total_rows (rows in customers), missing_emails (rows where email is NULL), duplicate_signups (number of extra rows caused by the same non-NULL email appearing more than once — e.g. an email that appears twice contributes 1).', 'sql', '-- UrbanKart analytics warehouse (SQLite). Tables: customers, products, orders.
-- Run as often as you like (Ctrl/Cmd + Enter), then Submit when your result matches the deliverable.

', '', 'SELECT (SELECT COUNT(*) FROM customers) AS total_rows, (SELECT COUNT(*) FROM customers WHERE email IS NULL) AS missing_emails, (SELECT COUNT(*) - COUNT(DISTINCT email) FROM customers WHERE email IS NOT NULL) AS duplicate_signups', 'Arjun Rao · Analytics Lead', array['SQL', 'Data Quality', 'NULL handling', 'Deduplication']),
  ('domain', 'data-analyst', 'sql', 4, 'Cancellation rate by channel', 'Operations', 'easy', 20, 'I think the app checkout is causing more cancellations than web, but I need numbers before I raise it in the product review. Use all orders from June to August.', 'Return one row per channel with columns: channel, total_orders, cancelled_orders, cancellation_rate_pct (cancelled / total × 100, rounded to 1 decimal).', 'sql', '-- UrbanKart analytics warehouse (SQLite). Tables: customers, products, orders.
-- Run as often as you like (Ctrl/Cmd + Enter), then Submit when your result matches the deliverable.

', '', 'SELECT channel, COUNT(*) AS total_orders, SUM(status = ''cancelled'') AS cancelled_orders, ROUND(100.0 * SUM(status = ''cancelled'') / COUNT(*), 1) AS cancellation_rate_pct FROM orders GROUP BY channel', 'Sneha Iyer · Product Manager, App', array['SQL', 'Conditional aggregation', 'Rates']),
  ('domain', 'data-analyst', 'sql', 5, 'Month-over-month revenue trend', 'Sales Reporting', 'medium', 25, 'Finance is asking whether we are growing. Give me delivered revenue for each month of the quarter so I can put a trend line in the deck.', 'Return one row per month with columns: month (formatted YYYY-MM) and revenue (delivered amount, rounded to 2 decimals), ordered by month.', 'sql', '-- UrbanKart analytics warehouse (SQLite). Tables: customers, products, orders.
-- Run as often as you like (Ctrl/Cmd + Enter), then Submit when your result matches the deliverable.

', '', 'SELECT substr(order_date, 1, 7) AS month, ROUND(SUM(amount), 2) AS revenue FROM orders WHERE status = ''delivered'' GROUP BY month ORDER BY month', 'Priya Menon · Sales Operations Manager', array['SQL', 'Date functions', 'Trend analysis']),
  ('domain', 'data-analyst', 'sql', 6, 'Top 5 customers for the loyalty campaign', 'Customer Analytics', 'medium', 25, 'We''re sending a thank-you voucher to our five most valuable customers. Rank by how much they actually spent with us (delivered orders only).', 'Return exactly 5 rows with columns: customer_id, name, total_spent (sum of delivered amount, rounded to 2 decimals), highest first.', 'sql', '-- UrbanKart analytics warehouse (SQLite). Tables: customers, products, orders.
-- Run as often as you like (Ctrl/Cmd + Enter), then Submit when your result matches the deliverable.

', '', 'SELECT c.customer_id, c.name, ROUND(SUM(o.amount), 2) AS total_spent FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE o.status = ''delivered'' GROUP BY c.customer_id, c.name ORDER BY total_spent DESC LIMIT 5', 'Kavya Nair · CRM Marketing', array['SQL', 'JOIN', 'Ranking', 'LIMIT']),
  ('domain', 'data-analyst', 'sql', 7, 'City-wise revenue (the city column is messy)', 'Data Quality', 'medium', 30, 'Regional managers keep getting different numbers for their city because the CRM stores ''Mumbai'', ''mumbai'' and '' Delhi'' as different values. Clean it in the query — don''t touch the table.', 'Return one row per cleaned city with columns: city (trimmed and lower-cased) and revenue (delivered amount, rounded to 2 decimals), highest revenue first.', 'sql', '-- UrbanKart analytics warehouse (SQLite). Tables: customers, products, orders.
-- Run as often as you like (Ctrl/Cmd + Enter), then Submit when your result matches the deliverable.

', '', 'SELECT lower(trim(c.city)) AS city, ROUND(SUM(o.amount), 2) AS revenue FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE o.status = ''delivered'' GROUP BY lower(trim(c.city)) ORDER BY revenue DESC', 'Arjun Rao · Analytics Lead', array['SQL', 'Data cleaning', 'String functions', 'JOIN']),
  ('domain', 'data-analyst', 'sql', 8, 'Average order value: Premium vs Regular', 'Customer Analytics', 'medium', 25, 'We''re deciding whether the Premium membership is worth promoting. Do Premium customers actually spend more per order?', 'Return one row per segment with columns: segment, delivered_orders, avg_order_value (average delivered amount, rounded to 2 decimals).', 'sql', '-- UrbanKart analytics warehouse (SQLite). Tables: customers, products, orders.
-- Run as often as you like (Ctrl/Cmd + Enter), then Submit when your result matches the deliverable.

', '', 'SELECT c.segment, COUNT(*) AS delivered_orders, ROUND(AVG(o.amount), 2) AS avg_order_value FROM orders o JOIN customers c ON c.customer_id = o.customer_id WHERE o.status = ''delivered'' GROUP BY c.segment', 'Kavya Nair · CRM Marketing', array['SQL', 'JOIN', 'AVG', 'Segmentation']),
  ('domain', 'data-analyst', 'sql', 9, 'Return rate by category', 'Operations', 'medium', 30, 'Returns are expensive for us — reverse logistics plus damaged stock. Which categories get sent back the most? Only count orders that reached the customer (delivered or returned); cancelled orders never shipped.', 'Return one row per category with columns: category, shipped_orders (delivered + returned), returned_orders, return_rate_pct (returned / shipped × 100, rounded to 1 decimal), highest return rate first.', 'sql', '-- UrbanKart analytics warehouse (SQLite). Tables: customers, products, orders.
-- Run as often as you like (Ctrl/Cmd + Enter), then Submit when your result matches the deliverable.

', '', 'SELECT p.category, COUNT(*) AS shipped_orders, SUM(o.status = ''returned'') AS returned_orders, ROUND(100.0 * SUM(o.status = ''returned'') / COUNT(*), 1) AS return_rate_pct FROM orders o JOIN products p ON p.product_id = o.product_id WHERE o.status IN (''delivered'', ''returned'') GROUP BY p.category ORDER BY return_rate_pct DESC', 'Rahul Das · Supply Chain Manager', array['SQL', 'JOIN', 'Conditional aggregation', 'Rates']),
  ('domain', 'data-analyst', 'sql', 10, 'Repeat purchase rate', 'Customer Analytics', 'hard', 35, 'Our investors track repeat purchase rate closely. Of the customers who had at least one delivered order this quarter, what share came back and had another one?', 'Return ONE row with columns: buyers (customers with ≥1 delivered order), repeat_buyers (customers with ≥2 delivered orders), repeat_rate_pct (repeat_buyers / buyers × 100, rounded to 1 decimal).', 'sql', '-- UrbanKart analytics warehouse (SQLite). Tables: customers, products, orders.
-- Run as often as you like (Ctrl/Cmd + Enter), then Submit when your result matches the deliverable.

', '', 'WITH per AS (SELECT customer_id, COUNT(*) AS n FROM orders WHERE status = ''delivered'' GROUP BY customer_id) SELECT COUNT(*) AS buyers, SUM(n >= 2) AS repeat_buyers, ROUND(100.0 * SUM(n >= 2) / COUNT(*), 1) AS repeat_rate_pct FROM per', 'Kavya Nair · CRM Marketing', array['SQL', 'Subqueries', 'Customer retention']),
  ('domain', 'data-analyst', 'sql', 11, 'Which products lost revenue from July to August?', 'Sales Reporting', 'hard', 35, 'August felt soft for some products. Before the pricing meeting, list every product whose delivered revenue in August was lower than in July.', 'Return one row per declining product with columns: product_name, july_revenue, august_revenue, change (august − july), all rounded to 2 decimals, biggest drop first. A product with no August sales counts as 0 for August.', 'sql', '-- UrbanKart analytics warehouse (SQLite). Tables: customers, products, orders.
-- Run as often as you like (Ctrl/Cmd + Enter), then Submit when your result matches the deliverable.

', '', 'SELECT p.product_name, ROUND(SUM(CASE WHEN substr(o.order_date,1,7)=''2026-07'' THEN o.amount ELSE 0 END), 2) AS july_revenue, ROUND(SUM(CASE WHEN substr(o.order_date,1,7)=''2026-08'' THEN o.amount ELSE 0 END), 2) AS august_revenue, ROUND(SUM(CASE WHEN substr(o.order_date,1,7)=''2026-08'' THEN o.amount ELSE 0 END) - SUM(CASE WHEN substr(o.order_date,1,7)=''2026-07'' THEN o.amount ELSE 0 END), 2) AS change FROM orders o JOIN products p ON p.product_id = o.product_id WHERE o.status = ''delivered'' GROUP BY p.product_name HAVING change < 0 ORDER BY change ASC', 'Priya Menon · Sales Operations Manager', array['SQL', 'Conditional aggregation', 'Period comparison']),
  ('domain', 'data-analyst', 'sql', 12, 'July sign-up cohort: how many bought within 30 days?', 'Customer Analytics', 'hard', 35, 'We changed the onboarding flow in July. I want to know how the July sign-up cohort converted to a first purchase.', 'Return ONE row with columns: july_signups (customers whose signup_date is in July 2026), converted (of those, customers with a delivered order within 30 days of signing up, i.e. order_date between signup_date and signup_date + 30 days), conversion_pct (converted / july_signups × 100, rounded to 1 decimal).', 'sql', '-- UrbanKart analytics warehouse (SQLite). Tables: customers, products, orders.
-- Run as often as you like (Ctrl/Cmd + Enter), then Submit when your result matches the deliverable.

', '', 'SELECT COUNT(*) AS july_signups, SUM(EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.status = ''delivered'' AND o.order_date BETWEEN c.signup_date AND date(c.signup_date, ''+30 days''))) AS converted, ROUND(100.0 * SUM(EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.status = ''delivered'' AND o.order_date BETWEEN c.signup_date AND date(c.signup_date, ''+30 days''))) / COUNT(*), 1) AS conversion_pct FROM customers c WHERE c.signup_date BETWEEN ''2026-07-01'' AND ''2026-07-31''', 'Sneha Iyer · Product Manager, App', array['SQL', 'Cohort analysis', 'Date arithmetic', 'EXISTS']);
