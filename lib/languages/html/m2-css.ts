import { lesson, q, sec, type TrackModule } from "../types";

export const cssBasics: TrackModule = {
  key: "css-basics",
  title: "CSS: styling a page",
  summary: "Select elements, understand how rules combine, size things with the box model and style text and colour.",
  lessons: [
    lesson("selectors-cascade", "Selectors and the cascade", 12, {
      summary: "A CSS rule picks elements with a selector and sets properties on them. When several rules match, the cascade decides which one wins.",
      sections: [
        sec("Writing a rule", [
          "A rule is a selector followed by braces holding property: value pairs. An element selector such as p matches every paragraph, a class selector .note matches elements with class=\"note\", and an id selector #top matches the one element with that id. Prefer classes: they are reusable and easy to override.",
        ], {
          title: "Element, class and id",
          code: `<style>\n  p { color: #333; }\n  .note { background: #fff3cd; padding: 8px; }\n  #top { font-size: 28px; }\n</style>\n<h1 id="top">Styled page</h1>\n<p>A normal paragraph.</p>\n<p class="note">A highlighted note.</p>`,
          explanation: "Both paragraphs get the grey colour; only the second also matches .note and gets the yellow background.",
        }),
        sec("Which rule wins", [
          "When two rules set the same property, the more specific selector wins: an id beats a class and a class beats an element. If specificity is equal, the rule written later wins. Styles are also inherited: setting color on body is passed down to most text inside it.",
        ], {
          title: "Specificity and order",
          code: `<style>\n  p { color: green; }\n  .warn { color: orange; }\n  p.warn { color: red; }\n</style>\n<p>Green: only the p rule matches.</p>\n<p class="warn">Red: p.warn is the most specific.</p>`,
          explanation: "The second paragraph matches all three rules, and p.warn wins because an element plus a class is more specific than either alone.",
        }),
      ],
      takeaways: ["Selectors pick elements; properties set how they look.", "More specific selectors beat less specific ones.", "Equal specificity: the later rule wins."],
      mistakes: ["Reaching for !important instead of fixing specificity.", "Styling with ids, which are hard to override.", "Forgetting the semicolon after a value."],
      check: [
        q("Which selector matches class=\"note\"?", ["note", "#note", ".note", "*note"], 2, "A dot selects by class."),
        q("Which wins: an id rule or a class rule on the same property?", ["The class rule", "The id rule", "Whichever is longer", "Neither"], 1, "Ids are more specific than classes."),
        q("What happens when specificity is equal?", ["The first rule wins", "The later rule wins", "An error", "Both apply"], 1, "The last rule in the cascade wins."),
      ],
    }),
    lesson("box-model", "The box model", 12, {
      summary: "Every element is a rectangular box made of content, padding, border and margin. Knowing how they add up is the key to sizing and spacing.",
      sections: [
        sec("Four layers", [
          "Content is the text or image. Padding is the space between content and border. Border wraps the padding. Margin is the space outside the border, separating the box from its neighbours. By default width sets only the content, so padding and border make the box larger.",
          "box-sizing: border-box changes that: width then includes padding and border, which makes sizing predictable. Many sites set it on every element.",
        ], {
          title: "Padding, border and margin",
          code: `<style>\n  * { box-sizing: border-box; }\n  .card { width: 220px; padding: 16px; border: 3px solid #2b6cb0; margin: 12px; background: #ebf4ff; }\n</style>\n<div class="card">This card is exactly 220px wide, padding and border included.</div>\n<div class="card">Margin keeps the cards apart.</div>`,
          explanation: "With border-box, each card stays 220 pixels wide in total even though it has padding and a border.",
        }),
        sec("Block and inline", [
          "Block elements such as div and p take the full width and start on a new line; inline elements such as span and a sit within a line, and width and vertical margin do not apply to them. display: inline-block gives an inline element a box that accepts width and height.",
        ]),
      ],
      takeaways: ["Content, padding, border and margin make the box.", "border-box makes width include padding and border.", "Block elements stack; inline elements flow in a line."],
      mistakes: ["Forgetting that padding adds to width without border-box.", "Setting width on an inline span and seeing no change.", "Confusing margin (outside) with padding (inside)."],
      check: [
        q("Which layer is outside the border?", ["Padding", "Content", "Margin", "Outline of text"], 2, "Margin is the outermost space."),
        q("What does box-sizing: border-box do?", ["Adds a border", "Makes width include padding and border", "Removes margin", "Centres the box"], 1, "It changes how width is counted."),
        q("Which element is block-level by default?", ["span", "a", "div", "strong"], 2, "div takes the full width on its own line."),
      ],
    }),
    lesson("colour-typography", "Colour and typography", 10, {
      summary: "Colour and type do most of the work of making a page readable. A few well-chosen values, kept in CSS variables, go a long way.",
      sections: [
        sec("Colour and text", [
          "Colours can be names (tomato), hex (#2b6cb0), rgb() or hsl(). Set font-family with fallbacks, font-size in rem so it follows the user's settings, line-height around 1.5 for body text, and keep text and background contrast high.",
        ], {
          title: "Readable text",
          code: `<style>\n  body { font-family: system-ui, sans-serif; font-size: 1rem; line-height: 1.6; color: #1a202c; max-width: 36rem; margin: 1rem auto; }\n  h1 { font-size: 2rem; color: #2b6cb0; }\n</style>\n<h1>Readable text</h1>\n<p>Line length, spacing and contrast matter more than the font you pick. About 60 to 75 characters per line reads comfortably.</p>`,
          explanation: "A limited width, generous line height and dark text on a light background make the paragraph comfortable to read.",
        }),
        sec("CSS variables", [
          "A custom property such as --brand: #2b6cb0 defined on :root can be reused anywhere with var(--brand). Change it once and the whole site updates, which is how themes such as dark mode are built.",
        ], {
          title: "One colour, used twice",
          code: `<style>\n  :root { --brand: #2b6cb0; }\n  h2 { color: var(--brand); }\n  button { background: var(--brand); color: white; border: 0; padding: 8px 14px; border-radius: 6px; }\n</style>\n<h2>Brand colour</h2>\n<button>Apply now</button>`,
          explanation: "The heading and the button both read --brand, so changing the one definition recolours both.",
        }),
      ],
      takeaways: ["Use rem for text sizes and a line height near 1.5.", "Keep contrast high.", "Put repeated values in CSS variables."],
      mistakes: ["Tiny grey text on white.", "Fixing font sizes in px so users cannot scale text.", "Repeating the same hex value in dozens of places."],
      check: [
        q("Where is a CSS variable usually defined for the whole page?", ["On body only", "On :root", "In the head", "On each element"], 1, ":root is the top of the document, so every element can read it."),
        q("How do you use a variable called --brand?", ["--brand", "var(--brand)", "$brand", "@brand"], 1, "var() reads a custom property."),
        q("Why size text in rem?", ["It is faster", "It follows the user's font setting", "It ignores zoom", "It is required"], 1, "rem is relative to the root font size."),
      ],
    }),
  ],
};

export const cssLayout: TrackModule = {
  key: "css-layout",
  title: "CSS: layout and responsive design",
  summary: "Lay out pages with Flexbox and Grid and make them work on phones and desktops.",
  lessons: [
    lesson("flexbox", "Flexbox", 12, {
      summary: "Flexbox lays items out in a row or a column, with control over spacing, alignment and how they share space. It is the tool for menus, toolbars and card rows.",
      sections: [
        sec("A flex container", [
          "Set display: flex on a parent and its children become flex items laid out in a row. justify-content spaces items along the main axis, align-items aligns them across it, gap adds space between them and flex-wrap lets them wrap onto new lines.",
        ], {
          title: "A navigation bar",
          code: `<style>\n  nav { display: flex; justify-content: space-between; align-items: center; gap: 12px; background: #1a202c; padding: 12px 16px; }\n  nav a { color: white; text-decoration: none; }\n  .links { display: flex; gap: 16px; }\n</style>\n<nav>\n  <strong style="color:white">Capabilio</strong>\n  <div class="links"><a href="#">Courses</a><a href="#">Arena</a><a href="#">Jobs</a></div>\n</nav>`,
          explanation: "The logo goes to one end and the links to the other because space-between pushes the two children apart.",
        }),
        sec("Sharing space", [
          "flex: 1 on an item tells it to grow and take an equal share of the free space. Items with flex: 2 take twice the share. flex-direction: column switches the main axis so items stack vertically.",
        ], {
          title: "Equal cards",
          code: `<style>\n  .row { display: flex; gap: 12px; }\n  .card { flex: 1; padding: 14px; background: #ebf4ff; border: 1px solid #2b6cb0; border-radius: 8px; }\n</style>\n<div class="row">\n  <div class="card">Learn</div>\n  <div class="card">Practise</div>\n  <div class="card">Prove</div>\n</div>`,
          explanation: "All three cards have flex: 1, so they share the row equally whatever the window width.",
        }),
      ],
      takeaways: ["display: flex turns children into flex items.", "justify-content works along the main axis, align-items across it.", "flex: 1 shares free space equally."],
      mistakes: ["Putting display: flex on the item instead of the parent.", "Mixing up justify-content and align-items.", "Forgetting flex-wrap so items squeeze on small screens."],
      check: [
        q("Where do you put display: flex?", ["On the children", "On the parent", "On body only", "On the html tag"], 1, "The container is the parent."),
        q("Which property adds space between flex items?", ["margin-box", "gap", "spacing", "pad"], 1, "gap sets space between items."),
        q("What does flex-direction: column do?", ["Makes columns of text", "Stacks items vertically", "Hides items", "Wraps items"], 1, "The main axis becomes vertical."),
      ],
    }),
    lesson("grid", "CSS Grid", 12, {
      summary: "Grid lays content out in rows and columns at once. Use it for page layouts and card galleries; use Flexbox for a single row or column.",
      sections: [
        sec("Defining columns", [
          "display: grid with grid-template-columns defines the columns. The fr unit is a share of the free space, so 1fr 2fr gives two columns where the second is twice as wide. gap sets the space between rows and columns.",
        ], {
          title: "A page layout",
          code: `<style>\n  .page { display: grid; grid-template-columns: 1fr 3fr; gap: 12px; }\n  .page > * { padding: 14px; border-radius: 8px; }\n  aside { background: #fefcbf; }\n  main { background: #e6fffa; }\n</style>\n<div class="page">\n  <aside>Sidebar</aside>\n  <main>Main content takes three times the width of the sidebar.</main>\n</div>`,
          explanation: "The two columns split the width one to three, whatever size the window is.",
        }),
        sec("A gallery that adapts", [
          "repeat(auto-fit, minmax(160px, 1fr)) creates as many columns as fit, each at least 160 pixels wide. On a phone you get one or two columns and on a wide screen you get many, with no media query.",
        ], {
          title: "Auto-fit gallery",
          code: `<style>\n  .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }\n  .gallery div { background: #ebf4ff; padding: 24px; text-align: center; border-radius: 8px; }\n</style>\n<div class="gallery">\n  <div>1</div><div>2</div><div>3</div><div>4</div><div>5</div><div>6</div>\n</div>`,
          explanation: "Resize the window and the number of columns changes by itself, because each column must be at least 140 pixels wide.",
        }),
      ],
      takeaways: ["Grid handles rows and columns together.", "fr shares the free space.", "auto-fit with minmax makes a layout that adapts by itself."],
      mistakes: ["Using Grid for a simple one-row menu where Flexbox is simpler.", "Forgetting gap and adding margins everywhere.", "Fixed pixel columns that overflow on phones."],
      check: [
        q("What does 1fr 2fr mean?", ["Two columns, the second twice as wide", "One row and two columns of equal size", "Two equal columns", "A 12px gap"], 0, "fr divides the free space in those proportions."),
        q("Which property sets the columns of a grid?", ["grid-columns", "grid-template-columns", "columns-grid", "flex-columns"], 1, "grid-template-columns defines them."),
        q("When is Flexbox usually the better choice?", ["A page with rows and columns", "A single row or column of items", "A table of data", "A photo gallery in a grid"], 1, "Flexbox is one-dimensional."),
      ],
    }),
    lesson("responsive-design", "Responsive design", 12, {
      summary: "A responsive page works on a 360-pixel phone and a 1440-pixel desktop. Most visitors in India open pages on phones, so design for the small screen first.",
      sections: [
        sec("Mobile first and media queries", [
          "Start with styles for a small screen, then add a media query to change the layout when there is more room. A query such as @media (min-width: 700px) { ... } applies its rules only when the window is at least 700 pixels wide. Always include the viewport meta tag, or phones will draw a wide page and shrink it.",
        ], {
          title: "One column, then two",
          code: `<meta name="viewport" content="width=device-width, initial-scale=1">\n<style>\n  .cols { display: grid; gap: 10px; }\n  .cols div { background: #ebf4ff; padding: 20px; border-radius: 8px; }\n  @media (min-width: 700px) {\n    .cols { grid-template-columns: 1fr 1fr; }\n  }\n</style>\n<div class="cols"><div>Left</div><div>Right</div></div>`,
          explanation: "On a narrow window the two boxes stack in one column; from 700 pixels wide they sit side by side.",
        }),
        sec("Flexible media", [
          "img { max-width: 100%; height: auto; } stops pictures overflowing their container. Use relative units such as %, rem and fr instead of fixed pixel widths, and test by resizing the browser or using the device toolbar in developer tools.",
        ]),
      ],
      takeaways: ["Design for the small screen first.", "min-width media queries add layout as space grows.", "max-width: 100% keeps images inside their box."],
      mistakes: ["Forgetting the viewport meta tag.", "Fixed pixel widths wider than a phone screen.", "Testing only on a desktop window."],
      check: [
        q("What does @media (min-width: 700px) mean?", ["Applies below 700px", "Applies at 700px and wider", "Applies only at exactly 700px", "Hides content"], 1, "min-width is a lower limit."),
        q("Why is mobile first a good habit?", ["Phones are faster", "Most visitors use phones and small layouts are simplest", "It avoids CSS", "Desktop is unsupported"], 1, "Start simple and add space-dependent layout."),
        q("Which rule keeps an image inside its container?", ["img { width: 100vw; }", "img { max-width: 100%; height: auto; }", "img { float: left; }", "img { overflow: hidden; }"], 1, "max-width: 100% stops overflow and height: auto keeps proportions."),
      ],
    }),
  ],
};
