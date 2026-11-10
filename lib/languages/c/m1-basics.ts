import { lesson, q, sec, type TrackModule } from "../types";

export const basics: TrackModule = {
  key: "c-basics",
  title: "Getting started with C",
  summary: "How a C program is written, compiled and run; variables, types, input and output, and operators.",
  lessons: [
    lesson("program-structure", "Structure of a C program and compiling it", 10, {
      summary: "A C program is a set of functions, and execution always starts at main. You write source code, a compiler turns it into an executable, and the operating system runs that executable.",
      sections: [
        sec("The smallest useful program", [
          "Every C program has a function called main. The operating system calls it when the program starts, and the value it returns tells the system whether the program succeeded: 0 means success.",
          "Lines that start with # are preprocessor directives. #include <stdio.h> pastes in the declarations for the standard input and output functions, so the compiler knows what printf is.",
        ], {
          title: "Hello, C",
          code: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, C\\n");\n    return 0;\n}\n',
          explanation: "printf prints text; \\n is the newline character. Every statement ends with a semicolon, and braces group the body of main.",
        }),
        sec("From source code to a running program", [
          "A compiler such as gcc translates the .c file into machine code. The usual command is gcc hello.c -o hello, then ./hello runs it. If the compiler finds a syntax error it stops and reports the line.",
          "Compiling happens in stages: the preprocessor expands directives, the compiler produces object code, and the linker joins your code with the standard library. Errors from the linker, such as an undefined reference, mean a function was declared but never defined.",
        ]),
        sec("Comments and good habits", [
          "Use // for a one-line comment and /* ... */ for a block. Comments explain why, not what. Compile with warnings turned on (gcc -Wall -Wextra) and treat each warning as a bug to understand.",
        ]),
      ],
      takeaways: ["Execution starts at main, which returns 0 on success.", "#include brings in declarations; the linker supplies the library code.", "Compile with -Wall -Wextra and read the warnings."],
      mistakes: ["Forgetting the semicolon at the end of a statement.", "Writing void main(); the standard form returns int.", "Ignoring compiler warnings because the program still runs."],
      check: [
        q("Where does execution of a C program begin?", ["The first function in the file", "The function named main", "The first #include line", "The function that has the most lines"], 1, "The runtime always calls main, whatever order the functions are written in."),
        q("What does return 0 from main usually mean?", ["The program failed", "The program printed nothing", "The program finished successfully", "The program must be run again"], 2, "By convention a zero exit status means success; non-zero values signal an error."),
        q("Which command compiles hello.c into an executable called hello with gcc?", ["gcc hello.c -o hello", "gcc -o hello.c hello", "run hello.c", "compile hello"], 0, "-o names the output file, and the source file is given as the input."),
      ],
    }),
    lesson("variables-types", "Variables, data types and constants", 12, {
      summary: "A variable is a named piece of memory with a type. The type decides how many bytes it uses and how those bytes are read, so choosing the right type matters in C.",
      sections: [
        sec("Basic types", [
          "int holds whole numbers, usually 4 bytes. char holds one character and is really a small integer, 1 byte. float and double hold numbers with a fractional part; double has more precision and is the default choice. long and long long hold larger integers.",
          "The sizes are not fixed by the language, only minimums. sizeof tells you the size on your machine, and <stdint.h> offers exact-width types such as int32_t when you need them.",
        ], {
          title: "Sizes on this machine",
          code: '#include <stdio.h>\n\nint main(void) {\n    printf("int=%zu char=%zu double=%zu\\n", sizeof(int), sizeof(char), sizeof(double));\n    return 0;\n}\n',
          explanation: "%zu prints a size_t, the type returned by sizeof. Typical output is int=4 char=1 double=8.",
        }),
        sec("Declaring, initialising and constants", [
          "A declaration such as int age = 20; creates the variable and gives it a value. A local variable that is not initialised holds garbage, so always give it a value before you read it.",
          "Use const for a value that must not change, and #define or an enum for named constants. Names should say what the value means: marks, not m.",
        ], {
          title: "Constants",
          code: '#include <stdio.h>\n\n#define MAX_STUDENTS 60\n\nint main(void) {\n    const double pi = 3.14159;\n    int radius = 5;\n    printf("%.2f %d\\n", pi * radius * radius, MAX_STUDENTS);\n    return 0;\n}\n',
          explanation: "pi is a typed constant; MAX_STUDENTS is replaced by 60 before compiling. %.2f prints two decimal places.",
        }),
        sec("Type conversion", [
          "When types are mixed, C converts silently. Dividing two ints discards the fraction: 7 / 2 is 3. To get 3.5, make one operand a double, either by writing 7.0 / 2 or by casting with (double)7 / 2.",
        ]),
      ],
      takeaways: ["The type fixes the size and meaning of a variable's bytes.", "Always initialise a variable before reading it.", "Integer division discards the fraction; cast to double when you need it."],
      mistakes: ["Reading an uninitialised local variable.", "Expecting 7 / 2 to be 3.5.", "Assuming int is always 4 bytes on every machine."],
      check: [
        q("What is the value of 7 / 2 when both are int?", ["3.5", "3", "4", "2"], 1, "Integer division truncates toward zero, so the fractional part is dropped."),
        q("What does an uninitialised local int variable contain?", ["Always 0", "Always -1", "An unpredictable leftover value", "A compile error occurs"], 2, "Local variables are not cleared; reading one gives whatever was in that memory."),
        q("Which keyword marks a variable that must not be modified?", ["static", "const", "final", "fixed"], 1, "const asks the compiler to reject any assignment to the variable."),
        q("Which operator gives the size in bytes of a type or variable?", ["length", "size", "sizeof", "count"], 2, "sizeof is an operator evaluated by the compiler and returns a size_t."),
      ],
    }),
    lesson("input-output", "Input and output with printf and scanf", 12, {
      summary: "printf writes formatted output and scanf reads formatted input. Both use format specifiers, and getting the specifier wrong is one of the most common beginner errors.",
      sections: [
        sec("Printing with format specifiers", [
          "The first argument to printf is a format string. Each % sequence is replaced by the next argument: %d for int, %f for double in printf, %c for a char, %s for a string, %ld for long.",
          "Width and precision tune the layout: %5d pads to width 5 and %.3f prints three decimals. Use \\n to end a line, otherwise output can stay in the buffer.",
        ]),
        sec("Reading with scanf", [
          "scanf needs the address of the variable, written with &, because it must store the value there. Use %d for int, %lf for double, %c for char and %s for a word.",
          "scanf returns how many items it read. Check it: a result that is not what you expected means the input was not in the right form.",
        ], {
          title: "Sum of two numbers",
          code: '#include <stdio.h>\n\nint main(void) {\n    int a, b;\n    if (scanf("%d %d", &a, &b) != 2) {\n        printf("bad input\\n");\n        return 1;\n    }\n    printf("%d\\n", a + b);\n    return 0;\n}\n',
          explanation: "The program stores two integers through their addresses, checks that both were read, and prints their sum.",
        }),
        sec("Reading lines and characters", [
          "%s stops at whitespace, so it reads one word. To read a whole line use fgets(buf, size, stdin), which is bounded and therefore safe. Avoid gets, which cannot limit the length and has been removed from the language.",
        ]),
      ],
      takeaways: ["scanf needs &variable; printf takes the value.", "Match the specifier to the type: %d int, %lf double in scanf.", "Check scanf's return value and prefer fgets for lines."],
      mistakes: ["Forgetting & before the variable in scanf.", "Using %f in scanf for a double; it needs %lf.", "Using gets, which can overflow the buffer."],
      check: [
        q("Which call correctly reads an int named n?", ["scanf(\"%d\", n);", "scanf(\"%d\", &n);", "scanf(\"%n\", &d);", "scanf(&n, \"%d\");"], 1, "scanf stores through a pointer, so it needs the address of n."),
        q("Which specifier reads a double with scanf?", ["%d", "%f", "%lf", "%c"], 2, "scanf distinguishes float (%f) from double (%lf), unlike printf."),
        q("What does scanf return?", ["The value it read", "The number of items it successfully read", "Always 1", "The number of characters typed"], 1, "The return value lets you detect failed or partial input."),
      ],
    }),
    lesson("operators", "Operators and expressions", 12, {
      summary: "Operators combine values into expressions. Knowing precedence, the difference between = and ==, and how increments behave removes a whole class of bugs.",
      sections: [
        sec("Arithmetic, relational and logical operators", [
          "Arithmetic operators are + - * / and %, where % gives the remainder and works on integers only. Relational operators (< <= > >= == !=) produce 1 for true and 0 for false. Logical && and || combine conditions, and ! negates one.",
          "&& and || short-circuit: in a && b, b is not evaluated if a is false. That lets you write p != 0 && *p > 3 safely.",
        ]),
        sec("Assignment, increment and precedence", [
          "= assigns and == compares; writing if (x = 5) assigns 5 and is always true. Compound forms such as += and *= update a variable in place. x++ yields the old value then adds one, while ++x adds one first.",
          "Multiplication binds tighter than addition, and comparison tighter than &&. When in doubt, add parentheses; they cost nothing and make intent clear.",
        ], {
          title: "Increment and remainder",
          code: '#include <stdio.h>\n\nint main(void) {\n    int x = 5;\n    int a = x++;\n    int b = ++x;\n    printf("%d %d %d %d\\n", a, b, x, 17 % 5);\n    return 0;\n}\n',
          explanation: "a gets 5 (old value), then x becomes 6; ++x makes x 7 and b gets 7. The program prints 5 7 7 2.",
        }),
        sec("The conditional operator", [
          "condition ? yes : no picks one of two values. For example, int bigger = a > b ? a : b; keeps the larger number without an if statement.",
        ]),
      ],
      takeaways: ["= assigns, == compares.", "&& and || stop as soon as the answer is known.", "Use parentheses to make precedence obvious."],
      mistakes: ["Writing if (x = 0) instead of if (x == 0).", "Using % with doubles; it is for integers.", "Modifying and reading the same variable in one expression, such as i = i++ + ++i."],
      check: [
        q("What does 17 % 5 evaluate to?", ["3", "2", "3.4", "0"], 1, "17 = 3 * 5 + 2, so the remainder is 2."),
        q("What is wrong with if (x = 5)?", ["Nothing, it compares", "It assigns 5 and is always true", "It is a syntax error", "It is always false"], 1, "A single = assigns, and the assigned value 5 is non-zero, hence true."),
        q("In int a = x++; with x equal to 5, what are a and x afterwards?", ["a=5, x=6", "a=6, x=6", "a=5, x=5", "a=6, x=5"], 0, "Postfix ++ returns the old value, then increments the variable."),
      ],
    }),
  ],
};
