/* Tiny synchronous script loaded at the very top of <body> to read the
 * persisted theme and apply it before any content paints. Kept as a separate
 * file (rather than inline) so the CSP can stay strict (no 'unsafe-inline'). */
(function () {
  try {
    var t = window.localStorage.getItem("claudeOne:theme");
    if (t !== "neumorphism" && t !== "liquid-glass") t = "neumorphism";
    document.body.setAttribute("data-theme", t);
  } catch (e) {
    document.body.setAttribute("data-theme", "neumorphism");
  }
})();
