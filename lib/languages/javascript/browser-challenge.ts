import type { HtmlChallenge } from "../types";

const PAGE = (script: string) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Tasks</title></head>
<body>
  <input id="task" placeholder="New task">
  <button id="add">Add</button>
  <p id="count">0 tasks</p>
  <ul id="list"></ul>
  <script>
${script}
  </script>
</body>
</html>
`;

export const TASK_SCRIPT_REF = `    const input = document.querySelector("#task");
    const add = document.querySelector("#add");
    const list = document.querySelector("#list");
    const count = document.querySelector("#count");
    let tasks = [];
    try { tasks = JSON.parse(localStorage.getItem("tasks") || "[]"); } catch (e) { tasks = []; }
    function draw() {
      list.innerHTML = "";
      for (const t of tasks) {
        const li = document.createElement("li");
        li.textContent = t;
        list.append(li);
      }
      count.textContent = tasks.length + (tasks.length === 1 ? " task" : " tasks");
    }
    add.addEventListener("click", () => {
      const text = input.value.trim();
      if (text === "") return;
      tasks.push(text);
      try { localStorage.setItem("tasks", JSON.stringify(tasks)); } catch (e) { /* storage may be blocked */ }
      input.value = "";
      draw();
    });
    draw();`;

const ids = (calls: { callee: string; strings: string[] }[], id: string) => calls.some((c) => /(^|\.)(querySelector|getElementById)$/.test(c.callee) && c.strings.some((s) => s === id || s === `#${id}`));

export const browserChallenge: HtmlChallenge = {
  kind: "html",
  title: "A task list that remembers",
  statement: "Make this page work. When the person types a task and presses Add, the task appears in the list, the count says how many tasks there are, the box is cleared, and the tasks are still there after the page is reloaded. Write the JavaScript inside the <script> element. Your code is checked by reading it, so use the techniques in the requirements; try it in the preview to see it work.",
  starter: PAGE("    // write your JavaScript here"),
  reference: PAGE(TASK_SCRIPT_REF),
  requirements: [
    { text: "The page keeps its four parts: the input #task, the button #add, the paragraph #count and the list #list.", test: (d) => !!d.one("input#task") && !!d.one("button#add") && !!d.one("p#count, #count") && !!d.one("ul#list, ol#list") },
    { text: "Your script selects those four elements with document.querySelector or document.getElementById.", test: (d) => !d.js.error && ["task", "add", "count", "list"].every((id) => ids(d.js.calls, id)) },
    { text: "The Add button gets a click handler with addEventListener(\"click\", …).", test: (d) => d.js.callsTo("addEventListener").some((c) => c.firstString === "click") },
    { text: "Each task is shown as a new <li> made with document.createElement(\"li\") and put in the list with append or appendChild.", test: (d) => d.js.callsTo("createElement").some((c) => c.firstString === "li") && (d.js.callsTo("append").length + d.js.callsTo("appendChild").length > 0) },
    { text: "The text comes from the input’s value, with spaces trimmed off, and a blank task is not added.", test: (d) => /\.value\b/.test(d.source) && d.js.callsTo("trim").length > 0 },
    { text: "The input is cleared after a task is added (its value is set to an empty string).", test: (d) => d.js.assigns.some((a) => a.target.endsWith(".value") && a.empty) },
    { text: "The typed text is put in with textContent, never with innerHTML (a person could type HTML).", test: (d) => d.js.assignsTo("textContent") >= 1 && d.js.assignsTo("innerHTML") === 0 },
    { text: "The count paragraph is updated with textContent every time the list changes.", test: (d) => d.js.assignsTo("textContent") >= 2 },
    { text: "Tasks are saved with localStorage.setItem and JSON.stringify.", test: (d) => d.js.callsTo("setItem").length > 0 && d.js.callsTo("stringify").length > 0 },
    { text: "Saved tasks are read back with localStorage.getItem and JSON.parse inside a try block, because storage can be empty or blocked.", test: (d) => d.js.callsInTry.some((c) => c.endsWith("getItem")) && d.js.callsInTry.some((c) => c.endsWith("JSON.parse")) },
  ],
  commonMistakes: [
    PAGE(TASK_SCRIPT_REF.replace("li.textContent = t;", "li.innerHTML = t;")),
    PAGE(TASK_SCRIPT_REF.replace('add.addEventListener("click", () => {', "add.onclick = () => {").replace("      draw();\n    });\n    draw();", "      draw();\n    };\n    draw();")),
    PAGE(TASK_SCRIPT_REF.replace(/\n\s*try \{ localStorage\.setItem[^\n]*/, "")),
    PAGE(TASK_SCRIPT_REF.replace("input.value.trim()", "input.value")),
    PAGE(TASK_SCRIPT_REF.replace('      input.value = "";\n', "")),
    PAGE(TASK_SCRIPT_REF.replace(/\n\s*count\.textContent = [^\n]*/, "")),
    PAGE(TASK_SCRIPT_REF.replace('try { tasks = JSON.parse(localStorage.getItem("tasks") || "[]"); } catch (e) { tasks = []; }', 'tasks = JSON.parse(localStorage.getItem("tasks") || "[]");')),
    PAGE(TASK_SCRIPT_REF).replace('  <ul id="list"></ul>\n', ""),
    PAGE(TASK_SCRIPT_REF.replace('const li = document.createElement("li");\n        li.textContent = t;\n        list.append(li);', 'list.textContent += t;')),
    PAGE(TASK_SCRIPT_REF.replace('document.querySelector("#count")', "null")),
    PAGE("    const x = ;"),
  ],
};
