import { lesson, q, sec, type TrackModule } from "../types";

export const jsBasics: TrackModule = {
  key: "js-basics",
  title: "JavaScript basics",
  summary: "Run JavaScript, store values, understand its types and make decisions.",
  lessons: [
    lesson("running-js", "Running JavaScript", 10, {
      summary: "JavaScript runs in every browser and, through Node.js, on servers. It is the language of the web, so it is one of the most asked-for skills in Indian product and service companies.",
      sections: [
        sec("Where it runs", [
          "In a browser you open the developer console (F12) or put code in a script tag. On a computer with Node.js you run node file.js. console.log prints a value, and it is the tool you use most while learning. Statements end with a semicolon, which is optional in many cases but good to keep for clarity.",
        ], {
          title: "Hello, JavaScript",
          code: 'console.log("Hello, JavaScript");\nconsole.log(2 + 3, "is five");\n',
          explanation: "Each console.log writes one line. Output: Hello, JavaScript, then 5 is five.",
        }),
        sec("Comments and order", [
          "// starts a one-line comment and /* ... */ spans lines. JavaScript runs top to bottom, one statement after another, so a value must exist before the line that uses it.",
        ], {
          title: "Top to bottom",
          code: '// the code below runs in order\nconst year = 2026;\nconsole.log("Year:", year);\n',
          explanation: "year is created first and then read. Output: Year: 2026.",
        }),
      ],
      takeaways: ["JavaScript runs in browsers and in Node.js.", "console.log prints values for you to see.", "Code runs top to bottom."],
      mistakes: ["Using a variable before the line that creates it.", "Mixing up the browser console with the terminal.", "Forgetting the quotes around text."],
      check: [
        q("Which tool runs JavaScript outside the browser?", ["Node.js", "HTML", "CSS", "SQL"], 0, "Node.js runs JavaScript on the server and the command line."),
        q("What does console.log do?", ["Saves a file", "Prints a value", "Stops the program", "Creates a variable"], 1, "It writes to the console."),
        q("How does a one-line comment start?", ["#", "//", "--", "<!--"], 1, "// starts a comment."),
      ],
    }),
    lesson("variables-types-js", "Variables and types", 12, {
      summary: "Use const for values that do not change and let for values that do. JavaScript values have types, and a few of its type rules surprise beginners.",
      sections: [
        sec("const and let", [
          "const creates a name that cannot be pointed at a new value, and let allows reassignment. Prefer const and use let only when the value must change. Avoid the older var, which has confusing scope rules.",
          "The main types are number (integers and decimals share one type), string, boolean, undefined (no value yet), null (deliberately empty), object and symbol. typeof tells you the type of a value.",
        ], {
          title: "Types",
          code: 'const name = "Asha";\nlet score = 80;\nscore = score + 5;\nconsole.log(name, score);\nconsole.log(typeof name, typeof score, typeof true, typeof undefined);\n',
          explanation: "score can change because it is declared with let. Output: Asha 85, then string number boolean undefined.",
        }),
        sec("Equality and conversion", [
          "Use === and !==, which compare value and type. == converts types first and gives odd results, such as 0 == \"\" being true. Number(\"42\") converts text to a number and gives NaN when it cannot. NaN is never equal to anything, even itself; test with Number.isNaN.",
        ], {
          title: "Strict equality",
          code: 'console.log(5 === "5", 5 == "5");\nconsole.log(Number("42") + 1, Number("abc"));\nconsole.log(0.1 + 0.2 === 0.3);\n',
          explanation: "=== says false for number versus string while == says true. Number(\"abc\") is NaN. Output: false true, then 43 NaN, then false.",
        }),
      ],
      takeaways: ["Prefer const, use let when a value must change.", "Compare with === and !==.", "Decimal numbers are approximate, so 0.1 + 0.2 is not exactly 0.3."],
      mistakes: ["Using var out of habit.", "Using == and being surprised by conversion.", "Comparing decimals with ===."],
      check: [
        q("Which keyword declares a value that is never reassigned?", ["let", "var", "const", "static"], 2, "const prevents reassignment."),
        q("What does typeof undefined return?", ["null", "\"undefined\"", "\"object\"", "0"], 1, "typeof returns the string \"undefined\"."),
        q("Which operator compares value and type?", ["=", "==", "===", "=>"], 2, "=== is strict equality."),
      ],
    }),
    lesson("operators-conditions-js", "Operators and decisions", 12, {
      summary: "Operators calculate and compare. if, else and the ternary operator choose what to run. JavaScript also treats some values as false, which matters when you write conditions.",
      sections: [
        sec("Branching", [
          "if runs a block when a condition is true, else if checks another condition and else is the fallback. Combine conditions with && (and), || (or) and ! (not). The ternary condition ? a : b picks one of two values in a single expression.",
        ], {
          title: "Grade a score",
          code: 'const marks = 72;\nlet grade;\nif (marks >= 80) {\n  grade = "A";\n} else if (marks >= 60) {\n  grade = "B";\n} else {\n  grade = "C";\n}\nconsole.log(grade);\nconsole.log(marks >= 40 ? "pass" : "fail");\n',
          explanation: "72 is not 80 or more but is 60 or more, so the grade is B, and the ternary prints pass. Output: B then pass.",
        }),
        sec("Truthy and falsy", [
          "In a condition, these values count as false: false, 0, \"\" (empty string), null, undefined and NaN. Everything else counts as true, including \"0\" and empty arrays. || and ?? give default values: name || \"guest\" uses the fallback for any falsy name, while ?? only for null or undefined.",
        ], {
          title: "Defaults",
          code: 'const count = 0;\nconsole.log(count || 10);\nconsole.log(count ?? 10);\nconsole.log("" ? "yes" : "no", "0" ? "yes" : "no");\n',
          explanation: "|| replaces the legitimate 0 while ?? keeps it. The empty string is falsy but the text \"0\" is truthy. Output: 10, then 0, then no yes.",
        }),
      ],
      takeaways: ["Use if, else if and else to choose a path.", "Falsy values: false, 0, empty string, null, undefined, NaN.", "?? only replaces null and undefined."],
      mistakes: ["Using || for a default when 0 or an empty string is valid.", "Using = instead of === in a condition.", "Assuming an empty array is falsy."],
      check: [
        q("Which value is falsy?", ["\"0\"", "[]", "0", "\"false\""], 2, "The number 0 is falsy."),
        q("What does a ?? b do?", ["Uses b when a is falsy", "Uses b when a is null or undefined", "Compares a and b", "Adds a and b"], 1, "?? checks only for null and undefined."),
        q("What does the ternary a ? b : c return when a is true?", ["a", "b", "c", "an error"], 1, "It returns the value after the question mark."),
      ],
    }),
  ],
};

export const jsFunctions: TrackModule = {
  key: "js-functions",
  title: "Loops and functions",
  summary: "Repeat work, package it in functions and understand scope and closures.",
  lessons: [
    lesson("loops-js", "Loops", 10, {
      summary: "Loops repeat work. Use for when you know how many times, while when you do not, and for...of to go through the items of a list.",
      sections: [
        sec("for, while and for...of", [
          "A classic for loop has a start, a condition and a step. while repeats as long as its condition holds, so something inside must eventually make it false. for...of gives each item of an array directly and is the clearest way to visit every element. break leaves a loop early and continue skips to the next round.",
        ], {
          title: "Three loops",
          code: 'for (let i = 1; i <= 3; i++) console.log("round", i);\nlet n = 3;\nwhile (n > 0) { n--; }\nconsole.log("n is", n);\nfor (const city of ["Hyderabad", "Pune", "Chennai"]) {\n  if (city === "Pune") continue;\n  console.log(city);\n}\n',
          explanation: "The for loop prints rounds 1 to 3, the while loop counts n down to 0, and for...of skips Pune. Output: round 1, round 2, round 3, n is 0, Hyderabad, Chennai.",
        }),
        sec("Looping over objects and counting", [
          "Use Object.keys, Object.values or Object.entries to get arrays you can loop over with for...of. A common pattern is a counter or an accumulator that is updated each round, such as a running total. Prefer array methods such as map and filter for transforming lists, which the data module covers next, and keep loops for work with side effects.",
        ]),
      ],
      takeaways: ["Use for...of to visit every item.", "A while loop must change something so it can end.", "break leaves the loop, continue skips a round."],
      mistakes: ["Forgetting to change the variable in a while loop and looping forever.", "Using <= and running one round too many.", "Using for...in on arrays, which gives indexes as strings."],
      check: [
        q("Which loop visits each item of an array most directly?", ["for...of", "while", "do...never", "for...off"], 0, "for...of gives each element."),
        q("What does continue do?", ["Leaves the loop", "Skips to the next round", "Restarts the program", "Pauses"], 1, "continue jumps to the next iteration."),
        q("How many times does for (let i = 0; i < 3; i++) run?", ["2", "3", "4", "Forever"], 1, "i takes the values 0, 1 and 2."),
      ],
    }),
    lesson("functions-js", "Functions and arrow functions", 14, {
      summary: "A function packages code you can run many times with different inputs. JavaScript functions are values: you can store them, pass them to other functions and return them.",
      sections: [
        sec("Declaring and calling", [
          "function add(a, b) { return a + b; } declares a function. return sends a value back; without it the result is undefined. Default parameters supply a value when the caller leaves an argument out. An arrow function is a shorter form: const add = (a, b) => a + b.",
        ], {
          title: "Three ways",
          code: 'function greet(name = "friend") {\n  return "Hello, " + name;\n}\nconst square = (x) => x * x;\nconsole.log(greet("Asha"), greet());\nconsole.log(square(7));\n',
          explanation: "The default is used when greet() gets no argument. Output: Hello, Asha Hello, friend, then 49.",
        }),
        sec("Functions as values", [
          "Because a function is a value, you can pass it to another function. A function that takes or returns a function is called higher-order. This is how array methods such as map and filter work, which the next module uses all the time.",
        ], {
          title: "Passing a function",
          code: 'function twice(fn, value) {\n  return fn(fn(value));\n}\nconsole.log(twice((n) => n + 3, 10));\nconsole.log(twice((s) => s + "!", "hi"));\n',
          explanation: "twice applies whatever function it is given two times. Output: 16, then hi!!.",
        }),
      ],
      takeaways: ["return sends a value back; no return gives undefined.", "Arrow functions are a short form of function expressions.", "Functions are values you can pass around."],
      mistakes: ["Forgetting return and getting undefined.", "Calling a function without parentheses and getting the function itself.", "Putting return on one line and the value on the next."],
      check: [
        q("What does a function without a return statement give back?", ["0", "null", "undefined", "An error"], 2, "The result is undefined."),
        q("Which is an arrow function?", ["function f() {}", "const f = () => 1", "f => function", "def f(): 1"], 1, "The => symbol makes an arrow function."),
        q("What is a higher-order function?", ["A very long function", "One that takes or returns a function", "One that never returns", "A function with many parameters"], 1, "It works with other functions as values."),
      ],
    }),
    lesson("scope-closures", "Scope and closures", 12, {
      summary: "Scope decides where a name can be used. A closure is a function that keeps access to the variables around it, even after the outer function has finished.",
      sections: [
        sec("Block and function scope", [
          "let and const live only inside the block (the braces) where they are declared. A name declared inside a function is invisible outside it. An inner scope can read names from the scopes around it, but not the other way round.",
        ], {
          title: "Block scope",
          code: 'const outer = "visible everywhere";\nif (true) {\n  const inner = "only in this block";\n  console.log(outer, inner);\n}\nconsole.log(typeof inner);\n',
          explanation: "inner does not exist outside the braces, so typeof inner is \"undefined\". Output: visible everywhere only in this block, then undefined.",
        }),
        sec("Closures", [
          "When a function is created inside another, it remembers the outer function's variables. That lets you build a counter whose count is private: nothing outside can change it except through the functions you return.",
        ], {
          title: "A private counter",
          code: 'function makeCounter() {\n  let count = 0;\n  return () => {\n    count++;\n    return count;\n  };\n}\nconst a = makeCounter();\nconst b = makeCounter();\nconsole.log(a(), a(), a(), b());\n',
          explanation: "Each counter has its own count that persists between calls. Output: 1 2 3 1.",
        }),
      ],
      takeaways: ["let and const are scoped to their block.", "Inner scopes can read outer names.", "A closure keeps its outer variables alive."],
      mistakes: ["Using a block variable outside its braces.", "Expecting two counters to share one count.", "Using var and leaking names out of blocks."],
      check: [
        q("Where is a const declared inside an if block visible?", ["Anywhere in the file", "Only inside that block", "In the next function", "Globally"], 1, "const is block scoped."),
        q("What is a closure?", ["A closed file", "A function that remembers variables from where it was created", "A loop that ends", "A private class"], 1, "It keeps its surrounding scope."),
        q("In the counter example, how many separate counts exist after makeCounter() runs twice?", ["One", "Two", "Zero", "Three"], 1, "Each call creates its own count."),
      ],
    }),
  ],
};

export const jsData: TrackModule = {
  key: "js-data",
  title: "Working with data",
  summary: "Arrays and their methods, objects, destructuring, strings and JSON.",
  lessons: [
    lesson("arrays-js", "Arrays and array methods", 14, {
      summary: "Arrays hold ordered lists. map, filter and reduce transform lists without loops and are used in almost every JavaScript codebase and interview.",
      sections: [
        sec("Basics", [
          "An array is written with square brackets and indexed from 0. push adds to the end, pop removes from the end, length is the size, includes checks membership and slice copies a part. Arrays are objects, so a const array can still be changed; const only stops reassigning the name.",
        ], {
          title: "Array basics",
          code: 'const skills = ["HTML", "CSS"];\nskills.push("JavaScript");\nconsole.log(skills.length, skills[0], skills.includes("CSS"));\nconsole.log(skills.slice(1));\n',
          explanation: "push grows the array to three items. Output: 3 HTML true, then [ \'CSS\', \'JavaScript\' ].",
        }),
        sec("map, filter and reduce", [
          "map builds a new array by applying a function to each item. filter keeps only the items for which a function returns true. reduce folds the array into one value. None of them change the original array.",
        ], {
          title: "Transform a list",
          code: 'const marks = [45, 82, 67, 91, 38];\nconst passed = marks.filter((m) => m >= 40);\nconst boosted = passed.map((m) => m + 5);\nconst total = marks.reduce((sum, m) => sum + m, 0);\nconsole.log(passed);\nconsole.log(boosted);\nconsole.log(total, total / marks.length);\n',
          explanation: "filter drops 38, map adds 5 to each remaining mark and reduce adds all five marks. Output: [ 45, 82, 67, 91 ], [ 50, 87, 72, 96 ], then 323 64.6.",
        }),
      ],
      takeaways: ["Indexes start at 0.", "map transforms, filter selects, reduce combines.", "These methods return new values and leave the array alone."],
      mistakes: ["Forgetting the starting value of reduce.", "Using map when you only need a loop with side effects.", "Expecting sort() to sort numbers numerically by default."],
      check: [
        q("Which method keeps only items that pass a test?", ["map", "filter", "reduce", "push"], 1, "filter selects items."),
        q("What does [1, 2, 3].map((n) => n * 2) return?", ["[1, 2, 3]", "[2, 4, 6]", "12", "[2, 3, 4]"], 1, "map applies the function to each item."),
        q("Can you push to a const array?", ["No", "Yes, const only prevents reassigning the name", "Only on Tuesdays", "Only with let"], 1, "The array itself can change."),
      ],
    }),
    lesson("objects-js", "Objects and destructuring", 14, {
      summary: "Objects group related values under names. Destructuring and the spread operator make it easy to take objects apart and build new ones.",
      sections: [
        sec("Objects", [
          "An object is a set of key: value pairs written in braces. Read a value with dot notation (student.name) or brackets (student[\"name\"]). Add or change values by assigning, check a key with the in operator and list keys with Object.keys. A method is a function stored on an object.",
        ], {
          title: "A student object",
          code: 'const student = { name: "Ravi", year: 3, skills: ["CSS", "JS"] };\nstudent.year = 4;\nstudent.college = "JNTU";\nconsole.log(student.name, student.year, student["college"]);\nconsole.log(Object.keys(student));\n',
          explanation: "Objects can be changed after creation, even when declared with const. Output: Ravi 4 JNTU, then [ \'name\', \'year\', \'skills\', \'college\' ].",
        }),
        sec("Destructuring and spread", [
          "Destructuring pulls values out into variables: const { name, year } = student. Spread (...) copies properties into a new object or array, which is the safe way to change data without modifying the original.",
        ], {
          title: "Take apart and copy",
          code: 'const student = { name: "Ravi", year: 3 };\nconst { name, year } = student;\nconst promoted = { ...student, year: year + 1 };\nconsole.log(name, year);\nconsole.log(promoted, student);\n',
          explanation: "promoted is a new object with year changed, and student is untouched. Output: Ravi 3, then { name: \'Ravi\', year: 4 } { name: \'Ravi\', year: 3 }.",
        }),
      ],
      takeaways: ["Objects are key-value pairs.", "Destructuring pulls out values by name.", "Spread copies without changing the original."],
      mistakes: ["Reading a key that does not exist and getting undefined.", "Mutating an object that other code also uses.", "Forgetting that a copy with spread is shallow."],
      check: [
        q("How do you read the key name from an object called student?", ["student.name", "student->name", "student:name", "name(student)"], 0, "Dot notation reads a property."),
        q("What does const { a } = obj do?", ["Creates a copy of obj", "Declares a with the value of obj.a", "Deletes a", "Compares a with obj"], 1, "It pulls the property into a variable."),
        q("What does { ...obj, x: 1 } produce?", ["A changed obj", "A new object with obj's properties and x set to 1", "An error", "An array"], 1, "Spread copies, then x overrides."),
      ],
    }),
    lesson("strings-json", "Strings, template literals and JSON", 12, {
      summary: "Strings have many handy methods, template literals make building text easy and JSON is how programs exchange data over the web.",
      sections: [
        sec("Strings and templates", [
          "Common methods are toUpperCase, trim, split, includes, slice and replace. A template literal uses backticks and ${ } to embed values and can span lines, so you rarely need string concatenation.",
        ], {
          title: "Build text",
          code: 'const name = "  asha  ";\nconst clean = name.trim();\nconst title = clean[0].toUpperCase() + clean.slice(1);\nconsole.log(`Hello, ${title}! You have ${2 + 3} new jobs.`);\nconsole.log("a,b,c".split(","));\n',
          explanation: "trim removes the spaces, the first letter is capitalised and the template inserts values. Output: Hello, Asha! You have 5 new jobs., then [ \'a\', \'b\', \'c\' ].",
        }),
        sec("JSON", [
          "JSON is text that looks like a JavaScript object, with keys always in double quotes. JSON.stringify turns a value into JSON text and JSON.parse turns JSON text back into a value. Parsing bad text throws an error, so wrap data from outside in try and catch.",
        ], {
          title: "Round trip",
          code: 'const job = { role: "Frontend", openings: 3, remote: false };\nconst text = JSON.stringify(job);\nconsole.log(text);\nconsole.log(JSON.parse(text).role);\ntry {\n  JSON.parse("{bad json}");\n} catch (e) {\n  console.log("could not parse");\n}\n',
          explanation: "stringify makes text and parse reads it back; the bad text throws and is caught. Output: {\"role\":\"Frontend\",\"openings\":3,\"remote\":false}, then Frontend, then could not parse.",
        }),
      ],
      takeaways: ["Template literals use backticks and ${ }.", "JSON.stringify and JSON.parse convert both ways.", "Always guard JSON.parse for outside data."],
      mistakes: ["Using single quotes inside JSON keys.", "Parsing without try and catch.", "Expecting string methods to change the original string; strings never change."],
      check: [
        q("Which quotes make a template literal?", ["Single quotes", "Double quotes", "Backticks", "Parentheses"], 2, "Backticks allow ${ } and multiple lines."),
        q("What does JSON.stringify do?", ["Parses text", "Turns a value into JSON text", "Deletes keys", "Sorts keys"], 1, "It converts to a JSON string."),
        q("What happens when JSON.parse gets invalid text?", ["Returns null", "Returns an empty object", "Throws an error", "Fixes it"], 2, "It throws a SyntaxError."),
      ],
    }),
  ],
};
