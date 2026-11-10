import { lesson, q, sec, type TrackModule } from "../types";

export const stl: TrackModule = {
  key: "cpp-stl",
  title: "Strings and the STL",
  summary: "std::string, std::vector, the associative containers and the algorithm library: the tools you will use every day.",
  lessons: [
    lesson("strings-vectors", "std::string and std::vector", 14, {
      summary: "std::string and std::vector manage their own memory and know their size. They replace nearly every use of raw arrays.",
      sections: [
        sec("std::vector", [
          "A vector is a resizable array. push_back adds an element, size() counts, v[i] reads without checking while v.at(i) checks the range and throws, and pop_back removes the last item. Elements are stored contiguously, so access is fast. reserve(n) avoids repeated reallocation when you know the size in advance.",
        ], {
          title: "Building a vector",
          code: '#include <iostream>\n#include <vector>\n\nint main() {\n    std::vector<int> squares;\n    for (int i = 1; i <= 5; i++) {\n        squares.push_back(i * i);\n    }\n    squares.pop_back();\n    std::cout << squares.size() << \' \' << squares.back() << \' \' << squares.at(1) << \'\\n\';\n    return 0;\n}\n',
          explanation: "Five squares are added and the last is removed, leaving 1, 4, 9, 16. Output: 4 16 4.",
        }),
        sec("std::string", [
          "std::string supports + for joining, == for comparing, length(), substr(pos, len), find (returning string::npos when absent), and indexing. Unlike C strings it needs no terminator handling and grows as needed. to_string and stoi convert between numbers and text.",
        ], {
          title: "String operations",
          code: '#include <iostream>\n#include <string>\n\nint main() {\n    std::string s = "learn c++";\n    std::string t = s.substr(6) + std::to_string(20);\n    bool found = s.find("rn") != std::string::npos;\n    std::cout << t << \' \' << s.length() << \' \' << found << \' \' << std::stoi("42") + 1 << \'\\n\';\n    return 0;\n}\n',
          explanation: "substr(6) is c++, joined with 20; find locates rn. Output: c++20 9 1 43.",
        }),
      ],
      takeaways: ["Prefer vector and string over raw arrays.", "at() checks bounds; [] does not.", "find returns npos when nothing matches."],
      mistakes: ["Indexing past size() with [].", "Comparing find's result with -1 on an unsigned type.", "Growing a vector one element at a time without reserve."],
      check: [
        q("Which call adds an element to the end of a vector?", ["add", "push_back", "append", "insert_end"], 1, "push_back is the standard method."),
        q("What does v.at(i) do that v[i] does not?", ["Checks the range and throws", "Sorts", "Copies", "Nothing"], 0, "It throws out_of_range for a bad index."),
        q("What does string::find return when the text is absent?", ["-1", "string::npos", "0", "An exception"], 1, "npos is a special large value."),
      ],
    }),
    lesson("maps-sets", "map, set and unordered containers", 14, {
      summary: "set and map keep their keys sorted (O(log n)); unordered_set and unordered_map use hashing (O(1) on average). Choosing the right container is half of a fast solution.",
      sections: [
        sec("Maps", [
          "map<K, V> stores key-value pairs in sorted key order. m[key] creates the entry with a default value if it is missing, which makes counting easy: counts[word]++. find(key) returns an iterator to check existence without inserting. Loop with for (const auto& [key, value] : m) to unpack each pair.",
        ], {
          title: "Counting words",
          code: '#include <iostream>\n#include <map>\n#include <string>\n#include <vector>\n\nint main() {\n    std::vector<std::string> words{"to", "be", "or", "not", "to", "be"};\n    std::map<std::string, int> counts;\n    for (const auto& w : words) {\n        counts[w]++;\n    }\n    for (const auto& [word, n] : counts) {\n        std::cout << word << \'=\' << n << \' \';\n    }\n    std::cout << \'\\n\';\n    return 0;\n}\n',
          explanation: "map orders keys alphabetically. Output: be=2 not=1 or=1 to=2.",
        }),
        sec("Sets and unordered containers", [
          "A set holds unique sorted values and insert returns whether the value was new. unordered_map and unordered_set are faster on average but have no order. For queues and stacks use std::queue, std::stack, or priority_queue for the largest or smallest item first.",
        ], {
          title: "Unique values",
          code: '#include <iostream>\n#include <set>\n#include <unordered_map>\n\nint main() {\n    std::set<int> s{5, 1, 4, 1, 5};\n    std::unordered_map<char, int> seen;\n    seen[\'a\'] = 1;\n    std::cout << s.size() << \' \' << *s.begin() << \' \' << seen.count(\'a\') << seen.count(\'z\') << \'\\n\';\n    return 0;\n}\n',
          explanation: "The set keeps 1, 4, 5 with 1 first; count tells whether a key exists. Output: 3 1 10.",
        }),
      ],
      takeaways: ["map and set are sorted; unordered versions are hashed.", "m[key] inserts a default if missing; use find or count to test.", "Structured bindings unpack pairs in loops."],
      mistakes: ["Using m[key] just to check existence, which inserts.", "Relying on unordered iteration order.", "Using map when unordered_map would be faster."],
      check: [
        q("What does map's operator[] do for a missing key?", ["Throws", "Inserts a default value", "Returns null", "Does nothing"], 1, "It creates the entry."),
        q("Which container keeps unique sorted values?", ["vector", "set", "unordered_map", "queue"], 1, "set stores unique keys in order."),
        q("Typical lookup time of unordered_map?", ["O(1) on average", "O(n)", "O(log n) always", "O(n log n)"], 0, "Hashing gives constant time on average."),
      ],
    }),
    lesson("algorithms", "The algorithm library", 14, {
      summary: "<algorithm> provides tested versions of sort, search, count, min/max and more. Using them is shorter and usually faster than writing loops by hand.",
      sections: [
        sec("Sorting and searching", [
          "std::sort(begin, end) sorts in O(n log n); pass a lambda for a custom order. After sorting, binary_search, lower_bound and upper_bound find values in O(log n). reverse, unique, accumulate (in <numeric>), min_element, max_element and next_permutation cover many routine tasks.",
        ], {
          title: "Sort and search",
          code: '#include <algorithm>\n#include <iostream>\n#include <numeric>\n#include <vector>\n\nint main() {\n    std::vector<int> v{5, 1, 4, 2, 8};\n    std::sort(v.begin(), v.end());\n    auto pos = std::lower_bound(v.begin(), v.end(), 4) - v.begin();\n    int total = std::accumulate(v.begin(), v.end(), 0);\n    std::cout << v.front() << \' \' << pos << \' \' << total << \' \' << *std::max_element(v.begin(), v.end()) << \'\\n\';\n    return 0;\n}\n',
          explanation: "Sorted: 1 2 4 5 8. The value 4 is at index 2, the total is 20 and the maximum is 8. Output: 1 2 20 8.",
        }),
        sec("Complexity awareness", [
          "Know the cost of what you call: vector push_back is amortised O(1), sort is O(n log n), map operations are O(log n), unordered_map O(1) on average, and erasing from the middle of a vector is O(n). A solution that is correct but too slow fails the time limit, so complexity is part of correctness in interviews and contests.",
        ]),
      ],
      takeaways: ["Prefer library algorithms to hand-written loops.", "Binary search functions need sorted input.", "Know the complexity of each container operation."],
      mistakes: ["Using binary_search on unsorted data.", "Erasing from a vector inside a loop without care.", "Ignoring complexity until a test times out."],
      check: [
        q("What does std::sort need as arguments?", ["A begin and end iterator", "A single value", "A file", "A string"], 0, "It sorts the range between two iterators."),
        q("What do lower_bound and binary_search require?", ["Sorted data", "A map", "Unique values", "Strings"], 0, "They rely on the order to halve the range."),
        q("What is the complexity of std::sort?", ["O(n)", "O(n log n)", "O(n squared)", "O(1)"], 1, "It is a comparison sort with n log n behaviour."),
      ],
    }),
  ],
};

export const memory: TrackModule = {
  key: "cpp-memory",
  title: "Pointers, memory and RAII",
  summary: "Pointers and new/delete, and why modern C++ uses smart pointers and destructors instead.",
  lessons: [
    lesson("pointers-new", "Pointers and dynamic memory", 14, {
      summary: "C++ keeps C's pointers and adds new and delete. Raw ownership is error-prone, which is why the rest of the language steers you to safer tools.",
      sections: [
        sec("Pointers and references", [
          "A pointer holds an address and can be null (nullptr) or reseated; a reference is an alias that cannot be null or reseated. Use references for parameters and pointers when absence or reassignment matters. new T allocates one object and delete frees it; new T[n] pairs with delete[]. Every new needs exactly one matching delete.",
        ], {
          title: "new and delete",
          code: '#include <iostream>\n\nint main() {\n    int* p = new int{42};\n    int* arr = new int[3]{1, 2, 3};\n    std::cout << *p + arr[2] << \'\\n\';\n    delete p;\n    delete[] arr;\n    return 0;\n}\n',
          explanation: "Memory from new must be freed. Output: 45.",
        }),
        sec("The classic memory bugs", [
          "A leak forgets to delete, a dangling pointer uses memory after delete, and a double delete frees twice. Compile with -fsanitize=address,undefined while developing and AddressSanitizer will report them with line numbers.",
        ]),
      ],
      takeaways: ["new pairs with delete; new[] with delete[].", "Prefer references for parameters, nullptr for no object.", "Use AddressSanitizer to find memory bugs."],
      mistakes: ["Forgetting delete.", "Using delete instead of delete[] for arrays.", "Using a pointer after freeing it."],
      check: [
        q("What pairs with new int[10]?", ["delete", "delete[]", "free", "release"], 1, "Arrays allocated with new[] need delete[]."),
        q("Which can be null?", ["A reference", "A pointer", "Both", "Neither"], 1, "A pointer can be nullptr; a reference must refer to something."),
        q("What flag turns on AddressSanitizer?", ["-O2", "-fsanitize=address", "-Wall", "-g only"], 1, "It instruments memory accesses."),
      ],
    }),
    lesson("raii-smart-pointers", "RAII and smart pointers", 14, {
      summary: "RAII ties a resource to an object's lifetime: the constructor acquires it and the destructor releases it. Smart pointers apply that to heap memory, so you almost never write delete.",
      sections: [
        sec("unique_ptr and shared_ptr", [
          "std::unique_ptr owns an object exclusively and deletes it when the pointer goes out of scope. std::shared_ptr counts owners and deletes the object when the last one goes. Create them with make_unique and make_shared. Moving a unique_ptr transfers ownership. Use a raw pointer only to observe an object owned elsewhere.",
        ], {
          title: "Automatic cleanup",
          code: '#include <iostream>\n#include <memory>\n\nstruct Resource {\n    ~Resource() { std::cout << "released\\n"; }\n};\n\nint main() {\n    {\n        auto r = std::make_unique<Resource>();\n        std::cout << "using\\n";\n    }\n    auto shared = std::make_shared<int>(7);\n    auto other = shared;\n    std::cout << shared.use_count() << \'\\n\';\n    return 0;\n}\n',
          explanation: "The destructor runs as the inner scope ends; two shared_ptrs share one int. Output: using, released, 2 on separate lines.",
        }),
        sec("The rule of zero", [
          "If your class holds its resources in members that manage themselves (string, vector, unique_ptr), you do not need to write a destructor, copy or move operations at all: the compiler's versions are correct. Write them by hand only when a class directly owns a raw resource.",
        ]),
      ],
      takeaways: ["RAII releases resources when objects leave scope.", "unique_ptr is exclusive; shared_ptr counts owners.", "Let members manage themselves (rule of zero)."],
      mistakes: ["Two shared_ptrs created from the same raw pointer.", "Copying a unique_ptr instead of moving it.", "Using shared_ptr when unique_ptr would do."],
      check: [
        q("When does unique_ptr free its object?", ["When it goes out of scope", "Never", "On program exit only", "When copied"], 0, "Its destructor deletes the object."),
        q("What does shared_ptr::use_count report?", ["The number of owners", "The object's size", "Memory used", "A hash"], 0, "It counts the shared owners."),
        q("What is the rule of zero?", ["Never use pointers", "Prefer classes that need no custom destructor or copy operations", "Always write a destructor", "Avoid templates"], 1, "Self-managing members make hand-written special functions unnecessary."),
      ],
    }),
  ],
};
