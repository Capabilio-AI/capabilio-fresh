import { lesson, q, sec, type TrackModule } from "../types";

export const basics: TrackModule = {
  key: "java-basics",
  title: "Getting started with Java",
  summary: "How Java programs are compiled and run on the JVM; variables, types, input and output, and operators.",
  lessons: [
    lesson("program-structure", "How a Java program runs", 10, {
      summary: "Java source is compiled to bytecode, and the Java Virtual Machine runs that bytecode on any operating system. Every program starts at a main method inside a class.",
      sections: [
        sec("Compile once, run anywhere", [
          "javac turns Main.java into Main.class, which holds bytecode rather than machine code. The java command starts the JVM, which loads the class and runs it, so the same .class file works on Windows, macOS and Linux. The JDK contains the compiler and tools; the JRE is only what is needed to run.",
          "A public class must live in a file with the same name, so public class Main goes in Main.java. By convention class names start with a capital letter.",
        ], {
          title: "Hello, Java",
          code: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, Java");\n    }\n}\n',
          explanation: "main is the entry point: public so the JVM can call it, static so no object is needed, void because it returns nothing. Compile with javac Main.java and run with java Main.",
        }),
        sec("Reading the structure", [
          "Everything in Java lives inside a class. Statements end with a semicolon and blocks use braces. System.out.println prints a line; System.out.print prints without a newline. Comments use // for one line and /* ... */ for a block.",
        ]),
      ],
      takeaways: ["javac compiles to bytecode; java runs it on the JVM.", "Execution starts at public static void main(String[] args).", "A public class's name must match its file name."],
      mistakes: ["Naming the file differently from the public class.", "Writing main with the wrong signature, so the JVM cannot find it.", "Confusing the JDK (tools) with the JRE (runtime only)."],
      check: [
        q("What does javac produce?", ["Machine code for one CPU", "Bytecode in a .class file", "A .exe file", "A text report"], 1, "The compiler outputs platform-independent bytecode for the JVM."),
        q("Why is main declared static?", ["It must be private", "The JVM calls it without creating an object", "It returns a value", "It is a constructor"], 1, "No instance exists when the program starts, so the entry point is static."),
        q("A public class Student must be saved as...", ["student.java", "Student.java", "Main.java", "Any name works"], 1, "The file name must match the public class name exactly."),
      ],
    }),
    lesson("variables-types", "Variables and data types", 12, {
      summary: "Java is statically typed: every variable has a type fixed at compile time. Eight primitive types hold simple values, and String holds text.",
      sections: [
        sec("Primitive types", [
          "The integer types are byte, short, int and long (8, 16, 32 and 64 bits). float and double hold decimals, with double the usual choice. char holds one UTF-16 character, and boolean holds true or false. Unlike C, these sizes are fixed by the language.",
          "int is the default for whole numbers and double for decimals. A long literal needs an L suffix, as in 3_000_000_000L, and underscores can make big numbers readable.",
        ], {
          title: "Declaring variables",
          code: 'public class Main {\n    public static void main(String[] args) {\n        int age = 20;\n        double cgpa = 8.4;\n        char grade = \'A\';\n        boolean placed = false;\n        long population = 1_400_000_000L;\n        String name = "Asha";\n        System.out.println(name + " " + age + " " + cgpa + " " + grade + " " + placed + " " + population);\n    }\n}\n',
          explanation: "Each variable has a declared type. The + operator joins text with other values. Output: Asha 20 8.4 A false 1400000000.",
        }),
        sec("Casting and var", [
          "Widening happens automatically (int to long or double). Narrowing needs an explicit cast and can lose information: (int) 3.9 is 3. Integer division discards the fraction, so 7 / 2 is 3 and 7 / 2.0 is 3.5.",
          "var lets the compiler infer a local variable's type from its initial value. The variable still has one fixed type; it is not dynamic typing.",
        ], {
          title: "Division and casts",
          code: 'public class Main {\n    public static void main(String[] args) {\n        int a = 7, b = 2;\n        var ratio = (double) a / b;\n        int cut = (int) 3.9;\n        System.out.println((a / b) + " " + ratio + " " + cut);\n    }\n}\n',
          explanation: "a / b is integer division, 3. Casting one operand to double gives 3.5, and casting 3.9 to int drops the fraction. Output: 3 3.5 3.",
        }),
      ],
      takeaways: ["Types are checked at compile time.", "Integer division drops the fraction; cast to double when needed.", "Narrowing needs an explicit cast and may lose data."],
      mistakes: ["Forgetting the L on a long literal larger than int.", "Expecting 7 / 2 to be 3.5.", "Using == to compare Strings; use equals."],
      check: [
        q("What is the type of the literal 3.14 by default?", ["float", "double", "decimal", "long"], 1, "Decimal literals are double unless you add an f suffix."),
        q("What does (int) 3.9 evaluate to?", ["4", "3", "3.9", "An error"], 1, "Casting truncates toward zero."),
        q("Which keyword lets the compiler infer a local variable's type?", ["auto", "var", "let", "dynamic"], 1, "var infers the type once; it stays fixed afterwards."),
        q("How many bits does an int have in Java?", ["16", "32", "64", "It depends on the machine"], 1, "Java fixes int at 32 bits on every platform."),
      ],
    }),
    lesson("input-output", "Input and output", 12, {
      summary: "Scanner reads typed input from the keyboard or a file, and printf formats output. Reading input correctly is the first thing every coding test needs.",
      sections: [
        sec("Reading with Scanner", [
          "Create a Scanner over System.in and call nextInt, nextDouble, next (a word) or nextLine (a whole line). nextInt leaves the newline in the input, so a nextLine straight after it returns an empty string; call nextLine once to consume it.",
          "Check hasNextInt before reading when input may run out. Close the scanner when you are finished, or use try-with-resources.",
        ], {
          title: "Sum of two numbers",
          code: 'import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner in = new Scanner(System.in);\n        int a = in.nextInt();\n        int b = in.nextInt();\n        System.out.println(a + b);\n    }\n}\n',
          explanation: "Two integers are read and their sum is printed. With the input 3 4 the output is 7.",
        }),
        sec("Formatted output", [
          "System.out.printf takes a format string like C: %d for integers, %.2f for a double with two decimals, %s for text and %n for a platform-correct newline. String.format builds the same text without printing it.",
          "For large inputs, Scanner is slow; competitive programmers use BufferedReader with readLine and split, which reads much faster.",
        ], {
          title: "Formatted printing",
          code: 'public class Main {\n    public static void main(String[] args) {\n        String name = "Ravi";\n        double cgpa = 8.456;\n        System.out.printf("%s scored %.2f in %d subjects%n", name, cgpa, 6);\n    }\n}\n',
          explanation: "%.2f rounds to two decimals, so the output is: Ravi scored 8.46 in 6 subjects.",
        }),
      ],
      takeaways: ["Scanner reads typed values; nextLine after nextInt needs an extra nextLine.", "printf uses format specifiers like C.", "BufferedReader is faster for large input."],
      mistakes: ["Calling nextLine right after nextInt and getting an empty line.", "Using %d for a double.", "Forgetting to import java.util.Scanner."],
      check: [
        q("Which method reads one whole line of text from a Scanner?", ["next()", "nextLine()", "readAll()", "nextInt()"], 1, "nextLine returns everything up to the line break."),
        q("What does %.2f print?", ["An integer", "A double with two decimal places", "Two characters", "A string of length 2"], 1, "The .2 sets the number of digits after the decimal point."),
        q("Which class is usually faster for reading large inputs?", ["Scanner", "BufferedReader", "Console", "System"], 1, "BufferedReader avoids Scanner's per-token parsing overhead."),
      ],
    }),
    lesson("operators", "Operators and expressions", 12, {
      summary: "Java's operators look like C's, with stricter types: conditions must be boolean, and == compares references for objects.",
      sections: [
        sec("Arithmetic, comparison and logic", [
          "+ - * / % work as in C, and % gives the remainder. Comparison operators return boolean, and && and || short-circuit. Unlike C, a number is never treated as true or false, so if (x = 5) does not compile when x is an int.",
          "x++ yields the old value then adds one; ++x adds one first. Compound assignments like += also cast back to the variable's type silently, so byte b += 1 is allowed.",
        ], {
          title: "Remainder and increment",
          code: 'public class Main {\n    public static void main(String[] args) {\n        int x = 5;\n        int a = x++;\n        int b = ++x;\n        System.out.println(a + " " + b + " " + x + " " + (17 % 5));\n    }\n}\n',
          explanation: "a gets the old 5, then ++x makes x 7 and b 7. Output: 5 7 7 2.",
        }),
        sec("== versus equals, and the ternary", [
          "For primitives == compares values. For objects it compares whether two references point to the same object, so use equals to compare contents. Two strings built at run time can be equal in content but different objects.",
          "condition ? a : b picks one of two values and is handy for short choices.",
        ], {
          title: "Comparing strings",
          code: 'public class Main {\n    public static void main(String[] args) {\n        String a = new String("java");\n        String b = new String("java");\n        System.out.println((a == b) + " " + a.equals(b));\n    }\n}\n',
          explanation: "a and b are different objects with the same text, so == is false and equals is true. Output: false true.",
        }),
      ],
      takeaways: ["Conditions must be boolean; there is no truthy number.", "Use equals for object content and == for primitives.", "Short-circuit && and || skip the right side when the answer is known."],
      mistakes: ["Comparing strings with ==.", "Assuming integer division gives a decimal.", "Mixing up x++ and ++x in a larger expression."],
      check: [
        q("What does == compare for two String objects?", ["Their text", "Whether they are the same object", "Their length", "Their hash code"], 1, "For objects, == checks reference identity."),
        q("Is if (x = 5) valid when x is an int?", ["Yes, it assigns", "No, the condition must be boolean", "Yes, it always runs", "Only inside a loop"], 1, "An int is not a boolean, so the compiler rejects it."),
        q("What does 17 % 5 evaluate to?", ["3", "2", "3.4", "0"], 1, "17 = 3 x 5 + 2."),
      ],
    }),
  ],
};
