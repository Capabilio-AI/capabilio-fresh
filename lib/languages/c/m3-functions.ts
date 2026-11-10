import { lesson, q, sec, type TrackModule } from "../types";

export const functions: TrackModule = {
  key: "c-functions",
  title: "Functions and recursion",
  summary: "Break a program into reusable pieces: defining functions, how variables live and die, and thinking recursively.",
  lessons: [
    lesson("functions", "Defining and calling functions", 12, {
      summary: "A function packages a task with a name, inputs and a result. In C, arguments are passed by value, so a function works on copies.",
      sections: [
        sec("Declaration, definition and call", [
          "A function has a return type, a name, a parameter list and a body. A prototype, the declaration without the body, tells the compiler the signature before the function is used, so prototypes usually sit at the top of the file or in a header.",
          "return sends a value back and ends the function. A function with return type void returns nothing.",
        ], {
          title: "Maximum of two numbers",
          code: '#include <stdio.h>\n\nint max(int a, int b);\n\nint main(void) {\n    printf("%d\\n", max(8, 13));\n    return 0;\n}\n\nint max(int a, int b) {\n    return a > b ? a : b;\n}\n',
          explanation: "The prototype lets main call max before it is defined. The call prints 13.",
        }),
        sec("Pass by value", [
          "When you call f(x), the value of x is copied into the parameter. Changing the parameter inside the function does not change the caller's variable. To change the original you pass its address, which the pointers module covers.",
        ], {
          title: "Changing a copy",
          code: '#include <stdio.h>\n\nstatic void bump(int n) {\n    n = n + 1;\n}\n\nint main(void) {\n    int x = 5;\n    bump(x);\n    printf("%d\\n", x);\n    return 0;\n}\n',
          explanation: "bump changes only its own copy, so main still prints 5.",
        }),
        sec("Writing good functions", [
          "Give each function one job and a name that says it. Keep it short enough to read at a glance. Functions that depend only on their parameters are easy to test, because the same input always gives the same output.",
        ]),
      ],
      takeaways: ["A prototype declares a function before it is defined.", "Arguments are copied; the callee cannot change the caller's variables.", "One function, one job."],
      mistakes: ["Calling a function before declaring it, so the compiler guesses its signature.", "Expecting a parameter change to affect the caller's variable.", "Forgetting to return a value from a non-void function."],
      check: [
        q("What does pass by value mean?", ["The function receives a copy of the argument", "The function receives the original variable", "Arguments are always pointers", "The function cannot return"], 0, "C copies each argument into the parameter."),
        q("What is a function prototype?", ["A call to the function", "A declaration of its signature without the body", "A loop", "A header file"], 1, "It tells the compiler the return type and parameters so calls can be checked."),
        q("A function declared void...", ["Returns an int", "Returns nothing", "Cannot take parameters", "Must call main"], 1, "void as a return type means no value is returned."),
      ],
    }),
    lesson("scope-storage", "Scope, lifetime and storage classes", 12, {
      summary: "Scope is where a name can be used; lifetime is how long the memory exists. Local, global and static variables differ in both.",
      sections: [
        sec("Local and global variables", [
          "A variable declared inside a block is local: it exists only while the block runs, and each call of a function gets a fresh copy. A global variable is declared outside every function, lives for the whole program and can be used anywhere after its declaration.",
          "Globals make code hard to reason about because any function can change them. Prefer parameters and return values.",
        ]),
        sec("static makes a local variable remember", [
          "A static local variable is initialised once and keeps its value between calls, yet it can only be named inside its function. It is a tidy way to count calls without a global.",
        ], {
          title: "Counting calls",
          code: '#include <stdio.h>\n\nstatic int next_id(void) {\n    static int id = 0;\n    id++;\n    return id;\n}\n\nint main(void) {\n    next_id();\n    next_id();\n    printf("%d\\n", next_id());\n    return 0;\n}\n',
          explanation: "id is created once and survives each call, so the third call returns 3.",
        }),
        sec("Shadowing and the stack", [
          "A name declared in an inner block hides one with the same name outside; this is shadowing and is a common source of confusion. Local variables live in a stack frame that is released when the function returns, so a pointer to a local becomes invalid afterwards.",
        ]),
      ],
      takeaways: ["Locals are fresh on each call; globals live for the whole run.", "static inside a function keeps the value between calls.", "Never return the address of a local variable."],
      mistakes: ["Relying on globals so any function can break your data.", "Shadowing a variable by accident with the same name in an inner block.", "Returning a pointer to a local array."],
      check: [
        q("What does static do to a local variable?", ["Makes it global", "Keeps its value between calls", "Makes it constant", "Removes it from the stack permanently"], 1, "The variable is created once and persists, but its name stays local to the function."),
        q("When is a local variable's memory released?", ["When the program ends", "When the function returns", "Never", "When another variable is declared"], 1, "A stack frame is removed on return."),
        q("What is shadowing?", ["Hiding a file", "An inner variable hiding an outer one of the same name", "A compiler error", "Copying a variable"], 1, "The inner declaration takes priority within its block."),
      ],
    }),
    lesson("recursion", "Recursion", 14, {
      summary: "A recursive function solves a problem by calling itself on a smaller version of it. It needs a base case that stops the calls and a step that moves toward it.",
      sections: [
        sec("Base case and recursive case", [
          "Factorial is the classic example: n! = n times (n-1)!, with 0! = 1. The base case returns directly; the recursive case calls the function with a smaller argument.",
          "Each call gets its own stack frame holding its parameters. Without a base case, or with a step that never reaches it, the stack fills and the program crashes with a stack overflow.",
        ], {
          title: "Factorial",
          code: '#include <stdio.h>\n\nstatic long factorial(int n) {\n    if (n <= 1) {\n        return 1;\n    }\n    return n * factorial(n - 1);\n}\n\nint main(void) {\n    printf("%ld\\n", factorial(5));\n    return 0;\n}\n',
          explanation: "factorial(5) becomes 5 * 4 * 3 * 2 * 1, so the program prints 120.",
        }),
        sec("When recursion is costly", [
          "A naive recursive Fibonacci calls itself twice and recomputes the same values again and again, so its time grows exponentially. Storing results (memoisation) or using a loop fixes that.",
        ], {
          title: "Fibonacci with a loop",
          code: '#include <stdio.h>\n\nint main(void) {\n    long a = 0, b = 1;\n    for (int i = 0; i < 10; i++) {\n        long next = a + b;\n        a = b;\n        b = next;\n    }\n    printf("%ld\\n", a);\n    return 0;\n}\n',
          explanation: "Ten steps give the tenth Fibonacci number, 55, with no repeated work.",
        }),
        sec("Thinking recursively", [
          "Ask three questions: what is the smallest case, how do I shrink the problem by one step, and how do I combine the smaller answer into the bigger one? Trees, divide and conquer and backtracking all rely on this habit.",
        ]),
      ],
      takeaways: ["Every recursion needs a base case and a step toward it.", "Each call uses stack memory, so depth is limited.", "Repeated subproblems call for memoisation or a loop."],
      mistakes: ["Missing or unreachable base case.", "Recomputing the same subproblem exponentially often.", "Forgetting that deep recursion can overflow the stack."],
      check: [
        q("What stops a recursive function?", ["A loop", "A base case", "A global variable", "The compiler"], 1, "The base case returns without another call."),
        q("What is factorial(4)?", ["10", "16", "24", "12"], 2, "4 times 3 times 2 times 1 equals 24."),
        q("What can happen if recursion has no base case?", ["It returns 0", "Stack overflow", "Nothing", "A compile error"], 1, "Calls keep stacking until the stack memory is exhausted."),
        q("Why is naive recursive Fibonacci slow?", ["It uses too many variables", "It recomputes the same values repeatedly", "It cannot return", "It uses a loop"], 1, "The two recursive calls overlap heavily, giving exponential time."),
      ],
    }),
  ],
};
