import { lesson, q, sec, type TrackModule } from "../types";

export const functions: TrackModule = {
  key: "python-functions",
  title: "Functions",
  summary: "Define reusable functions, pass arguments flexibly, understand scope, and use recursion.",
  lessons: [
    lesson("def-args", "Defining functions and arguments", 12, {
      summary: "def creates a function. Parameters can have defaults, be passed by keyword, or collect extras with *args and **kwargs.",
      sections: [
        sec("Parameters and return values", [
          "A function without a return statement returns None. Default values make a parameter optional, and callers can pass arguments by name for clarity. A function can return several values at once as a tuple and the caller can unpack them.",
        ], {
          title: "Defaults and multiple returns",
          code: 'def stats(values, scale=1):\n    return min(values) * scale, max(values) * scale\n\nlow, high = stats([4, 9, 2])\nprint(low, high, stats([4, 9, 2], scale=10))\n',
          explanation: "stats returns two values that are unpacked; scale defaults to 1 unless given by name. Output: 2 9 (20, 90).",
        }),
        sec("The mutable default trap", [
          "A default value is created once, when the function is defined. A default of [] is therefore shared by every call that does not pass its own list, and appending to it leaks data between calls. Use None as the default and create the list inside the function.",
        ], {
          title: "Avoiding the trap",
          code: 'def add_item(item, bucket=None):\n    if bucket is None:\n        bucket = []\n    bucket.append(item)\n    return bucket\n\nprint(add_item(1), add_item(2))\n',
          explanation: "Each call without a bucket gets its own fresh list. Output: [1] [2].",
        }),
      ],
      takeaways: ["No return means the function returns None.", "Defaults and keyword arguments make calls clear.", "Never use a mutable object as a default value."],
      mistakes: ["Using [] or {} as a default argument.", "Forgetting return and getting None.", "Putting a non-default parameter after a default one."],
      check: [
        q("What does a function without return give back?", ["0", "None", "An empty string", "An error"], 1, "The implicit result is None."),
        q("Why is def f(x, items=[]) risky?", ["It is slow", "The same list is shared across calls", "It is a syntax error", "It cannot append"], 1, "The default is created once at definition time."),
        q("How do you return two values from a function?", ["You cannot", "return a, b gives a tuple", "Use two return statements", "Use a global"], 1, "Multiple values are packed into a tuple."),
      ],
    }),
    lesson("scope-lambda", "Scope, lambda and higher-order functions", 12, {
      summary: "Variables live in the scope where they are assigned. Functions are values too, so they can be passed around, which makes lambda and key= sorting possible.",
      sections: [
        sec("LEGB scope", [
          "Python looks a name up in the Local scope, then Enclosing functions, then Global, then Built-ins. Assigning to a name inside a function creates a local variable even if a global of that name exists. Use global or nonlocal only when you truly need to rebind an outer name; returning values is cleaner.",
        ], {
          title: "Local versus global",
          code: 'count = 10\n\ndef bump():\n    count = 99\n    return count\n\nprint(bump(), count)\n',
          explanation: "The assignment inside bump makes a new local name, so the global is untouched. Output: 99 10.",
        }),
        sec("Functions as values", [
          "A lambda is a one-expression anonymous function, most useful as a key. sorted(items, key=...) sorts by the value the key function returns; min, max and sort accept the same argument.",
        ], {
          title: "Sorting by a key",
          code: 'students = [("Asha", 72), ("Ravi", 91), ("Kim", 85)]\nby_marks = sorted(students, key=lambda s: s[1], reverse=True)\nprint([name for name, _ in by_marks])\n',
          explanation: "The key picks the marks, highest first. Output: [\'Ravi\', \'Kim\', \'Asha\'].",
        }),
      ],
      takeaways: ["Name lookup runs Local, Enclosing, Global, Built-in.", "Assigning inside a function creates a local variable.", "Pass functions as values, for example key= in sorted."],
      mistakes: ["Expecting an assignment in a function to change a global.", "Writing a long lambda that is hard to read; use def.", "Shadowing a built-in such as list or sum."],
      check: [
        q("What does assigning to a name inside a function do by default?", ["Changes the global", "Creates a local variable", "Raises an error", "Deletes the global"], 1, "Assignment makes the name local to the function."),
        q("What is a lambda?", ["A class", "A small anonymous function", "A loop", "A module"], 1, "It is a function made from a single expression."),
        q("What does sorted(x, key=len) sort by?", ["The values themselves", "Length of each item", "Alphabet only", "Index"], 1, "The key function's result decides the order."),
      ],
    }),
    lesson("recursion", "Recursion", 12, {
      summary: "A recursive function calls itself on a smaller problem. Python limits recursion depth, and functools.lru_cache removes repeated work.",
      sections: [
        sec("Base case and recursive case", [
          "Every recursive function needs a base case that returns directly, and a step that moves toward it. Python stops at about a thousand nested calls with RecursionError, so for very deep problems prefer a loop.",
        ], {
          title: "Factorial",
          code: 'def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(5))\n',
          explanation: "factorial(5) is 5 x 4 x 3 x 2 x 1. Output: 120.",
        }),
        sec("Caching repeated work", [
          "A naive Fibonacci recomputes the same values exponentially often. Decorating the function with functools.cache stores each result the first time, making it linear with no other change.",
        ], {
          title: "Memoised Fibonacci",
          code: 'from functools import cache\n\n@cache\ndef fib(n):\n    return n if n < 2 else fib(n - 1) + fib(n - 2)\n\nprint(fib(80))\n',
          explanation: "Each value is computed once and reused. Output: 23416728348467685.",
        }),
      ],
      takeaways: ["Recursion needs a base case and progress toward it.", "Python caps recursion depth near 1000.", "functools.cache removes repeated subproblems."],
      mistakes: ["No reachable base case.", "Recursing a million levels deep.", "Recomputing the same subproblems."],
      check: [
        q("What error does infinite recursion raise?", ["ValueError", "RecursionError", "TypeError", "KeyError"], 1, "Python stops at its recursion limit."),
        q("What does @cache do?", ["Stores results of earlier calls", "Makes the function run in parallel", "Removes the base case", "Prints debug output"], 0, "Repeated calls with the same arguments return the stored result."),
        q("What is factorial(4)?", ["10", "16", "24", "12"], 2, "4 x 3 x 2 x 1 = 24."),
      ],
    }),
  ],
};

export const data: TrackModule = {
  key: "python-data",
  title: "Data structures",
  summary: "Lists, tuples, sets and dictionaries, plus comprehensions that build them in one line.",
  lessons: [
    lesson("lists-tuples", "Lists and tuples", 12, {
      summary: "A list is an ordered, changeable sequence; a tuple is an ordered, fixed one. Slicing works on both.",
      sections: [
        sec("Lists", [
          "append adds to the end, insert places at a position, pop removes (the last item by default), remove deletes the first matching value and sort orders the list in place while sorted returns a new one. Indexes start at 0 and negative indexes count from the end, so items[-1] is the last element.",
          "Slicing items[a:b] gives a new list from a up to but not including b; items[::-1] reverses a copy. Assigning one list to another variable does not copy it: both names refer to the same list.",
        ], {
          title: "Slicing and copying",
          code: 'nums = [10, 20, 30, 40, 50]\nprint(nums[1:4], nums[-1], nums[::-1])\nalias = nums\ncopy = nums[:]\nnums.append(60)\nprint(len(alias), len(copy))\n',
          explanation: "alias shares the list and sees the new item, while the slice copy does not. Output: [20, 30, 40] 50 [50, 40, 30, 20, 10], then 6 5.",
        }),
        sec("Tuples", [
          "A tuple such as (3, 4) cannot be changed after creation, which makes it a good fixed record and a valid dictionary key. Unpacking assigns each item to a name: x, y = point. Swapping needs no temporary variable: a, b = b, a.",
        ], {
          title: "Unpacking and swapping",
          code: 'point = (3, 4)\nx, y = point\nx, y = y, x\nprint(x, y)\n',
          explanation: "The tuple is unpacked and the two names are swapped in one line. Output: 4 3.",
        }),
      ],
      takeaways: ["Lists change; tuples do not.", "Slicing makes a copy; plain assignment does not.", "Negative indexes count from the end."],
      mistakes: ["Thinking b = a copies a list.", "Modifying a list while iterating over it.", "Using list.sort() result: it returns None."],
      check: [
        q("What does nums[::-1] do?", ["Sorts the list", "Returns a reversed copy", "Removes the last item", "Reverses in place"], 1, "A slice with step -1 walks backwards and makes a copy."),
        q("What does b = a do for a list a?", ["Copies the list", "Makes b refer to the same list", "Sorts the list", "Creates an empty list"], 1, "Both names point to one object."),
        q("Why use a tuple?", ["It is mutable", "It is fixed and can be a dictionary key", "It is sorted", "It holds only numbers"], 1, "Immutability makes tuples hashable."),
      ],
    }),
    lesson("sets-dicts", "Sets and dictionaries", 14, {
      summary: "A set stores unique values and tests membership fast. A dictionary maps keys to values and is the most useful structure in everyday Python.",
      sections: [
        sec("Dictionaries", [
          "d = {\"a\": 1} stores a value under each key. d[key] reads it (KeyError if missing), d.get(key, default) is the safe read, and d[key] = v adds or replaces. Loop with d.items() to get key and value together. Keys must be hashable, such as strings, numbers and tuples.",
          "collections.Counter and defaultdict make counting and grouping short: Counter(words) counts every word in one call.",
        ], {
          title: "Counting words",
          code: 'from collections import Counter\n\nwords = ["to", "be", "or", "not", "to", "be"]\ncounts = Counter(words)\nprint(counts["to"], counts.get("xyz", 0), counts.most_common(1))\n',
          explanation: "Counter tallies each word; get with a default avoids KeyError. Output: 2 0 [(\'to\', 2)].",
        }),
        sec("Sets", [
          "A set drops duplicates and supports union (|), intersection (&) and difference (-). Membership with in takes constant time on average, much faster than searching a list. Use a set to remove duplicates or to test 'have I seen this before?'.",
        ], {
          title: "Duplicates and overlap",
          code: 'a = {1, 2, 3, 4}\nb = {3, 4, 5}\nprint(a & b, sorted(a | b), len(set([1, 1, 2, 2, 2])))\n',
          explanation: "The intersection is {3, 4}, the union has five values, and duplicates collapse. Output: {3, 4} [1, 2, 3, 4, 5] 2.",
        }),
      ],
      takeaways: ["Dictionaries map keys to values; use .get for safe reads.", "Sets hold unique items and test membership quickly.", "Counter counts things in one call."],
      mistakes: ["Reading a missing key with d[key] and getting KeyError.", "Using a list as a dictionary key.", "Relying on set order."],
      check: [
        q("What does d.get(\"x\", 0) return when \"x\" is missing?", ["KeyError", "0", "None", "\"x\""], 1, "The second argument is the default."),
        q("Which can be a dictionary key?", ["A list", "A tuple of numbers", "A dictionary", "A set"], 1, "Keys must be hashable; tuples of hashable items are."),
        q("What is {1, 2, 3} & {2, 3, 4}?", ["{2, 3}", "{1, 2, 3, 4}", "{1, 4}", "{}"], 0, "& is intersection."),
      ],
    }),
    lesson("comprehensions", "Comprehensions and generators", 12, {
      summary: "A comprehension builds a list, set or dict from a loop in one expression. A generator produces values lazily, one at a time, using little memory.",
      sections: [
        sec("Comprehensions", [
          "[expr for x in items if cond] builds a list; the same with braces builds a set, and {k: v for ...} a dict. They are shorter and usually faster than appending in a loop. If one gets long or nested, a plain loop is more readable.",
        ], {
          title: "Squares of evens",
          code: 'squares = [n * n for n in range(1, 8) if n % 2 == 0]\nlengths = {w: len(w) for w in ["pear", "fig"]}\nprint(squares, lengths)\n',
          explanation: "Only even n are kept and squared. Output: [4, 16, 36] {\'pear\': 4, \'fig\': 3}.",
        }),
        sec("Generators", [
          "A generator expression uses parentheses, and a function with yield makes a generator function. Values are produced on demand, so sum(n * n for n in range(10**6)) never holds a million numbers in memory. A generator can be consumed only once.",
        ], {
          title: "A generator function",
          code: 'def countdown(n):\n    while n > 0:\n        yield n\n        n -= 1\n\nprint(list(countdown(3)), sum(x * x for x in range(1000)))\n',
          explanation: "yield hands out one value at a time; list collects them. Output: [3, 2, 1] 332833500.",
        }),
      ],
      takeaways: ["A comprehension builds a collection from a loop in one expression.", "Generators produce values lazily and save memory.", "A generator can be consumed only once."],
      mistakes: ["Nesting comprehensions until they are unreadable.", "Using a generator twice and getting nothing.", "Building a huge list when a generator would do."],
      check: [
        q("What does [n for n in range(3)] produce?", ["[1, 2, 3]", "[0, 1, 2]", "(0, 1, 2)", "{0, 1, 2}"], 1, "range(3) gives 0, 1, 2."),
        q("What makes a function a generator?", ["Using return", "Using yield", "Using lambda", "Using class"], 1, "yield produces values lazily."),
        q("A generator can be iterated...", ["Many times", "Once", "Never", "Only with len"], 1, "After it is exhausted it yields nothing."),
      ],
    }),
    lesson("strings", "Working with strings", 12, {
      summary: "Strings are immutable sequences of characters with a rich set of methods. Many text tasks reduce to split, join, replace and slicing.",
      sections: [
        sec("Common methods", [
          "len, upper, lower, strip, replace, find, startswith, endswith, split and join cover most needs. s.split() breaks text into a list of words, and \" \".join(words) puts them back together. Strings cannot be changed; each method returns a new string.",
        ], {
          title: "Cleaning and splitting",
          code: 'line = "  Learn Python with Capabilio  "\nwords = line.strip().lower().split()\nprint(words, "-".join(words))\n',
          explanation: "strip trims, lower changes case, split breaks on spaces and join glues with a hyphen. Output: [\'learn\', \'python\', \'with\', \'capabilio\'] learn-python-with-capabilio.",
        }),
        sec("Slicing and common problems", [
          "Slicing works as with lists, so s[::-1] reverses a string and a palindrome check is s == s[::-1]. Counting letters uses Counter or a dict. For text that must match patterns, the re module offers regular expressions.",
        ], {
          title: "Palindrome and anagram",
          code: 'def is_palindrome(s):\n    return s == s[::-1]\n\ndef is_anagram(a, b):\n    return sorted(a) == sorted(b)\n\nprint(is_palindrome("level"), is_anagram("listen", "silent"))\n',
          explanation: "Both checks are one line each thanks to slicing and sorting. Output: True True.",
        }),
      ],
      takeaways: ["Strings are immutable; methods return new strings.", "split and join convert between text and lists.", "Slicing [::-1] reverses a sequence."],
      mistakes: ["Expecting s.upper() to change s.", "Building a long string with += in a big loop; use join.", "Forgetting that split() without arguments handles any whitespace."],
      check: [
        q("What does \"a,b,c\".split(\",\") return?", ["\"abc\"", "[\"a\", \"b\", \"c\"]", "(\"a\", \"b\", \"c\")", "3"], 1, "It breaks the text at each comma."),
        q("What does s.upper() do to s?", ["Changes it in place", "Returns a new uppercase string", "Raises an error", "Sorts it"], 1, "Strings are immutable."),
        q("How do you reverse a string s?", ["s.reverse()", "s[::-1]", "reverse(s)", "s.flip()"], 1, "A step of -1 walks the string backwards."),
      ],
    }),
  ],
};
