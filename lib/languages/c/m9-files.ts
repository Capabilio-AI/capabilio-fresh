import { lesson, q, sec, type TrackModule } from "../types";

export const files: TrackModule = {
  key: "c-files",
  title: "Files, preprocessor and bigger programs",
  summary: "Read and write files, use the preprocessor well, and split a program across several source files.",
  lessons: [
    lesson("file-io", "File input and output", 12, {
      summary: "A FILE pointer connects your program to a file. fopen opens it, fprintf and fgets move text, and fclose finishes the job.",
      sections: [
        sec("Opening, writing and closing", [
          "fopen(path, mode) returns a FILE pointer or NULL on failure. Modes include \"r\" to read, \"w\" to write (erasing the old contents) and \"a\" to append. Always test for NULL; a missing file or a permission problem is normal, not exceptional.",
          "fprintf writes formatted text to a file the same way printf writes to the screen. Call fclose when done so buffered data is flushed to disk.",
        ], {
          title: "Write then read back",
          code: '#include <stdio.h>\n\nint main(void) {\n    FILE *f = fopen("scores.tmp", "w");\n    if (f == NULL) {\n        return 1;\n    }\n    fprintf(f, "%d %d\\n", 40, 2);\n    fclose(f);\n\n    f = fopen("scores.tmp", "r");\n    if (f == NULL) {\n        return 1;\n    }\n    int a, b;\n    if (fscanf(f, "%d %d", &a, &b) == 2) {\n        printf("%d\\n", a + b);\n    }\n    fclose(f);\n    remove("scores.tmp");\n    return 0;\n}\n',
          explanation: "Two numbers are written, the file is closed and reopened for reading, then added. Output: 42. remove deletes the temporary file.",
        }),
        sec("Reading line by line", [
          "fgets(buf, size, f) reads one line and returns NULL at the end of the file. Looping while fgets succeeds is the standard way to process a text file, because it never overruns the buffer. For binary data use fread and fwrite with the \"rb\" and \"wb\" modes.",
        ]),
      ],
      takeaways: ["Check fopen for NULL.", "Close every file you open.", "Loop on fgets to read a file safely line by line."],
      mistakes: ["Opening with \"w\" and erasing a file you meant to read.", "Forgetting fclose, losing buffered output.", "Using feof as the loop condition instead of the read's return value."],
      check: [
        q("What does fopen return on failure?", ["0 as an int", "NULL", "-1", "An empty file"], 1, "A null FILE pointer signals that the file could not be opened."),
        q("Which mode adds to the end of a file without erasing it?", ["r", "w", "a", "x"], 2, "\"a\" appends; \"w\" truncates the file first."),
        q("Why call fclose?", ["It deletes the file", "It flushes buffered data and releases the file", "It renames the file", "It is optional and has no effect"], 1, "Output may stay in a buffer until the file is closed."),
      ],
    }),
    lesson("preprocessor", "The preprocessor and macros", 10, {
      summary: "The preprocessor edits your source text before compilation. It handles includes, constants, macros and conditional compilation.",
      sections: [
        sec("#define and function-like macros", [
          "#define NAME value replaces NAME with the text value everywhere. A macro with parameters, such as #define SQUARE(x) ((x) * (x)), is also pure text substitution, so every parameter and the whole result need parentheses, and an argument with side effects, like SQUARE(i++), is evaluated more than once.",
          "Prefer const variables, enums and static inline functions to macros when you can; they are type-checked and behave predictably.",
        ], {
          title: "A macro with parentheses",
          code: '#include <stdio.h>\n\n#define SQUARE(x) ((x) * (x))\n\nint main(void) {\n    printf("%d\\n", SQUARE(2 + 3));\n    return 0;\n}\n',
          explanation: "With full parentheses the argument expands to ((2 + 3) * (2 + 3)) = 25. Without them the answer would be 11.",
        }),
        sec("Conditional compilation and include guards", [
          "#ifdef, #ifndef and #if include or skip code at compile time, useful for debug output or platform differences. In a header file, wrap the contents in #ifndef NAME_H, #define NAME_H and #endif so that including it twice does no harm.",
        ], {
          title: "Debug output only when asked",
          code: '#include <stdio.h>\n\n#ifdef DEBUG\n#define LOG(msg) printf("debug: %s\\n", msg)\n#else\n#define LOG(msg) ((void)0)\n#endif\n\nint main(void) {\n    LOG("starting");\n    printf("done\\n");\n    return 0;\n}\n',
          explanation: "Without -DDEBUG the LOG call vanishes, so only done is printed. Compile with -DDEBUG to see the extra line.",
        }),
      ],
      takeaways: ["Macros are text substitution; parenthesise parameters and results.", "Include guards stop a header from being processed twice.", "Prefer const, enum and inline functions when they fit."],
      mistakes: ["Missing parentheses in a macro, giving wrong precedence.", "Passing an expression with side effects to a macro.", "Forgetting include guards in a header."],
      check: [
        q("Why parenthesise macro parameters?", ["To make them const", "To keep operator precedence correct after text substitution", "To speed up compilation", "It is required syntax"], 1, "The preprocessor pastes text, so precedence can change without parentheses."),
        q("What do include guards prevent?", ["Linking errors from missing files", "A header being included twice in one compilation", "Stack overflow", "Unused variables"], 1, "They stop duplicate definitions when a header arrives through several routes."),
        q("When does the preprocessor run?", ["At run time", "Before compilation proper", "After linking", "Only in debug builds"], 1, "It transforms the source text before the compiler sees it."),
      ],
    }),
    lesson("multi-file", "Splitting a program into several files", 12, {
      summary: "Real programs span many files: headers declare what is available and source files define it. Understanding this makes linker errors make sense.",
      sections: [
        sec("Headers and source files", [
          "A header (.h) holds declarations: function prototypes, types and constants that other files need. A source file (.c) holds the definitions. Other files #include the header with quotes, for example #include \"mathutil.h\", and the linker joins the compiled pieces.",
          "Compile everything with a single command such as gcc main.c mathutil.c -o app, or build each file into an object file and link them, which is what a Makefile automates.",
        ], {
          title: "What a header contains",
          code: '#include <stdio.h>\n\n/* in a real project the next three lines would live in mathutil.h */\n#ifndef MATHUTIL_H\n#define MATHUTIL_H\nint cube(int x);\n#endif\n\n/* and this would be in mathutil.c */\nint cube(int x) {\n    return x * x * x;\n}\n\nint main(void) {\n    printf("%d\\n", cube(3));\n    return 0;\n}\n',
          explanation: "The declaration comes first, then the definition, then the use. Split across files, the first block is the header and the second is the source. Output: 27.",
        }),
        sec("Reading linker errors", [
          "An undefined reference means a function was declared but its definition was never linked in, usually because a .c file was left off the command. A multiple definition error means the same function or variable was defined in two places, often because a definition was put in a header.",
        ]),
      ],
      takeaways: ["Headers declare; source files define.", "Add every .c file to the build or the linker reports undefined references.", "Never put function definitions in a header."],
      mistakes: ["Defining a global variable in a header included by several files.", "Forgetting an include guard.", "Leaving a .c file out of the compile command."],
      check: [
        q("What belongs in a header file?", ["Function prototypes and shared types", "All the program's logic", "The main function only", "Compiled machine code"], 0, "Headers carry declarations that several source files share."),
        q("What does 'undefined reference' usually mean?", ["A syntax error", "A declared function has no linked definition", "A missing semicolon", "A full disk"], 1, "The linker could not find the function's compiled code."),
        q("How do you include your own header?", ["#include <file.h>", "#include \"file.h\"", "#import file.h", "include file.h"], 1, "Quotes search the project directory first; angle brackets are for system headers."),
      ],
    }),
  ],
};
