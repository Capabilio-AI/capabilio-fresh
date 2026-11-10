import { lesson, q, sec, type TrackModule } from "../types";

export const arrays: TrackModule = {
  key: "java-arrays",
  title: "Arrays and Strings",
  summary: "Fixed-size arrays, tables, and Java's immutable String with StringBuilder for building text.",
  lessons: [
    lesson("arrays-1d", "Arrays", 12, {
      summary: "A Java array is an object that holds a fixed number of values of one type. Unlike C, it knows its own length and checks every index.",
      sections: [
        sec("Creating and using arrays", [
          "int[] marks = new int[5]; creates five ints, all starting at 0. An array literal such as {60, 70, 80} creates and fills one in a single step. The field marks.length gives the size, with no parentheses, and valid indexes run from 0 to length - 1.",
          "Going outside the range throws ArrayIndexOutOfBoundsException instead of silently corrupting memory, which is a big safety gain over C.",
        ], {
          title: "Average of an array",
          code: 'public class Main {\n    public static void main(String[] args) {\n        int[] marks = {60, 70, 80, 90, 100};\n        int sum = 0;\n        for (int m : marks) {\n            sum += m;\n        }\n        System.out.printf("%.1f%n", (double) sum / marks.length);\n    }\n}\n',
          explanation: "The for-each loop adds every element and length gives the count. Output: 80.0.",
        }),
        sec("The Arrays helper class", [
          "java.util.Arrays has ready-made methods: sort, toString for printing, fill, copyOf and binarySearch (which requires a sorted array). Printing an array directly shows a useless reference, so wrap it in Arrays.toString.",
          "Arrays are objects, so assigning one array variable to another copies the reference, not the contents. Use Arrays.copyOf or clone for a real copy.",
        ], {
          title: "Sorting and searching",
          code: 'import java.util.Arrays;\n\npublic class Main {\n    public static void main(String[] args) {\n        int[] a = {5, 1, 4, 2, 8};\n        Arrays.sort(a);\n        System.out.println(Arrays.toString(a) + " " + Arrays.binarySearch(a, 4));\n    }\n}\n',
          explanation: "After sorting, 4 sits at index 2. Output: [1, 2, 4, 5, 8] 2.",
        }),
      ],
      takeaways: ["An array has a fixed length, available as .length.", "Out-of-range access throws an exception.", "Assigning an array copies the reference; use Arrays.copyOf for a copy."],
      mistakes: ["Writing length() for an array; it is a field.", "Printing an array directly instead of Arrays.toString.", "Using binarySearch on an unsorted array."],
      check: [
        q("How do you get the size of an int array named a?", ["a.length()", "a.length", "a.size()", "len(a)"], 1, "length is a field of arrays, not a method."),
        q("What happens on a[10] when a has 5 elements?", ["Returns 0", "Throws ArrayIndexOutOfBoundsException", "Silent memory corruption", "Compile error"], 1, "Java checks every index at run time."),
        q("What does int[] b = a; do?", ["Copies the elements", "Makes b refer to the same array", "Sorts the array", "Creates a new empty array"], 1, "Both variables now reference one array object."),
      ],
    }),
    lesson("arrays-2d", "Two-dimensional arrays", 12, {
      summary: "A 2D array in Java is an array of arrays. Rows can even have different lengths.",
      sections: [
        sec("Rows and columns", [
          "int[][] m = new int[3][4]; builds three rows of four ints. m[i][j] is row i, column j; m.length is the number of rows and m[i].length the width of row i. Nested loops visit every element.",
        ], {
          title: "Sum of a matrix",
          code: 'public class Main {\n    public static void main(String[] args) {\n        int[][] m = {{1, 2, 3}, {4, 5, 6}};\n        int sum = 0;\n        for (int[] row : m) {\n            for (int v : row) {\n                sum += v;\n            }\n        }\n        System.out.println(sum);\n    }\n}\n',
          explanation: "The outer loop gives each row and the inner loop each value. Output: 21.",
        }),
        sec("Transpose and jagged arrays", [
          "The transpose swaps rows and columns. Because each row is its own array, a jagged array, where rows have different lengths, is allowed: create the outer array first, then each row separately.",
        ], {
          title: "Transpose",
          code: 'public class Main {\n    public static void main(String[] args) {\n        int[][] m = {{1, 2, 3}, {4, 5, 6}};\n        int[][] t = new int[3][2];\n        for (int i = 0; i < 2; i++) {\n            for (int j = 0; j < 3; j++) {\n                t[j][i] = m[i][j];\n            }\n        }\n        System.out.println(t[2][0] + " " + t[2][1]);\n    }\n}\n',
          explanation: "Row 2 of the transpose is the third column of the original. Output: 3 6.",
        }),
      ],
      takeaways: ["m[i][j] is row i, column j.", "m.length is rows; m[i].length is the width of row i.", "Rows are separate arrays, so they can differ in length."],
      mistakes: ["Swapping row and column indexes.", "Using m.length for the width.", "Forgetting to create each row of a jagged array."],
      check: [
        q("For int[][] m = new int[3][4], what is m[0].length?", ["3", "4", "12", "0"], 1, "Each row has four elements."),
        q("In Java, a 2D array is...", ["One block of memory", "An array of arrays", "A list of lists", "Always rectangular"], 1, "Each row is a separate array object, so jagged arrays are possible."),
        q("Which loop style reads every value in a 2D array without indexes?", ["Nested for-each", "A single while", "A switch", "Recursion only"], 0, "Loop over rows, then over the values in each row."),
      ],
    }),
    lesson("strings", "Strings and StringBuilder", 14, {
      summary: "A String is an immutable object: every change makes a new string. Compare contents with equals, and use StringBuilder to build text efficiently.",
      sections: [
        sec("Working with String", [
          "length() gives the number of characters, charAt(i) one character, substring(a, b) the part from a up to but not including b, indexOf the position of a match, and toUpperCase, trim, replace and split transform text. All of them return a new string; the original never changes.",
          "equals compares contents, equalsIgnoreCase ignores case, and compareTo orders strings alphabetically. Use == only when you really mean to ask whether two references are the same object.",
        ], {
          title: "Palindrome check",
          code: 'public class Main {\n    public static void main(String[] args) {\n        String s = "level";\n        boolean ok = true;\n        for (int i = 0, j = s.length() - 1; i < j; i++, j--) {\n            if (s.charAt(i) != s.charAt(j)) {\n                ok = false;\n                break;\n            }\n        }\n        System.out.println(ok ? "palindrome" : "not a palindrome");\n    }\n}\n',
          explanation: "Two indexes move inward from both ends. All pairs match, so the output is palindrome.",
        }),
        sec("StringBuilder", [
          "Joining strings with + inside a loop creates a new String each time, which is slow for long text. StringBuilder keeps one growing buffer: append adds, reverse reverses, insert and deleteCharAt edit, and toString gives the final String.",
        ], {
          title: "Reverse and count",
          code: 'public class Main {\n    public static void main(String[] args) {\n        String s = "banana";\n        String rev = new StringBuilder(s).reverse().toString();\n        int count = 0;\n        for (char c : s.toCharArray()) {\n            if (c == \'a\') {\n                count++;\n            }\n        }\n        System.out.println(rev + " " + count);\n    }\n}\n',
          explanation: "reverse flips the text and the loop counts the letter a. Output: ananab 3.",
        }),
      ],
      takeaways: ["Strings are immutable: methods return new strings.", "Use equals for content and == for identity.", "Use StringBuilder to build text in a loop."],
      mistakes: ["Comparing strings with ==.", "Ignoring a method's return value, as in s.toUpperCase(); on its own.", "Building a long string with + in a loop."],
      check: [
        q("What does s.toUpperCase() do to s?", ["Changes s in place", "Returns a new string and leaves s unchanged", "Throws an exception", "Changes only the first letter"], 1, "Strings are immutable."),
        q("What does \"hello\".substring(1, 3) return?", ["\"hel\"", "\"el\"", "\"ell\"", "\"he\""], 1, "From index 1 up to but not including index 3."),
        q("Why use StringBuilder in a loop?", ["It avoids creating many temporary strings", "It sorts the text", "It is required by Java", "It makes strings case-insensitive"], 0, "It appends into one buffer instead of copying each time."),
      ],
    }),
  ],
};
