import { lesson, q, sec, type TrackModule } from "../types";

// Every example is a complete script that builds its own tables, so it can be run on an empty database. The same small data is reused.
export const EMP =
  "CREATE TABLE employee (id INTEGER PRIMARY KEY, name TEXT, dept TEXT, salary INTEGER);\n" +
  "INSERT INTO employee VALUES (1,'Asha','IT',60000),(2,'Ravi','IT',80000),(3,'Kim','HR',50000),(4,'Dev','HR',55000),(5,'Mira','Ops',70000),(6,'Zed','IT',80000);\n\n";

export const queries: TrackModule = {
  key: "sql-queries",
  title: "Querying data",
  summary: "Read data with SELECT: filtering, sorting, NULL, expressions, aggregates and grouping.",
  lessons: [
    lesson("select-where", "SELECT, WHERE and ORDER BY", 12, {
      summary: "A relational database stores data in tables of rows and columns. SELECT reads from a table, WHERE keeps the rows you want and ORDER BY sorts the result.",
      sections: [
        sec("Reading a table", [
          "SELECT lists the columns you want and FROM names the table. WHERE filters rows before anything else happens. ORDER BY sorts, ascending by default; add DESC for descending and list several columns to break ties. LIMIT n keeps the first n rows. SQL is declarative: you describe the result you want, not how to compute it.",
          "Keywords are not case sensitive, but writing them in capitals and ending each statement with a semicolon makes queries easy to read. The examples here use a small employee table, and details such as quoting can differ a little between MySQL, PostgreSQL and SQLite.",
        ], {
          title: "Filter and sort",
          code: EMP + "SELECT name, salary FROM employee WHERE dept = 'IT' ORDER BY salary DESC, name;",
          explanation: "Three IT employees are returned, highest salary first, with ties broken by name: Ravi 80000, Zed 80000, Asha 60000.",
        }),
        sec("Combining conditions", [
          "AND, OR and NOT combine conditions; use parentheses when mixing AND and OR, because AND binds tighter. IN (a, b) tests membership, BETWEEN x AND y is inclusive at both ends, and LIKE matches patterns where % means any characters and _ means exactly one.",
        ], {
          title: "Several conditions",
          code: EMP + "SELECT name FROM employee WHERE salary BETWEEN 55000 AND 70000 AND name LIKE '%a' ORDER BY name;",
          explanation: "Salaries from 55000 to 70000 whose name ends in a: Asha and Mira.",
        }),
      ],
      takeaways: ["SELECT chooses columns, WHERE chooses rows, ORDER BY sorts.", "BETWEEN includes both ends; LIKE uses % and _.", "Use parentheses when mixing AND with OR."],
      mistakes: ["Using = NULL instead of IS NULL.", "Forgetting that AND binds tighter than OR.", "Relying on row order without an ORDER BY."],
      check: [
        q("Which clause filters rows?", ["ORDER BY", "WHERE", "SELECT", "LIMIT"], 1, "WHERE keeps only rows that satisfy the condition."),
        q("Is BETWEEN 10 AND 20 inclusive of 20?", ["Yes", "No", "Only for dates", "Only for text"], 0, "Both ends are included."),
        q("What does LIKE 'A%' match?", ["Values starting with A", "Values ending with A", "Exactly A", "Values containing %"], 0, "% stands for any run of characters."),
      ],
    }),
    lesson("null-expressions", "NULL, CASE and expressions", 12, {
      summary: "NULL means unknown, not zero or empty. It makes comparisons unknown, so it needs its own tests, and COALESCE and CASE let you handle it.",
      sections: [
        sec("Three-valued logic", [
          "Any comparison with NULL is neither true nor false but unknown, so WHERE x = NULL matches nothing. Test with IS NULL and IS NOT NULL. Aggregates ignore NULLs: COUNT(x) counts non-NULL values while COUNT(*) counts rows, and AVG divides only by the non-NULL count.",
        ], {
          title: "NULL and aggregates",
          code: "CREATE TABLE t (x INTEGER);\nINSERT INTO t VALUES (1), (NULL), (3);\nSELECT COUNT(*), COUNT(x), AVG(x), SUM(COALESCE(x, 0)) FROM t;",
          explanation: "Three rows, two non-NULL values, an average of 2.0 (NULL is skipped), and a sum of 4 once NULL becomes 0: 3, 2, 2.0, 4.",
        }),
        sec("CASE and COALESCE", [
          "CASE WHEN condition THEN value ... ELSE value END works like if/else inside a query, which is how you create labels or bands. COALESCE(a, b, ...) returns the first value that is not NULL, a neat way to supply a default.",
        ], {
          title: "Banding values",
          code: EMP + "SELECT CASE WHEN salary >= 70000 THEN 'high' ELSE 'standard' END AS band, COUNT(*) AS n FROM employee GROUP BY band ORDER BY band;",
          explanation: "Three employees earn 70000 or more and three do not: high 3, standard 3.",
        }),
      ],
      takeaways: ["NULL is unknown; test it with IS NULL.", "COUNT(*) counts rows; COUNT(x) counts non-NULL values.", "CASE builds conditional values; COALESCE supplies defaults."],
      mistakes: ["Writing x = NULL.", "Forgetting that AVG skips NULLs.", "Assuming NULL equals NULL."],
      check: [
        q("What does WHERE x = NULL return?", ["Rows where x is empty", "No rows", "All rows", "An error"], 1, "The comparison is unknown, so no row qualifies."),
        q("What does COUNT(x) count?", ["All rows", "Non-NULL values of x", "NULL values", "Distinct values"], 1, "COUNT(column) ignores NULLs."),
        q("What does COALESCE(a, b) return?", ["The larger value", "The first non-NULL value", "Always a", "NULL"], 1, "It falls back to b when a is NULL."),
      ],
    }),
    lesson("group-by", "Aggregates, GROUP BY and HAVING", 14, {
      summary: "Aggregate functions summarise many rows into one value. GROUP BY computes one summary per group, and HAVING filters the groups.",
      sections: [
        sec("Grouping", [
          "COUNT, SUM, AVG, MIN and MAX collapse rows. With GROUP BY dept you get one result row per department. Every selected column must be either in the GROUP BY or inside an aggregate. WHERE filters rows before grouping; HAVING filters groups after the aggregates are computed.",
        ], {
          title: "Departments with more than one person",
          code: EMP + "SELECT dept, COUNT(*) AS n, AVG(salary) AS avg_salary FROM employee GROUP BY dept HAVING COUNT(*) > 1 ORDER BY dept;",
          explanation: "Ops has one employee and is dropped by HAVING. HR has 2 with an average of 52500.0 and IT has 3 with an average of about 73333.33.",
        }),
        sec("Distinct counts and order of evaluation", [
          "COUNT(DISTINCT x) counts unique values. A query is evaluated in this logical order: FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT. That is why you cannot use a SELECT alias in WHERE, but you often can in ORDER BY.",
        ], {
          title: "Distinct salaries",
          code: EMP + "SELECT COUNT(*) AS people, COUNT(DISTINCT salary) AS salary_levels, MAX(salary) - MIN(salary) AS spread FROM employee;",
          explanation: "Six people share five different salary levels (80000 appears twice), and the spread is 80000 - 50000 = 30000: 6, 5, 30000.",
        }),
      ],
      takeaways: ["GROUP BY gives one row per group.", "WHERE filters rows; HAVING filters groups.", "Selected columns must be grouped or aggregated."],
      mistakes: ["Putting an aggregate in WHERE.", "Selecting a non-grouped column.", "Confusing COUNT(*) with COUNT(DISTINCT x)."],
      check: [
        q("Which clause filters groups after aggregation?", ["WHERE", "HAVING", "LIMIT", "ORDER BY"], 1, "HAVING works on aggregate results."),
        q("Can you use COUNT(*) in a WHERE clause?", ["Yes", "No, use HAVING", "Only with GROUP BY", "Only in subqueries"], 1, "WHERE runs before aggregates exist."),
        q("What does COUNT(DISTINCT dept) return?", ["Number of rows", "Number of different departments", "Largest department", "Sum of departments"], 1, "It counts unique non-NULL values."),
      ],
    }),
  ],
};
