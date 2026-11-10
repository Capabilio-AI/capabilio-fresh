import { lesson, q, sec, type TrackModule } from "../types";

export const memory: TrackModule = {
  key: "c-memory",
  title: "Dynamic memory",
  summary: "Ask for memory at run time with malloc, resize it, give it back, and learn the bugs that come from getting that wrong.",
  lessons: [
    lesson("malloc-free", "malloc, calloc, realloc and free", 14, {
      summary: "Fixed arrays need their size at compile time. The heap lets a program request exactly the memory it needs while running, and it must give that memory back.",
      sections: [
        sec("Allocating and releasing", [
          "malloc(bytes) returns a pointer to that many uninitialised bytes, or NULL if memory is short. calloc(count, size) returns zeroed memory. Both live on the heap until you call free; unlike a local variable they do not disappear when the function returns.",
          "Always check for NULL, use sizeof of the element type in the size calculation, and call free exactly once for each successful allocation.",
        ], {
          title: "An array sized at run time",
          code: '#include <stdio.h>\n#include <stdlib.h>\n\nint main(void) {\n    int n = 5;\n    int *a = malloc(n * sizeof *a);\n    if (a == NULL) {\n        return 1;\n    }\n    for (int i = 0; i < n; i++) {\n        a[i] = i * i;\n    }\n    printf("%d\\n", a[4]);\n    free(a);\n    return 0;\n}\n',
          explanation: "sizeof *a keeps the size correct if the type changes. a[4] is 16. The memory is released with free.",
        }),
        sec("Growing with realloc", [
          "realloc(ptr, newBytes) resizes a block, possibly moving it, and returns the new address. Store the result in a temporary first: if it fails it returns NULL and the original block is still yours, so assigning directly to your only pointer would leak it.",
        ], {
          title: "Doubling safely",
          code: '#include <stdio.h>\n#include <stdlib.h>\n\nint main(void) {\n    int *a = calloc(2, sizeof *a);\n    if (a == NULL) {\n        return 1;\n    }\n    int *bigger = realloc(a, 4 * sizeof *a);\n    if (bigger == NULL) {\n        free(a);\n        return 1;\n    }\n    a = bigger;\n    a[3] = 42;\n    printf("%d\\n", a[3]);\n    free(a);\n    return 0;\n}\n',
          explanation: "realloc's result goes into a temporary pointer and is checked before replacing a. Output: 42.",
        }),
      ],
      takeaways: ["Check every allocation for NULL.", "Use sizeof *p so the size follows the type.", "Free each block once, and put realloc's result in a temporary first."],
      mistakes: ["Writing malloc(n) and forgetting to multiply by the element size.", "Assigning realloc's result straight to the only pointer.", "Forgetting to free, causing a memory leak."],
      check: [
        q("Which function gives zero-initialised memory?", ["malloc", "calloc", "free", "alloc"], 1, "calloc clears the block; malloc leaves it uninitialised."),
        q("How many times should you free one allocated block?", ["Zero", "Exactly once", "Twice", "Once per use"], 1, "Freeing twice is undefined; never freeing leaks the memory."),
        q("Why use a temporary pointer with realloc?", ["It is faster", "If realloc fails, the original pointer is not lost", "To avoid NULL", "It is required by the compiler"], 1, "On failure realloc returns NULL but leaves the old block intact."),
      ],
    }),
    lesson("memory-bugs", "Memory bugs: leaks, use-after-free and overflows", 14, {
      summary: "Memory errors are the most common cause of crashes and security holes in C. Learn their names, what they look like and how to catch them.",
      sections: [
        sec("The usual suspects", [
          "A leak is memory that is never freed; a long-running program slowly runs out. Use-after-free reads or writes a block after freeing it. A double free releases the same block twice and corrupts the allocator. A buffer overflow writes past the end of an array or block, damaging neighbouring data.",
          "All of these are undefined behaviour. They often seem to work in a small test and fail unpredictably in a bigger program, which makes them hard to debug by reading output alone.",
        ], {
          title: "A correct ownership pattern",
          code: '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\nstatic char *copy_text(const char *s) {\n    char *out = malloc(strlen(s) + 1);\n    if (out != NULL) {\n        strcpy(out, s);\n    }\n    return out;\n}\n\nint main(void) {\n    char *t = copy_text("hello");\n    if (t == NULL) {\n        return 1;\n    }\n    printf("%s\\n", t);\n    free(t);\n    t = NULL;\n    return 0;\n}\n',
          explanation: "The allocation is one byte longer than the text for the terminator. The caller owns the result, frees it once, then sets the pointer to NULL.",
        }),
        sec("Finding them", [
          "Compile with -fsanitize=address -g and run the program: AddressSanitizer reports leaks, overflows and use-after-free with the line numbers involved. On Linux, valgrind does a similar job. Decide who owns each allocation, and write that down in a comment.",
        ]),
      ],
      takeaways: ["Leak, use-after-free, double free and overflow are the four main memory bugs.", "Allocate strlen + 1 for a string copy.", "Run with -fsanitize=address to find them."],
      mistakes: ["Allocating strlen(s) without the extra byte for '\\0'.", "Using a pointer after free.", "Freeing memory that was not allocated with malloc."],
      check: [
        q("What is a memory leak?", ["Reading past an array", "Memory that is allocated but never freed", "Freeing twice", "Using NULL"], 1, "The program loses the ability to free the block, so it stays reserved."),
        q("How many bytes are needed to store a copy of a string with n characters?", ["n", "n + 1", "n - 1", "2n"], 1, "One extra byte holds the null terminator."),
        q("Which compiler flag enables AddressSanitizer?", ["-O3", "-fsanitize=address", "-Wall", "-pedantic"], 1, "It instruments memory accesses and reports errors at run time."),
      ],
    }),
  ],
};
