// Source snippets for the Python code-reading questions. The generator runs them; the answers are NOT written here.
import type { Language, Spec } from "../gen-code-questions.mts";

const S = String.raw;

export const lang: Language = {
  language: "python",
  show: (s) => s.body.trim(),
  wrap: (shown) => `${shown}\n`,
};

export const specs: Spec[] = [
  // ---------------------------------------------------------------- python-basics
  { m: "python-basics", body: S`x = 7
y = 2
print(x / y, x // y, x % y)`, alt: [["x / y", "x * y"], ["x // y", "x ** y"], ["x % y", "y % x"]],
    why: "/ gives the full answer with a decimal (3.5). // drops the decimal part (3). % is the remainder (1)." },
  { m: "python-basics", body: S`a = "5"
b = 3
print(a * b)`, alt: [['a = "5"', "a = 5"], ["a * b", "a + str(b)"], ["b = 3", "b = 2"]],
    why: "A text times a number repeats the text. \"5\" three times is 555. It is not a sum." },
  { m: "python-basics", body: S`name = "Ravi"
age = 20
print(f"{name} is {age + 1} next year")`, alt: [["age + 1", "age * 2"], ["{name}", "{age}"], ["age = 20", "age = 19"], ["{name}", "{name[0]}"]],
    why: "An f-string puts the values inside the { }. You can do a sum inside it too, so age + 1 is 21." },
  { m: "python-basics", body: S`print(type(3), type(3.0), type("3"))`, alt: [["type(3)", "type(3 / 1)"], ["type(3.0)", "type(3)"], [S`type("3")`, "type(3 > 2)"]],
    why: "3 is an int, 3.0 is a float, and \"3\" with quotes is a str (text)." },
  { m: "python-basics", body: S`a = 10
b = 3
a, b = b, a
print(a, b)`, alt: [["a, b = b, a", "a = b"], ["a, b = b, a", "b = a"], ["a, b = b, a", "a, b = a, b"]],
    why: "a, b = b, a swaps the two values in one line. So a becomes 3 and b becomes 10." },
  { m: "python-basics", body: S`print(2 ** 3 ** 2, (2 ** 3) ** 2, -7 // 2)`, alt: [["-7 // 2", "7 // 2"], ["2 ** 3 ** 2", "(2 ** 3) ** 2"], ["-7 // 2", "-7 % 2"]],
    why: "** goes from the right: 3 ** 2 is 9, then 2 ** 9 is 512. (2 ** 3) ** 2 is 64. -7 // 2 rounds down to -4." },
  { m: "python-basics", body: S`s = "Capabilio"
print(s[0], s[-1], s[2:5], len(s))`, alt: [["s[-1]", "s[-2]"], ["s[2:5]", "s[2:4]"], ["s[0]", "s[1]"]],
    why: "Counting starts at 0. s[-1] is the last letter. s[2:5] takes the letters at places 2, 3 and 4." },
  { m: "python-basics", body: S`print(True + True, bool(0), bool("a"), 3 > 2 > 1)`, alt: [["True + True", "True + False"], ["bool(0)", "bool(1)"], ["3 > 2 > 1", "3 > 2 > 2"]],
    why: "True counts as 1, so True + True is 2. 0 is False and a non-empty text is True. 3 > 2 > 1 means 3 > 2 and 2 > 1." },
  { m: "python-basics", body: S`x = 5
x += 2
x *= 3
x -= 1
print(x)`, alt: [["x *= 3", "x //= 3"], ["x += 2", "x -= 2"], ["x -= 1", "x -= 10"]],
    why: "Go line by line: 5, then 7, then 21, then 20." },
  { m: "python-basics", body: S`text = "  hello world  "
print(text.strip().title(), len(text.strip()))`, alt: [[".strip().title()", ".title()"], [".title()", ".upper()"], ["len(text.strip())", "len(text)"]],
    why: "strip() removes the spaces at both ends. title() makes each word start with a capital letter. \"hello world\" has 11 characters." },

  // ---------------------------------------------------------------- python-control
  { m: "python-control", body: S`m = 65
if m >= 75:
    g = "A"
elif m >= 60:
    g = "B"
else:
    g = "C"
print(g, m)`, alt: [["m = 65", "m = 75"], ["m = 65", "m = 40"], ["elif m >= 60", "elif m > 65"], ["if m >= 75", "if m >= 60"]],
    why: "Python checks from the top and stops at the first true one. 65 is not 75 or more, but it is 60 or more, so g is B." },
  { m: "python-control", body: S`for i in range(1, 6, 2):
    print(i, end=" ")`, alt: [["range(1, 6, 2)", "range(1, 6)"], ["1, 6, 2", "0, 6, 2"], ["6, 2", "5, 2"]],
    why: "range(1, 6, 2) starts at 1, stops before 6, and goes up by 2: 1 3 5." },
  { m: "python-control", body: S`total = 0
for n in [4, 8, 6]:
    total += n
print(total, total / 3)`, alt: [["total / 3", "total // 4"], ["total += n", "total = n"], ["[4, 8, 6]", "[4, 8, 6, 2]"]],
    why: "The loop adds 4, 8 and 6 to get 18. 18 / 3 is 6.0 (a division always gives a decimal)." },
  { m: "python-control", body: S`n = 3
while n > 0:
    print(n, end=" ")
    n -= 1
print("go")`, alt: [["n > 0", "n > 1"], ["n -= 1", "n -= 2"], ['print("go")', 'print("go", n)']],
    why: "It prints n and makes it smaller by 1, while n is more than 0. Then it prints go." },
  { m: "python-control", body: S`for i in range(1, 8):
    if i % 2 == 0:
        continue
    if i == 5:
        break
    print(i, end=" ")`, alt: [["continue", "break"], ["i == 5", "i == 7"], ["i % 2 == 0", "i % 2 == 1"]],
    why: "continue skips to the next number. break stops the whole loop. Even numbers are skipped, and at 5 the loop stops, so it prints 1 3." },
  { m: "python-control", body: S`for i in range(3):
    if i == 5:
        break
else:
    print("done")
print(i)`, alt: [["i == 5", "i == 1"], ["range(3)", "range(5)"], ["i == 5", "i == 2"]],
    why: "The else of a for loop runs only when the loop was not stopped by break. Here nothing breaks, so done is printed. i ends at 2." },
  { m: "python-control", body: S`for i in range(1, 4):
    print("*" * i)`, alt: [['"*" * i', '"*" * 3'], ["range(1, 4)", "range(3)"], ['"*" * i', "str(i) * i"]],
    why: "\"*\" * i repeats the star i times. So the rows have 1, 2 and 3 stars." },
  { m: "python-control", body: S`names = ["A", "B"]
marks = [70, 90]
for i, (n, m) in enumerate(zip(names, marks), 1):
    print(i, n, m)`, alt: [["enumerate(zip(names, marks), 1)", "enumerate(zip(names, marks))"], ["zip(names, marks)", "zip(marks, names)"], ["[70, 90]", "[70]"]],
    why: "zip pairs the two lists place by place. enumerate(..., 1) numbers the pairs starting from 1." },
  { m: "python-control", body: S`n = 1234
s = 0
while n:
    s += n % 10
    n //= 10
print(s)`, alt: [["n //= 10", "n //= 100"], ["s += n % 10", "s = n % 10"], ["n % 10", "n % 100"]],
    why: "n % 10 is the last digit and n // 10 removes it. It adds 4, 3, 2 and 1, which is 10." },
  { m: "python-control", body: S`print([x * x for x in range(1, 6) if x % 2 == 1])`, alt: [["x % 2 == 1", "x % 2 == 0"], ["x * x", "x + x"], ["x * x", "x ** 3"]],
    why: "The list keeps only the odd numbers 1, 3 and 5, and squares each one: 1, 9, 25." },

  // ---------------------------------------------------------------- python-functions
  { m: "python-functions", body: S`def add(a, b=10):
    return a + b
print(add(5), add(5, 1))`, alt: [["b=10", "b=0"], ["a + b", "a * b"], ["add(5), add(5, 1)", "add(5, 1), add(5)"]],
    why: "When you do not give b, it uses the default 10. So add(5) is 15, and add(5, 1) is 6." },
  { m: "python-functions", body: S`def f(x):
    x = x + 1
    return x
n = 5
f(n)
print(n, f(n))`, alt: [["x = x + 1", "x = x * 2"], ["return x", "return n"], ["n = 5", "n = 0"]],
    why: "The function changes its own copy x. The variable n outside stays 5. f(n) gives back 6." },
  { m: "python-functions", body: S`def add_item(lst):
    lst.append(9)
nums = [1, 2]
add_item(nums)
print(nums)`, alt: [["    lst.append(9)", "    lst = lst + [9]"], ["    lst.append(9)", "    lst.append(9)\n    lst.append(8)"], ["    lst.append(9)", "    lst.insert(0, 9)"]],
    why: "A list is not copied when you pass it. append changes the real list, so nums gets a 9 at the end." },
  { m: "python-functions", body: S`x = 10
def show():
    x = 3
    print(x)
show()
print(x)`, alt: [["    x = 3", "    global x\n    x = 3"], ["show()\nprint(x)", "print(x)\nshow()"], ["x = 10", "x = 20"]],
    why: "x = 3 inside the function makes a new local x. The outside x is still 10." },
  { m: "python-functions", body: S`def fact(n):
    return 1 if n <= 1 else n * fact(n - 1)
print(fact(5))`, alt: [["n * fact(n - 1)", "n + fact(n - 1)"], ["n <= 1", "n <= 2"], ["return 1 if", "return 0 if"]],
    why: "fact(5) is 5 * 4 * 3 * 2 * 1, which is 120." },
  { m: "python-functions", body: S`words = ["pear", "fig", "banana"]
print(sorted(words, key=len))`, alt: [["key=len", "key=lambda w: w[-1]"], ["key=len", "reverse=True"], ["key=len", "key=lambda w: -len(w)"]],
    why: "key=len sorts by how long each word is: fig (3), pear (4), banana (6)." },
  { m: "python-functions", body: S`def make(n):
    def times(x):
        return x * n
    return times
double = make(2)
print(double(5), make(3)(5))`, alt: [["x * n", "x + n"], ["make(2)", "make(4)"], ["make(3)(5)", "make(3)(2)"]],
    why: "make returns a small function that remembers n. double multiplies by 2, so 5 gives 10. make(3)(5) is 15." },
  { m: "python-functions", body: S`def stats(*nums):
    return min(nums), max(nums), sum(nums)
lo, hi, total = stats(4, 9, 2)
print(lo, hi, total)`, alt: [["min(nums), max(nums)", "max(nums), min(nums)"], ["sum(nums)", "len(nums)"], ["stats(4, 9, 2)", "stats(4, 9)"]],
    why: "*nums collects all the numbers. The function gives back three values, and Python unpacks them into lo, hi and total." },
  { m: "python-functions", body: S`def f(a, b=[]):
    b.append(a)
    return b
print(f(1), f(2))`, alt: [["b=[]):\n    b.append(a)", "b=None):\n    b = b or []\n    b.append(a)"], ["b.append(a)", "b.insert(0, a)"], ["print(f(1), f(2))", "print(f(1))\nprint(f(2))"]],
    why: "The default list [] is made only once and shared by every call. So both calls add to the same list." },
  { m: "python-functions", body: S`def div(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        return "no"
print(div(6, 3), div(1, 0))`, alt: [["a / b", "a // b"], ['return "no"', "return 0"], ["div(6, 3)", "div(6, 4)"]],
    why: "Dividing by zero is an error, and except catches it, so div(1, 0) gives no. div(6, 3) is 2.0." },

  // ---------------------------------------------------------------- python-data
  { m: "python-data", body: S`a = [3, 1, 2]
b = a
b.append(4)
c = a.copy()
c.append(5)
print(a, c)`, alt: [["b = a", "b = a.copy()"], ["c = a.copy()", "c = a"], ["print(a, c)", "print(c, a)"]],
    why: "b = a makes a second name for the same list, so a also gets the 4. a.copy() makes a separate list, so the 5 goes only into c." },
  { m: "python-data", body: S`nums = [5, 2, 9, 1]
nums.sort()
print(nums, nums[-1], nums[1:3])`, alt: [["nums.sort()", "nums.sort(reverse=True)"], ["nums[1:3]", "nums[1:2]"], ["nums[-1]", "nums[-2]"]],
    why: "sort() puts the numbers in order: 1, 2, 5, 9. nums[-1] is the last one, and nums[1:3] takes the places 1 and 2." },
  { m: "python-data", body: S`d = {"a": 1, "b": 2}
d["c"] = 3
d["a"] += 10
print(d, len(d), d.get("z", 0))`, alt: [['d["a"] += 10', 'd["a"] = 10'], ['d.get("z", 0)', 'd.get("a", 0)'], ['d["c"] = 3', 'd["a"] = 3']],
    why: "d[\"c\"] = 3 adds a new key. d[\"a\"] += 10 changes its value to 11. get(\"z\", 0) gives 0 when the key is not there." },
  { m: "python-data", body: S`s = {1, 2, 2, 3}
t = {3, 4}
print(len(s), s & t, sorted(s | t))`, alt: [["s & t", "s - t"], ["s | t", "s & t"], ["len(s)", "len(s) + len(t)"]],
    why: "A set keeps each value once, so s is {1, 2, 3}. & is what both have in common. | is everything from both." },
  { m: "python-data", body: S`a, *rest = (1, 2, 3, 4)
print(a, rest, len(rest))`, alt: [["a, *rest", "*rest, a"], ["(1, 2, 3, 4)", "(1, 2)"], ["len(rest)", "len(rest) + 1"]],
    why: "a takes the first value. *rest collects all the other values into a list." },
  { m: "python-data", body: S`words = ["a", "b", "a", "c", "a"]
count = {}
for w in words:
    count[w] = count.get(w, 0) + 1
print(count)`, alt: [["count.get(w, 0) + 1", "count.get(w, 0) + 2"], ["count[w] = count.get(w, 0) + 1", "count[w] = 1"], ['["a", "b", "a", "c", "a"]', '["a", "b", "a", "c"]']],
    why: "For each word it adds 1 to its count (starting from 0). a appears 3 times, b once and c once." },
  { m: "python-data", body: S`s = "a,b,,c"
parts = s.split(",")
print(parts, len(parts), "-".join(parts))`, alt: [['s.split(",")', 's.split(",", 1)'], ['"-".join', '"".join'], ['"a,b,,c"', '"a,b,c"']],
    why: "split cuts at every comma, and two commas in a row give an empty text between them. There are 4 parts." },
  { m: "python-data", body: S`s = "python"
print(s[::-1], s[1:4], s[::2])`, alt: [["s[::-1]", "s[::1]"], ["s[1:4]", "s[1:3]"], ["s[::2]", "s[1::2]"]],
    why: "[::-1] reads from the end to the start. [1:4] takes places 1, 2 and 3. [::2] takes every second letter." },
  { m: "python-data", body: S`g = [[1, 2], [3, 4]]
print(g[1][0], sum(row[1] for row in g), [r[::-1] for r in g])`, alt: [["g[1][0]", "g[0][1]"], ["row[1]", "row[0]"], ["r[::-1]", "r"]],
    why: "g[1][0] is row 1, column 0, which is 3. The second column adds 2 + 4 = 6. Each row is also reversed." },
  { m: "python-data", body: S`marks = {"A": 70, "B": 90, "C": 80}
best = max(marks, key=marks.get)
print(best, sorted(marks, key=marks.get)[0])`, alt: [["max(", "min("], ["marks.get)[0]", "marks.get)[-1]"], ["marks.get)[0]", "marks.get)[1]"]],
    why: "max with key=marks.get finds the name with the biggest mark, which is B. Sorting by marks puts A (70) first." },

  // ---------------------------------------------------------------- python-oop
  { m: "python-oop", body: S`class P:
    def __init__(self, n):
        self.n = n
    def hi(self):
        return "Hi " + self.n
print(P("Ravi").hi())`, alt: [['"Hi "', '"Hello "'], ["self.n = n", "self.n = n.upper()"], ['P("Ravi")', 'P("Sita")']],
    why: "P(\"Ravi\") makes an object and __init__ saves the name. hi() joins Hi with that name." },
  { m: "python-oop", body: S`class C:
    count = 0
    def __init__(self):
        C.count += 1
a = C()
b = C()
print(C.count, a.count)`, alt: [["C.count += 1", "self.count += 1"], ["count = 0", "count = 5"], ["a = C()\nb = C()", "a = C()\nb = C()\nc = C()"]],
    why: "count belongs to the class, so every object shares it. Each new object adds 1 to the same count." },
  { m: "python-oop", body: S`class A:
    def say(self):
        return "A"
class B(A):
    def say(self):
        return "B" + super().say()
print(B().say(), A().say())`, alt: [['"B" + super().say()', '"B"'], ['"B" + super().say()', 'super().say() + "B"'], ["A().say()", "B().say()"]],
    why: "B changes say, and super().say() calls the version in A. So B says BA, and A says only A." },
  { m: "python-oop", body: S`class P:
    def __init__(self, x, y):
        self.x, self.y = x, y
    def __str__(self):
        return f"({self.x}, {self.y})"
print(P(1, 2), str(P(3, 4)))`, alt: [['f"({self.x}, {self.y})"', 'f"({self.y}, {self.x})"'], ["P(1, 2)", "P(5, 6)"], ["str(P(3, 4))", "P(3, 4).x"]],
    why: "print uses __str__ to turn an object into text, so it shows (1, 2) and (3, 4)." },
  { m: "python-oop", body: S`class T:
    def __init__(self, c):
        self._c = c
    @property
    def f(self):
        return self._c * 9 / 5 + 32
print(T(100).f, T(0).f)`, alt: [["* 9 / 5", "* 9 // 5"], ["+ 32", "+ 30"], ["T(100).f, T(0).f", "T(37).f, T(0).f"]],
    why: "@property lets you use f like a variable, without brackets. 100 degrees C is 212.0 F and 0 is 32.0 F." },
  { m: "python-oop", body: S`class A: pass
class B(A): pass
x = B()
print(isinstance(x, B), isinstance(x, A), isinstance(A(), B))`, alt: [["isinstance(A(), B)", "isinstance(A(), A)"], ["x = B()", "x = A()"], ["isinstance(x, A)", "isinstance(x, int)"]],
    why: "A B object is also an A, because B comes from A. But an A object is not a B." },
  { m: "python-oop", body: S`class M:
    @staticmethod
    def add(a, b):
        return a + b
    @classmethod
    def name(cls):
        return cls.__name__
print(M.add(2, 3), M.name())`, alt: [["a + b", "a * b"], ["cls.__name__", "cls.__name__.lower()"], ["M.add(2, 3), M.name()", "M.name(), M.add(2, 3)"]],
    why: "A static method needs no object, and a class method receives the class itself. cls.__name__ is the name of the class, M." },
  { m: "python-oop", body: S`class E:
    def __init__(self):
        self.rpm = 0
class Car:
    def __init__(self):
        self.e = E()
    def start(self):
        self.e.rpm = 800
car = Car()
car.start()
print(car.e.rpm)`, alt: [["800", "1200"], ["car.start()", "pass"], [["self.e.rpm = 800", "self.e.rpm += 800"], ["car.start()", "car.start()\ncar.start()"]]],
    why: "A Car has an engine E inside it. start() sets the engine's rpm to 800." },
  { m: "python-oop", body: S`class V:
    def __init__(self, n):
        self.n = n
    def __add__(self, o):
        return V(self.n + o.n)
print((V(2) + V(5)).n)`, alt: [["self.n + o.n", "self.n * o.n"], ["V(2) + V(5)", "V(2) + V(5) + V(1)"], ["self.n + o.n", "self.n - o.n"]],
    why: "__add__ tells Python what + means for V objects. V(2) + V(5) makes a new V with 7." },
  { m: "python-oop", body: S`class P:
    pass
a = P()
b = P()
c = a
print(a == b, a == c, a is c)`, alt: [["c = a", "c = b"], ["b = P()", "b = a"], ["a == c", "a == b"]],
    why: "By default two objects are equal only when they are the very same object. a and b are different objects. c is another name for a." },

  // ---------------------------------------------------------------- python-tools
  { m: "python-tools", body: S`try:
    n = int("12a")
except ValueError:
    n = -1
finally:
    print("done")
print(n)`, alt: [['"12a"', '"12"'], ["n = -1", "n = 0"], ['print("done")', 'print("end")']],
    why: "int(\"12a\") fails with a ValueError, so n becomes -1. finally always runs, so done is printed first." },
  { m: "python-tools", body: S`class Low(Exception):
    pass
def check(x):
    if x < 5:
        raise Low("low")
    return x
try:
    check(3)
except Low as e:
    print("caught", e)`, alt: [['"low"', '"too low"'], ['print("caught", e)', 'print(e, "caught")'], ['print("caught", e)', 'print("caught", type(e).__name__)']],
    why: "check(3) raises Low with the message low. except catches it, and e holds the message." },
  { m: "python-tools", body: S`with open("t.txt", "w") as f:
    f.write("a\nb\n")
with open("t.txt") as f:
    lines = f.readlines()
print(len(lines), lines[1].strip())`, alt: [[S`"a\nb\n"`, S`"a\nb\nc\n"`], ["lines[1]", "lines[0]"], ["f.readlines()", "f.read()"]],
    why: "The file has two lines. readlines() gives a list of them, and strip() removes the line end from the second one." },
  { m: "python-tools", body: S`import json
data = json.loads('{"a": [1, 2], "b": {"c": 3}}')
print(data["a"][1], data["b"]["c"], len(data))`, alt: [['["a"][1]', '["a"][0]'], ['["b"]["c"]', '["b"]'], ["len(data)", "len(data) + 5"]],
    why: "json.loads turns text into lists and dictionaries. data[\"a\"][1] is 2, data[\"b\"][\"c\"] is 3, and data has 2 keys." },
  { m: "python-tools", body: S`import math
print(math.floor(3.7), math.ceil(3.2), round(2.5), round(3.5))`, alt: [["round(2.5)", "math.floor(2.5 + 0.5)"], ["math.floor(3.7)", "math.ceil(3.7)"], ["round(3.5)", "round(3.4)"]],
    why: "floor rounds down and ceil rounds up. Python's round() sends .5 to the nearest even number, so 2.5 becomes 2 and 3.5 becomes 4." },
  { m: "python-tools", body: S`from collections import Counter
c = Counter("banana")
print(c["a"], c.most_common(1))`, alt: [['"banana"', '"mississippi"'], ['c["a"]', 'c["n"]'], ["most_common(1)", "most_common(2)"]],
    why: "Counter counts each letter. a appears 3 times in banana, and most_common(1) gives the top one." },
  { m: "python-tools", body: S`def avg(xs):
    return sum(xs) / len(xs)
try:
    print(avg([]))
except ZeroDivisionError:
    print("empty")
print(avg([2, 4]))`, alt: [["avg([2, 4])", "avg([2, 5])"], ["/ len(xs)", "// len(xs)"], ['print("empty")', "print(0)"]],
    why: "avg([]) divides by 0 and fails, so except prints empty. The average of 2 and 4 is 3.0." },
  { m: "python-tools", body: S`def gen(n):
    for i in range(n):
        yield i * 2
g = gen(3)
print(next(g), next(g), list(g))`, alt: [["i * 2", "i + 2"], ["range(n)", "range(n + 1)"], ["list(g)", "next(g)"]],
    why: "yield gives one value at a time, and remembers where it stopped. The first two next() give 0 and 2. list(g) takes what is left: 4." },
  { m: "python-tools", body: S`print(sorted({3: "c", 1: "a", 2: "b"}.items())[0], list(map(lambda x: x * 2, [1, 2, 3])), any(x > 2 for x in [1, 2, 3]), all(x > 2 for x in [1, 2, 3]))`, alt: [["x * 2", "x ** 2"], ["any(x > 2", "any(x > 3"], ["[0]", "[-1]"]],
    why: "Sorted pairs start with key 1. map doubles each number. any is true when at least one is more than 2. all is true only when every one is." },
  { m: "python-tools", body: S`x = 3.14159
print(f"{x:.2f}", round(x, 1), f"{42:05d}", f"{1234567:,}")`, alt: [[".2f", ".3f"], ["round(x, 1)", "round(x)"], ["05d", "5d"], [",}", "}"]],
    why: ".2f keeps 2 digits after the point. 05d fills with zeros to width 5. , adds commas to a big number." },
];
