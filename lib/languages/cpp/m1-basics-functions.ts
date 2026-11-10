import { lesson, q, sec, type TrackModule } from "../types";

export const basics: TrackModule = {
  key: "cpp-basics",
  title: "Getting started with C++",
  summary: "Compile and run C++, use cin and cout, the core types, control flow and operators.",
  lessons: [
    lesson("program-structure", "Structure of a C++ program", 10, {
      summary: "C++ is compiled like C but adds streams, strings, containers and classes. Every program starts at main, and the standard library lives in the std namespace.",
      sections: [
        sec("Your first program", [
          "#include <iostream> brings in the stream objects. std::cout writes with the << operator and std::endl or '\\n' ends a line. Compile with g++ -std=c++20 -Wall -Wextra hello.cpp -o hello and run ./hello. Writing using namespace std; saves typing in small programs, but in larger code prefer the explicit std:: prefix to avoid name clashes.",
        ], {
          title: "Hello, C++",
          code: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, C++" << \'\\n\';\n    return 0;\n}\n',
          explanation: "cout sends text to the screen; << chains several items. Output: Hello, C++.",
        }),
        sec("What C++ adds to C", [
          "C++ is mostly a superset of C with stronger type checking. On top of it come classes and objects, templates, references, the Standard Template Library (containers and algorithms), exceptions and RAII, where objects release resources automatically when they go out of scope. Learning these makes programs safer and shorter than the equivalent C.",
        ]),
      ],
      takeaways: ["main is the entry point; return 0 means success.", "cout << prints; cin >> reads.", "Prefer std:: names in larger programs."],
      mistakes: ["Forgetting #include <iostream>.", "Using = where == is meant.", "Compiling without -Wall -Wextra and missing warnings."],
      check: [
        q("Which header provides cout?", ["<stdio.h>", "<iostream>", "<string>", "<cstdlib>"], 1, "iostream declares the standard stream objects."),
        q("What does the << operator do with cout?", ["Shifts bits only", "Sends data to the output stream", "Reads input", "Compares values"], 1, "Here << is overloaded to insert items into the stream."),
        q("What is RAII?", ["A compiler flag", "Objects releasing resources automatically at end of scope", "A kind of loop", "A header"], 1, "Resource Acquisition Is Initialization ties cleanup to an object's lifetime."),
      ],
    }),
    lesson("types-io", "Types, cin and cout", 12, {
      summary: "C++ has the same primitive types as C plus bool and a real string type. cin reads typed values and skips whitespace for you.",
      sections: [
        sec("Types and auto", [
          "int, long long, double, char and bool cover most needs, and std::string holds text. auto lets the compiler deduce a variable's type from its initial value. Prefer brace initialisation, int n{5}, because it refuses narrowing conversions that would lose data.",
        ], {
          title: "Declaring variables",
          code: '#include <iostream>\n#include <string>\n\nint main() {\n    int age{20};\n    double cgpa = 8.4;\n    bool placed{false};\n    std::string name = "Asha";\n    auto big = 3000000000LL;\n    std::cout << name << \' \' << age << \' \' << cgpa << \' \' << placed << \' \' << big << \'\\n\';\n    return 0;\n}\n',
          explanation: "bool prints as 0 or 1 unless you use boolalpha. Output: Asha 20 8.4 0 3000000000.",
        }),
        sec("Reading with cin", [
          "cin >> a >> b reads two values of the right types. Check the stream afterward: if (cin >> n) is true only when the read worked. getline(cin, line) reads a whole line. In contests, std::ios::sync_with_stdio(false); cin.tie(nullptr); makes input and output much faster.",
        ], {
          title: "Sum of two numbers",
          code: '#include <iostream>\n\nint main() {\n    int a, b;\n    if (std::cin >> a >> b) {\n        std::cout << a + b << \'\\n\';\n    }\n    return 0;\n}\n',
          explanation: "The condition is true only if both values were read. With the input 3 4 the output is 7.",
        }),
      ],
      takeaways: ["auto deduces the type; braces prevent narrowing.", "std::string replaces char arrays.", "Check that cin succeeded."],
      mistakes: ["Mixing cin >> with getline without clearing the newline.", "Reading into the wrong type.", "Forgetting that integer division truncates."],
      check: [
        q("What does auto do?", ["Makes a variable automatic memory", "Deduces the type from the initialiser", "Allocates memory", "Declares a constant"], 1, "The compiler picks the type for you."),
        q("What does if (cin >> n) test?", ["That n is positive", "That the read succeeded", "That n is zero", "That input is empty"], 1, "The stream converts to true when the extraction worked."),
        q("Which type holds text in C++?", ["char[]", "std::string", "text", "str"], 1, "std::string manages its own memory."),
      ],
    }),
    lesson("control", "Operators and control flow", 12, {
      summary: "Control flow is the same as in C, with range-based for loops and a switch that works on integers and enums.",
      sections: [
        sec("Conditions and loops", [
          "if, else, switch, for, while and do-while behave as in C. The range-based for loop, for (auto x : items), visits every element of a container. Use const auto& to avoid copying large elements. Conditions are bool, but numbers still convert: zero is false.",
        ], {
          title: "Sum with a range-for",
          code: '#include <iostream>\n#include <vector>\n\nint main() {\n    std::vector<int> v{4, 17, 9, 2};\n    int best = v[0], sum = 0;\n    for (int x : v) {\n        sum += x;\n        if (x > best) {\n            best = x;\n        }\n    }\n    std::cout << sum << \' \' << best << \'\\n\';\n    return 0;\n}\n',
          explanation: "One pass totals the values and tracks the maximum. Output: 32 17.",
        }),
        sec("Operators worth knowing", [
          "% gives the remainder for integers, && and || short-circuit, and ?: chooses between two values. Increment and decrement work as in C. Bitwise operators (& | ^ << >>) are common in competitive code. C++20 adds the three-way comparison <=> which compares two values in one expression.",
        ], {
          title: "Remainder and ternary",
          code: '#include <iostream>\n\nint main() {\n    int x = 17;\n    std::cout << x % 5 << \' \' << (x > 10 ? "big" : "small") << \' \' << (1 << 4) << \'\\n\';\n    return 0;\n}\n',
          explanation: "17 mod 5 is 2, the ternary picks big, and shifting 1 left by 4 gives 16. Output: 2 big 16.",
        }),
      ],
      takeaways: ["Range-based for visits every element.", "Use const auto& for big elements.", "Short-circuit operators skip the right side when the answer is known."],
      mistakes: ["Copying large objects in a range-for.", "Off-by-one in index loops.", "Missing break in switch."],
      check: [
        q("What does for (auto x : v) do?", ["Visits every element of v", "Creates a vector", "Sorts v", "Reverses v"], 0, "It iterates through the container."),
        q("How do you avoid copying each element in a range-for?", ["Use const auto&", "Use int", "Use register", "Use static"], 0, "A const reference refers to the element without copying."),
        q("What is 1 << 4?", ["4", "8", "16", "32"], 2, "Each left shift doubles: 1, 2, 4, 8, 16."),
      ],
    }),
  ],
};

export const functions: TrackModule = {
  key: "cpp-functions",
  title: "Functions and references",
  summary: "Functions, passing by value and by reference, overloading and default arguments.",
  lessons: [
    lesson("functions-references", "Functions and references", 14, {
      summary: "C++ passes by value unless you ask for a reference. A reference is another name for an existing variable, and it removes both the copy and the need for pointer syntax.",
      sections: [
        sec("Pass by value, reference and const reference", [
          "void f(int x) gets a copy. void f(int& x) works on the caller's variable. void f(const std::string& s) avoids copying a large object while promising not to change it, which is the usual way to pass strings and containers. A function can also return a reference, but never to a local variable.",
        ], {
          title: "Swap by reference",
          code: '#include <iostream>\n\nvoid swap_values(int& a, int& b) {\n    int tmp = a;\n    a = b;\n    b = tmp;\n}\n\nint main() {\n    int x = 1, y = 2;\n    swap_values(x, y);\n    std::cout << x << \' \' << y << \'\\n\';\n    return 0;\n}\n',
          explanation: "a and b are the caller's variables, so the swap is visible. Output: 2 1.",
        }),
        sec("Overloading and default arguments", [
          "Several functions can share a name if their parameter lists differ, and the compiler picks the best match. A default argument, such as int power(int base, int exp = 2), lets callers leave a trailing parameter out. Declare functions before use, with a prototype if needed.",
        ], {
          title: "Overloads and defaults",
          code: '#include <iostream>\n\ndouble area(double r) {\n    return 3.14159 * r * r;\n}\n\ndouble area(double w, double h) {\n    return w * h;\n}\n\nint power(int base, int exp = 2) {\n    int result = 1;\n    for (int i = 0; i < exp; i++) {\n        result *= base;\n    }\n    return result;\n}\n\nint main() {\n    std::cout << area(1.0) << \' \' << area(3.0, 4.0) << \' \' << power(5) << \' \' << power(2, 10) << \'\\n\';\n    return 0;\n}\n',
          explanation: "The argument count selects the overload; power uses 2 when exp is omitted. Output: 3.14159 12 25 1024.",
        }),
      ],
      takeaways: ["A reference is an alias for an existing variable.", "Pass large objects as const T&.", "Overloads differ in parameters, not return type."],
      mistakes: ["Returning a reference to a local variable.", "Copying big strings by passing by value.", "Overloads that differ only in return type."],
      check: [
        q("What does void f(int& x) allow?", ["Changing the caller's variable", "Only reading it", "Returning two values", "Skipping the argument"], 0, "x refers to the original variable."),
        q("What is the usual way to pass a large read-only object?", ["By value", "By const reference", "By pointer to pointer", "As a global"], 1, "const T& avoids a copy and forbids changes."),
        q("What is a default argument?", ["A value used when the caller omits that argument", "A global", "A constant", "An overload"], 0, "Trailing parameters can have defaults."),
      ],
    }),
    lesson("lambdas-templates", "Lambdas and templates", 14, {
      summary: "A lambda is a small function written inline. A template is a function or class written once for any type.",
      sections: [
        sec("Lambda expressions", [
          "A lambda looks like [capture](parameters) { body }. The capture list decides which outside variables it can use: [x] copies x, [&x] refers to it and [&] captures everything by reference. Lambdas are the standard way to supply a comparison or a predicate to algorithms like sort and count_if.",
        ], {
          title: "Counting with a lambda",
          code: '#include <algorithm>\n#include <iostream>\n#include <vector>\n\nint main() {\n    std::vector<int> v{3, 8, 1, 9, 4};\n    int limit = 3;\n    auto big = std::count_if(v.begin(), v.end(), [limit](int x) { return x > limit; });\n    std::sort(v.begin(), v.end(), [](int a, int b) { return a > b; });\n    std::cout << big << \' \' << v.front() << \'\\n\';\n    return 0;\n}\n',
          explanation: "Three values exceed 3, and the descending sort puts 9 first. Output: 3 9.",
        }),
        sec("Function templates", [
          "template <typename T> declares a function that works for any type that supports the operations used. The compiler generates a version for each type you call it with. The standard library is built on templates; writing your own is for when one algorithm should serve many types.",
        ], {
          title: "A generic maximum",
          code: '#include <iostream>\n#include <string>\n\ntemplate <typename T>\nT larger(T a, T b) {\n    return a > b ? a : b;\n}\n\nint main() {\n    std::cout << larger(3, 9) << \' \' << larger(2.5, 1.5) << \' \' << larger(std::string("pear"), std::string("apple")) << \'\\n\';\n    return 0;\n}\n',
          explanation: "One definition serves int, double and string. Output: 9 2.5 pear.",
        }),
      ],
      takeaways: ["A lambda is an inline function; the capture list picks outside variables.", "Templates write one function for many types.", "Lambdas plus algorithms replace many hand-written loops."],
      mistakes: ["Capturing a local by reference and using it after it dies.", "Forgetting the captured variable in the capture list.", "Template errors are long; read the first line."],
      check: [
        q("What does [limit] in a lambda do?", ["Copies limit into the lambda", "Declares an array", "Captures everything", "Makes limit global"], 0, "It captures limit by value."),
        q("What does template <typename T> introduce?", ["A generic function or class", "A loop", "A macro", "A header"], 0, "T stands for any type."),
        q("Which algorithm counts elements matching a condition?", ["count_if", "sort", "find", "fill"], 0, "It takes a predicate and returns how many items satisfy it."),
      ],
    }),
  ],
};
