// The blueprint for the Java modules added after the first nine. Programs: Java 21, one file, `public class Main` holds main, every other type is NOT public.
// No input, deterministic, standard library only. See c-modules.ts for the shape.
import type { ModuleSpec } from "./c-modules";

export const JAVA_MODULES: ModuleSpec[] = [
  { key: "java-text", file: "m7-text", export: "textTools", title: "Strings, text and formatting", summary: "Build, format and search text with String, StringBuilder, printf and regular expressions.",
    challengeBrief: "Read one line of text and print the number of words, the longest word, and the line with each word capitalised, on three lines.",
    lessons: [
      { key: "string-methods", title: "String methods and immutability", minutes: 12, brief: "length, charAt, substring, indexOf, replace, split, trim/strip, equals vs ==, compareTo, why Strings are immutable." },
      { key: "stringbuilder", title: "StringBuilder and building text", minutes: 12, brief: "why += in a loop is slow, append, insert, reverse, deleteCharAt, toString, when to use StringBuilder." },
      { key: "formatting-text-blocks", title: "printf, String.format and text blocks", minutes: 12, brief: "%d %s %f %n, width, precision, flags, String.format, text blocks with triple quotes, formatted()." },
      { key: "regex-java", title: "Regular expressions with Pattern and Matcher", minutes: 14, brief: "Pattern.compile, matcher.find and group, matches, replaceAll, split with regex, escaping backslashes in Java strings." },
    ] },
  { key: "java-oop-design", file: "m8-oop-design", export: "oopDesign", title: "Object design that lasts", summary: "equals and hashCode, immutability, interfaces with default methods, composition and simple design patterns.",
    challengeBrief: "Read n lines of 'name amount' and print the total per name, sorted by name, one per line as 'name total'.",
    lessons: [
      { key: "equals-hashcode-tostring", title: "equals, hashCode and toString", minutes: 14, brief: "default Object behaviour, writing equals and hashCode together, why HashSet needs them, toString for readable output." },
      { key: "immutability", title: "Immutable classes", minutes: 12, brief: "final fields, no setters, defensive copies, why immutable objects are safe, String as an example." },
      { key: "interfaces-default", title: "Interfaces, default methods and polymorphism", minutes: 14, brief: "interface contracts, default and static methods, programming to an interface, polymorphic calls through a list." },
      { key: "composition-patterns", title: "Composition and simple patterns", minutes: 14, brief: "has-a vs is-a, delegation, strategy with an interface or lambda, a simple factory method, builder for many fields." },
    ] },
  { key: "java-generics-collections", file: "m9-generics", export: "genericsCollections", title: "Generics and collections in depth", summary: "Write type-safe generic code and choose the right collection for the job.",
    challengeBrief: "Read n words and print each distinct word with how many times it appeared, sorted by count descending and then alphabetically.",
    lessons: [
      { key: "generics-basics", title: "Generic classes and methods", minutes: 14, brief: "type parameters, a generic Box and Pair, generic methods, bounded types with extends, why generics prevent ClassCastException." },
      { key: "wildcards-erasure", title: "Wildcards and type erasure", minutes: 13, brief: "List<?>, ? extends and ? super in plain words, PECS rule of thumb, type erasure and what it means for you." },
      { key: "map-set-choices", title: "HashMap, LinkedHashMap, TreeMap", minutes: 14, brief: "iteration order of each, null keys, getOrDefault, merge, computeIfAbsent, HashSet/LinkedHashSet/TreeSet, choosing between them." },
      { key: "iterators-comparable", title: "Iterator, Comparable and Comparator", minutes: 13, brief: "enhanced for and Iterator, removing safely while iterating, ConcurrentModificationException, Comparable vs Comparator, comparing with chained comparators." },
    ] },
  { key: "java-streams-functional", file: "m10-streams", export: "streamsFunctional", title: "Lambdas, streams and Optional", summary: "Process collections in a clear pipeline with functional interfaces, streams and Optional.",
    challengeBrief: "Read n integers and print the sum of the squares of the even numbers, then the count of odd numbers, on two lines (use streams).",
    lessons: [
      { key: "functional-interfaces", title: "Functional interfaces and method references", minutes: 13, brief: "Function, Predicate, Consumer, Supplier, BiFunction, UnaryOperator, lambda syntax, method references Type::method." },
      { key: "stream-pipelines", title: "Stream pipelines", minutes: 14, brief: "stream(), filter, map, sorted, distinct, limit, forEach, collect(toList), terminal vs intermediate, streams are used once and lazy." },
      { key: "collectors", title: "Collectors: grouping and summarising", minutes: 14, brief: "groupingBy, counting, summingInt, averagingInt, partitioningBy, joining, toMap, mapToInt and sum/average/max." },
      { key: "optional-use", title: "Optional the right way", minutes: 12, brief: "Optional.of/empty/ofNullable, map, orElse, orElseGet, orElseThrow, ifPresent, why not to use it for fields and why not get()." },
    ] },
  { key: "java-algorithms", file: "m11-algorithms", export: "algorithms", title: "Algorithms and problem solving", summary: "Count the work an algorithm does, then write the searches, sorts and dynamic programs that interviews ask for.",
    challengeBrief: "Read n and print the n-th Fibonacci number modulo 1000000007 for n up to 1000000 (needs a loop, not plain recursion).",
    lessons: [
      { key: "complexity-big-o", title: "Counting work: Big O", minutes: 12, brief: "O(1), O(n), O(n^2), O(log n) with small loops, ArrayList vs LinkedList cost, HashMap and TreeMap lookups." },
      { key: "search-sort-algos", title: "Searching and sorting by hand", minutes: 15, brief: "linear and binary search, Arrays.binarySearch, bubble, insertion and merge sort on int arrays, Arrays.sort." },
      { key: "two-pointers-windows", title: "Two pointers and sliding windows", minutes: 14, brief: "pair sum in a sorted array, remove duplicates, longest substring without repeats, fixed and variable windows." },
      { key: "memo-dp", title: "Memoisation and dynamic programming", minutes: 15, brief: "overlapping subproblems, memo with an array or HashMap, bottom-up table, climbing stairs, coin change, longest common subsequence." },
    ] },
  { key: "java-data-structures", file: "m12-data-structures", export: "dataStructures", title: "Data structures from scratch", summary: "Stacks, queues, linked lists, trees, heaps and graphs, built by hand and with the library.",
    challengeBrief: "Read a string of brackets ()[]{} and print YES if it is balanced and NO otherwise (use a stack).",
    lessons: [
      { key: "stack-queue-deque", title: "Stacks, queues and ArrayDeque", minutes: 13, brief: "why not the old Stack class, ArrayDeque as stack and queue, push/pop/peek/offer/poll, matching brackets." },
      { key: "priority-queue", title: "PriorityQueue and heaps", minutes: 13, brief: "PriorityQueue min-heap by default, with a Comparator for max-heap, k largest elements, how a heap is stored in an array." },
      { key: "linked-list-bst", title: "Linked lists and binary search trees", minutes: 15, brief: "a Node class, building and reversing a singly linked list, BST insert, search and in-order traversal." },
      { key: "graphs-bfs-dfs", title: "Graphs: BFS and DFS", minutes: 15, brief: "adjacency list with Map<Integer, List<Integer>>, BFS with a queue for shortest steps, DFS with recursion, visited set." },
    ] },
  { key: "java-concurrency", file: "m13-concurrency", export: "concurrency", title: "Concurrency in Java", summary: "Run work in parallel safely: threads, locks, executors and futures, with outputs that do not depend on timing.",
    challengeBrief: "Read n integers and print their sum, computed by splitting the work across two threads and adding the two partial sums.",
    lessons: [
      { key: "threads-join", title: "Threads, join and shared data", minutes: 14, brief: "Thread and Runnable, start vs run, join, why output order is not fixed (so print only after join), a race on a counter." },
      { key: "synchronized-atomic", title: "synchronized, locks and atomics", minutes: 14, brief: "synchronized method, ReentrantLock, AtomicInteger, fixing the counter race, deadlock explained in words." },
      { key: "executors-futures", title: "ExecutorService and Future", minutes: 14, brief: "fixed thread pool, submit Callable, Future.get, invokeAll, shutdown, results collected in order so output is deterministic." },
      { key: "completable-future", title: "CompletableFuture", minutes: 13, brief: "supplyAsync, thenApply, thenCombine, join, allOf, handling exceptions, chaining without blocking." },
    ] },
  { key: "java-modern-features", file: "m14-modern", export: "modernFeatures", title: "Modern Java and utilities", summary: "Records, sealed types, pattern matching, dates and exact arithmetic: the parts of Java 17 and 21 that interviews and jobs expect.",
    challengeBrief: "Read two dates in YYYY-MM-DD form and print the number of days between them and the day of the week of the first date.",
    lessons: [
      { key: "records-sealed", title: "Records and sealed types", minutes: 13, brief: "record syntax, compact constructor validation, automatic equals/toString, sealed interface with permits, a small shape hierarchy." },
      { key: "pattern-switch", title: "Pattern matching and switch expressions", minutes: 14, brief: "instanceof patterns, switch with arrow cases returning values, switch over a sealed type, guards with when, var." },
      { key: "java-time", title: "Dates and times with java.time", minutes: 12, brief: "LocalDate, LocalDateTime, Duration, Period, ChronoUnit.DAYS.between, DayOfWeek, formatting with DateTimeFormatter (use fixed dates, never now())." },
      { key: "bigdecimal-math", title: "Exact numbers: BigInteger and BigDecimal", minutes: 12, brief: "why double is inexact for money, BigDecimal with scale and RoundingMode, BigInteger for huge factorials, Math.floorMod and overflow-safe Math.addExact." },
    ] },
  { key: "java-interview", file: "m15-interview", export: "interviewJava", title: "Placement and interview Java", summary: "The patterns placement rounds ask again and again, solved in Java, plus the output puzzles.",
    challengeBrief: "Read n integers and print the length of the longest run of equal consecutive values.",
    lessons: [
      { key: "array-patterns", title: "Array patterns", minutes: 15, brief: "prefix sums, Kadane's maximum subarray, rotate an array, merge two sorted arrays, find the missing number." },
      { key: "string-patterns", title: "String patterns", minutes: 14, brief: "palindrome, anagram check with a count array, reverse words, first non-repeating character, valid parentheses." },
      { key: "number-patterns", title: "Number patterns", minutes: 14, brief: "gcd and lcm, prime sieve, armstrong and perfect numbers, fast power with modulo, digit tricks." },
      { key: "output-puzzles", title: "Tricky output questions", minutes: 14, brief: "integer cache with ==, string pool and new String, char arithmetic, integer division and overflow, static and instance init order, finally overriding return." },
    ] },
];
