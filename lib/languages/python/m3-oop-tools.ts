import { lesson, q, sec, type TrackModule } from "../types";

export const oop: TrackModule = {
  key: "python-oop",
  title: "Object-oriented Python",
  summary: "Classes, inheritance, special methods and dataclasses.",
  lessons: [
    lesson("classes", "Classes and objects", 14, {
      summary: "A class bundles data and behaviour. __init__ sets up a new object, and self is the object a method is working on.",
      sections: [
        sec("Defining a class", [
          "Calling the class creates an object and runs __init__. Attributes are set on self, and methods take self as their first parameter. Names that begin with an underscore are, by convention, internal. The @property decorator lets a method be read like an attribute, which keeps a simple interface while hiding how a value is computed or checked.",
        ], {
          title: "A Student class",
          code: 'class Student:\n    def __init__(self, name, marks):\n        self.name = name\n        self.marks = marks\n\n    @property\n    def passed(self):\n        return self.marks >= 40\n\n    def __repr__(self):\n        return f"Student({self.name!r}, {self.marks})"\n\ns = Student("Asha", 72)\nprint(s, s.passed)\n',
          explanation: "__repr__ controls how the object prints, and passed reads like an attribute. Output: Student(\'Asha\', 72) True.",
        }),
        sec("Class and instance attributes", [
          "An attribute defined in the class body is shared by every instance; one set through self belongs to that object alone. Use @classmethod for alternative constructors and @staticmethod for helper functions that do not need the object.",
        ], {
          title: "A shared counter",
          code: 'class Ticket:\n    issued = 0\n\n    def __init__(self):\n        Ticket.issued += 1\n        self.number = Ticket.issued\n\nTicket()\nTicket()\nt = Ticket()\nprint(t.number, Ticket.issued)\n',
          explanation: "issued belongs to the class, so all tickets share it. Output: 3 3.",
        }),
      ],
      takeaways: ["__init__ sets up a new object; self is that object.", "Class attributes are shared; instance attributes are per object.", "@property turns a method into a read-only attribute."],
      mistakes: ["Forgetting self in a method definition.", "Using a mutable class attribute as per-object state.", "Calling the class without the parentheses."],
      check: [
        q("What does self refer to?", ["The class", "The object the method is called on", "The module", "The parent class"], 1, "Python passes the instance as the first argument."),
        q("Where is a class attribute stored?", ["On each instance", "On the class and shared", "In __init__ only", "Nowhere"], 1, "All instances see the same class attribute."),
        q("What does @property do?", ["Makes a method callable as an attribute", "Makes the attribute private", "Creates a new class", "Speeds up the method"], 0, "You read it without parentheses."),
      ],
    }),
    lesson("inheritance", "Inheritance, polymorphism and dataclasses", 14, {
      summary: "A subclass reuses and extends a parent class. Python's duck typing means any object with the right methods will do, and dataclasses remove the boilerplate of data holders.",
      sections: [
        sec("Subclasses and super()", [
          "class Dog(Animal): inherits everything from Animal. super() reaches the parent, for example to call its __init__. A method defined in the subclass overrides the parent's version. Python decides which method runs from the object's real class, so the same call can behave differently for different objects.",
        ], {
          title: "Overriding",
          code: 'class Animal:\n    def sound(self):\n        return "..."\n\nclass Dog(Animal):\n    def sound(self):\n        return "Woof"\n\nclass Cat(Animal):\n    pass\n\nprint([a.sound() for a in (Dog(), Cat())])\n',
          explanation: "Dog overrides sound; Cat inherits the default. Output: [\'Woof\', \'...\'].",
        }),
        sec("dataclasses", [
          "The @dataclass decorator generates __init__, __repr__ and __eq__ from a list of annotated fields, so a record takes a few lines. Add frozen=True to make instances immutable and hashable. Prefer composition (holding another object) to deep inheritance unless there is a true is-a relationship.",
        ], {
          title: "A dataclass",
          code: 'from dataclasses import dataclass\n\n@dataclass(frozen=True)\nclass Point:\n    x: int\n    y: int\n\np = Point(3, 4)\nprint(p, p == Point(3, 4), p.x + p.y)\n',
          explanation: "The generated methods give printing and equality for free. Output: Point(x=3, y=4) True 7.",
        }),
      ],
      takeaways: ["Subclasses inherit and may override methods.", "super() calls the parent's version.", "@dataclass generates the boilerplate for data holders."],
      mistakes: ["Forgetting to call super().__init__().", "Deep inheritance trees; prefer composition.", "Mutable default values in a dataclass field."],
      check: [
        q("What does super() give access to?", ["The parent class's methods", "The module", "The file", "The class attributes only"], 0, "It lets you call the parent's implementation."),
        q("What does @dataclass generate?", ["__init__, __repr__ and __eq__", "A database", "A web page", "Nothing"], 0, "These come from the annotated fields."),
        q("When is inheritance appropriate?", ["Whenever you want to reuse code", "When there is a true is-a relationship", "Never", "Only for exceptions"], 1, "Otherwise composition is simpler."),
      ],
    }),
  ],
};

export const tools: TrackModule = {
  key: "python-tools",
  title: "Errors, files and tools",
  summary: "Handle errors, work with files and JSON, use modules and virtual environments, and test your code.",
  lessons: [
    lesson("exceptions", "Exceptions", 12, {
      summary: "try/except handles errors that would otherwise stop the program. Catch specific exceptions, clean up with finally, and raise your own when something is wrong.",
      sections: [
        sec("try, except, else and finally", [
          "Put the risky line in try and name the exception you expect in except. else runs when nothing was raised, and finally always runs. Catching a bare except hides bugs; catch only what you can handle. raise ValueError(\"message\") signals a problem to the caller.",
        ], {
          title: "Handling a bad number",
          code: 'def to_int(text):\n    try:\n        return int(text)\n    except ValueError:\n        return None\n    finally:\n        print("checked", text)\n\nprint(to_int("42"), to_int("4x2"))\n',
          explanation: "The finally line prints for both calls. Output: checked 42, checked 4x2, then 42 None.",
        }),
        sec("Raising and custom exceptions", [
          "Validate inputs early and raise a clear error. A subclass of Exception gives callers something specific to catch. The traceback names the exception and each line it passed through; read it from the bottom, where the error itself is, up to your own code.",
        ], {
          title: "A custom exception",
          code: 'class InsufficientFunds(Exception):\n    pass\n\ndef withdraw(balance, amount):\n    if amount > balance:\n        raise InsufficientFunds(f"balance {balance} is below {amount}")\n    return balance - amount\n\ntry:\n    withdraw(100, 250)\nexcept InsufficientFunds as e:\n    print(e)\n',
          explanation: "The function raises the custom error and the caller catches it by type. Output: balance 100 is below 250.",
        }),
      ],
      takeaways: ["Catch specific exceptions, not a bare except.", "finally always runs.", "Raise clear exceptions and read tracebacks from the bottom."],
      mistakes: ["A bare except that hides every bug.", "Using exceptions for normal flow in a hot loop.", "Swallowing an error without logging it."],
      check: [
        q("When does a finally block run?", ["Only on error", "Only on success", "Always", "Never"], 2, "It runs whether or not an exception occurred."),
        q("Which exception does int(\"abc\") raise?", ["TypeError", "ValueError", "KeyError", "IndexError"], 1, "The text cannot be converted to an integer."),
        q("Why avoid a bare except:?", ["It is slower", "It hides unexpected bugs", "It is a syntax error", "It cannot catch ValueError"], 1, "It catches everything, including mistakes you meant to see."),
      ],
    }),
    lesson("files-json", "Files and JSON", 12, {
      summary: "Use a with block to open files so they always close. JSON is the standard format for exchanging structured data.",
      sections: [
        sec("Reading and writing text", [
          "with open(path, \"w\") as f: opens a file and closes it automatically, even if an error occurs. Modes are \"r\" read, \"w\" write (erasing the old content) and \"a\" append. Iterating over the file gives one line at a time without loading it all. pathlib.Path gives a cleaner way to build paths than joining strings.",
        ], {
          title: "Write then read back",
          code: 'import tempfile\nfrom pathlib import Path\n\npath = Path(tempfile.mkdtemp()) / "scores.txt"\nwith open(path, "w") as f:\n    f.write("40\\n2\\n")\nwith open(path) as f:\n    total = sum(int(line) for line in f)\nprint(total)\n',
          explanation: "Two numbers are saved, read line by line and added. Output: 42.",
        }),
        sec("JSON", [
          "The json module turns Python dicts, lists, strings and numbers into text with json.dumps and back with json.loads (json.dump and json.load work with files). It is how most web APIs send data. Tuples become lists and dictionary keys become strings.",
        ], {
          title: "Round trip",
          code: 'import json\n\nrecord = {"name": "Asha", "skills": ["python", "sql"], "year": 2}\ntext = json.dumps(record)\nback = json.loads(text)\nprint(text)\nprint(back["skills"][0], back == record)\n',
          explanation: "The dict becomes text and back again with no loss. Output: the JSON text, then python True.",
        }),
      ],
      takeaways: ["Always open files with a with block.", "Iterate a file to read it line by line.", "json.dumps and json.loads convert to and from text."],
      mistakes: ["Opening with \"w\" and erasing a file you meant to read.", "Forgetting to close a file opened without with.", "Assuming a JSON key order or tuple type is preserved."],
      check: [
        q("Why use with open(...)?", ["It runs faster", "The file is closed automatically", "It avoids exceptions", "It sorts lines"], 1, "The context manager closes the file on exit."),
        q("Which mode adds to a file without erasing it?", ["r", "w", "a", "x"], 2, "\"a\" appends."),
        q("What does json.loads do?", ["Writes a file", "Parses a JSON string into Python objects", "Downloads data", "Sorts a dict"], 1, "It turns JSON text into dicts, lists and values."),
      ],
    }),
    lesson("modules-venv", "Modules, packages and virtual environments", 12, {
      summary: "Modules split code across files; the standard library covers a huge amount; pip installs third-party packages into an isolated virtual environment.",
      sections: [
        sec("import and the standard library", [
          "import math, from math import sqrt and import math as m bring in other modules. Your own file helpers.py is a module too: import helpers. The standard library is rich: collections, itertools, datetime, random, pathlib, json, re and statistics solve many problems with no installation. Guard script code with if __name__ == \"__main__\": so it does not run when the file is imported.",
        ], {
          title: "Using the standard library",
          code: 'import math\nimport statistics\nfrom datetime import date\n\nprint(math.sqrt(144), statistics.mean([2, 4, 9]), (date(2026, 3, 1) - date(2026, 2, 1)).days)\n\nif __name__ == "__main__":\n    print("run directly")\n',
          explanation: "Three standard modules, with no installation. February 2026 has 28 days. Output: 12.0 5 28, then run directly.",
        }),
        sec("Virtual environments and pip", [
          "python3 -m venv .venv creates an isolated environment, and source .venv/bin/activate switches into it. pip install requests then installs into that environment only, so different projects can use different versions. pip freeze > requirements.txt records the exact versions so a teammate can reproduce your setup.",
        ]),
      ],
      takeaways: ["import brings in modules; the standard library is large.", "Use if __name__ == \"__main__\": for script entry code.", "Make a virtual environment for every project."],
      mistakes: ["Installing packages globally.", "Naming your file after a standard module, such as random.py.", "Forgetting requirements.txt."],
      check: [
        q("What does python3 -m venv .venv create?", ["A new Python version", "An isolated environment for packages", "A package", "A test"], 1, "Packages install into it instead of the system Python."),
        q("What is if __name__ == \"__main__\": for?", ["Running code only when the file is run directly", "Importing a module", "Defining a class", "Catching errors"], 0, "It prevents the code from running on import."),
        q("Which file records a project's package versions?", ["setup.txt", "requirements.txt", "modules.json", "main.py"], 1, "pip can install everything listed in it."),
      ],
    }),
    lesson("testing-debugging", "Testing and debugging", 12, {
      summary: "Tests prove that code works and keep it working. A few debugging habits turn a mysterious failure into a short search.",
      sections: [
        sec("Tests with assert and pytest", [
          "A test calls a function and asserts the expected result. With pytest, any function named test_something using plain assert statements is picked up and run. Test normal cases, edge cases (empty, one item, largest value) and invalid input, and write the failing test first when fixing a bug.",
        ], {
          title: "A small test",
          code: 'def total(prices):\n    return sum(prices)\n\ndef test_total():\n    assert total([10, 20]) == 30\n    assert total([]) == 0\n    assert total([5]) == 5\n\ntest_total()\nprint("tests passed")\n',
          explanation: "Normal, empty and single-item cases are all checked. pytest would find test_total by name. Output: tests passed.",
        }),
        sec("Debugging method", [
          "Reproduce the failure with the smallest input, read the traceback from the bottom, and print or inspect the real values to find the first place reality differs from what you expected. breakpoint() starts the built-in debugger at that line. Change one thing at a time, and keep the test that exposed the bug.",
        ]),
      ],
      takeaways: ["A test calls code and asserts the result.", "Test normal, edge and invalid cases.", "Debug by reproducing small and checking real values."],
      mistakes: ["Testing only the happy path.", "Changing several things at once while debugging.", "Deleting a failing test instead of fixing the code."],
      check: [
        q("How does pytest find a test?", ["Functions named test_*", "Files named main.py", "Functions with @test only", "It cannot"], 0, "It discovers test_ functions automatically."),
        q("What does breakpoint() do?", ["Ends the program", "Starts the debugger at that line", "Prints a line", "Raises an error"], 1, "You can inspect variables and step through."),
        q("Which inputs matter most besides typical ones?", ["Only huge ones", "Empty, single-item and invalid ones", "None", "Only strings"], 1, "Edge cases are where most bugs hide."),
      ],
    }),
  ],
};
