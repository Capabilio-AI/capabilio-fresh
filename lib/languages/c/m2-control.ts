import { lesson, q, sec, type TrackModule } from "../types";

export const control: TrackModule = {
  key: "c-control",
  title: "Decisions and loops",
  summary: "Make the program choose and repeat: if, else, switch, the three loops, and the patterns that placement tests love.",
  lessons: [
    lesson("if-switch", "Decisions: if, else and switch", 10, {
      summary: "if chooses between paths using a condition; switch chooses between fixed values. Any non-zero value counts as true in C.",
      sections: [
        sec("if, else if and else", [
          "An if statement runs its block when the condition is non-zero. Chain else if for further cases and end with else for everything left. Only the first matching branch runs.",
          "Always use braces, even for one statement. Without them only the next statement belongs to the if, and adding a second line later silently changes the meaning.",
        ], {
          title: "Grade from marks",
          code: '#include <stdio.h>\n\nint main(void) {\n    int marks = 72;\n    if (marks >= 90) {\n        printf("A\\n");\n    } else if (marks >= 70) {\n        printf("B\\n");\n    } else {\n        printf("C\\n");\n    }\n    return 0;\n}\n',
          explanation: "Conditions are tested top to bottom. 72 fails the first test and passes the second, so the program prints B.",
        }),
        sec("switch and fall-through", [
          "switch compares one integer or character expression with constant case labels. Each case should end with break; without it execution falls through into the next case, which is occasionally useful and often a bug.",
          "default handles any value not listed. switch cannot test ranges or strings, so use if for those.",
        ], {
          title: "Day of the week",
          code: '#include <stdio.h>\n\nint main(void) {\n    int day = 3;\n    switch (day) {\n        case 1: printf("Mon\\n"); break;\n        case 2: printf("Tue\\n"); break;\n        case 3: printf("Wed\\n"); break;\n        default: printf("Other\\n");\n    }\n    return 0;\n}\n',
          explanation: "The case for 3 prints Wed and break leaves the switch. Remove the breaks and it would also print Other.",
        }),
      ],
      takeaways: ["Zero is false and every other value is true.", "Use braces on every if and else.", "End each switch case with break unless you mean to fall through."],
      mistakes: ["Forgetting break in a switch.", "Putting a semicolon right after if (...), which makes the block run always.", "Using switch on a string or a range."],
      check: [
        q("In C, which value is treated as false?", ["-1", "0", "1", "Any negative number"], 1, "Only zero is false; every non-zero value is true."),
        q("What happens if a switch case has no break?", ["Compile error", "Execution continues into the next case", "The switch restarts", "The default case is skipped"], 1, "That is fall-through: the following statements run until a break or the end."),
        q("Which can switch not do?", ["Compare against a char", "Compare against an int", "Compare against a string", "Use a default label"], 2, "switch works on integer-like values only, not strings."),
      ],
    }),
    lesson("loops", "Loops: for, while and do-while", 12, {
      summary: "Loops repeat work. Pick for when you know the count, while when you repeat until a condition changes, and do-while when the body must run at least once.",
      sections: [
        sec("for and while", [
          "A for loop has three parts: initialisation, condition and update. for (int i = 0; i < n; i++) runs n times with i from 0 to n-1. A while loop checks its condition before every pass, so it may run zero times.",
          "Most counting bugs are off-by-one errors. Decide whether the last value should be included and choose < or <= on purpose.",
        ], {
          title: "Sum of 1 to n",
          code: '#include <stdio.h>\n\nint main(void) {\n    int n = 10, sum = 0;\n    for (int i = 1; i <= n; i++) {\n        sum += i;\n    }\n    printf("%d\\n", sum);\n    return 0;\n}\n',
          explanation: "i takes the values 1 through 10 and sum accumulates them. The program prints 55.",
        }),
        sec("do-while and choosing a loop", [
          "do { ... } while (condition); runs the body first and tests afterwards, which suits menus and input validation. Remember the semicolon after the closing parenthesis.",
          "An infinite loop is while (1) or for (;;) and is left with break or return. Use it only when the exit condition is awkward to write at the top.",
        ], {
          title: "Digits of a number",
          code: '#include <stdio.h>\n\nint main(void) {\n    int n = 4721, digits = 0;\n    do {\n        digits++;\n        n /= 10;\n    } while (n > 0);\n    printf("%d\\n", digits);\n    return 0;\n}\n',
          explanation: "Each pass removes the last digit by integer division. do-while guarantees 0 is counted as one digit. The output is 4.",
        }),
      ],
      takeaways: ["for suits a known count; while suits a condition; do-while runs at least once.", "Check the first and last values to avoid off-by-one errors.", "Make sure something in the loop moves the condition toward false."],
      mistakes: ["Using <= where < is meant, running once too often.", "Forgetting to update the loop variable and looping forever.", "A stray semicolon after for (...) which makes an empty loop."],
      check: [
        q("How many times does for (int i = 0; i < 5; i++) run its body?", ["4", "5", "6", "Infinite"], 1, "i takes 0, 1, 2, 3, 4 which is five values."),
        q("Which loop always runs its body at least once?", ["for", "while", "do-while", "none of them"], 2, "do-while checks the condition after the body."),
        q("What is a likely cause of a loop that never ends?", ["Using braces", "The condition never becomes false", "Using int", "Using printf inside"], 1, "If nothing changes the variables in the condition, it stays true."),
      ],
    }),
    lesson("break-nested", "break, continue and nested loops", 12, {
      summary: "break leaves a loop and continue skips to the next pass. Putting one loop inside another is how you print patterns and walk tables.",
      sections: [
        sec("break and continue", [
          "break ends the nearest enclosing loop or switch immediately. continue skips the rest of the current pass and goes to the next iteration; in a for loop the update step still runs.",
        ], {
          title: "First multiple of 7",
          code: '#include <stdio.h>\n\nint main(void) {\n    for (int i = 20; i < 100; i++) {\n        if (i % 7 != 0) {\n            continue;\n        }\n        printf("%d\\n", i);\n        break;\n    }\n    return 0;\n}\n',
          explanation: "Numbers that are not multiples of 7 are skipped. The first multiple, 21, is printed and break ends the search.",
        }),
        sec("Nested loops and patterns", [
          "In nested loops the inner loop runs completely for each pass of the outer loop. If the outer runs n times and the inner m times, the body runs n times m times. Pattern problems use the outer loop for rows and the inner loop for what goes in each row.",
        ], {
          title: "Triangle of stars",
          code: '#include <stdio.h>\n\nint main(void) {\n    int rows = 4;\n    for (int r = 1; r <= rows; r++) {\n        for (int c = 1; c <= r; c++) {\n            printf("*");\n        }\n        printf("\\n");\n    }\n    return 0;\n}\n',
          explanation: "Row r prints r stars, then a newline. This prints a right triangle with 1, 2, 3 and 4 stars.",
        }),
        sec("Prime check with early exit", [
          "To test whether n is prime you only need divisors up to its square root. As soon as one divides n, you can stop. Reasoning like this turns a slow loop into a fast one, and it is exactly what interviewers look for.",
        ]),
      ],
      takeaways: ["break exits the nearest loop; continue goes to the next pass.", "Nested loops multiply: n times m passes.", "Stop searching as soon as you have the answer."],
      mistakes: ["Expecting break to leave all nested loops; it leaves only the innermost.", "Reusing the same variable name in the inner and outer loop.", "Forgetting the newline after each row of a pattern."],
      check: [
        q("Which loop does break leave when used inside nested loops?", ["All loops", "Only the innermost loop", "Only the outermost loop", "None"], 1, "break affects only the closest enclosing loop or switch."),
        q("If the outer loop runs 3 times and the inner loop 4 times each, how many times does the inner body run?", ["7", "12", "3", "4"], 1, "The inner body runs 4 times for each of 3 outer passes: 12."),
        q("What does continue do in a for loop?", ["Ends the loop", "Skips to the update step and next iteration", "Restarts from the beginning of the program", "Does nothing"], 1, "The rest of the body is skipped and the loop moves on."),
      ],
    }),
  ],
};
