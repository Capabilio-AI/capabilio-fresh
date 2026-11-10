import { lesson, q, sec, type TrackModule } from "../types";

export const structs: TrackModule = {
  key: "c-structs",
  title: "Structures, unions and enums",
  summary: "Group related data into your own types, store collections of records, and name constants.",
  lessons: [
    lesson("structures", "Structures and typedef", 12, {
      summary: "A struct bundles several variables, possibly of different types, into one unit. typedef gives the type a shorter name.",
      sections: [
        sec("Defining and using a struct", [
          "struct Student { char name[20]; int roll; float cgpa; }; describes the fields. A variable of that type holds all of them, and you reach a field with the dot operator. typedef lets you write Student instead of struct Student.",
          "Assigning one struct to another copies every field, including arrays inside it. Passing a struct to a function also copies it, so large structs are usually passed by pointer.",
        ], {
          title: "A student record",
          code: '#include <stdio.h>\n#include <string.h>\n\ntypedef struct {\n    char name[20];\n    int roll;\n    double cgpa;\n} Student;\n\nint main(void) {\n    Student s = {"", 7, 8.5};\n    strcpy(s.name, "Asha");\n    printf("%s %d %.1f\\n", s.name, s.roll, s.cgpa);\n    return 0;\n}\n',
          explanation: "The braces initialise the fields in order; strcpy fills the name array. Output: Asha 7 8.5.",
        }),
        sec("Struct pointers and the arrow operator", [
          "When you hold a pointer to a struct, use p->field, which means (*p).field. This is how functions modify a record in place without copying it.",
        ], {
          title: "Updating through a pointer",
          code: '#include <stdio.h>\n\ntypedef struct {\n    int roll;\n    double cgpa;\n} Student;\n\nstatic void bump(Student *s) {\n    s->cgpa += 0.5;\n}\n\nint main(void) {\n    Student s = {1, 7.5};\n    bump(&s);\n    printf("%.1f\\n", s.cgpa);\n    return 0;\n}\n',
          explanation: "bump receives the address of s and changes its field with the arrow operator. Output: 8.0.",
        }),
      ],
      takeaways: ["A struct groups related fields into one type.", "Use . on a struct and -> on a pointer to a struct.", "Pass large structs by pointer, and use const if the function only reads."],
      mistakes: ["Using . when the variable is a pointer.", "Assigning a string to a char array field with = instead of strcpy.", "Forgetting the semicolon after the closing brace of a struct definition."],
      check: [
        q("Which operator accesses a field through a pointer to a struct?", [".", "->", "&", "::"], 1, "p->field is shorthand for (*p).field."),
        q("What does typedef do?", ["Allocates memory", "Gives a type a new name", "Declares a variable", "Imports a header"], 1, "It creates an alias so you can use the shorter name."),
        q("What happens when you pass a struct to a function by value?", ["Only its address is passed", "All of its fields are copied", "It becomes const", "It is freed afterward"], 1, "A by-value parameter is a full copy."),
      ],
    }),
    lesson("struct-arrays", "Arrays of structures and records", 12, {
      summary: "Most real programs handle many records: an array of structs plus a loop to search, total or sort them.",
      sections: [
        sec("A table of records", [
          "An array of structs works like an array of any type, with each element being a whole record. Loop over it and use the dot operator on each element. qsort from <stdlib.h> sorts such an array if you give it a comparison function.",
        ], {
          title: "Best score",
          code: '#include <stdio.h>\n\ntypedef struct {\n    int roll;\n    int score;\n} Entry;\n\nint main(void) {\n    Entry list[] = {{1, 72}, {2, 91}, {3, 85}};\n    int best = 0;\n    for (int i = 1; i < 3; i++) {\n        if (list[i].score > list[best].score) {\n            best = i;\n        }\n    }\n    printf("%d %d\\n", list[best].roll, list[best].score);\n    return 0;\n}\n',
          explanation: "The loop remembers the index of the highest score. Roll 2 scored 91, so the output is 2 91.",
        }),
        sec("Sorting records with qsort", [
          "qsort takes the array, element count, element size and a function that compares two elements through void pointers. Returning a negative, zero or positive number tells qsort the order. Avoid subtracting integers in the comparison, because the result can overflow; compare with < and > instead.",
        ], {
          title: "Sorting by score",
          code: '#include <stdio.h>\n#include <stdlib.h>\n\ntypedef struct {\n    int roll;\n    int score;\n} Entry;\n\nstatic int by_score(const void *a, const void *b) {\n    const Entry *x = a, *y = b;\n    return (x->score > y->score) - (x->score < y->score);\n}\n\nint main(void) {\n    Entry list[] = {{1, 72}, {2, 91}, {3, 85}};\n    qsort(list, 3, sizeof list[0], by_score);\n    printf("%d %d %d\\n", list[0].roll, list[1].roll, list[2].roll);\n    return 0;\n}\n',
          explanation: "The comparison returns -1, 0 or 1 without subtracting. Lowest score first gives rolls 1 3 2.",
        }),
      ],
      takeaways: ["An array of structs holds many records.", "qsort needs a comparison function over const void pointers.", "Compare with < and > rather than subtracting."],
      mistakes: ["Subtracting fields in a comparison function and overflowing.", "Passing the wrong element size to qsort.", "Mixing up the index of a record and its field values."],
      check: [
        q("How do you read the score of the third element of Entry list[]?", ["list.score[2]", "list[2].score", "list->score[2]", "score(list, 2)"], 1, "Index the array first, then access the field."),
        q("What does a qsort comparison function return?", ["true or false", "A negative, zero or positive int", "The larger element", "The index"], 1, "The sign tells qsort which element goes first."),
        q("Why avoid returning a - b in a comparator for ints?", ["It is slower", "The subtraction can overflow", "It does not compile", "It changes the array"], 1, "Large values of opposite sign can overflow int."),
      ],
    }),
    lesson("unions-enums", "Unions and enums", 10, {
      summary: "An enum names a set of integer constants. A union stores one of several types in the same memory.",
      sections: [
        sec("Enumerations", [
          "enum Day { MON, TUE, WED }; defines named constants numbered from 0 unless you set values. Enums make code self-explanatory compared with bare numbers and work well with switch.",
        ], {
          title: "Named states",
          code: '#include <stdio.h>\n\nenum State { IDLE, RUNNING = 5, DONE };\n\nint main(void) {\n    enum State s = DONE;\n    printf("%d %d\\n", IDLE, s);\n    return 0;\n}\n',
          explanation: "IDLE is 0, RUNNING is set to 5 and DONE continues as 6. Output: 0 6.",
        }),
        sec("Unions", [
          "All members of a union share the same memory, and its size is that of the largest member. Only the member most recently written is meaningful. Unions suit variant data and low-level work, and are normally paired with a tag that records which member is in use.",
        ], {
          title: "Shared storage",
          code: '#include <stdio.h>\n\nunion Value {\n    int i;\n    double d;\n};\n\nint main(void) {\n    union Value v;\n    v.d = 2.5;\n    printf("%zu %.1f\\n", sizeof v, v.d);\n    return 0;\n}\n',
          explanation: "The union is as large as its biggest member, 8 bytes, and holds the double just stored. Output: 8 2.5.",
        }),
      ],
      takeaways: ["Enum constants count up from 0 unless set.", "A union's members overlap in one block of memory.", "Keep a tag next to a union to know which member is valid."],
      mistakes: ["Reading a union member other than the one last written.", "Assuming enum values are strings.", "Forgetting enum values continue from the last explicit number."],
      check: [
        q("What is the value of the first enum constant by default?", ["1", "0", "-1", "It must be set"], 1, "Numbering starts at 0 unless you assign a value."),
        q("How are union members stored?", ["In separate memory", "Sharing the same memory", "In a linked list", "Only on the heap"], 1, "They overlap, so only one holds a meaningful value at a time."),
        q("What size is a union of an int and a double?", ["The sum of both", "The size of the largest member", "Always 1", "The size of the int"], 1, "Storage is shared and sized for the largest member (plus any padding)."),
      ],
    }),
  ],
};
