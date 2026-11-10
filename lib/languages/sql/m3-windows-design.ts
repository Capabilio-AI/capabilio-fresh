import { lesson, q, sec, type TrackModule } from "../types";
import { EMP } from "./m1-queries";

export const windows: TrackModule = {
  key: "sql-windows",
  title: "Window functions",
  summary: "Rank, number and compare rows without collapsing them: the technique behind most interview SQL.",
  lessons: [
    lesson("window-basics", "Ranking and running totals", 14, {
      summary: "A window function computes a value across a set of related rows but, unlike GROUP BY, keeps every row. OVER defines the window.",
      sections: [
        sec("OVER, PARTITION BY and ORDER BY", [
          "PARTITION BY splits rows into groups (like GROUP BY but without collapsing) and ORDER BY inside OVER sets the order within each group. ROW_NUMBER numbers rows 1, 2, 3 with no ties, RANK leaves gaps after ties (1, 1, 3) and DENSE_RANK does not (1, 1, 2).",
        ], {
          title: "Rank within a department",
          code: EMP + "SELECT dept, name, salary, RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS r FROM employee ORDER BY dept, r, name;",
          explanation: "In IT, Ravi and Zed tie for rank 1 and Asha is rank 3 (a gap). In HR, Dev is 1 and Kim 2. Mira is alone in Ops at 1.",
        }),
        sec("Running totals and LAG", [
          "An aggregate with OVER (ORDER BY ...) becomes a running figure: SUM(x) OVER (ORDER BY id) is the cumulative total. LAG(x) reads the previous row's value and LEAD the next, which is how you compute differences between consecutive rows.",
        ], {
          title: "Running total and change",
          code: EMP + "SELECT name, SUM(salary) OVER (ORDER BY id) AS running, salary - LAG(salary) OVER (ORDER BY id) AS change FROM employee ORDER BY id;",
          explanation: "The cumulative payroll grows 60000, 140000, 190000, 245000, 315000, 395000, and the first change is NULL because there is no previous row.",
        }),
      ],
      takeaways: ["Window functions keep every row.", "PARTITION BY groups; ORDER BY inside OVER orders.", "ROW_NUMBER has no ties; RANK leaves gaps; DENSE_RANK does not."],
      mistakes: ["Confusing PARTITION BY with GROUP BY.", "Forgetting ORDER BY in a ranking window.", "Using a window function in WHERE; wrap it in a subquery first."],
      check: [
        q("What does a window function do that GROUP BY does not?", ["Sorts", "Keeps every row while computing across a group", "Filters rows", "Joins tables"], 1, "The detail rows stay in the result."),
        q("If two rows tie for first, what does RANK give the next row?", ["2", "3", "1", "NULL"], 1, "RANK leaves a gap after ties; DENSE_RANK would give 2."),
        q("What does LAG(x) return?", ["The next row's x", "The previous row's x", "The first x", "The maximum x"], 1, "It looks back one row in the window order."),
      ],
    }),
    lesson("top-n", "Top-N per group and de-duplication", 14, {
      summary: "Two of the most common real tasks, the best row in each group and removing duplicates, both come from ROW_NUMBER filtered in an outer query.",
      sections: [
        sec("Top row per group", [
          "Number the rows within each group with ROW_NUMBER, then keep those numbered 1 in an outer query. Window functions cannot be used directly in WHERE, which is why the numbering sits in a subquery or a CTE. Add a tie-breaker to ORDER BY so the result is deterministic.",
        ], {
          title: "Highest paid per department",
          code: EMP + "SELECT dept, name FROM (SELECT dept, name, ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC, name) AS rn FROM employee) AS t WHERE rn = 1 ORDER BY dept;",
          explanation: "One row per department: HR Dev, IT Ravi (the tie with Zed is broken by name), Ops Mira.",
        }),
        sec("Second highest and duplicates", [
          "The nth highest value is a favourite interview question. DENSE_RANK handles ties properly: rank salaries, then pick the row whose rank is n. For duplicates, number rows within each set of identical values and delete or ignore those with a number above 1.",
        ], {
          title: "Second highest distinct salary",
          code: EMP + "SELECT salary FROM (SELECT DISTINCT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS dr FROM employee) AS t WHERE dr = 2;",
          explanation: "The distinct salaries rank 80000, 70000, 60000, 55000, 50000, so the second highest is 70000.",
        }),
      ],
      takeaways: ["Filter window results by wrapping them in a subquery or CTE.", "Add a tie-breaker so ROW_NUMBER is deterministic.", "DENSE_RANK solves nth-highest with ties."],
      mistakes: ["Using ROW_NUMBER for nth highest when ties exist.", "No tie-breaker, so results vary between runs.", "Using the window function in WHERE directly."],
      check: [
        q("Why wrap ROW_NUMBER in a subquery?", ["WHERE cannot use window functions directly", "It is faster", "It is required for GROUP BY", "To rename columns"], 0, "Windows are computed after WHERE, so filter in an outer query."),
        q("Which function handles ties best for nth highest?", ["ROW_NUMBER", "DENSE_RANK", "COUNT", "SUM"], 1, "DENSE_RANK gives equal values the same rank without gaps."),
        q("Why add a tie-breaker to ORDER BY?", ["To make the result deterministic", "To speed up", "To remove NULLs", "To group rows"], 0, "Otherwise equal rows may come out in any order."),
      ],
    }),
  ],
};

export const changing: TrackModule = {
  key: "sql-changing",
  title: "Creating and changing data",
  summary: "Define tables with constraints, change rows safely, and keep changes consistent with transactions.",
  lessons: [
    lesson("ddl-constraints", "Creating tables and constraints", 14, {
      summary: "CREATE TABLE defines the shape of data, and constraints make the database itself refuse bad data, which is more reliable than checking in application code.",
      sections: [
        sec("Types and constraints", [
          "A table has typed columns. PRIMARY KEY uniquely identifies a row, NOT NULL forbids missing values, UNIQUE forbids duplicates, DEFAULT supplies a value and CHECK enforces a rule. A FOREIGN KEY ties a column to another table's key so you cannot reference something that does not exist.",
        ], {
          title: "A table with rules",
          code: "CREATE TABLE student (\n  id INTEGER PRIMARY KEY,\n  email TEXT NOT NULL UNIQUE,\n  marks INTEGER CHECK (marks BETWEEN 0 AND 100),\n  status TEXT DEFAULT 'active'\n);\nINSERT INTO student (id, email, marks) VALUES (1, 'a@x.com', 72), (2, 'b@x.com', 91);\nSELECT id, status, marks FROM student ORDER BY id;",
          explanation: "The default status fills in automatically. A duplicate email or marks of 150 would be rejected by the database. Rows: 1 active 72 and 2 active 91.",
        }),
        sec("Keys and relationships", [
          "A one-to-many relationship is a foreign key on the 'many' side pointing at the primary key of the 'one'. A many-to-many relationship needs a junction table holding both keys, for example enrollment(student_id, course_id). ALTER TABLE adds or changes columns later; DROP TABLE removes a table and its data for good.",
        ], {
          title: "A junction table",
          code: "CREATE TABLE student (id INTEGER PRIMARY KEY, name TEXT);\nCREATE TABLE course (id INTEGER PRIMARY KEY, title TEXT);\nCREATE TABLE enrollment (\n  student_id INTEGER REFERENCES student(id),\n  course_id INTEGER REFERENCES course(id),\n  PRIMARY KEY (student_id, course_id)\n);\nINSERT INTO student VALUES (1,'Asha'),(2,'Ravi');\nINSERT INTO course VALUES (10,'SQL'),(11,'Java');\nINSERT INTO enrollment VALUES (1,10),(1,11),(2,10);\nSELECT s.name, COUNT(*) AS courses FROM student s JOIN enrollment e ON e.student_id = s.id GROUP BY s.name ORDER BY s.name;",
          explanation: "The junction table links students and courses many-to-many. Asha takes 2 courses and Ravi 1.",
        }),
      ],
      takeaways: ["Constraints make the database enforce the rules.", "PRIMARY KEY identifies; FOREIGN KEY links tables.", "Many-to-many needs a junction table."],
      mistakes: ["Storing lists in one column instead of a junction table.", "No primary key.", "Dropping a table without a backup."],
      check: [
        q("What does a FOREIGN KEY ensure?", ["Referenced rows exist in the other table", "Values are unique", "Values are sorted", "Columns are indexed"], 0, "You cannot point at a missing parent row."),
        q("How do you model many-to-many?", ["A column holding a list", "A junction table with both keys", "Two databases", "A view"], 1, "Each row links one of each."),
        q("What does CHECK do?", ["Rejects rows that break a condition", "Sorts rows", "Joins tables", "Creates an index"], 0, "It enforces a rule on column values."),
      ],
    }),
    lesson("dml-transactions", "INSERT, UPDATE, DELETE and transactions", 14, {
      summary: "INSERT, UPDATE and DELETE change data. A transaction groups several changes so they all happen or none do.",
      sections: [
        sec("Changing rows safely", [
          "UPDATE ... SET ... WHERE changes matching rows, and DELETE FROM ... WHERE removes them. Leaving out WHERE changes or deletes every row, so write the WHERE first and test it with a SELECT. INSERT can take rows from a query: INSERT INTO t SELECT ....",
        ], {
          title: "Raise some salaries",
          code: EMP + "UPDATE employee SET salary = salary + 5000 WHERE dept = 'HR';\nDELETE FROM employee WHERE salary < 56000 AND dept = 'HR';\nSELECT dept, COUNT(*) AS n, SUM(salary) AS payroll FROM employee GROUP BY dept ORDER BY dept;",
          explanation: "HR salaries rise to 55000 and 60000; the first is then below 56000 and is deleted. Result: HR 1 60000, IT 3 220000, Ops 1 70000.",
        }),
        sec("Transactions", [
          "BEGIN starts a transaction, COMMIT makes the changes permanent and ROLLBACK undoes them. This is the ACID guarantee: a transfer that debits one account and credits another must not stop halfway. Isolation levels control what concurrent transactions can see of each other.",
        ], {
          title: "A transfer that is undone",
          code: "CREATE TABLE account (id INTEGER PRIMARY KEY, balance INTEGER);\nINSERT INTO account VALUES (1, 500), (2, 100);\nBEGIN;\nUPDATE account SET balance = balance - 200 WHERE id = 1;\nUPDATE account SET balance = balance + 200 WHERE id = 2;\nROLLBACK;\nSELECT id, balance FROM account ORDER BY id;",
          explanation: "ROLLBACK cancels both updates, so the balances are back to 500 and 100. With COMMIT instead they would be 300 and 300.",
        }),
      ],
      takeaways: ["Always check the WHERE of an UPDATE or DELETE.", "A transaction is all-or-nothing.", "ACID: atomic, consistent, isolated, durable."],
      mistakes: ["UPDATE or DELETE with no WHERE.", "Doing a multi-step change outside a transaction.", "Holding a transaction open for a long time."],
      check: [
        q("What happens to an UPDATE without WHERE?", ["It changes every row", "It fails", "It changes one row", "It does nothing"], 0, "No condition means all rows qualify."),
        q("What does ROLLBACK do?", ["Makes changes permanent", "Undoes the transaction's changes", "Deletes the table", "Starts a new transaction"], 1, "Everything since BEGIN is discarded."),
        q("What does the A in ACID stand for?", ["Automatic", "Atomic", "Aggregate", "Alias"], 1, "Atomicity means a transaction happens completely or not at all."),
      ],
    }),
  ],
};

export const design: TrackModule = {
  key: "sql-design",
  title: "Design and performance",
  summary: "Normalisation, indexes and the habits of writing queries that stay fast.",
  lessons: [
    lesson("normalisation-indexes", "Normalisation and indexes", 14, {
      summary: "Good table design stores each fact once. Indexes make lookups fast at the cost of slower writes and extra space.",
      sections: [
        sec("Normalisation", [
          "Repeating a department name on every employee row means a rename must change many rows and typos creep in. Normalisation splits such data into related tables: first normal form wants one value per cell, second removes dependence on part of a key, third removes dependence between non-key columns. Store each fact in exactly one place and join when you need them together. Denormalise deliberately, and only for measured performance reasons.",
        ]),
        sec("Indexes", [
          "An index is a sorted structure on one or more columns, like the index of a book. It turns a full scan of the table into a quick lookup for WHERE, JOIN and ORDER BY on those columns. Every index slows INSERT, UPDATE and DELETE and uses space, so index the columns you actually search and join on. A composite index on (a, b) helps queries on a, or on a and b, but not on b alone. Wrapping an indexed column in a function, as in WHERE LOWER(name) = 'x', usually stops the index being used.",
        ], {
          title: "Creating an index",
          code: EMP + "CREATE INDEX idx_employee_dept ON employee (dept);\nCREATE UNIQUE INDEX idx_employee_name ON employee (name);\nSELECT COUNT(*) AS it_people FROM employee WHERE dept = 'IT';",
          explanation: "The index on dept lets the database find IT rows without scanning the table, and the unique index also forbids duplicate names. The answer is 3.",
        }),
      ],
      takeaways: ["Store each fact once; split data into related tables.", "Indexes speed reads and slow writes.", "A function on an indexed column can prevent index use."],
      mistakes: ["Indexing every column.", "Denormalising before measuring.", "Using SELECT * on wide tables in application code."],
      check: [
        q("What is the aim of normalisation?", ["Store each fact once and avoid inconsistency", "Make tables bigger", "Remove keys", "Speed up writes only"], 0, "Duplicated facts drift out of sync."),
        q("What is the cost of an index?", ["Slower writes and extra space", "Slower reads", "Lost data", "Nothing"], 0, "The index must be updated whenever the data changes."),
        q("Will an index on (a, b) help a query that filters only on b?", ["Usually not", "Always", "Only with ORDER BY", "Only for text"], 0, "The leading column must be used for the index to help."),
      ],
    }),
    lesson("good-habits", "Writing queries that stay correct and fast", 12, {
      summary: "A short list of habits prevents most wrong results and slow queries.",
      sections: [
        sec("Correctness habits", [
          "Name the columns you need rather than SELECT *. Check for NULLs in joins and conditions. Make sure a join cannot multiply rows by joining on a non-unique key: if the row count jumps, you have a many-to-many problem. Test on a few rows whose answer you know by hand. Write the question in words first, then the query.",
        ], {
          title: "A join that multiplies rows",
          code: EMP + "CREATE TABLE badge (dept TEXT, colour TEXT);\nINSERT INTO badge VALUES ('IT','blue'),('IT','green');\nSELECT COUNT(*) AS joined_rows FROM employee e JOIN badge b ON b.dept = e.dept WHERE e.dept = 'IT';",
          explanation: "Three IT employees times two badges is 6 rows, not 3: joining on a non-unique key multiplies rows. The result is 6.",
        }),
        sec("Performance habits", [
          "Filter early with WHERE, avoid functions on indexed columns, fetch only the rows and columns you need, and use LIMIT while exploring. When a query is slow, use your database's EXPLAIN command to see whether it scans the whole table or uses an index. Measure before and after any change.",
        ]),
      ],
      takeaways: ["Name columns instead of SELECT *.", "A non-unique join key multiplies rows.", "Use EXPLAIN to see how the database runs a query."],
      mistakes: ["Trusting a result without checking the row count.", "Optimising before measuring.", "Using DISTINCT to hide a bad join."],
      check: [
        q("What is a sign of a join on a non-unique key?", ["The row count grows unexpectedly", "The query is shorter", "NULLs disappear", "Sorting breaks"], 0, "Each match creates a combined row."),
        q("Which command shows how a query will be executed?", ["EXPLAIN", "DESCRIBE only", "TRACE", "PRINT"], 0, "EXPLAIN reports the plan, such as scans and index use."),
        q("Why avoid SELECT * in application code?", ["It fetches unneeded data and breaks when columns change", "It is invalid SQL", "It locks the table", "It disables indexes"], 0, "Name the columns you rely on."),
      ],
    }),
  ],
};
