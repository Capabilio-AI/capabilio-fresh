import { lesson, q, sec, type TrackModule } from "../types";

export const pointers: TrackModule = {
  key: "c-pointers",
  title: "Pointers",
  summary: "The idea that sets C apart: variables have addresses, and a pointer holds one. Pointers, arrays, parameters and function pointers.",
  lessons: [
    lesson("pointer-basics", "Addresses and pointers", 14, {
      summary: "Every variable lives at an address in memory. A pointer is a variable that stores such an address; the & operator gets an address and * follows one.",
      sections: [
        sec("Declaring and using a pointer", [
          "int *p; declares p as a pointer to int. &x is the address of x, so p = &x; makes p point at x. *p, the dereference, means the thing p points to: reading *p reads x, and writing *p = 9; changes x.",
          "A pointer that points nowhere should hold NULL. Dereferencing NULL or an uninitialised pointer crashes the program or corrupts memory, so check before you dereference.",
        ], {
          title: "Changing a variable through a pointer",
          code: '#include <stdio.h>\n\nint main(void) {\n    int x = 10;\n    int *p = &x;\n    *p = 25;\n    printf("%d %d\\n", x, *p);\n    return 0;\n}\n',
          explanation: "p holds the address of x, so writing through *p changes x. Both print 25.",
        }),
        sec("Why pointers matter", [
          "Pointers let a function change its caller's variables, let you build structures that grow at run time, and let you walk through memory without copying it. The cost is that you are now responsible for pointing at valid memory.",
          "Printing an address uses %p with the pointer cast to void *. The actual number changes on every run, so never write code that depends on it.",
        ]),
      ],
      takeaways: ["&x gives the address of x; *p gives the value at p.", "A pointer holds an address, not the data itself.", "Set unused pointers to NULL and never dereference NULL."],
      mistakes: ["Dereferencing a pointer that was never assigned.", "Confusing p (the address) with *p (the value).", "Declaring int *a, b; and expecting b to be a pointer."],
      check: [
        q("What does the & operator give?", ["The value of a variable", "The address of a variable", "A copy of a variable", "The size of a variable"], 1, "& takes the address of its operand."),
        q("After int x = 4; int *p = &x; *p = 7;, what is x?", ["4", "7", "The address of x", "Undefined"], 1, "Writing through the pointer modifies the variable it points at."),
        q("What should a pointer that currently points nowhere hold?", ["0 as an int variable", "NULL", "-1", "Its own address"], 1, "NULL is the defined null pointer value and can be tested."),
      ],
    }),
    lesson("pointers-arrays", "Pointers and arrays", 14, {
      summary: "An array name acts like a pointer to its first element, and pointer arithmetic moves in whole elements. That is why a[i] and *(a + i) mean the same thing.",
      sections: [
        sec("Array names and pointer arithmetic", [
          "In most expressions the name of an array becomes the address of its first element. Adding 1 to an int pointer moves it forward by sizeof(int) bytes, to the next element, not by one byte.",
          "So a[i] is defined as *(a + i). Subtracting two pointers into the same array gives the number of elements between them.",
        ], {
          title: "Walking an array with a pointer",
          code: '#include <stdio.h>\n\nint main(void) {\n    int a[4] = {3, 6, 9, 12};\n    int *p = a;\n    int sum = 0;\n    for (int i = 0; i < 4; i++) {\n        sum += *(p + i);\n    }\n    printf("%d %d\\n", sum, *(a + 2));\n    return 0;\n}\n',
          explanation: "p starts at a[0]; *(p + i) reads each element. The total is 30 and *(a + 2) is a[2], 9.",
        }),
        sec("Arrays are not pointers", [
          "An array owns its storage and sizeof gives the whole array. A pointer is one address, and sizeof gives the address size. When an array is passed to a function it turns into a pointer to its first element, which is why the length must travel separately.",
        ], {
          title: "sizeof differs",
          code: '#include <stdio.h>\n\nint main(void) {\n    int a[10];\n    int *p = a;\n    printf("%zu %zu\\n", sizeof(a), sizeof(p));\n    return 0;\n}\n',
          explanation: "The array takes 40 bytes with 4-byte ints, but the pointer is 8 bytes on a 64-bit system. Output: 40 8.",
        }),
      ],
      takeaways: ["a[i] is the same as *(a + i).", "Adding 1 to a pointer moves by one whole element.", "An array passed to a function becomes a pointer; its length is lost."],
      mistakes: ["Thinking p + 1 adds one byte.", "Using sizeof on an array parameter to find its length.", "Moving a pointer outside the array and dereferencing it."],
      check: [
        q("Which expression equals a[3]?", ["*(a + 3)", "*a + 3", "&a + 3", "a * 3"], 0, "Pointer arithmetic scales by element size, so *(a + 3) is the fourth element."),
        q("If p points to an int, p + 1 points...", ["One byte further", "To the next int", "To the previous int", "To NULL"], 1, "Arithmetic moves by sizeof(int) bytes."),
        q("Inside a function with parameter int a[], sizeof(a) gives...", ["The array size", "The size of a pointer", "Zero", "The number of elements"], 1, "The parameter is really an int *, so you get the pointer's size."),
      ],
    }),
    lesson("pointers-functions", "Pointers and functions", 14, {
      summary: "Passing an address lets a function change its caller's data and return more than one result. Function pointers let you pass behaviour itself.",
      sections: [
        sec("Pass by address", [
          "C passes by value, but passing a pointer copies the address, and the callee can then write through it. This is how scanf stores into your variables and how a swap function works.",
        ], {
          title: "Swapping two values",
          code: '#include <stdio.h>\n\nstatic void swap(int *a, int *b) {\n    int tmp = *a;\n    *a = *b;\n    *b = tmp;\n}\n\nint main(void) {\n    int x = 1, y = 2;\n    swap(&x, &y);\n    printf("%d %d\\n", x, y);\n    return 0;\n}\n',
          explanation: "swap receives the addresses of x and y and exchanges what is stored there. Output: 2 1.",
        }),
        sec("Returning several results", [
          "A function can return only one value, but output parameters let it hand back more: pass pointers for the extra results. Use const on a pointer parameter, as in const int *, to promise that the function will only read the data.",
        ], {
          title: "Minimum and maximum together",
          code: '#include <stdio.h>\n\nstatic void min_max(const int *a, int n, int *lo, int *hi) {\n    *lo = *hi = a[0];\n    for (int i = 1; i < n; i++) {\n        if (a[i] < *lo) *lo = a[i];\n        if (a[i] > *hi) *hi = a[i];\n    }\n}\n\nint main(void) {\n    int v[] = {7, 2, 9, 4};\n    int lo, hi;\n    min_max(v, 4, &lo, &hi);\n    printf("%d %d\\n", lo, hi);\n    return 0;\n}\n',
          explanation: "The function fills lo and hi through their addresses. Output: 2 9.",
        }),
        sec("Function pointers", [
          "A function has an address too. A pointer such as int (*op)(int, int) can hold any function with that signature, which lets you choose behaviour at run time. qsort uses one to let you decide how elements are compared.",
        ], {
          title: "Choosing an operation",
          code: '#include <stdio.h>\n\nstatic int add(int a, int b) { return a + b; }\nstatic int mul(int a, int b) { return a * b; }\n\nint main(void) {\n    int (*op)(int, int) = mul;\n    printf("%d\\n", op(6, 7));\n    op = add;\n    printf("%d\\n", op(6, 7));\n    return 0;\n}\n',
          explanation: "The same pointer first calls mul, then add, giving 42 and then 13.",
        }),
      ],
      takeaways: ["Pass &variable so a function can modify it.", "Output parameters let a function return several results.", "A function pointer chooses behaviour at run time."],
      mistakes: ["Passing x instead of &x to a function that expects int *.", "Forgetting to dereference with * inside the function.", "Mixing up the declaration of a function pointer, whose parentheses matter."],
      check: [
        q("How can a function change an int in its caller?", ["Return it only", "Receive a pointer to it", "Declare it static", "Use a second main"], 1, "With the address, the function can write to the caller's variable."),
        q("What does const int *p promise?", ["p cannot change", "The int cannot be changed through p", "p is NULL", "The int is a constant at compile time"], 1, "The pointed-to value is read-only through that pointer."),
        q("What is int (*op)(int, int)?", ["A function returning a pointer", "A pointer to a function taking two ints and returning an int", "An array of two ints", "A syntax error"], 1, "The parentheses around *op make it a pointer to a function."),
      ],
    }),
    lesson("pointer-pitfalls", "Pointer pitfalls: dangling, wild and double pointers", 12, {
      summary: "Most serious C bugs are pointer bugs. Knowing the main kinds helps you avoid them and recognise them when a program crashes.",
      sections: [
        sec("Wild, null and dangling pointers", [
          "A wild pointer was never initialised and holds a random address. A null pointer holds NULL and crashes if dereferenced. A dangling pointer once pointed at valid memory that has since gone away, for example a local variable after its function returned or memory that was freed.",
          "All three cause undefined behaviour: the program may crash, print nonsense, or appear to work until the day it does not.",
        ], {
          title: "Safe initialisation",
          code: '#include <stdio.h>\n\nint main(void) {\n    int value = 5;\n    int *p = NULL;\n    if (p == NULL) {\n        p = &value;\n    }\n    printf("%d\\n", *p);\n    return 0;\n}\n',
          explanation: "The pointer starts as NULL, is tested, then given a real address before use. Output: 5.",
        }),
        sec("Pointer to pointer", [
          "A pointer can point at another pointer: int **pp = &p; lets a function change which address the caller's pointer holds. You will meet this when a function must allocate memory for its caller, and in arrays of strings, where each element is a char pointer.",
        ]),
        sec("Habits that prevent bugs", [
          "Initialise every pointer, set a pointer to NULL after freeing it, never return the address of a local variable, and keep array indexes in range. Tools such as AddressSanitizer find many of these mistakes for you; the debugging lesson shows how to use it.",
        ]),
      ],
      takeaways: ["A pointer must hold a valid address before it is dereferenced.", "A dangling pointer refers to memory that no longer belongs to you.", "Set pointers to NULL when they point nowhere."],
      mistakes: ["Returning the address of a local variable.", "Using memory after free.", "Dereferencing without checking for NULL."],
      check: [
        q("What is a dangling pointer?", ["A pointer to NULL", "A pointer to memory that is no longer valid", "A pointer to a pointer", "A const pointer"], 1, "The memory it refers to has been freed or has gone out of scope."),
        q("What is a wild pointer?", ["One never initialised", "One equal to NULL", "One passed to free twice", "One declared static"], 0, "It holds an indeterminate address."),
        q("Which is a good habit after free(p)?", ["Dereference p to confirm", "Set p = NULL", "Call free(p) again", "Cast p to int"], 1, "Setting it to NULL makes accidental reuse easy to detect."),
      ],
    }),
  ],
};
