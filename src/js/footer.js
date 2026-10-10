/* The footer: the credit Jagex's Fan Content Policy asks for, and the wiki's licence. */

/* the credit Jagex's Fan Content Policy asks for, and the wiki's licence */
const footHTML = () =>
  '<footer class="foot wrap"><p>Long Game is a free fan project. Created using intellectual property belonging to Jagex Limited under the terms of Jagex’s Fan Content Policy. This content is not endorsed by or affiliated with Jagex.</p>' +
  '<p>Training methods and rates are adapted from the <a href="https://oldschool.runescape.wiki/" rel="noopener">Old School RuneScape Wiki</a>, used under <a href="https://creativecommons.org/licenses/by-nc-sa/3.0/" rel="noopener">CC BY-NC-SA 3.0</a>.' +
  (CONFIG.repo
    ? ' The code and the data are on <a href="https://github.com/' +
      esc(CONFIG.repo) +
      '" rel="noopener">GitHub</a>.'
    : '') +
  '</p></footer>';
