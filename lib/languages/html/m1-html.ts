import { lesson, q, sec, type TrackModule } from "../types";

export const htmlBasics: TrackModule = {
  key: "html-basics",
  title: "HTML: the structure of a page",
  summary: "Write a valid page, add text, links and images, and organise content with lists and tables.",
  lessons: [
    lesson("page-structure", "The structure of an HTML page", 10, {
      summary: "HTML describes what content is, not how it looks. Every page has the same skeleton: a doctype, an html element, a head for information about the page and a body for what people see.",
      sections: [
        sec("Elements, tags and attributes", [
          "An element is an opening tag, content and a closing tag, such as <p>Hello</p>. Some elements are empty and have no closing tag, such as <img> and <br>. Attributes add detail inside the opening tag, as in <a href=\"https://example.com\">.",
          "Elements nest inside each other and must close in the reverse order they opened. Browsers forgive many mistakes, but broken nesting leads to pages that look different in different browsers.",
        ], {
          title: "A minimal page",
          code: `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8">\n    <title>My first page</title>\n  </head>\n  <body>\n    <h1>Hello, web</h1>\n    <p>This is my <strong>first</strong> page.</p>\n  </body>\n</html>`,
          explanation: "The head holds the title shown on the browser tab; the body holds the visible heading and paragraph.",
        }),
        sec("What goes in the head", [
          "The title appears on the tab and in search results. meta charset=\"utf-8\" makes text such as ₹ and Telugu or Hindi letters display correctly. The viewport meta tag makes a page behave properly on phones.",
        ], {
          title: "Head for a phone-friendly page",
          code: `<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Price: ₹499</title>\n</head>\n<body><p>The rupee sign shows correctly.</p></body>\n</html>`,
          explanation: "With utf-8 declared, the ₹ sign renders properly, and the viewport tag stops phones from zooming the page out.",
        }),
      ],
      takeaways: ["HTML describes meaning and structure; CSS handles looks.", "Every page needs a doctype, html, head and body.", "Elements must nest and close in order."],
      mistakes: ["Forgetting the doctype, which puts the browser in quirks mode.", "Closing tags in the wrong order.", "Leaving out meta charset so special characters turn into symbols."],
      check: [
        q("Where does the text of the browser tab come from?", ["The h1 element", "The title element in head", "The first p element", "The lang attribute"], 1, "The title element inside head sets the tab text."),
        q("Which of these is an empty element?", ["p", "div", "img", "h1"], 2, "img has no content or closing tag."),
        q("What does the doctype declaration do?", ["Loads CSS", "Tells the browser to use standard mode", "Sets the language", "Adds a title"], 1, "It switches off the old quirks mode."),
      ],
    }),
    lesson("text-links-images", "Text, links and images", 12, {
      summary: "Headings, paragraphs, links and images make up most of the web. Choosing the right element gives the page structure that browsers, search engines and screen readers understand.",
      sections: [
        sec("Headings and text", [
          "h1 to h6 give a page its outline: one h1 for the page topic, then h2 for sections and h3 for parts of a section. Do not pick a heading for its size; use CSS for size. p holds a paragraph, strong marks strong importance and em marks emphasis.",
        ], {
          title: "An outline",
          code: `<h1>Campus placement guide</h1>\n<h2>Before the test</h2>\n<p>Practise <strong>aptitude</strong> daily.</p>\n<h2>Interview day</h2>\n<p>Be <em>on time</em> and carry your documents.</p>`,
          explanation: "One h1 names the page, and each h2 starts a section; strong and em carry meaning, not just looks.",
        }),
        sec("Links and images", [
          "a with an href attribute creates a link; the text between the tags is what people click. An absolute URL starts with https://, while a relative path such as about.html points to a file on the same site. img needs src for the file and alt for a text description used by screen readers and shown if the image fails to load.",
        ], {
          title: "A link and an image",
          code: `<p>Read the <a href="https://developer.mozilla.org/">MDN web docs</a>.</p>\n<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Crect width='120' height='60' fill='%232b6cb0'/%3E%3C/svg%3E" alt="A blue banner" width="120" height="60">`,
          explanation: "The link text says where it goes. The image has alt text and a fixed size so the page does not jump while loading.",
        }),
      ],
      takeaways: ["Use one h1 and nested headings in order.", "Link text should say where the link goes.", "Every img needs a meaningful alt."],
      mistakes: ["Writing 'click here' as link text.", "Skipping heading levels to get a smaller font.", "Leaving alt empty on an image that carries information."],
      check: [
        q("Which attribute gives the destination of a link?", ["src", "href", "alt", "link"], 1, "href holds the link target."),
        q("Why does an image need alt text?", ["To make it load faster", "To describe it for screen readers and failed loads", "To resize it", "To make it clickable"], 1, "alt is the text alternative for the image."),
        q("How many h1 elements should a normal page have?", ["None", "One", "One per paragraph", "As many as possible"], 1, "One h1 names the main topic of the page."),
      ],
    }),
    lesson("lists-tables", "Lists and tables", 10, {
      summary: "Use lists for items that belong together and tables for data that has rows and columns. Both give structure that a screen reader can announce.",
      sections: [
        sec("Ordered and unordered lists", [
          "ul is a bulleted list where order does not matter, and ol is a numbered list where it does. Each item is an li. Lists can nest by putting a new ul or ol inside an li.",
        ], {
          title: "Two lists",
          code: `<h3>Skills</h3>\n<ul>\n  <li>HTML</li>\n  <li>CSS</li>\n  <li>JavaScript</li>\n</ul>\n<h3>Steps to apply</h3>\n<ol>\n  <li>Create a profile</li>\n  <li>Take the assessment</li>\n  <li>Apply</li>\n</ol>`,
          explanation: "The skills list is bulleted; the steps list is numbered because order matters.",
        }),
        sec("Tables for data", [
          "A table holds rows (tr) of cells: th for header cells and td for data cells. thead and tbody separate the heading row from the data. Do not use tables to lay out a page; that job belongs to CSS.",
        ], {
          title: "A results table",
          code: `<table border="1" cellpadding="6">\n  <thead>\n    <tr><th>Student</th><th>Score</th></tr>\n  </thead>\n  <tbody>\n    <tr><td>Asha</td><td>82</td></tr>\n    <tr><td>Ravi</td><td>74</td></tr>\n  </tbody>\n</table>`,
          explanation: "The th cells head the columns, and each tr in tbody is one student's row.",
        }),
      ],
      takeaways: ["ul for unordered, ol for ordered items.", "th marks headers and td marks data cells.", "Tables are for data, never for layout."],
      mistakes: ["Using br tags to fake a list.", "Putting text directly inside ul instead of li.", "Using a table to position page sections."],
      check: [
        q("Which element makes a numbered list?", ["ul", "ol", "li", "dl"], 1, "ol is an ordered list."),
        q("Which element is a header cell in a table?", ["td", "tr", "th", "thead"], 2, "th is a header cell."),
        q("Which is the right job for a table?", ["Page layout", "Rows and columns of data", "Menus", "Backgrounds"], 1, "Tables present tabular data."),
      ],
    }),
  ],
};

export const htmlForms: TrackModule = {
  key: "html-forms",
  title: "HTML: forms and meaning",
  summary: "Collect input with forms, use semantic elements for page structure and make pages usable for everyone.",
  lessons: [
    lesson("forms-inputs", "Forms and inputs", 14, {
      summary: "A form collects what people type or choose. Each field needs a label, a name and the right input type so the browser can help with the keyboard and check the value.",
      sections: [
        sec("Labels and input types", [
          "Connect a label to its input by matching the label's for attribute to the input's id. Clicking the label then focuses the field, and screen readers read it. The type attribute picks the control: text, email, number, date, password, checkbox, radio and more.",
        ], {
          title: "A sign-up form",
          code: `<form>\n  <p><label for="n">Name</label><br><input id="n" name="name" type="text" required></p>\n  <p><label for="e">Email</label><br><input id="e" name="email" type="email" required></p>\n  <p><label for="a">Age</label><br><input id="a" name="age" type="number" min="16" max="60"></p>\n  <button type="submit">Register</button>\n</form>`,
          explanation: "The browser checks that email looks like an email and that age is between 16 and 60 before the form can submit.",
        }),
        sec("Choices and long text", [
          "Radio buttons that share a name let the user pick one; checkboxes allow several. select gives a drop-down list and textarea holds longer text. The name attribute is the key the server receives each value under.",
        ], {
          title: "Choices",
          code: `<form>\n  <fieldset>\n    <legend>Year</legend>\n    <label><input type="radio" name="year" value="3"> 3rd</label>\n    <label><input type="radio" name="year" value="4"> 4th</label>\n  </fieldset>\n  <p><label for="b">Branch</label>\n  <select id="b" name="branch"><option>CSE</option><option>ECE</option><option>EEE</option></select></p>\n  <p><label for="m">About you</label><br><textarea id="m" name="about" rows="3" cols="30"></textarea></p>\n</form>`,
          explanation: "The two radio buttons share the name year, so only one can be chosen; fieldset and legend group them.",
        }),
      ],
      takeaways: ["Every field needs a label connected by for and id.", "type picks the control and the built-in checking.", "name is the key the server receives."],
      mistakes: ["Using placeholder text instead of a label.", "Giving radio buttons different names so several can be picked.", "Forgetting name, so the value is not sent at all."],
      check: [
        q("How do you connect a label to an input?", ["Put them in the same p", "Match label for to input id", "Give both the same class", "Use the title attribute"], 1, "The for attribute matches the input's id."),
        q("What makes radio buttons act as one group?", ["The same id", "The same name", "The same value", "The same label"], 1, "Radios sharing a name allow one choice."),
        q("Which input type shows an email keyboard on phones and checks the format?", ["text", "email", "url", "search"], 1, "type=email gives both."),
      ],
    }),
    lesson("semantic-html", "Semantic structure", 10, {
      summary: "Elements such as header, nav, main, section, article and footer say what each part of a page is. That helps search engines, screen readers and other developers.",
      sections: [
        sec("Landmarks instead of div soup", [
          "A div says nothing about its content. header holds the page or section heading, nav holds main navigation links, main holds the one main content area, article is a self-contained piece, section groups related content with a heading and footer closes a page or section. Use div only when no meaningful element fits.",
        ], {
          title: "A semantic page",
          code: `<body>\n  <header><h1>Capabilio Blog</h1>\n    <nav><a href="#a">Articles</a> | <a href="#c">Contact</a></nav>\n  </header>\n  <main>\n    <article id="a">\n      <h2>Why proof beats a resume</h2>\n      <p>Employers trust what you can show.</p>\n    </article>\n  </main>\n  <footer><p>Contact: hello@example.com</p></footer>\n</body>`,
          explanation: "Each region is named by its element, so a screen reader user can jump straight to the navigation or the main content.",
        }),
        sec("Why it matters", [
          "Semantic pages rank better, work with reader modes and are easier to style and maintain. A button should be a button element, not a div with a click handler, because it gets keyboard and screen reader support for free.",
        ]),
      ],
      takeaways: ["Choose the element by meaning, not looks.", "Use one main element per page.", "A real button beats a clickable div."],
      mistakes: ["Wrapping everything in div elements.", "Using more than one main element.", "Using a heading just to make text bigger."],
      check: [
        q("Which element holds the main navigation links?", ["header", "nav", "aside", "section"], 1, "nav marks navigation."),
        q("How many main elements should a page have?", ["One", "Two", "One per section", "None"], 0, "A page has a single main content area."),
        q("Why use a button element rather than a styled div?", ["It loads faster", "It gets keyboard and screen reader support built in", "It is smaller", "It needs no CSS"], 1, "Native elements carry accessibility behaviour."),
      ],
    }),
    lesson("accessibility-basics", "Accessibility basics", 10, {
      summary: "Accessible pages work for people who use screen readers, keyboards, zoom or voice control. Most of it comes from writing correct HTML.",
      sections: [
        sec("The habits that cover most cases", [
          "Write meaningful alt text, connect labels to inputs, use headings in order, keep link text descriptive and set the page language with the lang attribute. Make sure everything can be reached and used with the Tab key and that the focus outline is never removed without a replacement.",
          "Colour must not be the only signal: an error shown only in red is invisible to some users, so add text such as 'Error: enter a valid email'. Text needs enough contrast with its background, at least 4.5 to 1 for normal text.",
        ], {
          title: "An accessible error message",
          code: `<form>\n  <label for="em">Email</label>\n  <input id="em" type="email" aria-describedby="em-err" aria-invalid="true">\n  <p id="em-err" style="color:#b00020">Error: enter an address like name@example.com</p>\n  <button>Send</button>\n</form>`,
          explanation: "The message uses words as well as colour, and aria-describedby tells a screen reader which message belongs to the field.",
        }),
        sec("Testing it yourself", [
          "Put the mouse aside and use only the Tab key: you should reach every link, button and field in a sensible order and always see where the focus is. Zoom the page to 200 percent and check nothing is cut off. Browser developer tools include an accessibility check that flags missing labels and low contrast, and a screen reader such as NVDA (free on Windows) or VoiceOver on a Mac shows how the page really sounds.",
        ]),
      ],
      takeaways: ["Correct HTML gives most accessibility for free.", "Never rely on colour alone.", "Everything must work with the keyboard."],
      mistakes: ["Removing the focus outline with outline: none.", "Using vague link text such as 'here'.", "Low-contrast grey text on white."],
      check: [
        q("What is the minimum contrast ratio for normal text?", ["2 to 1", "3 to 1", "4.5 to 1", "10 to 1"], 2, "WCAG asks for 4.5 to 1 for normal text."),
        q("Which attribute sets the page language?", ["lang", "language", "locale", "charset"], 0, "lang on the html element sets it."),
        q("Why add words to an error shown in red?", ["Red is not allowed", "Colour alone is not seen by everyone", "Words load faster", "Browsers need it"], 1, "Colour-blind and screen reader users need text."),
      ],
    }),
  ],
};
