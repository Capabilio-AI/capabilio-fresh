import type { RoleLesson } from "./types";

// Verified content: every example below was run on Pyodide 0.26.4 (pandas 2.2.0), the runtime learners get in the browser, and its output recorded.
// To change a lesson, edit the code, then run scripts/verify-role-lessons.mts (and update the output it prints).
export const DS_LEVEL_1: readonly RoleLesson[] = [
  {
    "key": "profile-a-table",
    "title": "Profile a table before you trust it",
    "minutes": 12,
    "summary": "Before any analysis, look at the shape, the types and the spread. One outlier can make an average useless.",
    "analogy": {
      "icon": "🛒",
      "title": "Count the stock before the sale",
      "text": "A shopkeeper counts the shelves before announcing a discount. A data scientist does the same with a table: how many rows, what kind of values, and is anything odd. You never trust a number you have not checked.",
      "pairs": [
        [
          "Counting the shelves",
          "df.shape"
        ],
        [
          "Reading each label",
          "df.dtypes"
        ],
        [
          "The one price tag that is clearly wrong",
          "an outlier"
        ]
      ]
    },
    "sections": [
      {
        "heading": "First look: shape, types and a summary",
        "body": [
          "A DataFrame is a table. Every analysis starts with three questions: how many rows and columns (shape), what type is each column (dtypes), and what does a number column look like (describe).",
          "describe gives the count, mean, standard deviation, minimum, the quartiles and the maximum. Read it like a health check, not like an answer."
        ],
        "example": {
          "title": "Profile an orders table",
          "code": "import pandas as pd\n\norders = pd.DataFrame({\n    \"order_id\": [101, 102, 103, 104, 105, 106],\n    \"city\": [\"Pune\", \"Pune\", \"Delhi\", \"Chennai\", \"Delhi\", \"Pune\"],\n    \"amount\": [450, 520, 480, 510, 9800, 470],\n})\nprint(orders.shape)\nprint(orders.dtypes)\nprint(orders[\"amount\"].describe())",
          "explanation": "shape is (rows, columns). city is text, shown as object. In the summary, the maximum of 9800 is far from the median-like middle of about 500, which is the first hint that one order is unusual.",
          "output": "(6, 3)\norder_id     int64\ncity        object\namount       int64\ndtype: object\ncount       6.000000\nmean     2038.333333\nstd      3802.511889\nmin       450.000000\n25%       472.500000\n50%       495.000000\n75%       517.500000\nmax      9800.000000\nName: amount, dtype: float64"
        }
      },
      {
        "heading": "The mean can lie, the median does not",
        "body": [
          "The mean adds everything and divides, so one huge value drags it. The median is the middle value after sorting, so it barely moves.",
          "When the mean and the median are far apart, there is an outlier or a skew. Say so before you report an average."
        ],
        "example": {
          "title": "Mean against median",
          "code": "import pandas as pd\n\namount = pd.Series([450, 520, 480, 510, 9800, 470])\nprint(\"mean:\", amount.mean())\nprint(\"median:\", amount.median())\nprint(\"mean without the 9800 order:\", amount[amount < 5000].mean())",
          "explanation": "The mean is above 2000 even though five of the six orders are near 500. The median stays near 500. Removing the one odd order brings the mean back to about 486.",
          "output": "mean: 2038.3333333333333\nmedian: 495.0\nmean without the 9800 order: 486.0"
        }
      },
      {
        "heading": "Count what is missing",
        "body": [
          "Real data has holes. isna marks each missing value (NaN) and sum counts them per column.",
          "Always count missing values before computing anything, because most functions silently skip them and your count changes."
        ],
        "example": {
          "title": "Missing values per column",
          "code": "import pandas as pd\nimport numpy as np\n\nusers = pd.DataFrame({\n    \"user\": [\"a\", \"b\", \"c\", \"d\", \"e\"],\n    \"age\": [21, np.nan, 23, np.nan, 25],\n    \"city\": [\"Pune\", \"Delhi\", None, \"Pune\", \"Delhi\"],\n})\nprint(users.isna().sum())\nprint(\"rows with any missing value:\", users.isna().any(axis=1).sum())",
          "explanation": "age is missing twice and city once. Three different rows have a hole, so any row-wise analysis would lose rows.",
          "output": "user    0\nage     2\ncity    1\ndtype: int64\nrows with any missing value: 3"
        }
      }
    ],
    "check": [
      {
        "question": "A table has six orders. Five are near 500 and one is 9800. Which number best describes a typical order?",
        "options": [
          "The mean",
          "The median",
          "The maximum",
          "The sum"
        ],
        "answerIndex": 1,
        "why": "The median stays near 500. The mean is dragged up by the single 9800 order, so it describes no real order."
      },
      {
        "question": "What does df.shape return?",
        "options": [
          "The column types",
          "A summary of every number column",
          "The number of rows and columns",
          "The count of missing values"
        ],
        "answerIndex": 2,
        "why": "shape is (rows, columns). dtypes gives the types and describe gives the summary."
      },
      {
        "question": "You compute an average over a column with missing values. What does pandas do by default?",
        "options": [
          "Stops with an error",
          "Skips the missing values",
          "Treats them as zero",
          "Fills them with the median"
        ],
        "answerIndex": 1,
        "why": "mean skips NaN by default. That is why you must count the missing values first: the average then comes from fewer rows than you think."
      }
    ]
  },
  {
    "key": "clean-the-data",
    "title": "Clean what would corrupt the numbers",
    "minutes": 14,
    "summary": "Remove duplicates, handle missing values on purpose, and decide what to do with outliers, before you compute anything.",
    "analogy": {
      "icon": "🧺",
      "title": "Wash before you cook",
      "text": "You wash vegetables before cooking, not after tasting. Cleaning data is the same: duplicates, holes and wrong types spoil every number you cook from them. And you write down what you washed away, so the dish can be explained.",
      "pairs": [
        [
          "Same vegetable counted twice",
          "a duplicate row"
        ],
        [
          "A gap in the plate",
          "a missing value"
        ],
        [
          "A stone in the rice",
          "an outlier"
        ]
      ]
    },
    "sections": [
      {
        "heading": "Duplicates count twice",
        "body": [
          "A repeated row inflates counts and sums. drop_duplicates removes rows that are identical, or identical on the columns you name.",
          "Decide what makes two rows the same. Two orders with the same order_id are the same order, even if a timestamp differs."
        ],
        "example": {
          "title": "Drop repeated orders",
          "code": "import pandas as pd\n\norders = pd.DataFrame({\n    \"order_id\": [1, 2, 2, 3, 3, 3],\n    \"amount\": [100, 250, 250, 80, 80, 80],\n})\nprint(\"rows before:\", len(orders))\nclean = orders.drop_duplicates(subset=\"order_id\")\nprint(\"rows after:\", len(clean))\nprint(\"total before:\", orders[\"amount\"].sum(), \"after:\", clean[\"amount\"].sum())",
          "explanation": "Six rows become three orders. The total drops from 840 to 430, so the duplicates had almost doubled revenue (inflated it by about 95 percent).",
          "output": "rows before: 6\nrows after: 3\ntotal before: 840 after: 430"
        }
      },
      {
        "heading": "Missing values: choose, do not default",
        "body": [
          "You can drop rows with missing values, or fill them. Filling with the median is a safe default for a skewed number. Filling with zero changes the meaning, so do it only when zero is true.",
          "Whatever you pick, count how many values you changed and say so."
        ],
        "example": {
          "title": "Fill with the median",
          "code": "import pandas as pd\nimport numpy as np\n\ndf = pd.DataFrame({\"age\": [21, np.nan, 23, 24, np.nan, 95]})\nprint(\"mean before:\", round(df[\"age\"].mean(), 1))\nmedian = df[\"age\"].median()\ndf[\"age\"] = df[\"age\"].fillna(median)\nprint(\"filled with:\", median)\nprint(df[\"age\"].tolist())",
          "explanation": "The median of the four known ages is 23.5, so both holes become 23.5. The 95 is still there: filling does not fix outliers, that is the next step.",
          "output": "mean before: 40.8\nfilled with: 23.5\n[21.0, 23.5, 23.0, 24.0, 23.5, 95.0]"
        }
      },
      {
        "heading": "Outliers: find them with a rule",
        "body": [
          "The IQR rule flags a value as an outlier when it is more than 1.5 times the interquartile range below the first quartile or above the third. It is a rule, not a verdict: a flagged value can be an error or a real big customer.",
          "Check the flagged rows before you remove them, and keep a note of what you did."
        ],
        "example": {
          "title": "Flag outliers with the IQR rule",
          "code": "import pandas as pd\n\namount = pd.Series([450, 520, 480, 510, 9800, 470, 505])\nq1, q3 = amount.quantile(0.25), amount.quantile(0.75)\niqr = q3 - q1\nlow, high = q1 - 1.5 * iqr, q3 + 1.5 * iqr\nprint(\"limits:\", low, high)\nprint(\"flagged:\", amount[(amount < low) | (amount > high)].tolist())",
          "explanation": "Anything above the upper limit is flagged. Only the 9800 order is outside the limits, so that is the one to investigate.",
          "output": "limits: 415.0 575.0\nflagged: [9800]"
        }
      },
      {
        "heading": "Text that should be a number",
        "body": [
          "Exported data often stores numbers as text, like '1,200' or '₹450'. Strip the symbols, then convert with to_numeric. Use errors='coerce' so a bad value becomes NaN instead of crashing, then count the NaN."
        ],
        "example": {
          "title": "Turn text into numbers",
          "code": "import pandas as pd\n\nraw = pd.Series([\"1,200\", \"450\", \"n/a\", \"980\"])\namount = pd.to_numeric(raw.str.replace(\",\", \"\"), errors=\"coerce\")\nprint(amount.tolist())\nprint(\"could not convert:\", amount.isna().sum())",
          "explanation": "1,200 becomes 1200. n/a cannot be a number, so it becomes NaN, and counting the NaN tells you exactly how many values were lost.",
          "output": "[1200.0, 450.0, nan, 980.0]\ncould not convert: 1"
        }
      }
    ],
    "check": [
      {
        "question": "Orders 2 and 3 each appear three times with the same order_id and amount. What happens to revenue if you do not drop duplicates?",
        "options": [
          "Nothing, sum ignores repeats",
          "It is inflated",
          "It is understated",
          "pandas removes them for you"
        ],
        "answerIndex": 1,
        "why": "Each repeat adds the amount again, so revenue is overstated. drop_duplicates fixes it."
      },
      {
        "question": "An age column has missing values and one age of 95. You fill the holes with the median. What is still left to deal with?",
        "options": [
          "Nothing, filling also removes outliers",
          "The missing values, because fillna does nothing",
          "The 95, which fillna did not touch",
          "The column type"
        ],
        "answerIndex": 2,
        "why": "Filling only replaces the holes. A suspicious value like 95 still needs its own check."
      },
      {
        "question": "What does pd.to_numeric(values, errors='coerce') do with a value like 'n/a'?",
        "options": [
          "Raises an error",
          "Turns it into NaN",
          "Turns it into 0",
          "Keeps it as text"
        ],
        "answerIndex": 1,
        "why": "coerce turns anything that is not a number into NaN. Then you can count how many values could not be converted."
      }
    ]
  },
  {
    "key": "answer-a-business-question",
    "title": "Answer a business question: group, join, compare",
    "minutes": 15,
    "summary": "Turn a manager's question into groupby, merge and a clear number, then say what the number does and does not prove.",
    "analogy": {
      "icon": "📊",
      "title": "Sort the receipts into piles",
      "text": "To find which shop earns most, you sort the receipts into one pile per shop, then total each pile. If the shop names live on a different sheet, you first match receipts to shops. That is groupby and merge.",
      "pairs": [
        [
          "One pile per shop",
          "groupby"
        ],
        [
          "Total each pile",
          "an aggregation like sum"
        ],
        [
          "Matching receipts to the shop list",
          "merge"
        ]
      ]
    },
    "sections": [
      {
        "heading": "groupby: one number per group",
        "body": [
          "groupby splits the rows into groups, then an aggregation such as sum, mean or count gives one number per group. Always check the group sizes too: an average of two rows means little."
        ],
        "example": {
          "title": "Revenue and orders per city",
          "code": "import pandas as pd\n\norders = pd.DataFrame({\n    \"city\": [\"Pune\", \"Pune\", \"Delhi\", \"Delhi\", \"Delhi\", \"Chennai\"],\n    \"amount\": [450, 520, 480, 510, 470, 600],\n})\nsummary = orders.groupby(\"city\")[\"amount\"].agg([\"count\", \"sum\", \"mean\"])\nprint(summary)",
          "explanation": "Each row is one city. Delhi has the most orders (3), Chennai has one order, so its mean of 600 rests on a single order and should not be over-read.",
          "output": "         count   sum        mean\ncity                            \nChennai      1   600  600.000000\nDelhi        3  1460  486.666667\nPune         2   970  485.000000"
        }
      },
      {
        "heading": "merge: bring two tables together",
        "body": [
          "Data is split across tables: orders in one, customers in another. merge joins them on a shared key. A left join keeps every order even when the customer is unknown, which shows you the gaps instead of hiding them."
        ],
        "example": {
          "title": "Attach the customer's plan to each order",
          "code": "import pandas as pd\n\norders = pd.DataFrame({\"customer\": [1, 2, 2, 3, 9], \"amount\": [100, 200, 150, 80, 300]})\ncustomers = pd.DataFrame({\"customer\": [1, 2, 3], \"plan\": [\"free\", \"pro\", \"free\"]})\njoined = orders.merge(customers, on=\"customer\", how=\"left\")\nprint(joined)\nprint(joined.groupby(\"plan\", dropna=False)[\"amount\"].sum())",
          "explanation": "Customer 9 has no row in the customer table, so the left join keeps the order and shows a missing plan. dropna=False keeps that group visible, so the 300 is not silently lost.",
          "output": "   customer  amount  plan\n0         1     100  free\n1         2     200   pro\n2         2     150   pro\n3         3      80  free\n4         9     300   NaN\nplan\nfree    180\npro     350\nNaN     300\nName: amount, dtype: int64"
        }
      },
      {
        "heading": "Compare, then be honest about it",
        "body": [
          "A business answer is a number, a comparison and a limit. Compute the change as a percentage of the starting value, and say what could explain it besides the thing you care about.",
          "Three or four facts you can defend are worth more than twenty you cannot."
        ],
        "example": {
          "title": "Month-over-month change",
          "code": "import pandas as pd\n\nmonthly = pd.Series({\"Jan\": 1000, \"Feb\": 1200, \"Mar\": 900})\nchange = monthly.pct_change() * 100\nprint(change.round(1))\nprint(\"best month:\", monthly.idxmax())",
          "explanation": "February grew 20 percent on January, March fell 25 percent on February. The numbers say what happened, not why: a holiday, a price change or a data gap could each explain the fall.",
          "output": "Jan     NaN\nFeb    20.0\nMar   -25.0\ndtype: float64\nbest month: Feb"
        }
      }
    ],
    "check": [
      {
        "question": "You compute the mean order value per city and Chennai shows the highest, from a single order. What should you say?",
        "options": [
          "Chennai is the best city",
          "Report it, with the count, because one order proves little",
          "Remove Chennai",
          "Use the sum instead and ignore the count"
        ],
        "answerIndex": 1,
        "why": "A mean from one row is fragile. Always report group sizes next to averages."
      },
      {
        "question": "A left merge of orders onto customers keeps an order whose customer is not in the customer table. What do you see in the joined row?",
        "options": [
          "The order is dropped",
          "A missing value in the customer columns",
          "A duplicate order",
          "An error"
        ],
        "answerIndex": 1,
        "why": "Left join keeps every left row and fills the missing right side with NaN. That is how you notice the gap."
      },
      {
        "question": "Sales go from 1000 to 1200. What is the percentage change?",
        "options": [
          "2 percent",
          "20 percent",
          "200 percent",
          "12 percent"
        ],
        "answerIndex": 1,
        "why": "(1200 - 1000) / 1000 = 0.20, so 20 percent. The change is divided by the starting value."
      }
    ]
  }
];
