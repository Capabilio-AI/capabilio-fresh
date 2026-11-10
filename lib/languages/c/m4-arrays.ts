import { lesson, q, sec, type TrackModule } from "../types";

export const arrays: TrackModule = {
  key: "c-arrays",
  title: "Arrays",
  summary: "Store many values of one type: one-dimensional and two-dimensional arrays, passing them to functions, searching and sorting.",
  lessons: [
    lesson("arrays-1d", "One-dimensional arrays", 12, {
      summary: "An array is a fixed number of values of the same type stored side by side in memory, reached by an index that starts at 0.",
      sections: [
        sec("Declaring and using arrays", [
          "int marks[5]; reserves room for five ints, with valid indexes 0 to 4. You can initialise with braces: int a[3] = {10, 20, 30}; Leaving out the size lets the compiler count the values.",
          "C does not check bounds. Writing marks[5] or marks[-1] compiles and then corrupts other memory, or crashes, or appears to work. Keeping indexes inside 0 to n-1 is your job.",
        ], {
          title: "Average of an array",
          code: '#include <stdio.h>\n\nint main(void) {\n    int marks[5] = {60, 70, 80, 90, 100};\n    int n = sizeof(marks) / sizeof(marks[0]);\n    int sum = 0;\n    for (int i = 0; i < n; i++) {\n        sum += marks[i];\n    }\n    printf("%.1f\\n", (double)sum / n);\n    return 0;\n}\n',
          explanation: "sizeof(marks) / sizeof(marks[0]) gives the element count, 5. The average is 80.0.",
        }),
        sec("Arrays and functions", [
          "When you pass an array to a function, only the address of its first element is passed, so the function cannot know the length. Pass the length as a second parameter. Because the function works on the original memory, changes it makes are visible to the caller.",
        ], {
          title: "Largest element",
          code: '#include <stdio.h>\n\nstatic int largest(const int a[], int n) {\n    int best = a[0];\n    for (int i = 1; i < n; i++) {\n        if (a[i] > best) {\n            best = a[i];\n        }\n    }\n    return best;\n}\n\nint main(void) {\n    int v[] = {4, 17, 9, 2};\n    printf("%d\\n", largest(v, 4));\n    return 0;\n}\n',
          explanation: "The length is passed explicitly. const promises the function will not modify the array. The output is 17.",
        }),
      ],
      takeaways: ["Indexes run from 0 to n-1 and C does not check them.", "Compute the length with sizeof only where the array is declared.", "Pass the length along with an array to a function."],
      mistakes: ["Using index n, one past the end.", "Using sizeof on an array parameter inside a function; it gives the pointer size.", "Reading uninitialised elements."],
      check: [
        q("For int a[5], which index is the last valid one?", ["5", "4", "6", "1"], 1, "Indexes start at 0, so a five-element array ends at 4."),
        q("What does C do when you write beyond the end of an array?", ["Always stops with an error message", "Nothing is checked, leading to undefined behaviour", "Resizes the array", "Fills with zeros"], 1, "C has no bounds checking, so the write can corrupt memory silently."),
        q("Why pass the length to a function that receives an array?", ["The array has no memory", "The function receives only an address and cannot know the size", "It is required by the compiler", "It makes the array const"], 1, "The array decays to a pointer to its first element, which carries no length."),
      ],
    }),
    lesson("arrays-2d", "Two-dimensional arrays", 12, {
      summary: "A 2D array is an array of rows, each row an array. It models tables, grids and matrices.",
      sections: [
        sec("Rows and columns", [
          "int m[3][4]; is three rows of four ints. Element m[i][j] is row i, column j. Memory holds the rows one after another (row-major order), so walking the inner index fastest is quicker and matches how data is laid out.",
          "Nested loops visit every element: the outer loop over rows and the inner loop over columns.",
        ], {
          title: "Sum of a matrix",
          code: '#include <stdio.h>\n\nint main(void) {\n    int m[2][3] = {{1, 2, 3}, {4, 5, 6}};\n    int sum = 0;\n    for (int i = 0; i < 2; i++) {\n        for (int j = 0; j < 3; j++) {\n            sum += m[i][j];\n        }\n    }\n    printf("%d\\n", sum);\n    return 0;\n}\n',
          explanation: "Two rows of three values are added together: 1+2+3+4+5+6 = 21.",
        }),
        sec("Transpose and passing 2D arrays", [
          "The transpose swaps rows and columns: t[j][i] = m[i][j]. When a function receives a 2D array, every dimension except the first must be given, because the compiler needs the row width to compute addresses, as in void show(int m[][3], int rows).",
        ], {
          title: "Transpose",
          code: '#include <stdio.h>\n\nint main(void) {\n    int m[2][3] = {{1, 2, 3}, {4, 5, 6}};\n    int t[3][2];\n    for (int i = 0; i < 2; i++) {\n        for (int j = 0; j < 3; j++) {\n            t[j][i] = m[i][j];\n        }\n    }\n    printf("%d %d\\n", t[2][0], t[2][1]);\n    return 0;\n}\n',
          explanation: "Row 2 of the transpose holds the third column of the original: 3 and 6.",
        }),
      ],
      takeaways: ["m[i][j] means row i, column j.", "Memory is row-major: rows are stored one after another.", "A function parameter needs every dimension except the first."],
      mistakes: ["Swapping row and column indexes.", "Omitting the column size in a function parameter.", "Going past the last row or column."],
      check: [
        q("In int m[3][4], how many elements are there?", ["7", "12", "3", "4"], 1, "Three rows times four columns gives twelve."),
        q("Which element is the first of the second row?", ["m[1][0]", "m[0][1]", "m[2][0]", "m[1][1]"], 0, "Indexes start at 0, so the second row is index 1 and the first column is 0."),
        q("What order is a C 2D array stored in?", ["Column-major", "Row-major", "Random", "Diagonal"], 1, "Row after row, so the last index changes fastest in memory."),
      ],
    }),
    lesson("search-sort", "Searching and sorting", 14, {
      summary: "Linear search checks each element; binary search halves the range in a sorted array. Simple sorts like bubble and selection sort teach how comparison and swapping work.",
      sections: [
        sec("Linear and binary search", [
          "Linear search walks the array until it finds the target, taking up to n steps. Binary search needs a sorted array: compare with the middle element, and discard the half that cannot contain the target. It takes about log2(n) steps, so a million elements need around twenty.",
          "Compute the middle as low + (high - low) / 2, which avoids overflow that (low + high) / 2 can cause with very large indexes.",
        ], {
          title: "Binary search",
          code: '#include <stdio.h>\n\nstatic int find(const int a[], int n, int target) {\n    int low = 0, high = n - 1;\n    while (low <= high) {\n        int mid = low + (high - low) / 2;\n        if (a[mid] == target) {\n            return mid;\n        }\n        if (a[mid] < target) {\n            low = mid + 1;\n        } else {\n            high = mid - 1;\n        }\n    }\n    return -1;\n}\n\nint main(void) {\n    int v[] = {2, 5, 8, 12, 16, 23};\n    printf("%d %d\\n", find(v, 6, 12), find(v, 6, 7));\n    return 0;\n}\n',
          explanation: "12 sits at index 3 and 7 is absent, so the program prints 3 -1.",
        }),
        sec("Bubble and selection sort", [
          "Bubble sort repeatedly compares neighbours and swaps them if they are out of order, so the largest value bubbles to the end each pass. Selection sort finds the smallest remaining value and puts it in place. Both take about n squared steps, fine for learning and small data.",
          "Real programs use qsort from <stdlib.h> or a better algorithm such as merge sort. Knowing the simple sorts makes those easier to understand.",
        ], {
          title: "Bubble sort",
          code: '#include <stdio.h>\n\nint main(void) {\n    int a[] = {5, 1, 4, 2, 8};\n    int n = 5;\n    for (int pass = 0; pass < n - 1; pass++) {\n        for (int i = 0; i < n - 1 - pass; i++) {\n            if (a[i] > a[i + 1]) {\n                int tmp = a[i];\n                a[i] = a[i + 1];\n                a[i + 1] = tmp;\n            }\n        }\n    }\n    for (int i = 0; i < n; i++) {\n        printf("%d ", a[i]);\n    }\n    printf("\\n");\n    return 0;\n}\n',
          explanation: "Each pass pushes the largest remaining value to the right. The output is 1 2 4 5 8.",
        }),
      ],
      takeaways: ["Binary search needs sorted data and takes about log2(n) steps.", "Bubble and selection sort take about n squared steps.", "Use low + (high - low) / 2 for the middle index."],
      mistakes: ["Running binary search on unsorted data.", "An off-by-one in low and high, causing an infinite loop.", "Forgetting the temporary variable when swapping."],
      check: [
        q("What does binary search require?", ["A sorted array", "A 2D array", "A string", "At least 1000 elements"], 0, "Discarding half the range only works if the order is known."),
        q("Roughly how many comparisons does binary search need for 1,000,000 sorted elements?", ["About 20", "About 1,000", "About 500,000", "1,000,000"], 0, "Each step halves the range, and log2(1,000,000) is about 20."),
        q("What is the time of bubble sort as n grows?", ["Proportional to n", "Proportional to n squared", "Constant", "Proportional to log n"], 1, "Two nested loops over the data give about n squared steps."),
      ],
    }),
  ],
};
