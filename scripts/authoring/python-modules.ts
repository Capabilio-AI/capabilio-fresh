// The blueprint for the Python modules added after the first six. See c-modules.ts for the shape. Programs must not read input, use only the standard library
// (the runner has no pip packages and no network), and run on the runner's Python.
import type { ModuleSpec } from "./c-modules";

export const PYTHON_MODULES: ModuleSpec[] = [
  { key: "python-text", file: "m4-text", export: "textTools", title: "Strings and text in depth", summary: "Slice, search, clean and format text, and find patterns with regular expressions.",
    challengeBrief: "Read a line of text and print the number of words, the longest word, and the text with each word capitalised, on three lines.",
    lessons: [
      { key: "string-methods", title: "String methods you will use daily", minutes: 12, brief: "split, join, strip, replace, find, startswith, endswith, count, upper/lower, why strings are immutable." },
      { key: "slicing-formatting", title: "Slicing and formatting", minutes: 12, brief: "start:stop:step slices, negative indexes, reversing, f-string width/precision/alignment, format mini-language for numbers." },
      { key: "regex-basics", title: "Regular expressions with re", minutes: 14, brief: "re.search, findall, sub, match groups, character classes, quantifiers, raw strings, when not to use regex." },
      { key: "text-processing", title: "Cleaning and counting text", minutes: 12, brief: "normalise case and punctuation, word frequency with a dict and Counter, sorting results, unicode and encode/decode basics." },
    ] },
  { key: "python-iter-functional", file: "m5-iter-functional", export: "iterFunctional", title: "Iterators and functional tools", summary: "Loop the Pythonic way, build generators, and use sorting, zip, map and itertools.",
    challengeBrief: "Read n numbers and print the running (prefix) sums on one line, separated by spaces, using an iterator style such as itertools.accumulate or a generator.",
    lessons: [
      { key: "enumerate-zip", title: "enumerate, zip and unpacking", minutes: 12, brief: "loop with index, loop two lists together, unpacking, star-unpacking, swapping values." },
      { key: "iterators-generators", title: "Iterators and generators", minutes: 14, brief: "the iterator protocol, iter and next, yield, generator expressions, laziness and memory, exhausting a generator." },
      { key: "sorting-key", title: "Sorting with key functions", minutes: 12, brief: "sorted vs list.sort, key=, lambda keys, reverse, sorting by several fields with tuples, stability." },
      { key: "itertools-functools", title: "itertools and functools", minutes: 14, brief: "chain, accumulate, groupby (needs sorted input), combinations, permutations, product, functools.reduce and lru_cache." },
    ] },
  { key: "python-algorithms", file: "m6-algorithms", export: "algorithms", title: "Algorithms and problem solving", summary: "Count the work an algorithm does, then write the searches, sorts and dynamic programs that interviews ask for.",
    challengeBrief: "Read n and print the n-th Fibonacci number modulo 1000000007 for n up to 100000 (needs a loop or memoisation, not naive recursion).",
    lessons: [
      { key: "complexity-big-o", title: "Counting work: Big O", minutes: 12, brief: "O(1), O(n), O(n^2), O(log n) shown with small loops, why list.append is cheap and list.insert(0) is not, dict and set lookups." },
      { key: "search-sort-algos", title: "Searching and sorting by hand", minutes: 15, brief: "linear search, binary search with bisect and by hand, bubble, insertion and merge sort written in Python." },
      { key: "two-pointers-windows", title: "Two pointers and sliding windows", minutes: 14, brief: "pair sum on a sorted list, remove duplicates, longest substring without repeats, fixed and variable windows." },
      { key: "memo-dp", title: "Memoisation and dynamic programming", minutes: 15, brief: "overlapping subproblems, lru_cache, bottom-up table, climbing stairs, coin change, longest common subsequence." },
    ] },
  { key: "python-data-structures", file: "m7-data-structures", export: "dataStructures", title: "Data structures in Python", summary: "Stacks, queues, heaps, linked lists, trees and graphs, built and used the Python way.",
    challengeBrief: "Read a string of brackets ()[]{} and print YES if it is balanced and NO otherwise (use a stack).",
    lessons: [
      { key: "stack-queue-deque", title: "Stacks, queues and deque", minutes: 13, brief: "list as a stack, collections.deque as a queue, why list.pop(0) is slow, matching brackets." },
      { key: "heap-priority", title: "Heaps and priority queues", minutes: 13, brief: "heapq push/pop, k smallest and k largest, a max-heap with negated values, tuples as priorities." },
      { key: "linked-list-tree", title: "Linked lists and trees", minutes: 15, brief: "a Node class, building a linked list and reversing it, a binary tree with in-order and level-order traversal." },
      { key: "graphs-bfs-dfs", title: "Graphs: BFS and DFS", minutes: 15, brief: "adjacency list as a dict of lists, BFS with deque for shortest steps, DFS with recursion, visited set." },
    ] },
  { key: "python-oop-advanced", file: "m8-oop-advanced", export: "oopAdvanced", title: "Advanced classes and design", summary: "Special methods, properties, abstract classes and composition: the parts of OOP that make code easy to change.",
    challengeBrief: "Read n lines of 'name amount' and print the total per name, sorted by name, one per line as 'name total'.",
    lessons: [
      { key: "dunder-methods", title: "Special (dunder) methods", minutes: 14, brief: "__repr__, __str__, __eq__, __lt__, __len__, __iter__, __add__, making your own class behave like a built-in." },
      { key: "properties-classmethods", title: "Properties, class and static methods", minutes: 13, brief: "@property with validation, @classmethod as an alternative constructor, @staticmethod, class vs instance attributes." },
      { key: "abc-protocols", title: "Abstract classes and duck typing", minutes: 13, brief: "abc.ABC and abstractmethod, duck typing, why Python does not need interfaces, a plug-in style example." },
      { key: "composition-patterns", title: "Composition and simple patterns", minutes: 14, brief: "has-a vs is-a, delegation, a strategy as a function, a simple factory, why prefer composition." },
    ] },
  { key: "python-stdlib", file: "m9-stdlib", export: "stdlibPractical", title: "The standard library in practice", summary: "The batteries included: dates, collections, paths, CSV, logging and random numbers.",
    challengeBrief: "Read n dates in YYYY-MM-DD form and print the earliest, the latest and the number of days between them.",
    lessons: [
      { key: "datetime-module", title: "Dates and times", minutes: 12, brief: "date, datetime, timedelta, strptime and strftime, differences between dates, weekday." },
      { key: "collections-module", title: "collections: Counter, defaultdict, namedtuple", minutes: 13, brief: "Counter most_common, defaultdict(list), namedtuple and dataclass compared, deque." },
      { key: "csv-pathlib", title: "CSV and paths", minutes: 12, brief: "csv.reader and DictReader on io.StringIO text, csv.writer, pathlib.Path basics (the runner has no files, so use StringIO and path strings without touching disk)." },
      { key: "logging-random", title: "logging, random and statistics", minutes: 12, brief: "logging levels and format to stdout, random with a fixed seed so output is repeatable, statistics mean/median/stdev." },
    ] },
  { key: "python-data-work", file: "m10-data-work", export: "dataWork", title: "Working with data in pure Python", summary: "Read, clean, group and summarise records with only the standard library: the base of every data job.",
    challengeBrief: "Read n lines of 'city temperature' and print each city with its average temperature rounded to 1 decimal, sorted by city name.",
    lessons: [
      { key: "records-json", title: "Records and JSON", minutes: 13, brief: "lists of dicts as records, json.loads and dumps with indent and sort_keys, nested data access, missing keys with get." },
      { key: "clean-validate", title: "Cleaning and validating data", minutes: 13, brief: "strip, convert types safely with try/except, handle missing values, drop duplicates, simple validation rules." },
      { key: "group-aggregate", title: "Group, count and summarise", minutes: 14, brief: "group with defaultdict, sum/avg/min/max per group, sorting and top N, a small report printed as a table." },
      { key: "stats-thinking", title: "Thinking with numbers", minutes: 13, brief: "mean vs median and outliers, percent change, rounding pitfalls with floats and Decimal, reading a result critically." },
    ] },
  { key: "python-concurrency-interview", file: "m11-interview", export: "interviewPython", title: "Concurrency basics and interview Python", summary: "A first look at threads and asyncio, then the Python habits that placement interviews test.",
    challengeBrief: "Read n integers and print the length of the longest run of equal consecutive values.",
    lessons: [
      { key: "threads-basics", title: "Threads and the GIL", minutes: 13, brief: "threading.Thread, join, a lock protecting a counter, why threads do not speed up CPU work in CPython, concurrent.futures ThreadPoolExecutor." },
      { key: "asyncio-basics", title: "asyncio basics", minutes: 14, brief: "async def, await, asyncio.run, asyncio.gather with asyncio.sleep to show waiting together, when async helps." },
      { key: "pythonic-patterns", title: "Writing Pythonic code", minutes: 12, brief: "EAFP vs LBYL, truthiness, any/all, dict.get and setdefault, unpacking, avoiding mutable default arguments, common gotchas." },
      { key: "output-puzzles", title: "Tricky output questions", minutes: 12, brief: "mutable default args, list aliasing, is vs ==, late-binding closures, integer caching, string immutability: what each prints and why." },
    ] },
];
