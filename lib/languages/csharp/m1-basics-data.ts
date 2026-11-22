import { lesson, q, sec, type TrackModule } from "../types";

export const csBasics: TrackModule = {
  key: "cs-basics",
  title: "C# basics",
  summary: "Write and run a C# program, use types and variables, make decisions and repeat work.",
  lessons: [
    lesson("running-csharp", "Your first C# program", 10, {
      summary: "C# is Microsoft's language for .NET. It powers a large share of enterprise software, banking systems and Unity games, and many Indian service companies hire .NET developers in large numbers.",
      sections: [
        sec("A program", [
          "A modern C# program can be a single file of top-level statements: no class or Main method is required to start. Console.WriteLine prints a line and Console.ReadLine reads one. You build and run with the .NET SDK using dotnet run. C# is statically typed and compiled, so type mistakes are caught before the program runs.",
        ], {
          title: "Hello, C#",
          code: 'Console.WriteLine("Hello, C#");\nvar year = 2026;\nConsole.WriteLine($"The year is {year}");\n',
          explanation: "The $ before the string turns it into an interpolated string, which inserts the value of year. Output: Hello, C#, then The year is 2026.",
        }),
        sec("Compiled and typed", [
          "The compiler turns your code into intermediate code that the .NET runtime runs. Every name has a type that cannot change, which the compiler checks. var asks the compiler to work the type out from the value, so var year = 2026 is still an int.",
        ]),
      ],
      takeaways: ["C# runs on .NET and is compiled and statically typed.", "Console.WriteLine prints a line.", "Interpolated strings use $ and braces."],
      mistakes: ["Forgetting the semicolon at the end of a statement.", "Thinking var means a type that can change; it is fixed at compile time.", "Mixing up Console.Write and Console.WriteLine."],
      check: [
        q("Which command runs a project with the .NET SDK?", ["dotnet run", "csharp go", "net start", "cs run"], 0, "dotnet run builds and runs it."),
        q("What does $\"x is {x}\" create?", ["A comment", "An interpolated string", "A number", "An error"], 1, "$ enables embedded expressions in braces."),
        q("What does var do in var n = 5;?", ["Makes n dynamic", "Lets the compiler infer the type", "Makes n a string", "Makes n optional"], 1, "The type is inferred as int and stays fixed."),
      ],
    }),
    lesson("types-variables-cs", "Types and variables", 12, {
      summary: "C# has a rich set of built-in types. Choosing the right one matters because each has its own size and range and the compiler checks how you mix them.",
      sections: [
        sec("The built-in types", [
          "int holds whole numbers, long holds larger ones, double holds decimals, decimal holds exact decimals and is the right choice for money, bool holds true or false, char holds one character and string holds text. A const can never change after it is set.",
        ], {
          title: "Types in use",
          code: 'int students = 60;\ndouble average = 71.5;\ndecimal fee = 24999.50m;\nbool open = true;\nchar grade = \'A\';\nstring college = "JNTU";\nConsole.WriteLine($"{college}: {students} students, avg {average}, fee {fee}, open={open}, grade {grade}");\n',
          explanation: "Each variable has a fixed type, and the m suffix marks a decimal literal. Output: JNTU: 60 students, avg 71.5, fee 24999.50, open=True, grade A.",
        }),
        sec("Conversion", [
          "Going from a smaller to a larger type is automatic, but narrowing needs an explicit cast, such as (int)3.9, which gives 3 because it truncates. int.Parse(text) converts text and throws if it is not a number; int.TryParse returns false instead, which is the safe choice for user input.",
        ], {
          title: "Cast and TryParse",
          code: 'double price = 3.9;\nint whole = (int)price;\nConsole.WriteLine(whole);\nif (int.TryParse("42", out int n)) Console.WriteLine(n + 1);\nif (!int.TryParse("abc", out _)) Console.WriteLine("not a number");\n',
          explanation: "The cast truncates 3.9 to 3. TryParse succeeds for \"42\" and reports failure for \"abc\" without throwing. Output: 3, 43, not a number.",
        }),
      ],
      takeaways: ["Use decimal for money and double for general decimals.", "Narrowing needs an explicit cast.", "TryParse is the safe way to read user input."],
      mistakes: ["Using double for currency and getting rounding errors.", "Calling int.Parse on user input without a guard.", "Forgetting that integer division drops the fraction."],
      check: [
        q("Which type is best for money?", ["double", "float", "decimal", "char"], 2, "decimal avoids binary rounding errors."),
        q("What does (int)3.9 give?", ["4", "3", "3.9", "An error"], 1, "A cast truncates toward zero."),
        q("What does int.TryParse do on invalid text?", ["Throws", "Returns false", "Returns 0 silently and true", "Crashes"], 1, "It reports failure through its return value."),
      ],
    }),
    lesson("decisions-loops-cs", "Decisions and loops", 14, {
      summary: "if, switch, for, foreach and while control which code runs and how often. foreach is the cleanest way to visit every item of a collection.",
      sections: [
        sec("Choosing", [
          "if, else if and else pick a branch. switch compares one value against several cases, and the modern switch expression returns a value for each pattern, with _ as the default. && means and, || means or, and ! means not.",
        ], {
          title: "if and a switch expression",
          code: 'int marks = 72;\nstring grade = marks >= 80 ? "A" : marks >= 60 ? "B" : "C";\nstring day = "Sat";\nstring kind = day switch\n{\n    "Sat" or "Sun" => "weekend",\n    _ => "weekday"\n};\nConsole.WriteLine($"{grade} {kind}");\n',
          explanation: "72 falls in the middle band, and \"Sat\" matches the first pattern. Output: B weekend.",
        }),
        sec("Repeating", [
          "for runs a counted loop. while repeats while a condition is true. foreach visits each element of an array or list. break leaves a loop and continue skips to the next round.",
        ], {
          title: "Loops",
          code: 'int total = 0;\nfor (int i = 1; i <= 5; i++) total += i;\nConsole.WriteLine(total);\nforeach (var city in new[] { "Hyderabad", "Pune", "Chennai" })\n{\n    if (city == "Pune") continue;\n    Console.WriteLine(city);\n}\n',
          explanation: "The for loop adds 1 to 5, and foreach skips Pune. Output: 15, Hyderabad, Chennai.",
        }),
      ],
      takeaways: ["switch expressions return a value per pattern.", "foreach visits every item.", "break leaves a loop and continue skips one round."],
      mistakes: ["Using = instead of == in a condition.", "Off-by-one errors with < and <=.", "Forgetting the default case in a switch."],
      check: [
        q("Which loop visits each element of a collection directly?", ["for", "foreach", "while", "do"], 1, "foreach hands you each element."),
        q("What does _ mean in a switch expression?", ["A comment", "The default case", "An error", "A variable"], 1, "The discard pattern matches anything else."),
        q("What does continue do?", ["Exits the program", "Skips to the next loop round", "Restarts the loop", "Ends the method"], 1, "It jumps to the next iteration."),
      ],
    }),
  ],
};

export const csData: TrackModule = {
  key: "cs-data",
  title: "Methods and collections",
  summary: "Write methods, and store data in arrays, lists and dictionaries.",
  lessons: [
    lesson("methods-cs", "Methods", 12, {
      summary: "A method packages code under a name so you can reuse it. In C# every method has a return type and typed parameters.",
      sections: [
        sec("Declaring methods", [
          "A method states its return type, name and parameters. void means it returns nothing. Parameters can have default values, and named arguments let a call say which value is which. A method defined after top-level statements can be called from them.",
        ], {
          title: "Two methods",
          code: 'Console.WriteLine(Add(3, 4));\nConsole.WriteLine(Greet("Asha"));\nConsole.WriteLine(Greet(greeting: "Welcome", name: "Ravi"));\n\nstatic int Add(int a, int b) => a + b;\n\nstatic string Greet(string name, string greeting = "Hello")\n{\n    return $"{greeting}, {name}";\n}\n',
          explanation: "Add is written as an expression-bodied method, and Greet has a default. Output: 7, Hello, Asha, Welcome, Ravi.",
        }),
        sec("Passing by value and by reference", [
          "Arguments are copied by default, so changing a parameter does not change the caller's variable. The ref and out keywords pass the variable itself; out is how int.TryParse returns a second result alongside its bool.",
        ], {
          title: "out and ref",
          code: 'static bool TryHalf(int n, out int half)\n{\n    half = n / 2;\n    return n % 2 == 0;\n}\nstatic void AddOne(ref int x) => x++;\n\nbool even = TryHalf(10, out int h);\nint count = 5;\nAddOne(ref count);\nConsole.WriteLine($"{even} {h} {count}");\n',
          explanation: "out returns an extra value and ref lets the method change count. Output: True 5 6.",
        }),
      ],
      takeaways: ["Methods have a return type and typed parameters.", "Default and named arguments make calls clear.", "ref and out pass the variable itself."],
      mistakes: ["Forgetting to return a value on every path.", "Expecting a normal parameter change to affect the caller.", "Not assigning an out parameter before returning."],
      check: [
        q("What does a void method return?", ["0", "Nothing", "null", "An empty string"], 1, "void means no return value."),
        q("What does the out keyword do?", ["Prints output", "Lets a method assign a value back to the caller's variable", "Exits the method", "Makes a variable private"], 1, "It passes a variable for the method to fill."),
        q("What is a named argument?", ["Argument with a type", "Passing a value as name: value", "A global variable", "A constant"], 1, "The call states which parameter each value is for."),
      ],
    }),
    lesson("collections-cs", "Arrays, lists and dictionaries", 14, {
      summary: "Arrays have a fixed size, List<T> grows as needed and Dictionary<K, V> looks values up by key. These three cover most everyday data handling.",
      sections: [
        sec("Arrays and lists", [
          "An array has a fixed length chosen when it is created. A List<T> has Add, Remove, Count and Contains and grows as needed; the T is the type of the items it holds. Prefer List<T> unless you know the size will not change.",
        ], {
          title: "Array and list",
          code: 'int[] marks = { 45, 82, 67 };\nConsole.WriteLine(marks.Length + " " + marks[1]);\nvar skills = new List<string> { "C#", "SQL" };\nskills.Add("Azure");\nConsole.WriteLine(skills.Count + " " + skills.Contains("SQL"));\nforeach (var s in skills) Console.Write(s + " ");\nConsole.WriteLine();\n',
          explanation: "The array has three items; the list grows to three after Add. Output: 3 82, then 3 True, then C# SQL Azure.",
        }),
        sec("Dictionaries", [
          "A Dictionary<string, int> maps each key to a value. Reading a missing key with [] throws an exception, so use TryGetValue or ContainsKey when the key may be absent. Keys must be unique.",
        ], {
          title: "A dictionary",
          code: 'var scores = new Dictionary<string, int> { ["Asha"] = 82, ["Ravi"] = 74 };\nscores["Meena"] = 91;\nif (scores.TryGetValue("Ravi", out int r)) Console.WriteLine(r);\nConsole.WriteLine(scores.ContainsKey("Kiran"));\nforeach (var (name, score) in scores) Console.WriteLine($"{name}: {score}");\n',
          explanation: "TryGetValue finds Ravi, Kiran is missing, and the loop prints each pair. Output: 74, False, Asha: 82, Ravi: 74, Meena: 91.",
        }),
      ],
      takeaways: ["Arrays have a fixed size; List<T> grows.", "Dictionary maps unique keys to values.", "Use TryGetValue when a key may be missing."],
      mistakes: ["Indexing past the end of an array.", "Reading a missing dictionary key with [] and getting an exception.", "Modifying a list while looping over it."],
      check: [
        q("Which collection grows as you add items?", ["int[]", "List<T>", "string", "char"], 1, "List<T> resizes itself."),
        q("What happens when you read a missing key with dictionary[key]?", ["Returns 0", "Returns null", "Throws an exception", "Adds the key"], 2, "Use TryGetValue to avoid it."),
        q("What does T mean in List<T>?", ["A time value", "The type of the items", "Total", "Temporary"], 1, "T is a placeholder for the item type."),
      ],
    }),
    lesson("strings-linq", "Strings and LINQ", 14, {
      summary: "Strings are immutable text with many helpers. LINQ lets you filter, transform and summarise any collection with short readable queries.",
      sections: [
        sec("Strings", [
          "Strings never change: methods such as ToUpper, Trim, Replace and Substring return a new string. Split breaks text into an array and string.Join glues it back. string.IsNullOrWhiteSpace is the right check for empty input.",
        ], {
          title: "String helpers",
          code: 'string raw = "  asha, ravi ,meena ";\nvar names = raw.Split(\',\').Select(n => n.Trim()).ToArray();\nConsole.WriteLine(string.Join(" | ", names));\nConsole.WriteLine(names[0].ToUpper());\nConsole.WriteLine(string.IsNullOrWhiteSpace("   "));\n',
          explanation: "The text is split on commas and each piece trimmed. Output: asha | ravi | meena, then ASHA, then True.",
        }),
        sec("LINQ", [
          "Where filters, Select transforms, OrderBy sorts, and Sum, Average, Count, Any and First summarise. Queries are chained and read like a sentence. They need using System.Linq, which modern projects include automatically.",
        ], {
          title: "Query a list",
          code: 'var marks = new List<int> { 45, 82, 67, 91, 38 };\nvar good = marks.Where(m => m >= 60).OrderByDescending(m => m).ToList();\nConsole.WriteLine(string.Join(", ", good));\nConsole.WriteLine(marks.Average());\nConsole.WriteLine(marks.Any(m => m < 40));\n',
          explanation: "Where keeps the marks of 60 or more, sorted high to low; Average and Any summarise. Output: 91, 82, 67, then 64.6, then True.",
        }),
      ],
      takeaways: ["Strings are immutable; methods return new strings.", "Where, Select and OrderBy build queries.", "Use IsNullOrWhiteSpace to check text input."],
      mistakes: ["Calling Trim() and ignoring the returned string.", "Using First() on an empty list; use FirstOrDefault.", "Concatenating strings in a long loop instead of using StringBuilder."],
      check: [
        q("What does LINQ Where do?", ["Sorts items", "Keeps items that match a condition", "Adds items", "Counts items"], 1, "Where filters."),
        q("Are C# strings mutable?", ["Yes", "No, methods return new strings", "Only with var", "Only in loops"], 1, "Strings are immutable."),
        q("Which is safest for an empty list?", ["First()", "FirstOrDefault()", "Last()", "Single()"], 1, "FirstOrDefault returns a default instead of throwing."),
      ],
    }),
  ],
};
