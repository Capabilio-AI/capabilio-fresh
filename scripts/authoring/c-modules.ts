// The blueprint for the C modules added after the first ten: what each lesson must teach. The lesson text is drafted by the model and then every example is run
// on the runner, so the only things stated as output are real outputs. Order matters: it is the order a student meets them.
export interface LessonSpec { key: string; title: string; minutes: number; brief: string }
export interface ModuleSpec { key: string; title: string; summary: string; file: string; export: string; lessons: LessonSpec[]; challengeBrief: string }

export const C_MODULES: ModuleSpec[] = [
  { key: "c-types-deep", file: "m11-types", export: "typesDeep", title: "Data types in depth", summary: "How big each type is, what happens when a number does not fit, and how C converts between types.",
    challengeBrief: "Read a list of integers and print their sum using a type wide enough that it never overflows; the totals exceed the range of a 32-bit int.",
    lessons: [
      { key: "type-sizes", title: "Sizes and ranges of types", minutes: 12, brief: "sizeof, char/short/int/long/long long, the ranges from limits.h, why range matters, fixed-width types from stdint.h." },
      { key: "overflow", title: "Overflow and wrap-around", minutes: 12, brief: "signed overflow is undefined, unsigned wraps around, how to spot and avoid overflow with a wider type or a check before the operation." },
      { key: "conversions", title: "Type conversion and casting", minutes: 12, brief: "implicit conversion, integer promotion, int/int division, casting to double, mixing signed and unsigned." },
      { key: "float-precision", title: "How floating point really works", minutes: 12, brief: "float vs double, why 0.1+0.2 is not exactly 0.3, comparing floats with a tolerance, printing with %.2f." },
    ] },
  { key: "c-recursion-algos", file: "m12-recursion", export: "recursionAlgos", title: "Recursion and basic algorithms", summary: "Think recursively, count the work an algorithm does, and write the sorts and searches interviews ask for.",
    challengeBrief: "Read n and print the n-th Fibonacci number modulo 1000000007 for n up to 1000000 (needs a loop, not plain recursion).",
    lessons: [
      { key: "recursion-patterns", title: "Recursion patterns", minutes: 14, brief: "base case plus smaller problem, factorial, power, sum of digits, reverse a number, the call stack drawn as a diagram in words." },
      { key: "complexity", title: "Counting work: time complexity", minutes: 12, brief: "what O(1), O(n), O(n^2), O(log n) mean with simple loops, how to count operations, why it matters on large inputs." },
      { key: "simple-sorts", title: "Bubble, selection and insertion sort", minutes: 15, brief: "write the three sorts on an int array, trace one pass, compare their cost." },
      { key: "binary-search", title: "Binary search properly", minutes: 12, brief: "search a sorted array, the lo/hi/mid loop, overflow-safe mid, off-by-one traps, first/last occurrence." },
      { key: "merge-sort", title: "Divide and conquer: merge sort", minutes: 15, brief: "split, sort halves recursively, merge with a temp array, why O(n log n)." },
    ] },
  { key: "c-library", file: "m13-library", export: "library", title: "The standard library", summary: "Use the ready-made tools in math.h, ctype.h, stdlib.h and time.h instead of writing them again.",
    challengeBrief: "Read a line of text and print how many letters, digits, spaces and other characters it has, using ctype.h functions.",
    lessons: [
      { key: "math-h", title: "math.h", minutes: 10, brief: "sqrt, pow, fabs, ceil, floor, round, remember to link -lm note, integer vs double results." },
      { key: "ctype-h", title: "Testing characters with ctype.h", minutes: 10, brief: "isalpha, isdigit, isspace, isupper, toupper, tolower, cast to unsigned char." },
      { key: "stdlib-h", title: "stdlib.h: conversions, rand and qsort", minutes: 14, brief: "atoi/strtol, rand and srand, abs, qsort with a comparison function on ints and strings." },
      { key: "formatted-io", title: "Formatted input and output", minutes: 12, brief: "printf width/precision/flags, sprintf and snprintf, sscanf, checking scanf's return value." },
    ] },
  { key: "c-stack-queue", file: "m14-stack-queue", export: "stackQueue", title: "Stacks and queues", summary: "Build the two simplest data structures from arrays and linked lists, and use them to solve real problems.",
    challengeBrief: "Read a string of brackets ()[]{} and print YES if it is balanced, otherwise NO (use a stack).",
    lessons: [
      { key: "stack-array", title: "A stack with an array", minutes: 14, brief: "push, pop, peek, top index, overflow and underflow checks, a struct holding the array and top." },
      { key: "stack-uses", title: "Using a stack", minutes: 14, brief: "balanced brackets and reversing a string, tracing the stack step by step." },
      { key: "queue-array", title: "A queue with an array", minutes: 14, brief: "enqueue, dequeue, front/rear, the wasted-space problem, circular queue." },
      { key: "linked-stack-queue", title: "Stack and queue with linked lists", minutes: 14, brief: "push/pop at the head, enqueue at the tail with a tail pointer, freeing nodes." },
    ] },
  { key: "c-lists-deeper", file: "m15-lists", export: "listsDeeper", title: "Linked lists in depth", summary: "Insert, delete, reverse and search a linked list, and handle the tricky edge cases.",
    challengeBrief: "Read n then n integers, insert them into a linked list in order, reverse the list, and print it.",
    lessons: [
      { key: "list-insert-delete", title: "Insert and delete anywhere", minutes: 15, brief: "insert at head/tail/position, delete by value, the pointer-to-pointer trick or the previous-node pointer, empty list edge case." },
      { key: "list-reverse", title: "Reversing a list", minutes: 14, brief: "three-pointer iterative reverse, drawn step by step, the recursive version." },
      { key: "list-tricks", title: "Middle, cycles and merging", minutes: 15, brief: "slow and fast pointers to find the middle and detect a cycle, merging two sorted lists." },
      { key: "doubly-list", title: "Doubly linked lists", minutes: 14, brief: "prev and next pointers, insert and delete, why deletion needs no search for the previous node." },
    ] },
  { key: "c-trees-hash", file: "m16-trees-hash", export: "treesHash", title: "Trees and hashing", summary: "Binary search trees for ordered data and hash tables for fast lookup, built from scratch.",
    challengeBrief: "Read n integers, insert them into a binary search tree, and print them in sorted order using an in-order traversal.",
    lessons: [
      { key: "binary-tree", title: "Binary trees and traversals", minutes: 15, brief: "node with left and right, in-order, pre-order, post-order with recursion, height, a small tree drawn in text." },
      { key: "bst", title: "Binary search trees", minutes: 16, brief: "insert and search, the ordering rule, in-order gives sorted output, what happens with sorted input." },
      { key: "hash-basics", title: "Hash tables with chaining", minutes: 15, brief: "hash function on ints and strings, buckets as linked lists, insert and lookup, collisions explained." },
      { key: "heap-basics", title: "Heaps and priority", minutes: 14, brief: "array-stored min-heap, push with sift-up, pop with sift-down, finding the smallest quickly." },
    ] },
  { key: "c-bits-embedded", file: "m17-bits-embedded", export: "bitsEmbedded", title: "Bits, bytes and hardware-style C", summary: "The C that firmware and embedded jobs use: bit masks, bit fields, fixed-width types, volatile and memory layout.",
    challengeBrief: "Read a number and a bit position, then print the number with that bit set, cleared and toggled on three lines.",
    lessons: [
      { key: "bit-masks", title: "Masks: set, clear, toggle, test", minutes: 14, brief: "building a mask with 1u<<n, the four operations, a register-style example, printing in binary." },
      { key: "bit-fields-endian", title: "Bit fields, bytes and endianness", minutes: 14, brief: "struct bit fields, how bytes of an int are stored, checking endianness with a char pointer." },
      { key: "volatile-const", title: "volatile, const and static", minutes: 12, brief: "what each qualifier tells the compiler, why hardware registers are volatile, const pointers, static inside functions." },
      { key: "struct-layout", title: "Struct padding and unions", minutes: 12, brief: "alignment and padding, sizeof a struct, reordering members, a union sharing memory." },
    ] },
  { key: "c-project-skills", file: "m18-projects", export: "projectSkills", title: "Building real programs", summary: "Structure a program across files, read command-line arguments, handle errors and test your own code.",
    challengeBrief: "Read n student records (name and marks) and print them sorted by marks descending, ties by name, in a table.",
    lessons: [
      { key: "program-design", title: "Planning a program", minutes: 12, brief: "break a problem into functions, input/process/output, naming, a worked menu-driven program skeleton." },
      { key: "argc-argv", title: "Command-line arguments", minutes: 10, brief: "argc and argv, converting with strtol, validating arguments, usage messages (note: the practice runner gives no arguments so examples simulate them with a local array)." },
      { key: "error-handling", title: "Handling errors properly", minutes: 12, brief: "checking return values, errno and perror, exit codes, validating input, never trusting input." },
      { key: "testing-c", title: "Testing your own code", minutes: 12, brief: "assert.h, writing small test functions, edge cases (empty, one, maximum), reading a failing assert." },
    ] },
  { key: "c-interview", file: "m19-interview", export: "interview", title: "Placement and interview C", summary: "The patterns that placement rounds ask again and again, solved in C and explained step by step.",
    challengeBrief: "Read n integers and print the length of the longest run of equal consecutive values (an array pattern).",
    lessons: [
      { key: "array-patterns", title: "Array patterns", minutes: 15, brief: "two pointers, prefix sums, Kadane's maximum subarray, remove duplicates from a sorted array." },
      { key: "string-patterns", title: "String patterns", minutes: 14, brief: "palindrome, anagram check with a count array, reverse words, first non-repeating character." },
      { key: "number-patterns", title: "Number patterns", minutes: 14, brief: "gcd and lcm, prime sieve, armstrong and perfect numbers, fast power, digit tricks." },
      { key: "output-questions", title: "Tricky output questions", minutes: 14, brief: "the classic what-does-this-print puzzles: i++ + ++i style is undefined so avoid; do precedence, integer division, pointer arithmetic, sizeof array vs pointer, string literal tricks." },
    ] },
];
