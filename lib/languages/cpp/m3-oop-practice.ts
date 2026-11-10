import { lesson, q, sec, type TrackModule } from "../types";

export const oop: TrackModule = {
  key: "cpp-oop",
  title: "Classes and object-oriented C++",
  summary: "Classes with constructors and destructors, encapsulation, inheritance and virtual functions.",
  lessons: [
    lesson("classes", "Classes, constructors and encapsulation", 14, {
      summary: "A class bundles data with the functions that work on it. Constructors set the object up, destructors clean it up, and private members keep the internals safe.",
      sections: [
        sec("A class with invariants", [
          "Members are private by default in a class. A constructor with an initialiser list, Account(int b) : balance{b} {}, sets members before the body runs. Member functions marked const promise not to change the object, so they can be called on const objects. Keep data private and expose only operations that keep the object valid.",
        ], {
          title: "A protected balance",
          code: '#include <iostream>\n#include <stdexcept>\n\nclass Account {\npublic:\n    explicit Account(int opening) : balance_{opening} {}\n\n    void deposit(int amount) {\n        if (amount <= 0) {\n            throw std::invalid_argument("amount must be positive");\n        }\n        balance_ += amount;\n    }\n\n    int balance() const { return balance_; }\n\nprivate:\n    int balance_;\n};\n\nint main() {\n    Account a{100};\n    a.deposit(500);\n    std::cout << a.balance() << \'\\n\';\n    return 0;\n}\n',
          explanation: "balance_ is private; deposit validates before changing it, and balance() is const. Output: 600.",
        }),
        sec("struct versus class, and static members", [
          "struct is a class whose members are public by default; use it for plain data. A static member belongs to the class itself and is shared by every object. Mark single-argument constructors explicit so they are not used for accidental conversions.",
        ], {
          title: "Counting objects",
          code: '#include <iostream>\n\nclass Ticket {\npublic:\n    Ticket() : number{++issued} {}\n    int number;\n    static int issued;\n};\n\nint Ticket::issued = 0;\n\nint main() {\n    Ticket a, b;\n    Ticket c;\n    std::cout << c.number << \' \' << Ticket::issued << \'\\n\';\n    return 0;\n}\n',
          explanation: "issued is shared, so the third ticket is number 3. Output: 3 3.",
        }),
      ],
      takeaways: ["Keep data private and expose valid operations.", "Use initialiser lists and const member functions.", "static members belong to the class."],
      mistakes: ["Public data members that anyone can break.", "Forgetting const on getters.", "Assigning in the constructor body instead of the initialiser list."],
      check: [
        q("What does a const member function promise?", ["Not to change the object", "To be fast", "To return const", "To be static"], 0, "It can be called on const objects."),
        q("What does `explicit` on a constructor prevent?", ["Implicit conversions", "Inheritance", "Copying", "Destruction"], 0, "It blocks accidental type conversions."),
        q("Where do member initialisers belong?", ["In the initialiser list", "Only in main", "In the destructor", "In a header only"], 0, "They run before the constructor body."),
      ],
    }),
    lesson("inheritance-virtual", "Inheritance and virtual functions", 16, {
      summary: "A derived class extends a base class. Virtual functions make the call depend on the real object type, which is how C++ achieves polymorphism.",
      sections: [
        sec("Virtual functions and override", [
          "Mark a base function virtual and override it in derived classes. Call it through a base pointer or reference and the derived version runs. Add override in the derived class so the compiler checks that you really override something, and give a base class that is used polymorphically a virtual destructor so derived objects are destroyed correctly through a base pointer.",
        ], {
          title: "Polymorphism",
          code: '#include <iostream>\n#include <memory>\n#include <vector>\n\nclass Shape {\npublic:\n    virtual ~Shape() = default;\n    virtual double area() const = 0;\n};\n\nclass Square : public Shape {\npublic:\n    explicit Square(double s) : side_{s} {}\n    double area() const override { return side_ * side_; }\nprivate:\n    double side_;\n};\n\nclass Rect : public Shape {\npublic:\n    Rect(double w, double h) : w_{w}, h_{h} {}\n    double area() const override { return w_ * h_; }\nprivate:\n    double w_, h_;\n};\n\nint main() {\n    std::vector<std::unique_ptr<Shape>> shapes;\n    shapes.push_back(std::make_unique<Square>(3));\n    shapes.push_back(std::make_unique<Rect>(2, 5));\n    double total = 0;\n    for (const auto& s : shapes) {\n        total += s->area();\n    }\n    std::cout << total << \'\\n\';\n    return 0;\n}\n',
          explanation: "The loop is written once; each object supplies its own area (9 + 10). Output: 19.",
        }),
        sec("Abstract classes and slicing", [
          "= 0 makes a function pure virtual, turning the class into an abstract interface that cannot be instantiated. Store polymorphic objects by pointer or reference: copying a derived object into a base variable slices off the derived part. Prefer composition over inheritance unless there is a true is-a relationship.",
        ]),
      ],
      takeaways: ["virtual plus override gives run-time polymorphism.", "A polymorphic base needs a virtual destructor.", "Store polymorphic objects by pointer or reference to avoid slicing."],
      mistakes: ["Forgetting virtual on the base function.", "A non-virtual destructor in a polymorphic base.", "Passing derived objects by value as the base type."],
      check: [
        q("What does override do?", ["Makes a function virtual", "Asks the compiler to verify it overrides a base function", "Hides the base function", "Deletes the function"], 1, "It catches signature mismatches."),
        q("What does = 0 after a virtual function mean?", ["It returns zero", "It is pure virtual, so the class is abstract", "It is deleted", "It is inline"], 1, "The class cannot be instantiated."),
        q("Why give a polymorphic base a virtual destructor?", ["It is required by syntax", "So deleting through a base pointer destroys the derived part", "To speed up calls", "To avoid copying"], 1, "Otherwise the derived destructor is skipped."),
      ],
    }),
  ],
};

export const practice: TrackModule = {
  key: "cpp-practice",
  title: "Errors, files and problem solving",
  summary: "Exceptions, file streams, and the idioms used in coding rounds and contests.",
  lessons: [
    lesson("exceptions-files", "Exceptions and file streams", 12, {
      summary: "Exceptions report errors without checking a return code at every step. fstream reads and writes files, and its objects close themselves when they go out of scope.",
      sections: [
        sec("try, catch and throw", [
          "throw an object (usually derived from std::exception) to signal a problem and catch it by const reference where you can handle it. Catch specific types before general ones. Because destructors run during unwinding, RAII objects clean up even when an exception passes through.",
        ], {
          title: "Catching an error",
          code: '#include <iostream>\n#include <stdexcept>\n#include <string>\n\nint main() {\n    try {\n        int n = std::stoi("abc");\n        std::cout << n << \'\\n\';\n    } catch (const std::invalid_argument&) {\n        std::cout << "not a number\\n";\n    }\n    return 0;\n}\n',
          explanation: "stoi cannot convert abc, so it throws invalid_argument and the catch block runs. Output: not a number.",
        }),
        sec("File streams", [
          "ofstream writes and ifstream reads. Check that the file opened (if (!in)), then read with >> or getline in a loop. The stream closes itself at the end of the scope, so there is usually no explicit close.",
        ], {
          title: "Write then read",
          code: '#include <cstdio>\n#include <fstream>\n#include <iostream>\n\nint main() {\n    const char* path = "scores.tmp";\n    {\n        std::ofstream out(path);\n        out << 40 << \' \' << 2 << \'\\n\';\n    }\n    std::ifstream in(path);\n    int a = 0, b = 0;\n    if (in >> a >> b) {\n        std::cout << a + b << \'\\n\';\n    }\n    in.close();\n    std::remove(path);\n    return 0;\n}\n',
          explanation: "Two numbers are written, read back and added. Output: 42.",
        }),
      ],
      takeaways: ["Throw exceptions and catch them by const reference.", "Check a stream opened before reading.", "File streams close themselves at end of scope."],
      mistakes: ["Catching by value, which slices the exception.", "Ignoring a failed open.", "Throwing from a destructor."],
      check: [
        q("How should you catch an exception?", ["By value", "By const reference", "By pointer", "By macro"], 1, "It avoids copying and slicing."),
        q("When does an ofstream close?", ["Never", "At end of its scope", "Only with fclose", "At program start"], 1, "Its destructor closes the file."),
        q("What does `if (in >> a >> b)` check?", ["That both reads succeeded", "That the file is large", "That a is zero", "That the file exists on disk only"], 0, "The stream is true only if extraction worked."),
      ],
    }),
    lesson("problem-solving", "Problem-solving idioms", 14, {
      summary: "Coding rounds reward a small set of habits: read input fast, pick the right container, state the complexity, and test the edge cases.",
      sections: [
        sec("Fast I/O and common patterns", [
          "Turn off stream synchronisation with std::ios::sync_with_stdio(false) and cin.tie(nullptr) when reading a lot. Typical patterns: a frequency map for counting, a sorted array plus two pointers for pair sums, a prefix-sum array for range queries, and a set or unordered_set for 'seen before'. Choose long long when sums can exceed about two billion.",
        ], {
          title: "Two sum with a hash map",
          code: '#include <iostream>\n#include <unordered_map>\n#include <vector>\n\nint main() {\n    std::vector<int> a{2, 7, 11, 15};\n    int target = 18;\n    std::unordered_map<int, int> seen;\n    for (int i = 0; i < static_cast<int>(a.size()); i++) {\n        auto it = seen.find(target - a[i]);\n        if (it != seen.end()) {\n            std::cout << it->second << \' \' << i << \'\\n\';\n            break;\n        }\n        seen[a[i]] = i;\n    }\n    return 0;\n}\n',
          explanation: "One pass, O(n): when 11 is reached, 7 was already seen at index 1. Output: 1 2.",
        }),
        sec("Prefix sums and edge cases", [
          "A prefix-sum array answers 'sum of items a to b' in constant time after one pass. Before submitting, try an empty input, a single element, all equal values, the largest allowed values (check overflow) and an already sorted input. Say the time and space complexity out loud: it is part of the answer.",
        ], {
          title: "Range sums",
          code: '#include <iostream>\n#include <vector>\n\nint main() {\n    std::vector<int> a{3, 1, 4, 1, 5, 9};\n    std::vector<long long> prefix(a.size() + 1, 0);\n    for (std::size_t i = 0; i < a.size(); i++) {\n        prefix[i + 1] = prefix[i] + a[i];\n    }\n    std::cout << prefix[4] - prefix[1] << \'\\n\';\n    return 0;\n}\n',
          explanation: "The sum of the items at indexes 1 to 3 (1 + 4 + 1) is the difference of two prefixes. Output: 6.",
        }),
      ],
      takeaways: ["A hash map turns a pair search from O(n squared) into O(n).", "Prefix sums answer range sums in O(1).", "Test empty, single, equal and extreme inputs."],
      mistakes: ["Using int when sums overflow.", "Nested loops where a hash map would do.", "Skipping edge cases."],
      check: [
        q("What is the time of the hash-map two-sum solution?", ["O(n squared)", "O(n)", "O(log n)", "O(1)"], 1, "Each element is processed once with constant-time lookups."),
        q("What do prefix sums allow?", ["Constant-time range sums after one pass", "Sorting", "Searching strings", "Reversing"], 0, "Subtract two prefixes to get a range total."),
        q("When should you use long long?", ["Always", "When values or sums may exceed int's range", "Never", "Only for characters"], 1, "int overflows past about 2 billion."),
      ],
    }),
  ],
};
