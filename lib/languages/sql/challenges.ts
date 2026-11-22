import type { SqlChallenge } from "../types";

// Generated: the datasets are built from fixed seeds and each reference was run on every one of them. CI runs the reference and the common mistakes again on the real SQL engine.

export const challenges: Record<string, SqlChallenge> = {
  "sql-queries": {
    kind: "sql",
    title: "Busy departments",
    statement: "The employees table lists each person's department and salary. Find the departments that have at least 2 employees earning 40000 or more. Show the department and how many such employees it has, with the department that has the most such employees first, and ties in alphabetical order of department. An employee with no salary recorded does not count as earning 40000 or more.",
    mode: "query",
    ordered: true,
    reference: "SELECT dept, COUNT(*) AS n FROM employees WHERE salary >= 40000 GROUP BY dept HAVING COUNT(*) >= 2 ORDER BY n DESC, dept",
    probes: [],
    starter: "-- employees(id, name, dept, salary, manager_id)\nSELECT ",
    commonMistakes: ["SELECT dept, COUNT(*) AS n FROM employees GROUP BY dept HAVING COUNT(*) >= 2 ORDER BY n DESC, dept", "SELECT dept, COUNT(*) AS n FROM employees WHERE salary >= 40000 GROUP BY dept ORDER BY n DESC, dept", "SELECT dept, COUNT(*) AS n FROM employees WHERE salary > 40000 GROUP BY dept HAVING COUNT(*) >= 2 ORDER BY n DESC, dept"],
    datasets: [
      [
        { name: "employees", columns: [{"name": "id", "type": "number"}, {"name": "name", "type": "text"}, {"name": "dept", "type": "text"}, {"name": "salary", "type": "number"}, {"name": "manager_id", "type": "number"}], rows: [[1, "Sanjay", "Sales", 50000, null], [2, "Lokesh", "Sales", 45000, null], [3, "Kiran", "HR", 25000, null], [4, "Pooja", "Ops", 73000, null], [5, "Rahul", "Ops", 40000, 2], [6, "Meena", "Sales", 40000, null], [7, "Anita", "Sales", null, 6], [8, "Mohan", "Eng", 40000, null], [9, "Naveen", "Ops", 60000, null], [10, "Isha", "Sales", 35000, null]] },
      ],
      [
        { name: "employees", columns: [{"name": "id", "type": "number"}, {"name": "name", "type": "text"}, {"name": "dept", "type": "text"}, {"name": "salary", "type": "number"}, {"name": "manager_id", "type": "number"}], rows: [[1, "Ravi", "Eng", 24000, null], [2, "Jai", "Ops", 44000, 1], [3, "Mohan", "Sales", 27000, 2], [4, "Vikram", "Eng", 40000, null], [5, "Lokesh", "Eng", 40000, null], [6, "Arun", "HR", 35000, null], [7, "Geeta", "Eng", 54000, null], [8, "Naveen", "Ops", 72000, 1], [9, "Divya", "HR", 40000, 3], [10, "Sita", "Ops", 81000, null], [11, "Asha", "Sales", null, null], [12, "Isha", "Sales", 38000, 7]] },
      ],
      [
        { name: "employees", columns: [{"name": "id", "type": "number"}, {"name": "name", "type": "text"}, {"name": "dept", "type": "text"}, {"name": "salary", "type": "number"}, {"name": "manager_id", "type": "number"}], rows: [[1, "Geeta", "HR", 40000, null], [2, "Asha", "Ops", null, 1], [3, "Arun", "Sales", 40000, 1], [4, "Sita", "Eng", 51000, 2], [5, "Ravi", "HR", 65000, null], [6, "Sanjay", "Ops", 40000, 2], [7, "Isha", "Ops", 34000, 2], [8, "Mohan", "Eng", null, 6], [9, "Anita", "Eng", 70000, 1], [10, "Kavya", "Ops", 76000, 1], [11, "Lokesh", "Eng", 56000, null]] },
      ],
    ],
  },
  "sql-joins": {
    kind: "sql",
    title: "Paid totals for every customer",
    statement: "Show every customer with the total amount of their paid orders (orders whose status is 'paid'). A customer who has no paid orders must still appear, with a total of 0. List the customer with the largest total first, and break ties by customer name.",
    mode: "query",
    ordered: true,
    reference: "SELECT c.name, COALESCE(SUM(o.amount), 0) AS total FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid' GROUP BY c.id, c.name ORDER BY total DESC, c.name",
    probes: [],
    starter: "-- customers(id, name, city), orders(id, customer_id, amount, status)\nSELECT ",
    commonMistakes: ["SELECT c.name, SUM(o.amount) AS total FROM customers c JOIN orders o ON o.customer_id = c.id WHERE o.status = 'paid' GROUP BY c.id, c.name ORDER BY total DESC, c.name", "SELECT c.name, SUM(o.amount) AS total FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid' GROUP BY c.id, c.name ORDER BY total DESC, c.name", "SELECT c.name, COALESCE(SUM(o.amount), 0) AS total FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.id, c.name ORDER BY total DESC, c.name"],
    datasets: [
      [
        { name: "customers", columns: [{"name": "id", "type": "number"}, {"name": "name", "type": "text"}, {"name": "city", "type": "text"}], rows: [[1, "Anita", "Pune"], [2, "Ravi", "Pune"], [3, "Deepak", "Chennai"], [4, "Sita", "Chennai"], [5, "Mohan", "Delhi"], [6, "Isha", "Hyderabad"], [7, "Lata", "Pune"], [8, "Pooja", "Hyderabad"]] },
        { name: "orders", columns: [{"name": "id", "type": "number"}, {"name": "customer_id", "type": "number"}, {"name": "amount", "type": "number"}, {"name": "status", "type": "text"}], rows: [[1, 5, 1900, "refunded"], [2, 2, 250, "paid"], [3, 2, 1550, "paid"], [4, 5, 750, "paid"], [5, 3, 1500, "refunded"], [6, 1, 1100, "paid"], [7, 2, 1300, "refunded"], [8, 5, 150, "paid"], [9, 3, 350, "pending"], [10, 5, 1950, "paid"], [11, 1, 150, "paid"], [12, 1, 1650, "refunded"]] },
      ],
      [
        { name: "customers", columns: [{"name": "id", "type": "number"}, {"name": "name", "type": "text"}, {"name": "city", "type": "text"}], rows: [[1, "Divya", "Hyderabad"], [2, "Lokesh", "Delhi"], [3, "Meena", "Delhi"], [4, "Sanjay", "Chennai"], [5, "Jai", "Chennai"], [6, "Rahul", "Hyderabad"], [7, "Mohan", "Hyderabad"], [8, "Harish", "Chennai"], [9, "Madhu", "Chennai"]] },
        { name: "orders", columns: [{"name": "id", "type": "number"}, {"name": "customer_id", "type": "number"}, {"name": "amount", "type": "number"}, {"name": "status", "type": "text"}], rows: [[1, 3, 1250, "refunded"], [2, 2, 100, "paid"], [3, 2, 1450, "paid"], [4, 4, 1150, "paid"], [5, 2, 50, "paid"], [6, 2, 550, "refunded"], [7, 5, 150, "paid"], [8, 1, 1500, "refunded"], [9, 6, 250, "paid"], [10, 1, 1450, "pending"], [11, 6, 1900, "paid"], [12, 4, 1350, "pending"], [13, 5, 200, "paid"], [14, 2, 1950, "paid"]] },
      ],
      [
        { name: "customers", columns: [{"name": "id", "type": "number"}, {"name": "name", "type": "text"}, {"name": "city", "type": "text"}], rows: [[1, "Nisha", "Delhi"], [2, "Isha", "Hyderabad"], [3, "Pooja", "Delhi"], [4, "Divya", "Chennai"], [5, "Naveen", "Pune"], [6, "Kavya", "Delhi"], [7, "Sanjay", "Pune"], [8, "Harish", "Delhi"]] },
        { name: "orders", columns: [{"name": "id", "type": "number"}, {"name": "customer_id", "type": "number"}, {"name": "amount", "type": "number"}, {"name": "status", "type": "text"}], rows: [[1, 2, 850, "paid"], [2, 1, 450, "paid"], [3, 6, 750, "pending"], [4, 6, 1350, "refunded"], [5, 4, 1150, "paid"], [6, 2, 950, "paid"], [7, 4, 1250, "pending"], [8, 5, 150, "paid"], [9, 5, 100, "paid"], [10, 2, 350, "paid"], [11, 6, 1000, "pending"], [12, 5, 500, "paid"], [13, 1, 700, "paid"]] },
      ],
    ],
  },
  "sql-subqueries": {
    kind: "sql",
    title: "Above their department's average",
    statement: "Find the employees who earn more than the average salary of their own department. Show the name, the department and the salary. Order the rows by department, then by salary from highest to lowest, then by name. Employees with no salary recorded are not included and do not count towards the average.",
    mode: "query",
    ordered: true,
    reference: "SELECT name, dept, salary FROM employees e WHERE salary > (SELECT AVG(salary) FROM employees WHERE dept = e.dept) ORDER BY dept, salary DESC, name",
    probes: [],
    starter: "-- employees(id, name, dept, salary, manager_id)\nSELECT ",
    commonMistakes: ["SELECT name, dept, salary FROM employees WHERE salary > (SELECT AVG(salary) FROM employees) ORDER BY dept, salary DESC, name", "SELECT name, dept, salary FROM employees e WHERE salary >= (SELECT AVG(salary) FROM employees WHERE dept = e.dept) ORDER BY dept, salary DESC, name"],
    datasets: [
      [
        { name: "employees", columns: [{"name": "id", "type": "number"}, {"name": "name", "type": "text"}, {"name": "dept", "type": "text"}, {"name": "salary", "type": "number"}, {"name": "manager_id", "type": "number"}], rows: [[1, "Kavya", "Ops", 47000, null], [2, "Lata", "Sales", 85000, 1], [3, "Vikram", "Sales", 90000, 1], [4, "Meena", "HR", 40000, null], [5, "Sita", "Sales", 62000, 2], [6, "Lokesh", "HR", 74000, null], [7, "Madhu", "HR", 28000, null], [8, "Anita", "Sales", 47000, 5], [9, "Isha", "Ops", 40000, null], [10, "Kiran", "Ops", 40000, null]] },
      ],
      [
        { name: "employees", columns: [{"name": "id", "type": "number"}, {"name": "name", "type": "text"}, {"name": "dept", "type": "text"}, {"name": "salary", "type": "number"}, {"name": "manager_id", "type": "number"}], rows: [[1, "Lokesh", "Sales", null, null], [2, "Rahul", "Eng", 44000, 1], [3, "Pooja", "Ops", 73000, 2], [4, "Geeta", "Ops", 40000, 1], [5, "Deepak", "HR", 88000, 1], [6, "Sanjay", "Sales", null, 1], [7, "Divya", "Eng", 40000, null], [8, "Meena", "Ops", 43000, null], [9, "Madhu", "Sales", 53000, 2], [10, "Arun", "Sales", 40000, 2], [11, "Anita", "HR", 68000, null], [12, "Lata", "Ops", 69000, null]] },
      ],
      [
        { name: "employees", columns: [{"name": "id", "type": "number"}, {"name": "name", "type": "text"}, {"name": "dept", "type": "text"}, {"name": "salary", "type": "number"}, {"name": "manager_id", "type": "number"}], rows: [[1, "Kiran", "Ops", 57000, null], [2, "Lokesh", "HR", 51000, 1], [3, "Harish", "Ops", 80000, 1], [4, "Arun", "Ops", 87000, 3], [5, "Naveen", "Ops", 75000, 4], [6, "Nisha", "Eng", 42000, null], [7, "Pooja", "Sales", 40000, null], [8, "Deepak", "Sales", 49000, 7], [9, "Asha", "HR", 40000, null], [10, "Mohan", "Ops", 40000, null], [11, "Divya", "HR", 44000, 9]] },
      ],
    ],
  },
  "sql-windows": {
    kind: "sql",
    title: "Top two sales in each region",
    statement: "For each region, find its two largest sales. Show the region, the rep, the amount and the rank of the sale within its region (1 for the largest, 2 for the next). Order the rows by region, then by rank. No two sales in the same region have the same amount.",
    mode: "query",
    ordered: true,
    reference: "WITH r AS (SELECT region, rep, amount, ROW_NUMBER() OVER (PARTITION BY region ORDER BY amount DESC) AS rk FROM sales) SELECT region, rep, amount, rk FROM r WHERE rk <= 2 ORDER BY region, rk",
    probes: [],
    starter: "-- sales(id, rep, region, amount)\nSELECT ",
    commonMistakes: ["SELECT region, rep, amount, 1 AS rk FROM sales ORDER BY amount DESC LIMIT 8", "WITH r AS (SELECT region, rep, amount, ROW_NUMBER() OVER (PARTITION BY region ORDER BY amount) AS rk FROM sales) SELECT region, rep, amount, rk FROM r WHERE rk <= 2 ORDER BY region, rk"],
    datasets: [
      [
        { name: "sales", columns: [{"name": "id", "type": "number"}, {"name": "rep", "type": "text"}, {"name": "region", "type": "text"}, {"name": "amount", "type": "number"}], rows: [[1, "Lokesh", "East", 4500], [2, "Naveen", "East", 4400], [3, "Anita", "North", 7900], [4, "Lokesh", "West", 1300], [5, "Lokesh", "South", 5000], [6, "Kiran", "West", 1000], [7, "Pooja", "South", 2700], [8, "Lokesh", "North", 5200], [9, "Naveen", "East", 500], [10, "Naveen", "North", 6600], [11, "Geeta", "West", 4400], [12, "Kiran", "South", 4400]] },
      ],
      [
        { name: "sales", columns: [{"name": "id", "type": "number"}, {"name": "rep", "type": "text"}, {"name": "region", "type": "text"}, {"name": "amount", "type": "number"}], rows: [[1, "Mohan", "North", 1200], [2, "Sita", "South", 200], [3, "Mohan", "East", 7700], [4, "Lata", "West", 7500], [5, "Jai", "West", 4500], [6, "Divya", "East", 6000], [7, "Naveen", "East", 6800], [8, "Ravi", "West", 4900], [9, "Naveen", "North", 4100], [10, "Jai", "North", 3300], [11, "Mohan", "East", 4900], [12, "Sanjay", "West", 7300], [13, "Jai", "South", 6900], [14, "Lata", "North", 700], [15, "Pooja", "South", 400], [16, "Jai", "South", 2600]] },
      ],
      [
        { name: "sales", columns: [{"name": "id", "type": "number"}, {"name": "rep", "type": "text"}, {"name": "region", "type": "text"}, {"name": "amount", "type": "number"}], rows: [[1, "Lokesh", "West", 7500], [2, "Isha", "East", 7900], [3, "Isha", "East", 6500], [4, "Lata", "West", 900], [5, "Lokesh", "North", 600], [6, "Kiran", "South", 4100], [7, "Mohan", "West", 3300], [8, "Naveen", "North", 6400], [9, "Ravi", "East", 2900], [10, "Ravi", "East", 400], [11, "Madhu", "West", 1200], [12, "Lokesh", "South", 1800], [13, "Lata", "North", 1100], [14, "Pooja", "South", 4900], [15, "Lokesh", "North", 3300], [16, "Naveen", "South", 5000], [17, "Jai", "East", 3400], [18, "Mohan", "West", 2600], [19, "Lata", "North", 1700], [20, "Lata", "South", 2400]] },
      ],
    ],
  },
  "sql-changing": {
    kind: "sql",
    title: "Value of stock",
    statement: "The inventory table lists each item with the quantity in stock and the price of one. Do three things, in this order: add a whole-number column named value; set value to qty times price for every row; then delete the items whose qty is 0.",
    mode: "script",
    ordered: true,
    reference: "ALTER TABLE inventory ADD COLUMN value INTEGER;\nUPDATE inventory SET value = qty * price;\nDELETE FROM inventory WHERE qty = 0;",
    probes: ["SELECT item, value FROM inventory ORDER BY item", "SELECT COUNT(*) FROM inventory", "SELECT SUM(value) FROM inventory"],
    starter: "-- inventory(item, qty, price)\n-- Write your statements below, each ending with a semicolon.\n",
    commonMistakes: ["ALTER TABLE inventory ADD COLUMN value INTEGER;\nUPDATE inventory SET value = qty * price;", "ALTER TABLE inventory ADD COLUMN value INTEGER;\nUPDATE inventory SET value = price;\nDELETE FROM inventory WHERE qty = 0;", "ALTER TABLE inventory ADD COLUMN value INTEGER;\nDELETE FROM inventory WHERE qty = 0;"],
    datasets: [
      [
        { name: "inventory", columns: [{"name": "item", "type": "text"}, {"name": "qty", "type": "number"}, {"name": "price", "type": "number"}], rows: [["tape", 0, 170], ["clip", 8, 135], ["file", 5, 195], ["ruler", 0, 30], ["book", 20, 250], ["chalk", 12, 195], ["marker", 0, 205], ["stapler", 2, 230]] },
      ],
      [
        { name: "inventory", columns: [{"name": "item", "type": "text"}, {"name": "qty", "type": "number"}, {"name": "price", "type": "number"}], rows: [["ink", 2, 115], ["clip", 5, 240], ["paper", 2, 125], ["stapler", 0, 60], ["chalk", 5, 75], ["folder", 20, 260], ["file", 2, 205], ["pen", 2, 115], ["glue", 20, 120]] },
      ],
      [
        { name: "inventory", columns: [{"name": "item", "type": "text"}, {"name": "qty", "type": "number"}, {"name": "price", "type": "number"}], rows: [["ink", 0, 20], ["tape", 12, 150], ["file", 5, 225], ["glue", 1, 220], ["chalk", 5, 30], ["paper", 20, 295], ["folder", 2, 270], ["ruler", 20, 165], ["stapler", 1, 40], ["eraser", 20, 230]] },
      ],
    ],
  },
  "sql-design": {
    kind: "sql",
    title: "Split a flat table",
    statement: "The orders_flat table repeats each customer's city on every one of their orders. Normalise it. Create a table customers(name TEXT PRIMARY KEY, city TEXT) with exactly one row for each customer, and a table orders(order_id INTEGER PRIMARY KEY, customer TEXT, item TEXT) with one row for each order. Then create an index named idx_orders_customer on orders(customer). Leave orders_flat as it is.",
    mode: "script",
    ordered: true,
    reference: "CREATE TABLE customers (name TEXT PRIMARY KEY, city TEXT);\nINSERT INTO customers SELECT DISTINCT customer, city FROM orders_flat;\nCREATE TABLE orders (order_id INTEGER PRIMARY KEY, customer TEXT, item TEXT);\nINSERT INTO orders SELECT order_id, customer, item FROM orders_flat;\nCREATE INDEX idx_orders_customer ON orders(customer);",
    probes: ["SELECT name, city FROM customers ORDER BY name", "SELECT order_id, customer, item FROM orders ORDER BY order_id", "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_orders_customer' AND tbl_name = 'orders'", "SELECT COUNT(*) FROM orders_flat"],
    starter: "-- orders_flat(order_id, customer, city, item)\n-- Write your statements below, each ending with a semicolon.\n",
    commonMistakes: ["CREATE TABLE customers (name TEXT PRIMARY KEY, city TEXT);\nINSERT INTO customers SELECT customer, city FROM orders_flat;\nCREATE TABLE orders (order_id INTEGER PRIMARY KEY, customer TEXT, item TEXT);\nINSERT INTO orders SELECT order_id, customer, item FROM orders_flat;\nCREATE INDEX idx_orders_customer ON orders(customer);", "CREATE TABLE customers (name TEXT PRIMARY KEY, city TEXT);\nINSERT INTO customers SELECT DISTINCT customer, city FROM orders_flat;\nCREATE TABLE orders (order_id INTEGER PRIMARY KEY, customer TEXT, item TEXT);\nINSERT INTO orders SELECT order_id, customer, item FROM orders_flat;\n", "CREATE TABLE customers (name TEXT PRIMARY KEY, city TEXT);\nINSERT INTO customers SELECT DISTINCT customer, city FROM orders_flat;\nCREATE TABLE orders (order_id INTEGER PRIMARY KEY, customer TEXT, item TEXT);\n\nCREATE INDEX idx_orders_customer ON orders(customer);"],
    datasets: [
      [
        { name: "orders_flat", columns: [{"name": "order_id", "type": "number"}, {"name": "customer", "type": "text"}, {"name": "city", "type": "text"}, {"name": "item", "type": "text"}], rows: [[1, "Mohan", "Hyderabad", "chair"], [2, "Mohan", "Hyderabad", "mat"], [3, "Mohan", "Hyderabad", "bag"], [4, "Sita", "Chennai", "shelf"], [5, "Sita", "Chennai", "shelf"], [6, "Sita", "Chennai", "bag"], [7, "Naveen", "Chennai", "lamp"], [8, "Naveen", "Chennai", "bag"], [9, "Naveen", "Chennai", "mat"], [10, "Nisha", "Chennai", "chair"], [11, "Nisha", "Chennai", "bag"], [12, "Lata", "Delhi", "chair"], [13, "Lata", "Delhi", "mat"], [14, "Lata", "Delhi", "lamp"]] },
      ],
      [
        { name: "orders_flat", columns: [{"name": "order_id", "type": "number"}, {"name": "customer", "type": "text"}, {"name": "city", "type": "text"}, {"name": "item", "type": "text"}], rows: [[1, "Rahul", "Kochi", "chair"], [2, "Rahul", "Kochi", "lamp"], [3, "Rahul", "Kochi", "bag"], [4, "Vikram", "Chennai", "chair"], [5, "Vikram", "Chennai", "mat"], [6, "Isha", "Chennai", "desk"], [7, "Isha", "Chennai", "chair"], [8, "Nisha", "Pune", "lamp"], [9, "Nisha", "Pune", "desk"], [10, "Sanjay", "Pune", "chair"], [11, "Sanjay", "Pune", "lamp"], [12, "Pooja", "Kochi", "shelf"], [13, "Pooja", "Kochi", "bag"], [14, "Pooja", "Kochi", "chair"]] },
      ],
      [
        { name: "orders_flat", columns: [{"name": "order_id", "type": "number"}, {"name": "customer", "type": "text"}, {"name": "city", "type": "text"}, {"name": "item", "type": "text"}], rows: [[1, "Harish", "Kochi", "shelf"], [2, "Harish", "Kochi", "shelf"], [3, "Asha", "Delhi", "chair"], [4, "Asha", "Delhi", "shelf"], [5, "Kavya", "Delhi", "bag"], [6, "Kavya", "Delhi", "desk"], [7, "Kavya", "Delhi", "lamp"], [8, "Jai", "Kochi", "chair"], [9, "Jai", "Kochi", "shelf"], [10, "Sita", "Delhi", "bag"], [11, "Sita", "Delhi", "chair"], [12, "Sita", "Delhi", "shelf"]] },
      ],
    ],
  },
};
