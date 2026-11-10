import { lesson, q, sec, type TrackModule } from "../types";
import { EMP } from "./m1-queries";

const DEPT = "CREATE TABLE dept (code TEXT PRIMARY KEY, city TEXT);\nINSERT INTO dept VALUES ('IT','Pune'),('HR','Delhi'),('Fin','Mumbai');\n\n";

export const joins: TrackModule = {
  key: "sql-joins",
  title: "Joins",
  summary: "Combine tables: inner and left joins, self joins, anti-joins and set operations.",
  lessons: [
    lesson("inner-left", "INNER and LEFT JOIN", 14, {
      summary: "A join combines rows from two tables where a condition matches. INNER JOIN keeps only matches; LEFT JOIN keeps every row of the left table and fills the gaps with NULL.",
      sections: [
        sec("INNER JOIN", [
          "Tables are related by keys: here employee.dept holds a department code that appears as dept.code. JOIN ... ON states the matching condition. A row with no match on the other side disappears from an inner join, so Mira in 'Ops' vanishes because there is no Ops department row.",
        ], {
          title: "Employees with their city",
          code: EMP + DEPT + "SELECT e.name, d.city FROM employee e JOIN dept d ON e.dept = d.code ORDER BY e.name;",
          explanation: "Five employees match a department; Mira (Ops) has no dept row and is left out. The result lists Asha, Dev, Kim, Ravi, Zed with their cities.",
        }),
        sec("LEFT JOIN and counting zero", [
          "LEFT JOIN keeps all rows from the left table; columns from the right are NULL where nothing matched. It is the tool for 'including those with none'. Count a column from the right table, COUNT(e.id), not COUNT(*), so unmatched rows count as zero.",
        ], {
          title: "Headcount per department",
          code: EMP + DEPT + "SELECT d.code, COUNT(e.id) AS people FROM dept d LEFT JOIN employee e ON e.dept = d.code GROUP BY d.code ORDER BY d.code;",
          explanation: "Fin has no employees, so it still appears with 0: Fin 0, HR 2, IT 3.",
        }),
      ],
      takeaways: ["JOIN ... ON relates rows by a condition.", "INNER JOIN drops non-matches; LEFT JOIN keeps the left side.", "Count a right-table column to get zeros right."],
      mistakes: ["Forgetting the ON condition and producing a cross product.", "Using COUNT(*) after a LEFT JOIN, counting the NULL row as 1.", "Putting a right-table filter in WHERE, turning a LEFT JOIN into an inner join."],
      check: [
        q("What does an INNER JOIN do with rows that have no match?", ["Keeps them with NULLs", "Drops them", "Duplicates them", "Raises an error"], 1, "Only rows with a match in both tables remain."),
        q("What does LEFT JOIN guarantee?", ["Every left-table row appears", "Every right-table row appears", "No NULLs", "Sorted output"], 0, "Unmatched left rows get NULL for right columns."),
        q("What happens if you forget the ON condition in a join?", ["Nothing", "Every row pairs with every row", "An empty result", "A faster query"], 1, "Without a condition the result is the cross product."),
      ],
    }),
    lesson("join-patterns", "Self joins, anti-joins and UNION", 14, {
      summary: "Joining a table to itself finds related rows; NOT EXISTS finds rows with no match; UNION stacks the results of two queries.",
      sections: [
        sec("Self join", [
          "To compare rows within one table, join it to itself using two aliases. Adding a.id < b.id keeps each pair once and avoids pairing a row with itself.",
        ], {
          title: "Pairs with the same salary",
          code: EMP + "SELECT a.name, b.name FROM employee a JOIN employee b ON a.salary = b.salary AND a.id < b.id;",
          explanation: "Only Ravi and Zed share a salary (80000), so the single pair Ravi, Zed is returned.",
        }),
        sec("Anti-join and UNION", [
          "To find rows with no match, use WHERE NOT EXISTS (a correlated subquery) or a LEFT JOIN with WHERE right.key IS NULL. UNION combines two result sets and removes duplicates; UNION ALL keeps them and is faster. Both queries must return the same number of columns of compatible types.",
        ], {
          title: "Departments with no employees",
          code: EMP + DEPT + "SELECT d.code FROM dept d WHERE NOT EXISTS (SELECT 1 FROM employee e WHERE e.dept = d.code);",
          explanation: "Only Fin has no matching employee, so the result is Fin.",
        }),
      ],
      takeaways: ["A self join needs two aliases.", "NOT EXISTS finds rows with no match.", "UNION removes duplicates; UNION ALL keeps them."],
      mistakes: ["Pairing a row with itself in a self join.", "Using NOT IN on a column that can be NULL.", "Using UNION when UNION ALL would be correct and faster."],
      check: [
        q("Why add a.id < b.id in a self join?", ["To sort rows", "To avoid duplicate and self pairs", "To speed up the join", "It is required"], 1, "Each unordered pair appears once."),
        q("What is the difference between UNION and UNION ALL?", ["None", "UNION removes duplicates", "UNION ALL sorts", "UNION is faster"], 1, "UNION deduplicates; UNION ALL does not."),
        q("Which finds rows with no match in another table?", ["INNER JOIN", "NOT EXISTS", "GROUP BY", "ORDER BY"], 1, "A NOT EXISTS subquery is the standard anti-join."),
      ],
    }),
  ],
};

export const subqueries: TrackModule = {
  key: "sql-subqueries",
  title: "Subqueries and CTEs",
  summary: "Queries inside queries, correlated subqueries and WITH clauses that make long queries readable.",
  lessons: [
    lesson("subqueries", "Subqueries", 14, {
      summary: "A subquery is a SELECT inside another statement. It can return a single value, a list or a table, and a correlated one runs once per outer row.",
      sections: [
        sec("Scalar and correlated subqueries", [
          "A subquery that returns one value can be compared directly: salary > (SELECT AVG(salary) FROM employee). A correlated subquery refers to the outer row, so it is evaluated for each row; this is how you compare a row with its own group.",
        ], {
          title: "Above the overall average",
          code: EMP + "SELECT name FROM employee WHERE salary > (SELECT AVG(salary) FROM employee) ORDER BY name;",
          explanation: "The overall average is about 65833; Mira, Ravi and Zed earn more.",
        }),
        sec("Above the department average", [
          "In a correlated version the inner query is filtered by the outer row's department, so each person is compared with their own department.",
        ], {
          title: "Above their own department",
          code: EMP + "SELECT name FROM employee e WHERE salary > (SELECT AVG(salary) FROM employee WHERE dept = e.dept) ORDER BY name;",
          explanation: "IT averages about 73333 (Ravi and Zed beat it), HR averages 52500 (Dev beats it) and Ops has one person who equals their own average. The result is Dev, Ravi, Zed.",
        }),
      ],
      takeaways: ["A scalar subquery returns one value.", "A correlated subquery depends on the outer row.", "IN and EXISTS test membership with a subquery."],
      mistakes: ["A scalar subquery that returns several rows.", "Forgetting the correlation condition.", "Using NOT IN with NULLs in the list."],
      check: [
        q("What is a correlated subquery?", ["One that uses a value from the outer query", "One that runs once for all rows", "A UNION", "A view"], 0, "It is re-evaluated for each outer row."),
        q("Where can a scalar subquery appear?", ["Only in FROM", "In WHERE, SELECT and more", "Only in ORDER BY", "Nowhere"], 1, "It can stand wherever one value is expected."),
        q("What must a scalar subquery return?", ["Many rows", "At most one row and one column", "A table", "Nothing"], 1, "Otherwise the comparison has no single value."),
      ],
    }),
    lesson("ctes", "Common table expressions (WITH)", 12, {
      summary: "A WITH clause names an intermediate result so the main query can use it. It makes long queries readable and allows a step to be reused.",
      sections: [
        sec("Naming a step", [
          "WITH name AS (SELECT ...) defines a temporary named result that lasts for one statement. You can define several, separated by commas, and later ones can use earlier ones. Think of each CTE as one step of your reasoning, written in order.",
        ], {
          title: "Departments and their averages",
          code: EMP + "WITH dept_avg AS (SELECT dept, AVG(salary) AS avg_salary FROM employee GROUP BY dept)\nSELECT e.name FROM employee e JOIN dept_avg d ON d.dept = e.dept WHERE e.salary > d.avg_salary ORDER BY e.name;",
          explanation: "Same question as the correlated subquery, but built in two readable steps. Result: Dev, Ravi, Zed.",
        }),
        sec("Recursive CTEs", [
          "WITH RECURSIVE repeats a query using its own previous output, which is how SQL walks hierarchies such as managers and reports, or generates a series of numbers. It has an anchor query, a recursive part joined with UNION ALL, and must have a condition that ends it.",
        ], {
          title: "Generating numbers",
          code: "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM n WHERE x < 5)\nSELECT SUM(x) AS total, COUNT(*) AS how_many FROM n;",
          explanation: "The recursion produces 1 to 5, whose sum is 15 and count is 5: 15, 5.",
        }),
      ],
      takeaways: ["WITH names a step for one statement.", "Several CTEs can build on each other.", "WITH RECURSIVE walks hierarchies and generates series."],
      mistakes: ["A recursive CTE with no ending condition.", "Expecting a CTE to persist after the statement.", "Writing one giant unreadable query instead of steps."],
      check: [
        q("How long does a CTE exist?", ["Forever", "For one statement", "For the session", "Until restart"], 1, "It is visible only to the statement that defines it."),
        q("What does a recursive CTE need?", ["An anchor part and a recursive part with an end condition", "Only a SELECT", "A table", "A trigger"], 0, "Without a terminating condition it would never stop."),
        q("Why use CTEs?", ["To make queries readable and reusable within one statement", "To store data permanently", "To add indexes", "To change data"], 0, "They break a problem into named steps."),
      ],
    }),
  ],
};
