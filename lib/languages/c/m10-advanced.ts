import { lesson, q, sec, type TrackModule } from "../types";

export const advanced: TrackModule = {
  key: "c-advanced",
  title: "Bits, data structures and debugging",
  summary: "Work with individual bits, build a linked list from scratch, and find bugs systematically.",
  lessons: [
    lesson("bitwise", "Bitwise operators", 12, {
      summary: "Bitwise operators work on the individual bits of integers. They are fast, common in systems code, and a favourite of interview questions.",
      sections: [
        sec("AND, OR, XOR, NOT and shifts", [
          "& keeps bits set in both operands, | keeps bits set in either, ^ keeps bits that differ, and ~ flips every bit. x << n shifts bits left by n places, which multiplies by 2 to the power n; x >> n shifts right and divides.",
          "Do not confuse & with &&. The first works on bits and always evaluates both sides; the second is a logical test that short-circuits.",
        ], {
          title: "Testing and setting a bit",
          code: '#include <stdio.h>\n\nint main(void) {\n    unsigned x = 0;\n    x |= 1u << 3;\n    int bit3 = (x >> 3) & 1u;\n    printf("%u %d\\n", x, bit3);\n    return 0;\n}\n',
          explanation: "1u << 3 is 8, OR sets that bit, and shifting right then masking with 1 reads it back. Output: 8 1.",
        }),
        sec("Classic tricks", [
          "x & (x - 1) clears the lowest set bit, so repeating it until x is zero counts the bits. A number is a power of two exactly when it is positive and x & (x - 1) is zero. XOR of a value with itself is zero, so XOR-ing a list finds the one element that appears an odd number of times.",
        ], {
          title: "Counting set bits",
          code: '#include <stdio.h>\n\nint main(void) {\n    unsigned x = 11u;\n    int count = 0;\n    while (x != 0) {\n        x &= x - 1;\n        count++;\n    }\n    printf("%d\\n", count);\n    return 0;\n}\n',
          explanation: "Each pass removes one set bit; binary 1011 (11) has three, so the output is 3.",
        }),
      ],
      takeaways: ["& | ^ ~ work bit by bit; << and >> shift.", "x & (x - 1) clears the lowest set bit.", "Use unsigned types for shifts and masks."],
      mistakes: ["Using & where && is meant.", "Shifting a negative signed value or shifting by too many places.", "Forgetting operator precedence: use parentheses around bit tests."],
      check: [
        q("What is 5 & 3?", ["1", "7", "2", "6"], 0, "0101 AND 0011 is 0001, which is 1."),
        q("What does x << 2 do for a non-negative x that does not overflow?", ["Divides by 4", "Multiplies by 4", "Adds 2", "Squares x"], 1, "Each left shift doubles the value."),
        q("What does x & (x - 1) do?", ["Clears the lowest set bit", "Sets all bits", "Negates x", "Doubles x"], 0, "Subtracting one flips the lowest set bit and the zeros below it, so the AND clears that bit."),
      ],
    }),
    lesson("linked-list", "Building a linked list", 16, {
      summary: "A linked list stores each item in a node that points to the next. It is the first data structure that needs structs, pointers and dynamic memory together.",
      sections: [
        sec("Nodes and insertion", [
          "A node holds a value and a pointer to the next node; the list is just a pointer to the first one, the head, and the last node points to NULL. Inserting at the front takes constant time: make a node, point its next at the old head, and make it the new head.",
        ], {
          title: "Push and print",
          code: '#include <stdio.h>\n#include <stdlib.h>\n\ntypedef struct Node {\n    int value;\n    struct Node *next;\n} Node;\n\nstatic Node *push(Node *head, int value) {\n    Node *n = malloc(sizeof *n);\n    if (n == NULL) {\n        return head;\n    }\n    n->value = value;\n    n->next = head;\n    return n;\n}\n\nint main(void) {\n    Node *head = NULL;\n    for (int i = 1; i <= 3; i++) {\n        head = push(head, i);\n    }\n    for (Node *p = head; p != NULL; p = p->next) {\n        printf("%d ", p->value);\n    }\n    printf("\\n");\n    while (head != NULL) {\n        Node *next = head->next;\n        free(head);\n        head = next;\n    }\n    return 0;\n}\n',
          explanation: "Each push puts the new node in front, so the list reads 3 2 1. The last loop frees every node, saving the next pointer before freeing.",
        }),
        sec("Traversal, search and reversal", [
          "To traverse, follow next pointers until NULL. To reverse in place, walk the list with three pointers (previous, current, next) and flip each link as you go. Always read next before changing it, or you lose the rest of the list.",
        ], {
          title: "Reversing a list",
          code: '#include <stdio.h>\n#include <stdlib.h>\n\ntypedef struct Node {\n    int value;\n    struct Node *next;\n} Node;\n\nstatic Node *reverse(Node *head) {\n    Node *prev = NULL;\n    while (head != NULL) {\n        Node *next = head->next;\n        head->next = prev;\n        prev = head;\n        head = next;\n    }\n    return prev;\n}\n\nint main(void) {\n    Node c = {3, NULL}, b = {2, &c}, a = {1, &b};\n    Node *h = reverse(&a);\n    printf("%d %d %d\\n", h->value, h->next->value, h->next->next->value);\n    return 0;\n}\n',
          explanation: "The nodes here live on the stack, so nothing is freed. After reversal the order is 3 2 1.",
        }),
      ],
      takeaways: ["A list is a head pointer plus nodes linked by next.", "Insert at the front in constant time.", "Save next before you change or free a node."],
      mistakes: ["Freeing a node and then reading its next field.", "Losing the head pointer and leaking the list.", "Forgetting the empty-list case where head is NULL."],
      check: [
        q("How does a linked list mark its end?", ["A special value", "The last node's next is NULL", "A length stored in the head", "A zero node"], 1, "NULL in next means there is no further node."),
        q("What must you do before freeing a node you are iterating over?", ["Nothing", "Save its next pointer", "Set it to NULL", "Reverse the list"], 1, "After free you must not read the node, so keep next first."),
        q("How long does inserting at the head take?", ["Proportional to the list length", "Constant time", "Logarithmic", "Quadratic"], 1, "Only a couple of pointer assignments are needed."),
      ],
    }),
    lesson("debugging", "Debugging C programs", 12, {
      summary: "Debugging is a skill with a method: reproduce the bug, shrink it, look at real values, and fix the cause rather than the symptom.",
      sections: [
        sec("Reading the evidence", [
          "Start from what you can see. Compile with -Wall -Wextra -g so the compiler warns you and the debugger has line information. A segmentation fault means the program touched memory it should not have; the fix is nearly always a bad pointer, an out-of-range index or a missing allocation check.",
          "Add printf statements to print the actual values of the variables involved, to stderr so they appear immediately. Compare what you expect with what you see; the first place they differ is where the bug lives.",
        ], {
          title: "Tracing a loop",
          code: '#include <stdio.h>\n\nint main(void) {\n    int a[3] = {4, 5, 6};\n    int total = 0;\n    for (int i = 0; i < 3; i++) {\n        total += a[i];\n        fprintf(stderr, "i=%d total=%d\\n", i, total);\n    }\n    printf("%d\\n", total);\n    return 0;\n}\n',
          explanation: "The trace on stderr shows total after each step: 4, 9, 15. The final result printed is 15.",
        }),
        sec("Tools: gdb, sanitizers and valgrind", [
          "gdb lets you run the program under control: break main, run, next, step, print variable and backtrace show where it crashed. -fsanitize=address,undefined catches out-of-range access and undefined behaviour at run time. valgrind reports leaks and invalid reads on Linux.",
          "Shrink the failing case to the smallest input that still fails, change one thing at a time, and keep notes. When you find the cause, add a test so it stays fixed.",
        ]),
      ],
      takeaways: ["Compile with -Wall -Wextra -g while developing.", "Print actual values and find where expectation and reality first differ.", "Use gdb, AddressSanitizer or valgrind for crashes and memory errors."],
      mistakes: ["Changing several things at once and not knowing which fixed it.", "Fixing the symptom instead of the cause.", "Ignoring compiler warnings."],
      check: [
        q("What does a segmentation fault usually indicate?", ["A syntax error", "Access to memory the program must not use", "A missing header", "A slow loop"], 1, "Typically a bad pointer, out-of-range index or use after free."),
        q("Which flag adds debug information for gdb?", ["-g", "-O3", "-s", "-lm"], 0, "-g records line numbers and variable names in the executable."),
        q("What is a good first step when a bug appears?", ["Rewrite the whole program", "Reproduce it with the smallest failing input", "Delete the tests", "Turn off warnings"], 1, "A small reproducible case makes the cause far easier to find."),
      ],
    }),
  ],
};
