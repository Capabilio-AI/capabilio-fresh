import { lesson, q, sec, type TrackModule } from "../types";

export const jsModern: TrackModule = {
  key: "js-modern",
  title: "Classes, errors and async code",
  summary: "Classes, error handling, promises and async/await: the tools of real applications.",
  lessons: [
    lesson("classes-js", "Classes", 12, {
      summary: "A class is a blueprint for objects that share data and behaviour. Frameworks such as React and Angular and most Node.js codebases use classes and objects heavily.",
      sections: [
        sec("Defining a class", [
          "A class has a constructor that sets up each new object and methods that act on it. this refers to the object being worked on. Create objects with new. extends builds a class on top of another, and super calls the parent's version.",
        ], {
          title: "A class and a subclass",
          code: 'class Account {\n  constructor(owner, balance = 0) {\n    this.owner = owner;\n    this.balance = balance;\n  }\n  deposit(amount) {\n    this.balance += amount;\n    return this;\n  }\n}\nclass Savings extends Account {\n  addInterest() {\n    this.balance = Math.round(this.balance * 1.04);\n  }\n}\nconst s = new Savings("Asha", 1000);\ns.deposit(500).addInterest();\nconsole.log(s.owner, s.balance);\n',
          explanation: "Savings inherits deposit from Account and adds interest. 1500 plus 4 percent is 1560. Output: Asha 1560.",
        }),
        sec("Classes and plain objects", [
          "A class is mostly a tidy way to build objects that share methods. Many JavaScript programs use plain objects and functions instead, and both styles are normal. Use a class when you need many similar objects with behaviour, and a plain object for simple data. Private fields start with # and cannot be read from outside the class.",
        ]),
      ],
      takeaways: ["constructor sets up each object.", "this is the object a method is called on.", "extends and super reuse a parent class."],
      mistakes: ["Forgetting new when creating an object.", "Using a method as a callback and losing this.", "Calling this before super in a subclass constructor."],
      check: [
        q("Which keyword creates an object from a class?", ["make", "new", "create", "class"], 1, "new calls the constructor."),
        q("What does extends do?", ["Imports a file", "Makes a class inherit from another", "Adds a method", "Copies an object"], 1, "The subclass inherits the parent's members."),
        q("What is this inside a method?", ["The class", "The object the method was called on", "The window", "undefined always"], 1, "It points to the current object."),
      ],
    }),
    lesson("errors-js", "Handling errors", 10, {
      summary: "Errors will happen: bad input, missing data, a failed request. try and catch let a program deal with them instead of crashing.",
      sections: [
        sec("try, catch and finally", [
          "Code that might fail goes in try. If it throws, execution jumps to catch, which receives the error. finally runs either way, which is the place to clean up. Throw your own errors with throw new Error(\"message\") when a function receives something it cannot use.",
        ], {
          title: "Validate and catch",
          code: 'function parseAge(text) {\n  const age = Number(text);\n  if (Number.isNaN(age) || age < 0) {\n    throw new Error("Invalid age: " + text);\n  }\n  return age;\n}\nfor (const input of ["21", "abc"]) {\n  try {\n    console.log("age", parseAge(input));\n  } catch (e) {\n    console.log(e.message);\n  } finally {\n    console.log("checked", input);\n  }\n}\n',
          explanation: "The bad input throws and is caught, and finally runs both times. Output: age 21, checked 21, Invalid age: abc, checked abc.",
        }),
        sec("Error types and rethrowing", [
          "JavaScript has built-in error types such as TypeError, RangeError and SyntaxError, and you can write your own by extending Error. Catch an error only when you can do something useful with it, such as showing a message or retrying. If you cannot handle it, let it continue upward by throwing it again; a swallowed error is a bug that is hard to find later.",
        ]),
      ],
      takeaways: ["try holds risky code and catch handles the error.", "finally always runs.", "Throw an Error with a clear message for bad input."],
      mistakes: ["Catching an error and ignoring it silently.", "Throwing plain strings instead of Error objects.", "Wrapping huge blocks of code in one try."],
      check: [
        q("When does the finally block run?", ["Only on error", "Only on success", "Always", "Never"], 2, "finally runs in every case."),
        q("What should you throw?", ["A string", "An Error object", "A number", "null"], 1, "Error objects carry a message and a stack."),
        q("What does catch receive?", ["The error that was thrown", "The return value", "Nothing", "The function"], 0, "The thrown value becomes the parameter."),
      ],
    }),
    lesson("async-js", "Promises and async/await", 16, {
      summary: "Some work takes time: a network request, a timer, a file read. JavaScript does not stop and wait; it uses promises so the page stays responsive.",
      sections: [
        sec("Promises", [
          "A promise stands for a value that will arrive later. It is pending, then either fulfilled with a value or rejected with an error. .then handles success, .catch handles failure and Promise.all waits for several promises together.",
        ], {
          title: "A promise",
          code: 'const wait = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));\nconsole.log("start");\nwait(100, "done").then((v) => console.log(v));\nconsole.log("end");\n',
          explanation: "The synchronous lines run first and the timer result arrives later. Output: start, end, done.",
        }),
        sec("async and await", [
          "An async function always returns a promise, and inside it await pauses until a promise settles, so asynchronous code reads like normal top-to-bottom code. Use try and catch around await to handle rejections.",
        ], {
          title: "async/await",
          code: 'const wait = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));\nasync function main() {\n  try {\n    const a = await wait(50, "profile");\n    const [b, c] = await Promise.all([wait(50, "jobs"), wait(30, "alerts")]);\n    console.log(a, b, c);\n    await Promise.reject(new Error("server down"));\n  } catch (e) {\n    console.log("failed:", e.message);\n  }\n}\nmain();\n',
          explanation: "The first await finishes, then two requests run together, then the rejection is caught. Output: profile jobs alerts, then failed: server down.",
        }),
      ],
      takeaways: ["A promise is a value that arrives later.", "await pauses an async function, not the whole program.", "Promise.all runs independent work together."],
      mistakes: ["Forgetting await and using a promise as if it were its value.", "Awaiting independent requests one after another.", "No catch, so a rejection goes unhandled."],
      check: [
        q("What does await do inside an async function?", ["Blocks the whole page", "Pauses that function until the promise settles", "Cancels the promise", "Creates a promise"], 1, "Other code keeps running."),
        q("What does an async function return?", ["The value directly", "A promise", "undefined", "A callback"], 1, "It always wraps the result in a promise."),
        q("Which helps run independent requests at the same time?", ["Promise.all", "Promise.sleep", "await all", "setTimeout"], 0, "Promise.all waits for them together."),
      ],
    }),
  ],
};

export const jsBrowser: TrackModule = {
  key: "js-browser",
  title: "JavaScript in the browser",
  summary: "Change the page with the DOM, respond to clicks and typing, and store small data in the browser.",
  lessons: [
    lesson("dom-js", "The DOM", 12, {
      summary: "The browser turns an HTML page into a tree of objects called the DOM. JavaScript reads and changes that tree, and the page updates at once.",
      sections: [
        sec("Selecting and changing", [
          "document.querySelector finds the first element matching a CSS selector and querySelectorAll finds all of them. Then change its textContent, its classList or its style. Prefer textContent over innerHTML for text, because innerHTML with user input can allow script injection.",
        ], {
          title: "Change a heading",
          code: `<h1 id="title">Loading…</h1>\n<ul id="list"></ul>\n<script>\n  document.querySelector("#title").textContent = "Open roles";\n  const list = document.querySelector("#list");\n  for (const role of ["Frontend", "Backend", "Data"]) {\n    const li = document.createElement("li");\n    li.textContent = role;\n    list.append(li);\n  }\n</script>`,
          explanation: "The heading text is replaced and three list items are created and added to the page.",
        }),
        sec("Classes and styles", [
          "element.classList.add, remove and toggle change CSS classes, which is better than setting styles one by one because the look stays in your stylesheet. Read form values with input.value. Wrap page-changing code in a function so you can run it again after the data changes, and keep the data separate from the DOM so the page is easy to redraw.",
        ]),
      ],
      takeaways: ["querySelector finds elements with CSS selectors.", "textContent changes text safely.", "createElement and append build new elements."],
      mistakes: ["Running the script before the element exists in the page.", "Using innerHTML with text typed by a user.", "Forgetting that querySelector returns null when nothing matches."],
      check: [
        q("Which method finds the first element matching a CSS selector?", ["getAll", "querySelector", "findElement", "select"], 1, "querySelector takes a selector."),
        q("Why prefer textContent over innerHTML for user text?", ["It is shorter", "It does not run injected HTML or script", "It is required", "It is faster at nothing"], 1, "innerHTML can execute untrusted markup."),
        q("What does the DOM represent?", ["The server", "The page as a tree of objects", "The CSS file", "The network"], 1, "It is the live structure of the page."),
      ],
    }),
    lesson("events-js", "Events", 12, {
      summary: "Events are things that happen on a page: a click, a key press, a form submit. You attach a function that runs when the event occurs.",
      sections: [
        sec("Listening for events", [
          "element.addEventListener(\"click\", handler) runs the handler each time that element is clicked. The handler receives an event object. For a form, listen for submit and call event.preventDefault() so the browser does not reload the page.",
        ], {
          title: "A counter button and a form",
          code: `<button id="b">Clicked 0 times</button>\n<form id="f"><input id="n" placeholder="Your name"> <button>Greet</button></form>\n<p id="out"></p>\n<script>\n  let count = 0;\n  const b = document.querySelector("#b");\n  b.addEventListener("click", () => { count++; b.textContent = "Clicked " + count + " times"; });\n  document.querySelector("#f").addEventListener("submit", (e) => {\n    e.preventDefault();\n    document.querySelector("#out").textContent = "Hello, " + document.querySelector("#n").value + "!";\n  });\n</script>`,
          explanation: "The first button counts clicks. Submitting the form shows a greeting without reloading, because preventDefault stops the default action.",
        }),
        sec("Event delegation", [
          "Instead of adding a listener to every item in a list, add one to the parent and look at event.target to see which child was clicked. It works for items added later and uses less memory. Other common events are input (each keystroke), change, keydown, mouseover and DOMContentLoaded, which fires when the page has been read.",
        ]),
      ],
      takeaways: ["addEventListener attaches a handler to an event.", "The handler gets an event object.", "preventDefault stops the browser's default action."],
      mistakes: ["Calling the function instead of passing it: addEventListener(\"click\", f()).", "Forgetting preventDefault on a form and losing the page state.", "Adding the same listener again and again in a loop."],
      check: [
        q("Which call runs code when a button is clicked?", ["button.onclick()", "button.addEventListener(\"click\", handler)", "click(button)", "button.listen()"], 1, "addEventListener registers the handler."),
        q("What does event.preventDefault() do on a form submit?", ["Submits twice", "Stops the page reloading", "Clears the form", "Closes the page"], 1, "It cancels the default browser action."),
        q("What is passed to an event handler?", ["The event object", "Nothing", "The page", "A promise"], 0, "The browser passes an event object."),
      ],
    }),
    lesson("storage-fetch", "Storage and talking to servers", 14, {
      summary: "Pages can remember small things in the browser and fetch data from servers. This is how a job board loads listings and a to-do app keeps your tasks.",
      sections: [
        sec("localStorage", [
          "localStorage keeps text under a key, even after the page is closed. It stores only strings, so use JSON.stringify and JSON.parse for objects. It is not private or safe for secrets: any script on the page can read it, and it can be empty or blocked, so always have a fallback.",
        ], {
          title: "Remember a task list",
          code: `<ul id="l"></ul><button id="a">Add task</button>\n<script>\n  let tasks = [];\n  try { tasks = JSON.parse(localStorage.getItem("tasks") || "[]"); } catch (e) { tasks = []; }\n  const draw = () => { document.querySelector("#l").innerHTML = ""; tasks.forEach((t) => { const li = document.createElement("li"); li.textContent = t; document.querySelector("#l").append(li); }); };\n  document.querySelector("#a").addEventListener("click", () => {\n    tasks.push("Task " + (tasks.length + 1));\n    try { localStorage.setItem("tasks", JSON.stringify(tasks)); } catch (e) {}\n    draw();\n  });\n  draw();\n</script>`,
          explanation: "Each click adds a task and saves the list. The reads and writes are wrapped in try because storage can be blocked.",
        }),
        sec("fetch", [
          "fetch(url) returns a promise for a response. Check response.ok, because a 404 or 500 does not reject by itself, then call response.json() for the data. Put the call in an async function with try and catch to handle network failures.",
        ], {
          title: "A fetch helper",
          code: `<p id="s">Not loaded</p>\n<script>\n  async function load(url) {\n    try {\n      const res = await fetch(url);\n      if (!res.ok) throw new Error("HTTP " + res.status);\n      return await res.json();\n    } catch (e) {\n      return { error: e.message };\n    }\n  }\n  load("/does-not-exist.json").then((r) => { document.querySelector("#s").textContent = r.error ? "Failed: " + r.error : "Loaded"; });\n</script>`,
          explanation: "A missing file does not throw by itself; the ok check turns it into an error that the catch turns into a message.",
        }),
      ],
      takeaways: ["localStorage keeps strings between visits.", "Check response.ok after fetch.", "Wrap storage and network calls in try and catch."],
      mistakes: ["Storing passwords or tokens in localStorage.", "Assuming fetch rejects on a 404.", "Forgetting JSON.parse when reading stored objects."],
      check: [
        q("What type of value does localStorage store?", ["Objects", "Strings", "Functions", "Numbers only"], 1, "Everything is stored as text."),
        q("Does fetch reject when the server answers 404?", ["Yes", "No, you must check response.ok", "Only on Fridays", "Only for POST"], 1, "It rejects only on network failure."),
        q("Which method reads the JSON body of a response?", ["response.parse()", "response.json()", "response.text.json", "JSON.fetch()"], 1, "response.json() returns a promise for the data."),
      ],
    }),
  ],
};
