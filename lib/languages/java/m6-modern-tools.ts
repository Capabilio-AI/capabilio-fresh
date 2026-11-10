import { lesson, q, sec, type TrackModule } from "../types";

export const modern: TrackModule = {
  key: "java-modern",
  title: "Modern Java",
  summary: "Lambdas, streams, records, enums and Optional: the features you will see in every real codebase.",
  lessons: [
    lesson("lambdas-streams", "Lambdas and streams", 16, {
      summary: "A lambda is a short anonymous function. Streams use lambdas to process collections as a pipeline of filter, map and collect steps.",
      sections: [
        sec("Lambdas and functional interfaces", [
          "A lambda such as (a, b) -> a + b can be used wherever an interface with exactly one abstract method (a functional interface) is expected. Common ones are Predicate (test), Function (apply), Consumer (accept) and Comparator (compare).",
        ], {
          title: "A lambda for sorting",
          code: 'import java.util.ArrayList;\nimport java.util.List;\n\npublic class Main {\n    public static void main(String[] args) {\n        List<String> words = new ArrayList<>(List.of("pear", "fig", "banana"));\n        words.sort((a, b) -> Integer.compare(a.length(), b.length()));\n        System.out.println(words);\n    }\n}\n',
          explanation: "The lambda compares strings by length. Output: [fig, pear, banana].",
        }),
        sec("Stream pipelines", [
          "A stream pipeline has a source (list.stream()), zero or more intermediate steps (filter, map, sorted, distinct) and one terminal step (collect, sum, count, forEach) that produces the result. Streams do not change the source collection and run nothing until the terminal step.",
        ], {
          title: "Sum of the even squares",
          code: 'import java.util.List;\n\npublic class Main {\n    public static void main(String[] args) {\n        List<Integer> nums = List.of(1, 2, 3, 4, 5, 6);\n        int total = nums.stream()\n                .filter(n -> n % 2 == 0)\n                .mapToInt(n -> n * n)\n                .sum();\n        System.out.println(total);\n    }\n}\n',
          explanation: "The even numbers 2, 4, 6 are squared (4 + 16 + 36). Output: 56.",
        }),
      ],
      takeaways: ["A lambda implements a functional interface in one expression.", "Streams are pipelines: source, intermediate steps, one terminal step.", "Streams never modify the original collection."],
      mistakes: ["Forgetting the terminal operation, so nothing runs.", "Modifying outside variables inside a lambda.", "Overusing streams where a simple loop is clearer."],
      check: [
        q("What is a functional interface?", ["One with exactly one abstract method", "One with no methods", "A class with static methods", "An abstract class"], 0, "A lambda can stand in for it."),
        q("When does a stream pipeline actually run?", ["When it is created", "When the terminal operation is called", "At program start", "Never"], 1, "Intermediate steps are lazy."),
        q("Does stream().filter(...) change the original list?", ["Yes", "No", "Only for ArrayList", "Only with sorted"], 1, "Streams produce results without modifying their source."),
      ],
    }),
    lesson("records-enums-optional", "Records, enums and Optional", 14, {
      summary: "Records are compact immutable data classes, enums name a fixed set of values, and Optional makes the possibility of 'no value' explicit.",
      sections: [
        sec("Records and enums", [
          "record Point(int x, int y) {} creates a class with a constructor, accessors x() and y(), equals, hashCode and toString, all generated. Records are immutable, which makes them safe to share. An enum declares a fixed set of constants, can carry fields and methods, and works naturally in switch.",
        ], {
          title: "A record and an enum",
          code: 'public class Main {\n    record Point(int x, int y) {}\n\n    enum Level { LOW, MEDIUM, HIGH }\n\n    public static void main(String[] args) {\n        Point p = new Point(3, 4);\n        Level l = Level.valueOf("HIGH");\n        System.out.println(p + " " + l + " " + l.ordinal() + " " + p.equals(new Point(3, 4)));\n    }\n}\n',
          explanation: "toString, equals and the constants all work with no code from you. Output: Point[x=3, y=4] HIGH 2 true.",
        }),
        sec("Optional", [
          "A method that may find nothing can return Optional<T> instead of null. The caller must decide what to do: orElse gives a default, ifPresent runs code only when a value exists, and map transforms it. This makes forgotten null checks, the cause of NullPointerException, much harder to write.",
        ], {
          title: "Handling a missing value",
          code: 'import java.util.List;\nimport java.util.Optional;\n\npublic class Main {\n    static Optional<String> firstLong(List<String> words) {\n        return words.stream().filter(w -> w.length() > 5).findFirst();\n    }\n\n    public static void main(String[] args) {\n        System.out.println(firstLong(List.of("fig", "banana")).orElse("none"));\n        System.out.println(firstLong(List.of("fig", "pear")).orElse("none"));\n    }\n}\n',
          explanation: "The first list has banana; the second has no long word, so the default is used. Output: banana then none.",
        }),
      ],
      takeaways: ["A record is an immutable data class with generated methods.", "An enum is a fixed set of named values.", "Optional makes a missing value explicit."],
      mistakes: ["Calling Optional.get without checking isPresent.", "Using records for objects that need to change.", "Using enum ordinal() for storage; it changes if you reorder constants."],
      check: [
        q("What does a record give you automatically?", ["A constructor, accessors, equals, hashCode and toString", "A database table", "Mutable fields", "A main method"], 0, "These are generated from the component list."),
        q("What is Optional used for?", ["Looping", "Representing a value that may be absent", "Threading", "Sorting"], 1, "It forces callers to handle the empty case."),
        q("Which statement about enums is true?", ["They hold a fixed set of constants", "They can have unlimited new values at run time", "They cannot have methods", "They cannot be used in switch"], 0, "An enum's constants are fixed at compile time."),
      ],
    }),
  ],
};

export const tools: TrackModule = {
  key: "java-tools",
  title: "Files, threads and good practice",
  summary: "Read and write files, run work concurrently, and test and debug your programs.",
  lessons: [
    lesson("file-io", "File input and output", 12, {
      summary: "java.nio.file.Files reads and writes whole files in one call. Always handle the IOException these methods can throw.",
      sections: [
        sec("Reading and writing text", [
          "Path.of(\"notes.txt\") names a file. Files.writeString saves text, Files.readString reads it all, and Files.readAllLines returns a list of lines. For a large file, use Files.lines or a BufferedReader inside try-with-resources, so you never hold everything in memory and the file always gets closed.",
        ], {
          title: "Write then read back",
          code: 'import java.io.IOException;\nimport java.nio.file.Files;\nimport java.nio.file.Path;\nimport java.util.List;\n\npublic class Main {\n    public static void main(String[] args) throws IOException {\n        Path file = Files.createTempFile("scores", ".txt");\n        Files.writeString(file, "40\\n2\\n");\n        List<String> lines = Files.readAllLines(file);\n        int sum = 0;\n        for (String line : lines) {\n            sum += Integer.parseInt(line.trim());\n        }\n        System.out.println(sum);\n        Files.delete(file);\n    }\n}\n',
          explanation: "Two numbers are written to a temporary file, read back and added. Output: 42.",
        }),
        sec("Handling failures", [
          "A missing file or a permissions problem is normal, not exceptional. Catch IOException where you can do something useful, such as showing a clear message or asking for another path, and let it propagate with throws otherwise.",
        ]),
      ],
      takeaways: ["Files.readString and writeString handle small files in one call.", "Use try-with-resources for readers and writers.", "Plan for IOException instead of ignoring it."],
      mistakes: ["Reading a huge file entirely into memory.", "Not closing a stream.", "Hard-coding absolute paths."],
      check: [
        q("Which class reads a whole small file in one call?", ["Files", "Scanner only", "System", "Math"], 0, "java.nio.file.Files offers readString and readAllLines."),
        q("Why use try-with-resources with a BufferedReader?", ["It runs faster", "It closes the reader automatically", "It sorts lines", "It avoids exceptions"], 1, "The resource is closed even when an exception occurs."),
        q("What kind of exception does Files.readString throw?", ["IOException", "ArithmeticException", "ClassCastException", "None"], 0, "It is a checked exception for I/O failures."),
      ],
    }),
    lesson("threads", "Threads and concurrency basics", 16, {
      summary: "Threads let a program do several things at once. Sharing data between them is where bugs hide, so use the higher-level tools in java.util.concurrent.",
      sections: [
        sec("Starting threads and the race condition", [
          "A Thread runs a Runnable. start() begins it and join() waits for it to finish. When two threads change the same variable without coordination, updates can be lost: this is a race condition, and the result changes from run to run.",
        ], {
          title: "A safe shared counter",
          code: 'import java.util.concurrent.atomic.AtomicInteger;\n\npublic class Main {\n    public static void main(String[] args) throws InterruptedException {\n        AtomicInteger count = new AtomicInteger();\n        Runnable work = () -> {\n            for (int i = 0; i < 1000; i++) {\n                count.incrementAndGet();\n            }\n        };\n        Thread a = new Thread(work);\n        Thread b = new Thread(work);\n        a.start();\n        b.start();\n        a.join();\n        b.join();\n        System.out.println(count.get());\n    }\n}\n',
          explanation: "AtomicInteger makes each increment indivisible, so no update is lost. With a plain int the total could be less than 2000. Output: 2000.",
        }),
        sec("Executors and synchronized", [
          "Creating threads by hand does not scale. An ExecutorService manages a pool of threads and runs submitted tasks, and Future returns a result later. synchronized protects a block so only one thread at a time can enter it. Keep shared mutable state to a minimum; immutable data and records need no locking at all.",
        ]),
      ],
      takeaways: ["start() begins a thread; join() waits for it.", "Unprotected shared variables cause race conditions.", "Prefer atomic classes and executors to raw threads and locks."],
      mistakes: ["Calling run() instead of start().", "Sharing a plain int between threads.", "Holding locks while doing slow work."],
      check: [
        q("What does Thread.start() do?", ["Runs the code in the current thread", "Begins running the thread's code concurrently", "Stops the thread", "Waits for the thread"], 1, "start schedules a new thread; calling run() directly would not."),
        q("What is a race condition?", ["A fast algorithm", "Threads interfering because they share unprotected data", "A sorting error", "A compile error"], 1, "The outcome depends on timing."),
        q("Which class gives a thread-safe counter?", ["int", "AtomicInteger", "String", "ArrayList"], 1, "AtomicInteger performs updates atomically."),
      ],
    }),
    lesson("testing-debugging", "Testing and debugging Java", 12, {
      summary: "Tests show that code works and keep it working. A debugger and a few habits make finding a bug a method rather than a guess.",
      sections: [
        sec("Unit tests with JUnit", [
          "A unit test calls a small piece of code and asserts the expected result. In JUnit 5 you annotate a method with @Test and use assertEquals or assertThrows. Write the test first when you can: a failing test proves the bug, and a passing one proves the fix.",
          "Test the edges as well as the typical case: empty input, one element, the largest value, and invalid input.",
        ], {
          title: "A check you can run today",
          code: 'public class Main {\n    static int sumTo(int n) {\n        return n * (n + 1) / 2;\n    }\n\n    public static void main(String[] args) {\n        if (sumTo(10) != 55 || sumTo(0) != 0 || sumTo(1) != 1) {\n            throw new AssertionError("sumTo is wrong");\n        }\n        System.out.println("all checks passed");\n    }\n}\n',
          explanation: "A tiny hand-written check of normal, zero and one-element cases. In a real project the same idea lives in JUnit tests. Output: all checks passed.",
        }),
        sec("Debugging method", [
          "Reproduce the bug with the smallest input, read the stack trace from the top, and form one guess at a time. Use your IDE's debugger: set a breakpoint, step through, and watch the actual values of variables. Compare what you expected with what you see; the first difference is where the bug lives.",
        ]),
      ],
      takeaways: ["A unit test calls code and asserts the expected result.", "Test edge cases, not just the typical one.", "Debug by reproducing small, reading the trace and checking real values."],
      mistakes: ["Testing only the happy path.", "Changing several things at once while debugging.", "Fixing the symptom, not the cause."],
      check: [
        q("What annotation marks a JUnit 5 test method?", ["@Test", "@Run", "@Check", "@Unit"], 0, "JUnit discovers test methods by @Test."),
        q("Which inputs are important to test?", ["Only typical ones", "Typical, empty, single-element and invalid ones", "Only huge ones", "None"], 1, "Edge cases are where most bugs hide."),
        q("Where should you look first in a stack trace?", ["The bottom line", "The top, and the first line of your own code", "The exception's hash", "The last import"], 1, "The top shows the exception and where it originated."),
      ],
    }),
  ],
};
