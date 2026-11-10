import { lesson, q, sec, type TrackModule } from "../types";

export const oop: TrackModule = {
  key: "java-oop",
  title: "Object-oriented programming",
  summary: "Classes and objects, constructors, encapsulation, inheritance, polymorphism, abstract classes and interfaces.",
  lessons: [
    lesson("classes-objects", "Classes and objects", 14, {
      summary: "A class is a blueprint that describes data (fields) and behaviour (methods). An object is one instance of a class, created with new.",
      sections: [
        sec("Fields, methods and constructors", [
          "A class groups related fields and methods. A constructor has the class's name, no return type, and runs when you write new. It sets the object's starting state. Each object has its own copy of the instance fields.",
          "this refers to the current object, which lets a constructor parameter have the same name as a field.",
        ], {
          title: "A Student class",
          code: 'class Student {\n    String name;\n    int marks;\n\n    Student(String name, int marks) {\n        this.name = name;\n        this.marks = marks;\n    }\n\n    boolean passed() {\n        return marks >= 40;\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Student s = new Student("Asha", 72);\n        System.out.println(s.name + " " + s.passed());\n    }\n}\n',
          explanation: "new Student(...) calls the constructor and returns an object. Output: Asha true.",
        }),
        sec("Objects are references", [
          "A variable of a class type holds a reference to an object. Assigning one variable to another makes both refer to the same object, so a change through one is visible through the other. Uninitialised references hold null, and calling a method on null throws NullPointerException.",
        ], {
          title: "Two references, one object",
          code: 'class Counter {\n    int n;\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Counter a = new Counter();\n        Counter b = a;\n        b.n = 5;\n        System.out.println(a.n);\n    }\n}\n',
          explanation: "a and b refer to the same Counter, so setting b.n changes what a sees. Output: 5.",
        }),
      ],
      takeaways: ["A class describes; an object is an instance made with new.", "A constructor sets up a new object's state.", "Class variables hold references; null means no object."],
      mistakes: ["Calling a method on a null reference.", "Thinking b = a copies the object.", "Giving a constructor a return type, which makes it an ordinary method."],
      check: [
        q("What does new do?", ["Declares a class", "Creates an object and runs its constructor", "Deletes an object", "Imports a package"], 1, "It allocates the object and calls the constructor."),
        q("After Counter b = a; both variables...", ["Hold separate copies", "Refer to the same object", "Are null", "Cause an error"], 1, "Only the reference is copied."),
        q("What does this refer to inside a constructor?", ["The class", "The object being created", "The parent class", "The main method"], 1, "this is the current instance."),
      ],
    }),
    lesson("encapsulation-static", "Encapsulation and static members", 12, {
      summary: "Encapsulation hides a class's data behind methods so it can enforce rules. static members belong to the class, not to any single object.",
      sections: [
        sec("private fields with getters and setters", [
          "Make fields private and expose only the operations that make sense. A setter can validate its input, so an object can never be put into an impossible state, such as a negative balance. Only the class itself needs to know how the data is stored, so you can change that later without breaking callers.",
        ], {
          title: "A protected balance",
          code: 'class Account {\n    private int balance;\n\n    void deposit(int amount) {\n        if (amount <= 0) {\n            throw new IllegalArgumentException("amount must be positive");\n        }\n        balance += amount;\n    }\n\n    int getBalance() {\n        return balance;\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Account a = new Account();\n        a.deposit(500);\n        System.out.println(a.getBalance());\n    }\n}\n',
          explanation: "Callers cannot set balance directly; they must go through deposit, which checks the amount. Output: 500.",
        }),
        sec("static fields and methods", [
          "A static field has one copy shared by every object, such as a counter of how many objects have been made. A static method does not use an object, so it cannot read instance fields directly. Utility methods like Math.max are static.",
        ], {
          title: "Counting objects",
          code: 'class Ticket {\n    static int issued = 0;\n    final int number;\n\n    Ticket() {\n        issued++;\n        number = issued;\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        new Ticket();\n        new Ticket();\n        Ticket t = new Ticket();\n        System.out.println(t.number + " of " + Ticket.issued);\n    }\n}\n',
          explanation: "issued is shared, so the third ticket is number 3 of 3. Output: 3 of 3.",
        }),
      ],
      takeaways: ["Keep fields private and expose behaviour through methods.", "Validation in setters protects an object's rules.", "static members belong to the class and are shared."],
      mistakes: ["Making every field public.", "Trying to use instance fields from a static method.", "Getters and setters that do nothing but expose the field."],
      check: [
        q("What is the main benefit of private fields?", ["Faster code", "The class controls how its data changes", "Smaller files", "They are inherited"], 1, "Outside code can only act through the methods you provide."),
        q("How many copies of a static field exist?", ["One per object", "One for the whole class", "None", "Two"], 1, "A static field is shared by all instances."),
        q("What can a static method NOT do directly?", ["Call another static method", "Use an instance field", "Take parameters", "Return a value"], 1, "It has no this, so instance state is out of reach."),
      ],
    }),
    lesson("inheritance", "Inheritance and polymorphism", 16, {
      summary: "A subclass inherits the fields and methods of its superclass and can override behaviour. Polymorphism means a superclass variable can hold any subclass object and the right method runs.",
      sections: [
        sec("extends, super and overriding", [
          "class Dog extends Animal gives Dog everything Animal has. A subclass constructor calls super(...) first to initialise the inherited part. A method with the same signature in the subclass overrides the parent's version; mark it @Override so the compiler catches typing mistakes.",
        ], {
          title: "Overriding",
          code: 'class Animal {\n    String sound() {\n        return "...";\n    }\n}\n\nclass Dog extends Animal {\n    @Override\n    String sound() {\n        return "Woof";\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Animal a = new Dog();\n        System.out.println(a.sound());\n    }\n}\n',
          explanation: "The variable's type is Animal but the object is a Dog, so Dog's sound runs. Output: Woof.",
        }),
        sec("Polymorphism in practice", [
          "Write code against the general type and let each object do its own thing. A list of Shape objects can be asked for area() without knowing which are circles and which are rectangles. Adding a new shape needs no change to the code that uses shapes.",
          "Use inheritance for a true is-a relationship. When you only want to reuse code, prefer composition: hold another object as a field and delegate to it.",
        ], {
          title: "One call, many behaviours",
          code: 'class Shape {\n    double area() {\n        return 0;\n    }\n}\n\nclass Square extends Shape {\n    double side = 3;\n\n    @Override\n    double area() {\n        return side * side;\n    }\n}\n\nclass Rect extends Shape {\n    double w = 2, h = 5;\n\n    @Override\n    double area() {\n        return w * h;\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Shape[] shapes = {new Square(), new Rect()};\n        double total = 0;\n        for (Shape s : shapes) {\n            total += s.area();\n        }\n        System.out.println(total);\n    }\n}\n',
          explanation: "The loop is written once and each object supplies its own area: 9 + 10. Output: 19.0.",
        }),
      ],
      takeaways: ["extends reuses and specialises a class; super calls the parent.", "Overriding replaces behaviour; the object's real type decides which runs.", "Use inheritance for is-a; prefer composition for reuse."],
      mistakes: ["Forgetting @Override and accidentally overloading instead.", "Deep inheritance chains that are hard to follow.", "Using inheritance just to reuse code."],
      check: [
        q("What decides which overridden method runs?", ["The variable's declared type", "The object's actual class", "The file name", "The order of declaration"], 1, "Java uses dynamic dispatch on the real object."),
        q("What does @Override do?", ["Changes the access level", "Asks the compiler to check that it really overrides a parent method", "Makes a method static", "Hides the method"], 1, "It catches signature mistakes at compile time."),
        q("When is inheritance the right choice?", ["Any time you want to reuse code", "When there is a true is-a relationship", "Never", "Only for interfaces"], 1, "Otherwise composition keeps classes simpler."),
      ],
    }),
    lesson("abstract-interface", "Abstract classes and interfaces", 14, {
      summary: "An abstract class is a partly finished base class that cannot be instantiated. An interface is a pure contract that unrelated classes can promise to follow.",
      sections: [
        sec("Abstract classes", [
          "Marking a class abstract means you cannot create an instance of it directly. It can mix finished methods with abstract ones, which have no body and must be implemented by every concrete subclass. Use it when subclasses share real code and state as well as a contract.",
        ], {
          title: "An abstract base",
          code: 'abstract class Employee {\n    String name;\n\n    Employee(String name) {\n        this.name = name;\n    }\n\n    abstract double pay();\n\n    String describe() {\n        return name + " earns " + pay();\n    }\n}\n\nclass Intern extends Employee {\n    Intern(String name) {\n        super(name);\n    }\n\n    @Override\n    double pay() {\n        return 15000;\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println(new Intern("Ravi").describe());\n    }\n}\n',
          explanation: "describe is shared; pay is supplied by the subclass. Output: Ravi earns 15000.0.",
        }),
        sec("Interfaces", [
          "An interface lists methods a class promises to provide. A class can implement many interfaces but extend only one class. Since Java 8 an interface can carry default methods with a body. Interfaces are how Java code stays flexible: a method that accepts a Comparable or a Runnable works with any class that implements it.",
        ], {
          title: "Implementing an interface",
          code: 'interface Greeter {\n    String greet(String name);\n}\n\nclass Formal implements Greeter {\n    @Override\n    public String greet(String name) {\n        return "Good day, " + name;\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Greeter g = new Formal();\n        System.out.println(g.greet("Asha"));\n    }\n}\n',
          explanation: "Interface methods are public, so the implementation must be too. Output: Good day, Asha.",
        }),
      ],
      takeaways: ["An abstract class cannot be instantiated and may hold shared code.", "An interface is a contract; a class can implement several.", "Program to the interface type, not the concrete class."],
      mistakes: ["Trying to instantiate an abstract class.", "Forgetting public on an interface method implementation.", "Using an abstract class where an interface would be more flexible."],
      check: [
        q("Can you write new Employee(...) if Employee is abstract?", ["Yes", "No", "Only in main", "Only with super"], 1, "Abstract classes cannot be instantiated directly."),
        q("How many interfaces can a class implement?", ["Only one", "Any number", "None", "Two at most"], 1, "A class may implement many interfaces."),
        q("What is a default method in an interface?", ["An abstract method", "A method with a body that implementers can inherit", "A static field", "A constructor"], 1, "It lets an interface add behaviour without breaking existing implementers."),
      ],
    }),
  ],
};
