import { lesson, q, sec, type TrackModule } from "../types";

export const control: TrackModule = {
  key: "java-control",
  title: "Decisions and loops",
  summary: "if, switch (including the modern switch expression), the loop forms, and labelled break.",
  lessons: [
    lesson("if-switch", "Decisions: if and switch", 10, {
      summary: "if chooses by a boolean condition. switch chooses by value, and modern Java has a switch expression with arrows that returns a value and needs no break.",
      sections: [
        sec("if and else", [
          "The condition of an if must be a boolean expression. Chain else if for more cases. Always use braces: it prevents the classic bug where a second line looks like part of the if but is not.",
        ], {
          title: "Grade from marks",
          code: 'public class Main {\n    public static void main(String[] args) {\n        int marks = 72;\n        String grade;\n        if (marks >= 90) {\n            grade = "A";\n        } else if (marks >= 70) {\n            grade = "B";\n        } else {\n            grade = "C";\n        }\n        System.out.println(grade);\n    }\n}\n',
          explanation: "Tests run top to bottom and only the first match runs. 72 gives B.",
        }),
        sec("switch expressions", [
          "The older switch statement falls through without break. The arrow form, case 1 -> ..., never falls through and, used as an expression, produces a value. The compiler checks that every possible value is covered, or that there is a default.",
          "switch works on int, char, String and enum values.",
        ], {
          title: "Day name",
          code: 'public class Main {\n    public static void main(String[] args) {\n        int day = 3;\n        String name = switch (day) {\n            case 1 -> "Mon";\n            case 2 -> "Tue";\n            case 3 -> "Wed";\n            default -> "Other";\n        };\n        System.out.println(name);\n    }\n}\n',
          explanation: "The switch yields a value that is assigned to name. Output: Wed.",
        }),
      ],
      takeaways: ["Conditions must be boolean.", "Arrow-form switch does not fall through and can return a value.", "Always use braces on if and else."],
      mistakes: ["Forgetting break in an old-style switch.", "Using = instead of ==.", "Leaving out default in a switch expression over int."],
      check: [
        q("Which type can be the condition of an if?", ["int", "boolean", "String", "Any object"], 1, "Java does not convert numbers to booleans."),
        q("What is a feature of case X -> ... in a switch?", ["It falls through to the next case", "It does not fall through", "It requires break", "It only works for String"], 1, "Arrow cases run only their own branch."),
        q("Which values can a switch test?", ["Only int", "int, char, String and enums", "Any object", "Only boolean"], 1, "These are the supported selector types."),
      ],
    }),
    lesson("loops", "Loops: for, while, do-while and for-each", 12, {
      summary: "Java has the same three loops as C, plus a for-each loop that visits every element of an array or collection without an index.",
      sections: [
        sec("for, while and do-while", [
          "Use for when you know how many times to repeat, while when the count depends on a condition, and do-while when the body must run at least once. Off-by-one errors are the usual bug: decide whether the last value is included and pick < or <= on purpose.",
        ], {
          title: "Sum of 1 to n",
          code: 'public class Main {\n    public static void main(String[] args) {\n        int sum = 0;\n        for (int i = 1; i <= 10; i++) {\n            sum += i;\n        }\n        System.out.println(sum);\n    }\n}\n',
          explanation: "i runs from 1 to 10 inclusive and sum accumulates the values. Output: 55.",
        }),
        sec("The enhanced for loop", [
          "for (int x : numbers) visits each element in order and gives you its value. It is the cleanest way to read every item, but it hides the index, so use a normal for loop when you need the position or want to change elements.",
        ], {
          title: "Largest in an array",
          code: 'public class Main {\n    public static void main(String[] args) {\n        int[] numbers = {4, 17, 9, 2};\n        int best = numbers[0];\n        for (int x : numbers) {\n            if (x > best) {\n                best = x;\n            }\n        }\n        System.out.println(best);\n    }\n}\n',
          explanation: "Each element is compared with the best so far. Output: 17.",
        }),
      ],
      takeaways: ["for for counted loops, while for condition loops, do-while to run once at least.", "for-each reads every element without an index.", "Check the first and last values to avoid off-by-one errors."],
      mistakes: ["Using <= where < is meant and indexing past the end.", "Changing the collection while iterating over it.", "Expecting the for-each variable to change the array element."],
      check: [
        q("How many times does for (int i = 0; i < 5; i++) run?", ["4", "5", "6", "Infinite"], 1, "i takes 0 through 4, five values."),
        q("Which loop always runs its body at least once?", ["for", "while", "do-while", "for-each"], 2, "do-while tests its condition after the body."),
        q("When is the enhanced for loop NOT suitable?", ["Reading every element", "When you need the index", "Summing numbers", "Printing items"], 1, "It does not expose a position."),
      ],
    }),
    lesson("break-nested", "break, continue, labels and nested loops", 12, {
      summary: "break leaves a loop and continue skips to the next pass. A label lets break or continue target an outer loop, which C cannot do without a goto.",
      sections: [
        sec("break and continue", [
          "break ends the nearest loop or switch. continue skips the rest of the current pass. In nested loops they affect only the innermost loop unless you give them a label.",
        ], {
          title: "Stars in a triangle",
          code: 'public class Main {\n    public static void main(String[] args) {\n        for (int r = 1; r <= 4; r++) {\n            StringBuilder row = new StringBuilder();\n            for (int c = 1; c <= r; c++) {\n                row.append(\'*\');\n            }\n            System.out.println(row);\n        }\n    }\n}\n',
          explanation: "Row r holds r stars. This prints a right triangle of 1, 2, 3 and 4 stars.",
        }),
        sec("Labelled break", [
          "Putting a label before a loop, such as search:, lets break search; leave both loops at once. This is handy for finding a pair in a grid, though a method that returns early often reads better.",
        ], {
          title: "Find a pair",
          code: 'public class Main {\n    public static void main(String[] args) {\n        int[] a = {2, 7, 11, 15};\n        int target = 18;\n        search:\n        for (int i = 0; i < a.length; i++) {\n            for (int j = i + 1; j < a.length; j++) {\n                if (a[i] + a[j] == target) {\n                    System.out.println(a[i] + " " + a[j]);\n                    break search;\n                }\n            }\n        }\n    }\n}\n',
          explanation: "7 and 11 add to 18. break search leaves both loops. Output: 7 11.",
        }),
      ],
      takeaways: ["break and continue act on the innermost loop by default.", "A label lets them target an outer loop.", "Nested loops multiply: n times m passes."],
      mistakes: ["Expecting break to leave all nested loops.", "Reusing the same loop variable name in nested loops.", "Building long strings with + in a loop; use StringBuilder."],
      check: [
        q("What does break search; do?", ["Ends only the inner loop", "Ends the loop labelled search", "Restarts the program", "Does nothing"], 1, "A labelled break leaves the loop that carries the label."),
        q("With outer 3 passes and inner 4 passes, how often does the inner body run?", ["7", "12", "3", "4"], 1, "4 times for each of 3 outer passes is 12."),
        q("Which class builds strings efficiently in a loop?", ["String", "StringBuilder", "Scanner", "Math"], 1, "StringBuilder changes its buffer instead of creating new strings each time."),
      ],
    }),
  ],
};

export const methods: TrackModule = {
  key: "java-methods",
  title: "Methods and recursion",
  summary: "Break a program into reusable methods, understand how arguments are passed, and think recursively.",
  lessons: [
    lesson("methods", "Methods and overloading", 12, {
      summary: "A method packages a task with a name, parameters and a return type. Java passes everything by value, and overloading lets several methods share a name.",
      sections: [
        sec("Defining and calling methods", [
          "A method has an access modifier, a return type, a name and parameters. Methods that belong to the class rather than an object are static. return sends a value back; a void method returns nothing.",
          "Arguments are always copied. For a primitive that is the value; for an object it is a copy of the reference, so the method can change the object's contents but cannot make the caller's variable refer to a different object.",
        ], {
          title: "A method with a return value",
          code: 'public class Main {\n    static int max(int a, int b) {\n        return a > b ? a : b;\n    }\n\n    public static void main(String[] args) {\n        System.out.println(max(8, 13));\n    }\n}\n',
          explanation: "max returns the larger of its two arguments. Output: 13.",
        }),
        sec("Overloading", [
          "Several methods can share a name if their parameter lists differ in number or type. The compiler picks the best match from the arguments. The return type alone does not distinguish overloads.",
        ], {
          title: "Overloaded area",
          code: 'public class Main {\n    static double area(double r) {\n        return Math.PI * r * r;\n    }\n\n    static double area(double w, double h) {\n        return w * h;\n    }\n\n    public static void main(String[] args) {\n        System.out.printf("%.2f %.1f%n", area(1.0), area(3.0, 4.0));\n    }\n}\n',
          explanation: "One call gets the circle version and the other the rectangle version. Output: 3.14 12.0.",
        }),
      ],
      takeaways: ["Java is always pass by value.", "An object argument passes a copy of the reference.", "Overloads differ in parameter lists, not return type."],
      mistakes: ["Thinking a method can reassign the caller's object variable.", "Overloading by return type only.", "Forgetting a return on some path of a non-void method."],
      check: [
        q("How does Java pass arguments?", ["By reference always", "By value always", "By value for primitives and by reference for objects", "By name"], 1, "Even object references are passed by value (a copy of the reference)."),
        q("Which counts as a valid overload?", ["Same name, same parameters, different return type", "Same name, different parameter types", "Different name", "Same signature"], 1, "The parameter list must differ."),
        q("A method declared void...", ["Returns an int", "Returns nothing", "Cannot be static", "Cannot take parameters"], 1, "void means no value is returned."),
      ],
    }),
    lesson("recursion", "Recursion", 14, {
      summary: "A recursive method calls itself on a smaller problem. It needs a base case, and deep recursion can overflow the call stack.",
      sections: [
        sec("Base case and recursive case", [
          "Factorial: n! is n times (n-1)!, and 0! is 1. The base case returns directly; the recursive case moves toward it. Each call has its own frame on the stack. Missing the base case causes a StackOverflowError.",
        ], {
          title: "Factorial",
          code: 'public class Main {\n    static long factorial(int n) {\n        if (n <= 1) {\n            return 1;\n        }\n        return n * factorial(n - 1);\n    }\n\n    public static void main(String[] args) {\n        System.out.println(factorial(5));\n    }\n}\n',
          explanation: "factorial(5) is 5 x 4 x 3 x 2 x 1. Output: 120.",
        }),
        sec("Avoiding repeated work", [
          "A naive recursive Fibonacci recomputes the same values exponentially often. Storing results in an array or map (memoisation) makes it linear.",
        ], {
          title: "Memoised Fibonacci",
          code: 'public class Main {\n    static long fib(int n, long[] memo) {\n        if (n <= 1) {\n            return n;\n        }\n        if (memo[n] != 0) {\n            return memo[n];\n        }\n        memo[n] = fib(n - 1, memo) + fib(n - 2, memo);\n        return memo[n];\n    }\n\n    public static void main(String[] args) {\n        System.out.println(fib(50, new long[51]));\n    }\n}\n',
          explanation: "Each value is computed once and stored. Output: 12586269025.",
        }),
      ],
      takeaways: ["Every recursion needs a base case and progress toward it.", "Deep recursion can throw StackOverflowError.", "Memoisation removes repeated subproblems."],
      mistakes: ["No base case or one that is never reached.", "Recomputing the same values exponentially.", "Using int where the result needs long."],
      check: [
        q("What error does infinite recursion cause?", ["NullPointerException", "StackOverflowError", "ArithmeticException", "Nothing"], 1, "The call stack fills up."),
        q("What is factorial(4)?", ["10", "16", "24", "12"], 2, "4 x 3 x 2 x 1 = 24."),
        q("What does memoisation do?", ["Speeds up by storing computed results", "Removes the base case", "Converts recursion to a loop automatically", "Uses more recursion"], 0, "Saved results are reused instead of recomputed."),
      ],
    }),
  ],
};
