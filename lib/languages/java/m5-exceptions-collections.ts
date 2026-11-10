import { lesson, q, sec, type TrackModule } from "../types";

export const exceptions: TrackModule = {
  key: "java-exceptions",
  title: "Exceptions",
  summary: "Handle errors without crashing: try, catch, finally, checked and unchecked exceptions, and your own exception types.",
  lessons: [
    lesson("try-catch", "try, catch and finally", 12, {
      summary: "An exception is an object that signals something went wrong. try wraps risky code, catch handles a specific kind of problem, and finally runs whatever happens.",
      sections: [
        sec("Catching exceptions", [
          "When code throws an exception, Java unwinds the call stack until it finds a matching catch. If none exists, the program ends with a stack trace. Catch the most specific type you can handle, never an empty catch that hides the problem, and add a message that helps the person who reads the log.",
          "The stack trace names the exception, its message and the line of every call, so read it from the top: the first line of your own code in it is usually where to look.",
        ], {
          title: "Catching a bad number",
          code: 'public class Main {\n    public static void main(String[] args) {\n        String text = "12x";\n        try {\n            int n = Integer.parseInt(text);\n            System.out.println(n);\n        } catch (NumberFormatException e) {\n            System.out.println("not a number: " + text);\n        } finally {\n            System.out.println("done");\n        }\n    }\n}\n',
          explanation: "parseInt throws NumberFormatException, the catch block handles it, and finally always runs. Output: not a number: 12x then done.",
        }),
        sec("try-with-resources", [
          "Resources such as files and scanners must be closed. try (Scanner in = new Scanner(...)) closes the resource automatically when the block ends, even if an exception is thrown. It replaces the older pattern of closing inside finally.",
        ]),
      ],
      takeaways: ["catch the most specific exception you can handle.", "finally runs whether or not an exception occurred.", "try-with-resources closes resources for you."],
      mistakes: ["An empty catch block that swallows the error.", "Catching Exception everywhere.", "Reading a stack trace from the bottom instead of the top."],
      check: [
        q("When does a finally block run?", ["Only on error", "Only when there is no error", "In both cases", "Never"], 2, "It runs after the try and any catch, whether or not an exception was thrown."),
        q("Which exception does Integer.parseInt(\"abc\") throw?", ["ArithmeticException", "NumberFormatException", "NullPointerException", "IOException"], 1, "The text is not a valid integer."),
        q("What does try-with-resources provide?", ["Faster code", "Automatic closing of resources", "Multi-threading", "Retries"], 1, "The resource is closed when the block ends."),
      ],
    }),
    lesson("checked-custom", "Checked, unchecked and custom exceptions", 12, {
      summary: "Checked exceptions must be handled or declared; unchecked ones (RuntimeException and Error) need not be. You can define your own types to describe problems in your domain.",
      sections: [
        sec("Checked versus unchecked", [
          "Checked exceptions such as IOException represent problems outside the program's control. The compiler forces you to catch them or declare them with throws. Unchecked exceptions such as NullPointerException, IllegalArgumentException and ArrayIndexOutOfBoundsException usually mean a bug; fix the code rather than catching them.",
          "throw raises an exception; throws in a method signature warns callers that the method may raise one.",
        ]),
        sec("Defining your own", [
          "Extend Exception (checked) or RuntimeException (unchecked) and pass a clear message to super. A named exception such as InsufficientFundsException says exactly what went wrong and lets callers react to it specifically.",
        ], {
          title: "A custom exception",
          code: 'class InsufficientFundsException extends RuntimeException {\n    InsufficientFundsException(String message) {\n        super(message);\n    }\n}\n\npublic class Main {\n    static void withdraw(int balance, int amount) {\n        if (amount > balance) {\n            throw new InsufficientFundsException("balance " + balance + " is below " + amount);\n        }\n    }\n\n    public static void main(String[] args) {\n        try {\n            withdraw(100, 250);\n        } catch (InsufficientFundsException e) {\n            System.out.println(e.getMessage());\n        }\n    }\n}\n',
          explanation: "withdraw throws the custom exception and main catches it by type. Output: balance 100 is below 250.",
        }),
      ],
      takeaways: ["Checked exceptions must be handled or declared with throws.", "Unchecked exceptions usually mean a bug to fix.", "A custom exception gives callers a specific type to catch."],
      mistakes: ["Catching RuntimeExceptions to hide bugs.", "Throwing a generic Exception with no useful message.", "Confusing throw (raise) with throws (declare)."],
      check: [
        q("Which of these is a checked exception?", ["NullPointerException", "IOException", "ArithmeticException", "IllegalArgumentException"], 1, "IOException must be caught or declared."),
        q("What is the difference between throw and throws?", ["None", "throw raises an exception; throws declares that a method may raise one", "throws raises; throw declares", "They are both modifiers"], 1, "One acts, the other documents."),
        q("Usually an unchecked exception indicates...", ["A bug in the code", "A missing file", "A network outage", "A full disk"], 0, "It reflects a programming error such as a null reference or bad argument."),
      ],
    }),
  ],
};

export const collections: TrackModule = {
  key: "java-collections",
  title: "Collections and generics",
  summary: "The workhorses of everyday Java: List, Set and Map, how to sort, and how generics keep them type-safe.",
  lessons: [
    lesson("lists", "Lists: ArrayList and LinkedList", 12, {
      summary: "A List is an ordered, growable sequence. ArrayList is the default choice; LinkedList helps only in special cases.",
      sections: [
        sec("ArrayList basics", [
          "ArrayList<Integer> list = new ArrayList<>(); creates an empty list that grows as needed. add appends, get(i) reads, set(i, v) replaces, remove deletes and size() counts. The type in angle brackets, a generic, tells the compiler what the list holds, so mistakes are caught at compile time.",
          "Collections hold objects, not primitives, so use Integer, Double and Character. Java converts between int and Integer automatically (autoboxing). Be careful with remove: on a List<Integer>, remove(1) removes the element at index 1, not the value 1.",
        ], {
          title: "Working with a list",
          code: 'import java.util.ArrayList;\nimport java.util.List;\n\npublic class Main {\n    public static void main(String[] args) {\n        List<Integer> list = new ArrayList<>();\n        for (int i = 1; i <= 5; i++) {\n            list.add(i * i);\n        }\n        list.remove(Integer.valueOf(9));\n        System.out.println(list + " " + list.size());\n    }\n}\n',
          explanation: "The squares 1, 4, 9, 16, 25 are added and the value 9 is removed. Output: [1, 4, 16, 25] 4.",
        }),
        sec("Choosing a list", [
          "ArrayList stores items in an array, so reading by index is fast. Inserting in the middle shifts later items. LinkedList makes insertion at the ends cheap but reading by index slow. In practice ArrayList wins almost always; ArrayDeque is better than LinkedList for queues and stacks.",
        ]),
      ],
      takeaways: ["ArrayList is the default List.", "Generics fix the element type at compile time.", "remove(int) deletes by index; remove(Object) by value."],
      mistakes: ["Confusing remove by index with remove by value on List<Integer>.", "Using a raw type without angle brackets.", "Modifying a list while looping over it with for-each."],
      check: [
        q("Which type holds numbers in an ArrayList?", ["int", "Integer", "number", "Numeric"], 1, "Generic collections hold objects; Integer is the wrapper for int."),
        q("How do you get the number of elements in a List?", ["length", "size()", "count()", "length()"], 1, "Collections use size()."),
        q("Which List is usually the best default?", ["LinkedList", "ArrayList", "Vector", "Stack"], 1, "Array-backed storage gives fast access and good cache behaviour."),
      ],
    }),
    lesson("sets-maps", "Sets and Maps", 14, {
      summary: "A Set stores unique items. A Map stores key-value pairs and finds a value from its key in constant time on average; it is the structure you will use most.",
      sections: [
        sec("HashSet and HashMap", [
          "HashSet keeps only distinct values and tests membership quickly. HashMap<K, V> stores a value under each key: put, get, containsKey, getOrDefault and remove. Neither guarantees an order; use LinkedHashMap to keep insertion order and TreeMap to keep keys sorted.",
          "Keys must have consistent equals and hashCode methods. String and the wrapper types already do; for your own class you must write them, or two equal objects will not be found.",
        ], {
          title: "Counting words",
          code: 'import java.util.HashMap;\nimport java.util.Map;\n\npublic class Main {\n    public static void main(String[] args) {\n        String[] words = {"to", "be", "or", "not", "to", "be"};\n        Map<String, Integer> counts = new HashMap<>();\n        for (String w : words) {\n            counts.put(w, counts.getOrDefault(w, 0) + 1);\n        }\n        System.out.println(counts.get("to") + " " + counts.get("not") + " " + counts.size());\n    }\n}\n',
          explanation: "Each word's count is read, increased and stored back. Output: 2 1 4.",
        }),
        sec("Iterating a map", [
          "for (Map.Entry<K, V> e : map.entrySet()) gives each pair. keySet() gives the keys and values() the values. The first-seen-twice trick, adding to a HashSet and checking whether add returned false, finds duplicates in one pass.",
        ], {
          title: "Finding a duplicate",
          code: 'import java.util.HashSet;\nimport java.util.Set;\n\npublic class Main {\n    public static void main(String[] args) {\n        int[] a = {3, 8, 1, 8, 5};\n        Set<Integer> seen = new HashSet<>();\n        for (int x : a) {\n            if (!seen.add(x)) {\n                System.out.println("duplicate " + x);\n                break;\n            }\n        }\n    }\n}\n',
          explanation: "add returns false when the value is already present. Output: duplicate 8.",
        }),
      ],
      takeaways: ["Sets keep unique values; maps pair keys with values.", "HashMap gives fast average lookup but no order.", "Custom key classes need equals and hashCode."],
      mistakes: ["Writing a key class without equals and hashCode.", "Relying on HashMap iteration order.", "Calling get on a missing key and not handling null."],
      check: [
        q("What does Set.add return when the value already exists?", ["true", "false", "null", "An exception"], 1, "add returns false if the set did not change."),
        q("Which map keeps its keys sorted?", ["HashMap", "TreeMap", "LinkedHashMap", "ArrayMap"], 1, "TreeMap orders keys by their natural order or a comparator."),
        q("What does map.get(key) return for a missing key?", ["0", "An empty string", "null", "An exception"], 2, "A missing key gives null; getOrDefault avoids that."),
      ],
    }),
    lesson("sorting-comparators", "Sorting with Comparable and Comparator", 14, {
      summary: "To sort your own objects, tell Java how to compare them: build the order into the class with Comparable or supply one from outside with a Comparator.",
      sections: [
        sec("Comparable and Comparator", [
          "A class that implements Comparable<T> defines one natural order in compareTo, which returns a negative number, zero or a positive number. A Comparator is a separate object, so you can sort the same objects in several ways. Comparator.comparing(Student::getMarks) builds one from a field, and .reversed() flips it.",
          "Avoid writing a - b in a comparator for ints: it can overflow. Use Integer.compare(a, b).",
        ], {
          title: "Sorting records",
          code: 'import java.util.ArrayList;\nimport java.util.Comparator;\nimport java.util.List;\n\npublic class Main {\n    record Student(String name, int marks) {}\n\n    public static void main(String[] args) {\n        List<Student> list = new ArrayList<>(List.of(new Student("Asha", 72), new Student("Ravi", 91), new Student("Kim", 85)));\n        list.sort(Comparator.comparingInt(Student::marks).reversed());\n        System.out.println(list.get(0).name() + " " + list.get(2).name());\n    }\n}\n',
          explanation: "Sorted by marks, highest first: Ravi, Kim, Asha. Output: Ravi Asha.",
        }),
        sec("Generics in your own code", [
          "A generic method or class uses a type parameter, such as <T>, so one piece of code works for many types while the compiler still checks them. You will mostly use generics; writing your own is rarer, but reading signatures like Map<String, List<Integer>> is a daily skill.",
        ]),
      ],
      takeaways: ["Comparable gives a class one natural order; Comparator gives any number of orders.", "Use Integer.compare instead of subtracting.", "Comparator.comparing builds an order from a field."],
      mistakes: ["Subtracting ints in compareTo and overflowing.", "Forgetting that sort changes the list in place.", "Implementing compareTo inconsistently with equals."],
      check: [
        q("What does compareTo return when this object should come first?", ["A positive number", "A negative number", "Zero", "true"], 1, "A negative value means this sorts before the other."),
        q("What is the advantage of a Comparator over Comparable?", ["It is faster", "You can define many different orders outside the class", "It needs no method", "It sorts numbers only"], 1, "The order is separate from the class, so you can have several."),
        q("Why prefer Integer.compare(a, b) to a - b?", ["It is shorter", "Subtraction can overflow", "It sorts descending", "It is required"], 1, "Large values of opposite sign can overflow int."),
      ],
    }),
  ],
};
