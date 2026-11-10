import { lesson, q, sec, type TrackModule } from "../types";

export const basics: TrackModule = {
  key: "python-basics",
  title: "Getting started with Python",
  summary: "Run Python, store values in variables, read input, print results and use operators.",
  lessons: [
    lesson("running-python", "Running Python and your first program", 10, {
      summary: "Python runs your code line by line through an interpreter, with no separate compile step. Indentation, not braces, marks the structure of a program.",
      sections: [
        sec("The interpreter", [
          "Save code in a file ending in .py and run it with python3 hello.py, or type lines into the interactive prompt (REPL) to try ideas quickly. Python reads the file from the top; there is no required main function, though a common habit is to put the program's entry in a function and call it at the bottom.",
          "Comments start with #. print writes a line of output. Statements do not need semicolons.",
        ], {
          title: "Hello, Python",
          code: 'print("Hello, Python")\n',
          explanation: "One call to print is a complete program. Output: Hello, Python.",
        }),
        sec("Indentation is syntax", [
          "A block, such as the body of an if or a loop, is the set of lines indented one level further after a colon. Use four spaces per level and never mix tabs and spaces. A missing or inconsistent indent is a syntax error, not a style problem.",
        ], {
          title: "A block",
          code: 'age = 20\nif age >= 18:\n    print("adult")\n    print("can vote")\nprint("done")\n',
          explanation: "The two indented lines run only when the condition is true; the last line always runs. Output: adult, can vote, done on separate lines.",
        }),
      ],
      takeaways: ["Python runs source directly through an interpreter.", "A colon opens a block, and indentation defines it.", "Use four spaces per level and never mix tabs with spaces."],
      mistakes: ["Forgetting the colon at the end of an if or for line.", "Inconsistent indentation inside a block.", "Naming your file the same as a module you import, such as random.py."],
      check: [
        q("How does Python mark the body of an if statement?", ["Braces", "Indentation after a colon", "begin/end", "Semicolons"], 1, "Indentation is part of Python's syntax."),
        q("How do you start a comment?", ["//", "#", "--", "/*"], 1, "Everything after # on the line is ignored."),
        q("Which command typically runs hello.py?", ["python3 hello.py", "compile hello.py", "run hello", "java hello.py"], 0, "The interpreter reads and executes the file."),
      ],
    }),
    lesson("variables-types", "Variables and data types", 12, {
      summary: "A Python variable is a name that refers to a value, and the value carries the type. You do not declare types, but every value has one.",
      sections: [
        sec("Dynamic typing", [
          "x = 5 creates a name x referring to an int. Later x = \"five\" simply points the name at a string. The core types are int (unlimited size), float, str, bool, and None for 'no value'. type(x) tells you what a value is.",
          "Python integers never overflow: 2 ** 100 works. Floats follow the usual binary rules, so 0.1 + 0.2 is not exactly 0.3; compare floats with a tolerance (math.isclose).",
        ], {
          title: "Types and big integers",
          code: 'x = 5\nprice = 19.99\nname = "Asha"\nok = True\nprint(type(x).__name__, type(price).__name__, type(name).__name__, type(ok).__name__)\nprint(2 ** 100)\n',
          explanation: "Each value reports its own type, and the integer has no fixed size. Output: int float str bool, then 1267650600228229401496703205376.",
        }),
        sec("Conversion and division", [
          "int(\"42\"), float(\"3.5\") and str(7) convert between types. / always gives a float (7 / 2 is 3.5), // gives the floor (7 // 2 is 3) and % the remainder. Converting text that is not a number raises ValueError.",
        ], {
          title: "Three kinds of division",
          code: 'print(7 / 2, 7 // 2, 7 % 2, -7 // 2)\nprint(int("42") + 1)\n',
          explanation: "/ keeps the fraction, // floors (even for negatives, giving -4), and % is the remainder. Output: 3.5 3 1 -4, then 43.",
        }),
      ],
      takeaways: ["Names refer to values; values carry the type.", "Integers have no size limit.", "/ is true division, // is floor division."],
      mistakes: ["Comparing floats with ==.", "Expecting // to truncate toward zero for negatives; it floors.", "Concatenating a string with a number without str()."],
      check: [
        q("What is 7 // 2 in Python?", ["3.5", "3", "4", "2"], 1, "Floor division gives the largest whole number not above the result."),
        q("What does 7 / 2 give?", ["3", "3.5", "4", "An error"], 1, "/ always produces a float."),
        q("What happens with int(\"abc\")?", ["Returns 0", "Raises ValueError", "Returns None", "Returns 'abc'"], 1, "The text is not a valid integer."),
      ],
    }),
    lesson("input-output", "Input, output and f-strings", 10, {
      summary: "input() reads a line of text; print writes output. f-strings are the clearest way to put values into text.",
      sections: [
        sec("Reading input", [
          "input() always returns a string, so convert it: int(input()). To read several numbers on one line, split the text: a, b = map(int, input().split()). In contests, reading everything at once with sys.stdin is faster for large inputs.",
        ], {
          title: "Sum of two numbers",
          code: 'a, b = map(int, input().split())\nprint(a + b)\n',
          explanation: "input().split() gives two strings, map(int, ...) converts them. With the input 3 4 the output is 7.",
        }),
        sec("Formatting with f-strings", [
          "Put f before the quotes and write expressions in braces: f\"{name} scored {marks}\". A format spec follows a colon: {value:.2f} for two decimals, {n:05d} to pad with zeros, {x:>8} to right-align. print takes sep= and end= to change the separator and the line ending.",
        ], {
          title: "Formatted output",
          code: 'name = "Ravi"\ncgpa = 8.456\nprint(f"{name} scored {cgpa:.2f}")\nprint(1, 2, 3, sep="-", end="!\\n")\n',
          explanation: ".2f rounds to two decimals, and sep/end shape the printed line. Output: Ravi scored 8.46, then 1-2-3!.",
        }),
      ],
      takeaways: ["input() returns a string; convert it.", "f-strings put expressions straight into text.", "print accepts sep and end."],
      mistakes: ["Adding two input() values without converting, which joins the strings.", "Forgetting the f before the quotes.", "Using input() inside a loop for huge inputs."],
      check: [
        q("What type does input() return?", ["int", "str", "float", "Depends on the text"], 1, "It always returns text."),
        q("What does f\"{3.14159:.2f}\" produce?", ["3.14159", "3.14", "3.1", "3"], 1, ".2f keeps two digits after the decimal point."),
        q("What does print(\"a\", \"b\", sep=\"-\") show?", ["a b", "a-b", "ab", "a,b"], 1, "sep replaces the default space."),
      ],
    }),
    lesson("operators", "Operators and expressions", 10, {
      summary: "Python's operators are close to other languages, with a few friendly differences: chained comparisons, words for logic, and identity versus equality.",
      sections: [
        sec("Arithmetic, comparison and logic", [
          "** is a power, and comparisons can be chained: 0 < x < 10 means both parts hold. Logic uses the words and, or and not, and they short-circuit. Many values count as false: 0, 0.0, empty strings and collections, and None; everything else is true.",
        ], {
          title: "Chained comparison",
          code: 'x = 7\nprint(0 < x < 10, x % 2 == 0 or x > 5, not x)\nprint(2 ** 10)\n',
          explanation: "7 is between 0 and 10, the second test is true because x > 5, and a non-zero value is truthy so not x is False. Output: True True False, then 1024.",
        }),
        sec("== versus is", [
          "== asks whether two values are equal; is asks whether they are the very same object. Use == for values and reserve is for comparing to None (x is None). Augmented assignment such as x += 1 updates a variable in place; Python has no ++ operator.",
        ], {
          title: "Equal but not identical",
          code: 'a = [1, 2]\nb = [1, 2]\nprint(a == b, a is b, a is not None)\n',
          explanation: "The lists hold equal values but are two separate objects. Output: True False True.",
        }),
      ],
      takeaways: ["Comparisons can be chained.", "Use and, or, not; zero, empty and None are false.", "== compares values; is compares identity."],
      mistakes: ["Writing x++ which is not Python.", "Using is to compare numbers or strings.", "Forgetting that ** is power, not ^."],
      check: [
        q("What does 0 < x < 10 mean?", ["Syntax error", "x is greater than 0 and less than 10", "x equals 0 or 10", "x is between 0 and 10 exclusive of nothing"], 1, "Chained comparisons check each pair."),
        q("Which of these is falsy?", ["[0]", "\"0\"", "[]", "-1"], 2, "An empty list is false; a non-empty list or string is true."),
        q("When should you use is?", ["Comparing numbers", "Checking x is None", "Comparing strings", "Comparing lists"], 1, "is checks identity, which is right for the single None object."),
      ],
    }),
  ],
};

export const control: TrackModule = {
  key: "python-control",
  title: "Decisions and loops",
  summary: "if/elif/else, for and while loops, range, and the patterns that solve common problems.",
  lessons: [
    lesson("if-elif", "Decisions: if, elif and else", 8, {
      summary: "if chooses a path using a condition. elif adds further tests and else catches the rest. Only the first true branch runs.",
      sections: [
        sec("Branching", [
          "Conditions are evaluated top to bottom. The conditional expression value_if_true if condition else value_if_false picks between two values in one line. Python 3.10 added match for choosing between shapes of data, which is handy for commands and tokens.",
        ], {
          title: "Grade and match",
          code: 'marks = 72\nif marks >= 90:\n    grade = "A"\nelif marks >= 70:\n    grade = "B"\nelse:\n    grade = "C"\n\ncommand = "stop"\nmatch command:\n    case "go":\n        action = "moving"\n    case "stop":\n        action = "halting"\n    case _:\n        action = "unknown"\nprint(grade, action)\n',
          explanation: "72 fails the first test and passes the second, so the grade is B; match picks the stop case. Output: B halting.",
        }),
        sec("Truthiness in conditions", [
          "if items: is the idiomatic way to test whether a list has anything in it, and if not name: tests for an empty string. Write what you mean directly and avoid comparisons to True or False.",
        ]),
      ],
      takeaways: ["Only the first true branch of an if chain runs.", "Use the conditional expression for short two-way choices.", "Test collections directly: if items:."],
      mistakes: ["Using = instead of == in a condition.", "Writing if x == True.", "Overlapping elif conditions in the wrong order."],
      check: [
        q("In an if/elif/else chain, how many branches run?", ["All true ones", "At most one", "Always two", "None"], 1, "Evaluation stops at the first true condition."),
        q("What does if items: test for a list?", ["That it is True", "That it is not empty", "That it has numbers", "That it exists"], 1, "An empty list is false."),
        q("What does case _: do in a match statement?", ["Matches anything left over", "Raises an error", "Matches None", "Ends the program"], 0, "The underscore is the wildcard default."),
      ],
    }),
    lesson("loops", "Loops: for, while and range", 12, {
      summary: "for walks through any sequence; while repeats until a condition fails. range generates numbers for counted loops.",
      sections: [
        sec("for and range", [
          "for x in items: visits each element directly, with no index needed. range(n) gives 0 to n-1, range(a, b) gives a to b-1, and range(a, b, step) steps by step. enumerate(items) gives index and value together and zip(a, b) walks two sequences in step.",
        ], {
          title: "Sum and enumerate",
          code: 'total = 0\nfor i in range(1, 11):\n    total += i\nprint(total)\nfor idx, word in enumerate(["a", "b", "c"], start=1):\n    print(idx, word)\n',
          explanation: "range(1, 11) covers 1 through 10, so the sum is 55. enumerate numbers the words from 1. Output: 55, then 1 a, 2 b, 3 c.",
        }),
        sec("while, break, continue and else", [
          "while repeats as long as its condition holds. break leaves the loop and continue skips to the next pass. A loop can also have an else block that runs only if the loop finished without break, which is a neat way to express 'not found'.",
        ], {
          title: "Prime check with loop else",
          code: 'n = 29\nfor d in range(2, int(n ** 0.5) + 1):\n    if n % d == 0:\n        print("composite")\n        break\nelse:\n    print("prime")\n',
          explanation: "No divisor up to the square root is found, so the else block runs. Output: prime.",
        }),
      ],
      takeaways: ["for iterates directly over items; range makes counts.", "enumerate and zip avoid manual indexes.", "A loop's else runs only when no break happened."],
      mistakes: ["Using range(len(x)) when you can loop over x.", "Changing a list while iterating over it.", "Forgetting that range stops before its end value."],
      check: [
        q("What does range(2, 5) produce?", ["2, 3, 4", "2, 3, 4, 5", "3, 4, 5", "2, 5"], 0, "The end value is excluded."),
        q("What does enumerate give?", ["Only indexes", "Index and value pairs", "Sorted values", "Reversed values"], 1, "Each step yields (index, item)."),
        q("When does a loop's else block run?", ["Always", "When the loop ended without break", "When break happened", "Never"], 1, "It signals a search that did not find anything."),
      ],
    }),
    lesson("patterns", "Nested loops and common patterns", 12, {
      summary: "Nested loops build patterns and walk tables. Most beginner problems are a counter, an accumulator or a search written as a loop.",
      sections: [
        sec("Nested loops", [
          "The inner loop runs fully for each pass of the outer loop. Strings can be multiplied, so '*' * r builds a row of r stars, often replacing an inner loop altogether.",
        ], {
          title: "Triangle of stars",
          code: 'for r in range(1, 5):\n    print("*" * r)\n',
          explanation: "Row r holds r stars. Output: *, **, ***, **** on separate lines.",
        }),
        sec("Accumulate, count, find", [
          "Three patterns cover many tasks: keep a running total, count items that match a condition, and remember the best value so far. Built-ins such as sum, max, min and any/all say the same thing in one line when the logic is simple.",
        ], {
          title: "Count and best",
          code: 'scores = [72, 91, 85, 40, 91]\npassed = 0\nbest = scores[0]\nfor s in scores:\n    if s >= 50:\n        passed += 1\n    if s > best:\n        best = s\nprint(passed, best, sum(scores) / len(scores))\n',
          explanation: "Four scores reach 50, the best is 91, and the average is 75.8. Output: 4 91 75.8.",
        }),
      ],
      takeaways: ["Nested loops multiply: n times m passes.", "Counter, accumulator and best-so-far cover many problems.", "sum, max, min, any and all replace simple loops."],
      mistakes: ["Initialising best to 0 when values can be negative.", "Dividing by len of an empty list.", "Reusing a loop variable name inside a nested loop."],
      check: [
        q("What does \"ab\" * 3 give?", ["\"ababab\"", "\"ab3\"", "An error", "\"aaabbb\""], 0, "Multiplying a string repeats it."),
        q("Which built-in finds the largest value in a list?", ["big", "max", "top", "high"], 1, "max returns the largest element."),
        q("Why initialise best to the first element rather than 0?", ["It is faster", "Values may all be negative", "Zero is not allowed", "It sorts the list"], 1, "A starting value of 0 would wrongly win against negative data."),
      ],
    }),
  ],
};
