import { lesson, q, sec, type TrackModule } from "../types";

export const strings: TrackModule = {
  key: "c-strings",
  title: "Strings",
  summary: "C has no string type: a string is an array of characters ending in a zero byte. Learn to build, read and process them safely.",
  lessons: [
    lesson("char-arrays", "Strings as character arrays", 12, {
      summary: "A C string is a char array whose last element is the null character '\\0'. Every string function depends on that terminator.",
      sections: [
        sec("The null terminator", [
          "The literal \"cat\" occupies four bytes: 'c', 'a', 't' and '\\0'. Functions read until they meet the zero byte, so an array without one makes them run on into other memory.",
          "When you declare char name[10] = \"Ravi\"; the remaining bytes are zeroed. The array must be at least one byte longer than the text to hold the terminator.",
        ], {
          title: "Counting characters by hand",
          code: '#include <stdio.h>\n\nint main(void) {\n    char word[] = "capabilio";\n    int len = 0;\n    while (word[len] != \'\\0\') {\n        len++;\n    }\n    printf("%d\\n", len);\n    return 0;\n}\n',
          explanation: "The loop stops at the terminator, so the length is 9 and the terminator is not counted.",
        }),
        sec("Reading and printing strings", [
          "Use %s with printf. To read, scanf(\"%9s\", name) limits input to nine characters for a ten-byte array, and fgets(buf, sizeof buf, stdin) reads a full line including the newline. Always bound the read; an unbounded scanf(\"%s\") is a classic buffer overflow.",
        ], {
          title: "Reading a bounded word",
          code: '#include <stdio.h>\n\nint main(void) {\n    char name[10] = "";\n    if (scanf("%9s", name) == 1) {\n        printf("Hello, %s\\n", name);\n    }\n    return 0;\n}\n',
          explanation: "%9s stops after nine characters, leaving room for the terminator. With input 3 the program prints Hello, 3.",
        }),
      ],
      takeaways: ["A string is a char array ending in '\\0'.", "The array must have room for the terminator.", "Always bound string input with a width or fgets."],
      mistakes: ["Making the array exactly as long as the text, leaving no room for '\\0'.", "Using scanf(\"%s\") without a width.", "Comparing strings with == which compares addresses."],
      check: [
        q("How many bytes does the literal \"cat\" occupy?", ["3", "4", "5", "It depends"], 1, "Three characters plus the terminating zero byte."),
        q("What marks the end of a C string?", ["A newline", "A space", "The null character", "The length stored at the front"], 2, "Functions stop at the first '\\0'."),
        q("Why is scanf(\"%s\", buf) risky?", ["It is slow", "It can write past the end of buf", "It cannot read letters", "It needs a pointer to a pointer"], 1, "With no width limit, long input overflows the array."),
      ],
    }),
    lesson("string-h", "The string.h library", 12, {
      summary: "string.h provides the standard string operations. Knowing what each does, and which are unsafe, is a regular interview topic.",
      sections: [
        sec("Length, compare, copy and join", [
          "strlen(s) counts characters before the terminator. strcmp(a, b) returns 0 when the strings are equal, a negative number when a comes first alphabetically and a positive one otherwise. strcpy copies and strcat appends, but neither checks the destination size.",
          "Prefer snprintf(dest, sizeof dest, ...) to build text safely, or strncpy with explicit termination. Whatever you choose, work out the destination size first.",
        ], {
          title: "Comparing and joining",
          code: '#include <stdio.h>\n#include <string.h>\n\nint main(void) {\n    char full[32];\n    snprintf(full, sizeof full, "%s %s", "Asha", "Rao");\n    printf("%zu %d\\n", strlen(full), strcmp("apple", "banana") < 0);\n    return 0;\n}\n',
          explanation: "The joined text \"Asha Rao\" is 8 characters, and \"apple\" sorts before \"banana\", so the comparison prints 1. Output: 8 1.",
        }),
        sec("Searching inside strings", [
          "strchr finds the first occurrence of a character and strstr finds a substring; both return a pointer into the original string, or NULL if nothing is found. Always test for NULL before using the result.",
        ], {
          title: "Finding a substring",
          code: '#include <stdio.h>\n#include <string.h>\n\nint main(void) {\n    const char *text = "learn c with capabilio";\n    const char *hit = strstr(text, "with");\n    if (hit != NULL) {\n        printf("%ld\\n", (long)(hit - text));\n    }\n    return 0;\n}\n',
          explanation: "Subtracting the start address from the match address gives its index: 8.",
        }),
      ],
      takeaways: ["strlen excludes the terminator; strcmp returns 0 on equality.", "strcpy and strcat do not check sizes; use snprintf to build text.", "strstr and strchr return NULL when nothing matches."],
      mistakes: ["Comparing strings with == instead of strcmp.", "Treating strcmp's result as 1 and -1 only.", "Using the result of strstr without checking for NULL."],
      check: [
        q("What does strcmp(\"a\", \"a\") return?", ["1", "-1", "0", "The length"], 2, "Zero means the two strings are identical."),
        q("Which function counts characters before the terminator?", ["sizeof", "strlen", "strcnt", "strchr"], 1, "strlen walks the string until '\\0'."),
        q("What does strstr return when the substring is absent?", ["0 as an int", "An empty string", "NULL", "The original string"], 2, "It returns a null pointer, which you must check."),
      ],
    }),
    lesson("string-problems", "Common string problems", 14, {
      summary: "Reversing, palindromes, counting vowels and anagrams appear again and again in tests. They all follow from one idea: walk the string with an index or two.",
      sections: [
        sec("Reverse with two indexes", [
          "Place one index at the start and one at the last character, swap, and move them toward each other until they meet. The same two-index pattern checks a palindrome: compare the characters at both ends and stop at the first mismatch.",
        ], {
          title: "Palindrome check",
          code: '#include <stdio.h>\n#include <string.h>\n\nint main(void) {\n    const char *s = "level";\n    int i = 0, j = (int)strlen(s) - 1, ok = 1;\n    while (i < j) {\n        if (s[i] != s[j]) {\n            ok = 0;\n            break;\n        }\n        i++;\n        j--;\n    }\n    printf("%s\\n", ok ? "palindrome" : "not a palindrome");\n    return 0;\n}\n',
          explanation: "The ends of \"level\" match all the way inward, so it prints palindrome.",
        }),
        sec("Counting with a frequency table", [
          "To count letters, use an int array of 26 slots and increment counts[c - 'a'] for each lowercase character c. Two words are anagrams when their frequency tables are equal. This turns a nested-loop problem into a single pass.",
        ], {
          title: "Letter frequencies",
          code: '#include <stdio.h>\n\nint main(void) {\n    const char *s = "banana";\n    int counts[26] = {0};\n    for (int i = 0; s[i] != \'\\0\'; i++) {\n        counts[s[i] - \'a\']++;\n    }\n    printf("%d %d %d\\n", counts[\'a\' - \'a\'], counts[\'b\' - \'a\'], counts[\'n\' - \'a\']);\n    return 0;\n}\n',
          explanation: "banana has three a, one b and two n. The output is 3 1 2.",
        }),
      ],
      takeaways: ["Two indexes from both ends solve reverse and palindrome.", "A 26-slot count array turns letter problems into one pass.", "Characters are small integers, so c - 'a' gives a position."],
      mistakes: ["Indexing the count array with an uppercase or non-letter character.", "Forgetting to stop at the terminator.", "Modifying a string literal; copy it into an array first."],
      check: [
        q("What is 'd' - 'a' in C?", ["3", "4", "100", "-3"], 0, "Characters are integers and the letters are consecutive, so the difference is 3."),
        q("What size count array holds lowercase English letters?", ["10", "26", "52", "128"], 1, "One slot for each of the 26 letters."),
        q("Which is true of two anagrams?", ["They have the same length and the same letter counts", "They are identical strings", "They are palindromes", "They start with the same letter"], 0, "Anagrams use exactly the same letters the same number of times."),
      ],
    }),
  ],
};
