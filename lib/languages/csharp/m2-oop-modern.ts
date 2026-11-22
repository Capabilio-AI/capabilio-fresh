import { lesson, q, sec, type TrackModule } from "../types";

export const csOop: TrackModule = {
  key: "cs-oop",
  title: "Object-oriented C#",
  summary: "Classes, properties, inheritance, interfaces and error handling.",
  lessons: [
    lesson("classes-cs", "Classes, properties and constructors", 14, {
      summary: "A class bundles data and the code that works on it. Properties give controlled access to the data, and a constructor makes sure every object starts valid.",
      sections: [
        sec("A class", [
          "Fields hold data, properties expose it with get and set, and the constructor runs when you create an object with new. Mark data private and expose what callers need through public members. Properties let you validate on set or make a value read-only.",
        ], {
          title: "An account",
          code: 'var a = new Account("Asha", 1000m);\na.Deposit(500m);\nConsole.WriteLine($"{a.Owner}: {a.Balance}");\n\nclass Account\n{\n    public string Owner { get; }\n    public decimal Balance { get; private set; }\n\n    public Account(string owner, decimal opening)\n    {\n        Owner = owner;\n        Balance = opening;\n    }\n\n    public void Deposit(decimal amount)\n    {\n        if (amount <= 0) throw new ArgumentException("Amount must be positive");\n        Balance += amount;\n    }\n}\n',
          explanation: "Balance can be read by anyone but changed only inside the class, so every change goes through Deposit. Output: Asha: 1500.",
        }),
        sec("Static members and encapsulation", [
          "A static member belongs to the class itself rather than to any one object, such as Math.PI or a counter shared by all accounts. Encapsulation means an object hides how it works inside and offers a small public surface. That makes it possible to change the inside later without breaking the code that uses the class.",
        ]),
      ],
      takeaways: ["Properties give controlled access to data.", "private set keeps changes inside the class.", "A constructor makes new objects valid from the start."],
      mistakes: ["Making every field public.", "Skipping validation in the method that changes data.", "Forgetting new when creating an object."],
      check: [
        q("What does private set on a property mean?", ["Nobody can read it", "Only the class can change it", "It is a constant", "It is static"], 1, "Anyone can read; only the class can set."),
        q("When does a constructor run?", ["When the program starts", "When an object is created with new", "When a method is called", "Never automatically"], 1, "It initialises the new object."),
        q("Why validate inside Deposit?", ["It is faster", "So the object can never hold invalid data", "It is required by C#", "To hide the class"], 1, "The class protects its own rules."),
      ],
    }),
    lesson("inheritance-interfaces", "Inheritance and interfaces", 14, {
      summary: "Inheritance shares code between related classes. An interface is a contract that unrelated classes can promise to follow, which is how large .NET systems stay flexible and testable.",
      sections: [
        sec("Inheritance and virtual methods", [
          "A class inherits another with a colon. A method marked virtual can be replaced in a subclass with override, and the right version runs even when the object is held through its parent type. abstract classes cannot be created directly and may leave methods for subclasses to fill in.",
        ], {
          title: "Shapes",
          code: 'Shape[] shapes = { new Circle(2), new Square(3) };\nforeach (var s in shapes) Console.WriteLine($"{s.Name}: {s.Area():F1}");\n\nabstract class Shape\n{\n    public abstract string Name { get; }\n    public abstract double Area();\n}\nclass Circle(double r) : Shape\n{\n    public override string Name => "Circle";\n    public override double Area() => Math.PI * r * r;\n}\nclass Square(double side) : Shape\n{\n    public override string Name => "Square";\n    public override double Area() => side * side;\n}\n',
          explanation: "Each shape supplies its own Area, and the loop calls the right one. Output: Circle: 12.6, Square: 9.0.",
        }),
        sec("Interfaces", [
          "An interface lists members without code, such as INotifier with a Send method. Any class can implement it, and code written against the interface works with all of them. A class can inherit from only one class but implement many interfaces.",
        ], {
          title: "An interface",
          code: 'INotifier[] all = { new EmailNotifier(), new SmsNotifier() };\nforeach (var n in all) n.Send("Interview at 10am");\n\ninterface INotifier { void Send(string message); }\nclass EmailNotifier : INotifier\n{\n    public void Send(string message) => Console.WriteLine("Email: " + message);\n}\nclass SmsNotifier : INotifier\n{\n    public void Send(string message) => Console.WriteLine("SMS: " + message);\n}\n',
          explanation: "The loop treats both objects as INotifier. Output: Email: Interview at 10am, SMS: Interview at 10am.",
        }),
      ],
      takeaways: ["override replaces a virtual or abstract method.", "An interface is a contract of members.", "A class has one parent but can implement many interfaces."],
      mistakes: ["Forgetting virtual so override is not allowed.", "Deep inheritance chains where composition is simpler.", "Creating an abstract class with new."],
      check: [
        q("Which keyword lets a subclass replace a method?", ["new", "override", "static", "sealed"], 1, "override replaces a virtual or abstract method."),
        q("How many classes can one class inherit from?", ["One", "Two", "Any number", "None"], 0, "C# has single class inheritance."),
        q("What does an interface contain?", ["Full method code only", "Member signatures that classes must provide", "Only fields", "Only constants"], 1, "It is a contract."),
      ],
    }),
    lesson("exceptions-null", "Exceptions and null", 12, {
      summary: "Exceptions report errors that normal code cannot handle. null means no object, and handling it carefully prevents the most common C# crash, the NullReferenceException.",
      sections: [
        sec("try, catch, finally", [
          "Put risky code in try, catch specific exception types such as FormatException or DivideByZeroException, and use finally for clean-up that must always run. Throw your own with throw new ArgumentException(\"message\"). Catch the narrowest type you can handle and never swallow errors silently.",
        ], {
          title: "Handling errors",
          code: 'foreach (var text in new[] { "8", "x", "0" })\n{\n    try\n    {\n        int n = int.Parse(text);\n        Console.WriteLine(100 / n);\n    }\n    catch (FormatException)\n    {\n        Console.WriteLine("not a number");\n    }\n    catch (DivideByZeroException)\n    {\n        Console.WriteLine("cannot divide by zero");\n    }\n}\n',
          explanation: "Each input fails or succeeds differently. Output: 12, not a number, cannot divide by zero.",
        }),
        sec("Null safety", [
          "A string? is a string that may be null. ?. calls a member only if the object is not null, ?? supplies a fallback and ??= assigns only when the variable is null. Nullable reference types warn at compile time wherever a null might slip through.",
        ], {
          title: "Safe with null",
          code: 'string? name = null;\nConsole.WriteLine(name?.Length);\nConsole.WriteLine(name ?? "guest");\nname ??= "Asha";\nConsole.WriteLine(name.ToUpper());\n',
          explanation: "?. returns nothing for null instead of crashing, ?? gives the fallback and ??= fills the null. Output: (an empty line), guest, ASHA.",
        }),
      ],
      takeaways: ["Catch specific exception types.", "finally always runs.", "?., ?? and ??= handle null safely."],
      mistakes: ["Empty catch blocks that hide failures.", "Catching Exception everywhere.", "Calling a member on a value that can be null."],
      check: [
        q("What does name?.Length do when name is null?", ["Throws", "Returns null instead of crashing", "Returns 0", "Returns an empty string"], 1, "The ?. operator short-circuits on null."),
        q("What does a ?? b return?", ["a always", "a if it is not null, otherwise b", "b always", "true or false"], 1, "?? is the null-coalescing operator."),
        q("When does finally run?", ["Only after an error", "Only without an error", "Always", "Never"], 2, "It runs on both paths."),
      ],
    }),
  ],
};

export const csModern: TrackModule = {
  key: "cs-modern",
  title: "Modern C# in practice",
  summary: "Records, pattern matching and async code, the way current .NET projects are written.",
  lessons: [
    lesson("records-patterns", "Records and pattern matching", 12, {
      summary: "A record is a short way to declare an immutable data type with value-based equality. Pattern matching tests the shape of data in a readable way.",
      sections: [
        sec("Records", [
          "record Job(string Role, string City, int Openings) creates a type with those properties, a readable ToString and equality that compares the values, not the references. A with expression makes a modified copy and leaves the original untouched, which is the safe way to change immutable data.",
        ], {
          title: "A record",
          code: 'var a = new Job("Backend", "Hyderabad", 3);\nvar b = a with { Openings = 5 };\nConsole.WriteLine(a);\nConsole.WriteLine(b.Openings);\nConsole.WriteLine(a == new Job("Backend", "Hyderabad", 3));\n\nrecord Job(string Role, string City, int Openings);\n',
          explanation: "b is a changed copy, and two records with the same values are equal. Output: Job { Role = Backend, City = Hyderabad, Openings = 3 }, 5, True.",
        }),
        sec("Pattern matching", [
          "A switch expression can test types, ranges and property values in one place. Patterns such as >= 60 and < 80, and and or, replace long chains of if statements.",
        ], {
          title: "Matching",
          code: 'foreach (object x in new object[] { 85, 55, "text", null })\n{\n    string d = x switch\n    {\n        int and >= 80 => "high score",\n        int and >= 40 => "pass",\n        int => "fail",\n        string s => "text of length " + s.Length,\n        null => "nothing",\n        _ => "other"\n    };\n    Console.WriteLine(d);\n}\n',
          explanation: "Each value is tested against the patterns in order. Output: high score, pass, text of length 4, nothing.",
        }),
      ],
      takeaways: ["Records give immutable data with value equality.", "with makes a changed copy.", "Pattern matching tests type and value together."],
      mistakes: ["Expecting a record to be changed in place.", "Comparing two classes with == and expecting value equality.", "Ordering patterns so the general one hides the specific one."],
      check: [
        q("What does a with expression do on a record?", ["Changes the original", "Creates a modified copy", "Deletes it", "Compares two records"], 1, "The original is unchanged."),
        q("How are two records with the same values compared by ==?", ["By reference", "By value", "They are never equal", "By type only"], 1, "Records have value equality."),
        q("In a switch expression, which pattern should come first?", ["The most general", "The most specific", "Order does not matter", "The default"], 1, "A general pattern earlier would hide the specific one."),
      ],
    }),
    lesson("async-cs", "Async and await", 14, {
      summary: "Web servers, mobile apps and desktop apps must not freeze while they wait for a database or a network. async and await let C# code wait without blocking a thread.",
      sections: [
        sec("Task, async and await", [
          "A method that does slow work returns Task or Task<T> and is marked async. Inside it, await pauses that method until the work finishes and frees the thread for other work in the meantime. By convention the method name ends in Async. Avoid .Result and .Wait(), which block and can deadlock.",
        ], {
          title: "Awaiting work",
          code: 'Console.WriteLine("start");\nvar profile = await LoadAsync("profile", 100);\nConsole.WriteLine(profile);\nvar all = await Task.WhenAll(LoadAsync("jobs", 120), LoadAsync("alerts", 60));\nConsole.WriteLine(string.Join(", ", all));\n\nstatic async Task<string> LoadAsync(string what, int ms)\n{\n    await Task.Delay(ms);\n    return what + " loaded";\n}\n',
          explanation: "The first call is awaited alone and the next two run at the same time with Task.WhenAll. Output: start, profile loaded, jobs loaded, alerts loaded.",
        }),
        sec("Cancellation and errors", [
          "Pass a CancellationToken into long-running async methods so callers can stop them, for example when a user closes a page. Exceptions thrown inside an async method surface at the await, so a try and catch around the await works as it does for ordinary code. Use ConfigureAwait only in library code; application code rarely needs it.",
        ]),
      ],
      takeaways: ["async methods return Task or Task<T>.", "await waits without blocking the thread.", "Task.WhenAll runs independent work together."],
      mistakes: ["Blocking with .Result or .Wait().", "Using async void except for event handlers.", "Awaiting independent calls one by one."],
      check: [
        q("What does an async method that returns a string have as its return type?", ["string", "Task<string>", "void", "async string"], 1, "Task<string> represents a future string."),
        q("Why avoid calling .Result on a task?", ["It is slow to type", "It blocks the thread and can deadlock", "It is not allowed", "It returns null"], 1, "It turns async code back into blocking code."),
        q("Which runs several tasks at the same time?", ["Task.WhenAll", "Task.Sleep", "await all", "Thread.Join"], 0, "Task.WhenAll waits for them together."),
      ],
    }),
    lesson("dotnet-ecosystem", "The .NET ecosystem", 8, {
      summary: "Knowing the language is the start. Most C# jobs use a few standard parts of .NET: ASP.NET Core for web APIs, Entity Framework Core for databases and NuGet for packages.",
      sections: [
        sec("What employers ask for", [
          "ASP.NET Core builds web applications and REST APIs. Entity Framework Core maps classes to database tables so you can query them with LINQ. NuGet is the package manager, and dotnet new creates a project from a template. Unit tests are usually written with xUnit or NUnit.",
          "A realistic learning path is: this track, then SQL, then a small ASP.NET Core API that stores data in a database through Entity Framework Core, with tests. Having that project on GitHub is strong proof for .NET roles.",
        ]),
        sec("Where C# is used", [
          "Enterprise and banking software, internal business systems, APIs and cloud services on Azure, desktop applications and Unity game development. Many IT services companies run large .NET teams, so a student who can show a working API and a clean GitHub history stands out.",
        ]),
      ],
      takeaways: ["ASP.NET Core builds web APIs.", "Entity Framework Core connects classes to a database.", "A small API project on GitHub is strong proof."],
      mistakes: ["Learning only syntax and building no project.", "Skipping SQL even though most .NET apps use a database.", "Not writing any tests."],
      check: [
        q("Which part of .NET builds web APIs?", ["Unity", "ASP.NET Core", "NuGet", "xUnit"], 1, "ASP.NET Core is the web framework."),
        q("What is NuGet?", ["A database", "The .NET package manager", "A test runner", "An editor"], 1, "It distributes packages for .NET."),
        q("Which skill pairs best with C# for most jobs?", ["SQL", "Photoshop", "Assembly only", "None"], 0, "Most .NET applications use a relational database."),
      ],
    }),
  ],
};
