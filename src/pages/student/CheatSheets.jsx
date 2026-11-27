import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Chip, H3, Hero, HeroPill, HeroTitle, Icon, notify } from '../../ui.jsx';
import { MORE_SHEETS } from './cheatsheetMore.js';

/* ---------- cheat sheets: the snippets students reach for most, grouped by topic ---------- */
// Each language: [file extension, editor id for the playground, sections of [title, [[name, code, tip?]]]]
const BROWSER_SHEETS = {
  Python: ['.py', 'python', [
    ['Input and output', [
      ['Read numbers', 'n = int(input())\na, b = map(int, input().split())\nnums = list(map(int, input().split()))', 'input() always gives text, so convert it.'],
      ['Print', 'print(a, b)          # 3 4\nprint(a, b, sep=",")  # 3,4\nprint(f"Sum: {a + b}")\nprint(*nums)         # spread a list'],
    ]],
    ['Loops and conditions', [
      ['Loops', 'for i in range(n):        # 0 .. n-1\n    print(i)\n\nfor i, x in enumerate(nums):\n    print(i, x)\n\nwhile n > 0:\n    n -= 1'],
      ['Conditions', 'if x > 0:\n    print("positive")\nelif x == 0:\n    print("zero")\nelse:\n    print("negative")\n\nlabel = "even" if x % 2 == 0 else "odd"'],
    ]],
    ['Lists and strings', [
      ['Lists', 'nums = [3, 1, 2]\nnums.append(5)\nnums.sort()               # [1, 2, 3, 5]\nprint(sum(nums), max(nums), len(nums))\nsquares = [x * x for x in nums]\nevens = [x for x in nums if x % 2 == 0]'],
      ['Strings', 's = "hello world"\ns.upper()        # HELLO WORLD\ns.split()        # [\'hello\', \'world\']\ns[::-1]          # reversed\n" ".join(words)\ns.count("l")     # 3', 'Strings cannot change: methods return a new one.'],
    ]],
    ['Dictionaries and functions', [
      ['Count things', 'count = {}\nfor w in words:\n    count[w] = count.get(w, 0) + 1\n\nfrom collections import Counter\nCounter(words).most_common(1)'],
      ['Functions', 'def area(w, h=1):\n    return w * h\n\narea(3, 4)   # 12\narea(3)      # 3\n\nsquare = lambda x: x * x'],
    ]],
  ]],
  JavaScript: ['.js', 'js', [
    ['Input and output', [
      ['Read numbers', 'const n = Number(input());\nconst [a, b] = input().split(" ").map(Number);', 'In this app, input() reads one line, like in Python.'],
      ['Print', 'console.log(a, b);\nconsole.log(`Sum: ${a + b}`);\nconsole.log(nums.join(" "));'],
    ]],
    ['Loops and conditions', [
      ['Loops', 'for (let i = 0; i < n; i++) {\n  console.log(i);\n}\n\nfor (const x of nums) console.log(x);\n\nnums.forEach((x, i) => console.log(i, x));'],
      ['Conditions', 'if (x > 0) {\n  console.log("positive");\n} else if (x === 0) {\n  console.log("zero");\n} else {\n  console.log("negative");\n}\n\nconst label = x % 2 === 0 ? "even" : "odd";', 'Use === to compare, not ==.'],
    ]],
    ['Arrays and strings', [
      ['Array methods', 'const doubled = nums.map(x => x * 2);\nconst big = nums.filter(x => x > 2);\nconst total = nums.reduce((s, x) => s + x, 0);\nnums.sort((a, b) => a - b);   // numbers!\nMath.max(...nums);'],
      ['Strings', 'const s = "hello world";\ns.toUpperCase();\ns.split(" ");\n[...s].reverse().join("");\ns.includes("world");   // true\ns.length;'],
    ]],
    ['Objects and functions', [
      ['Count things', 'const count = {};\nfor (const w of words) count[w] = (count[w] || 0) + 1;\n\nconst m = new Map();\nm.set("a", 1).get("a");'],
      ['Functions', 'function area(w, h = 1) {\n  return w * h;\n}\n\nconst square = x => x * x;'],
    ]],
  ]],
  'C++': ['.cpp', 'cpp', [
    ['Starting point', [
      ['Skeleton', '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    int a, b;\n    cin >> a >> b;\n    cout << a + b << "\\n";\n    return 0;\n}', 'bits/stdc++.h pulls in the whole standard library.'],
      ['Read a list', 'int n;\ncin >> n;\nvector<int> v(n);\nfor (auto &x : v) cin >> x;'],
    ]],
    ['Loops and conditions', [
      ['Loops', 'for (int i = 0; i < n; i++) {\n    cout << i << " ";\n}\n\nfor (int x : v) cout << x << "\\n";\n\nwhile (n > 0) n--;'],
      ['Conditions', 'if (x > 0) cout << "positive";\nelse if (x == 0) cout << "zero";\nelse cout << "negative";\n\nstring label = x % 2 == 0 ? "even" : "odd";'],
    ]],
    ['Vectors and strings', [
      ['Vectors', 'vector<int> v = {3, 1, 2};\nv.push_back(5);\nsort(v.begin(), v.end());\nint total = accumulate(v.begin(), v.end(), 0);\nint big = *max_element(v.begin(), v.end());'],
      ['Strings', 'string s;\ngetline(cin, s);      // whole line\ns.length();\nreverse(s.begin(), s.end());\ns.substr(0, 3);'],
    ]],
    ['Maps and big numbers', [
      ['Count things', 'map<string, int> count;\nstring w;\nwhile (cin >> w) count[w]++;\nfor (auto &[k, c] : count) cout << k << " " << c << "\\n";'],
      ['Big numbers', 'long long big = 1LL * a * b;   // avoid overflow\nconst int MOD = 1e9 + 7;', 'int holds about ±2 billion. Use long long beyond that.'],
    ]],
  ]],
  'HTML & CSS': ['.html', 'web', [
    ['Page basics', [
      ['Page skeleton', '<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    h1 { color: red; }\n  </style>\n</head>\n<body>\n  <h1>Hello</h1>\n  <script>\n    // JavaScript here\n  </script>\n</body>\n</html>'],
      ['Common tags', '<h1>Title</h1>\n<p>Paragraph with <b>bold</b> and <a href="#">a link</a></p>\n<img src="cat.png" alt="A cat">\n<ul>\n  <li>One</li>\n  <li>Two</li>\n</ul>', 'Always give images an alt text.'],
    ]],
    ['Layout', [
      ['Flexbox row', '.row {\n  display: flex;\n  gap: 12px;\n  align-items: center;\n  justify-content: space-between;\n}'],
      ['Grid', '.cards {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 16px;\n}'],
    ]],
    ['Styling', [
      ['Selectors', 'p { }            /* every p */\n.card { }        /* class="card" */\n#main { }        /* id="main" */\n.card:hover { }  /* on hover */\n.nav a { }       /* a inside .nav */'],
      ['Box model', '.box {\n  padding: 16px;        /* inside */\n  margin: 8px;          /* outside */\n  border: 1px solid #ccc;\n  border-radius: 12px;\n}'],
    ]],
    ['Interactivity', [
      ['Click handler', '<button id="b">Click</button>\n<script>\n  document.getElementById("b").onclick = () => alert("Hi");\n</script>'],
      ['Change the page', 'const h = document.querySelector("h1");\nh.textContent = "New title";\nh.style.color = "blue";\nh.classList.add("big");'],
    ]],
  ]],
};

const SHEETS = { ...BROWSER_SHEETS, ...MORE_SHEETS }; // browser languages first, then the ones that need the server runner

const copy = text => { navigator.clipboard?.writeText(text).then(() => notify('Copied'), () => notify('Could not copy. Select the code and copy it by hand.')); };

export function CheatSheets() {
  const [lang, setLang] = useState('Python');
  const [q, setQ] = useState('');
  const [, env, sections] = SHEETS[lang];
  const term = q.trim().toLowerCase();
  const shown = sections.map(([t, items]) => [t, items.filter(([n, c]) => !term || `${t} ${n} ${c}`.toLowerCase().includes(term))]).filter(([, items]) => items.length);
  const count = sections.reduce((n, [, items]) => n + items.length, 0);
  return (
    <div className="flex flex-col gap-5">
      <Hero>
        <div className="flex flex-col gap-5">
          <div><HeroPill>Cheat sheets</HeroPill></div>
          <HeroTitle>The snippets you keep forgetting.</HeroTitle>
          <div className="flex flex-wrap gap-1.5 rounded-lg bg-soft border border-line p-1.5" role="tablist" aria-label="Language">
            {Object.entries(SHEETS).map(([k, [e, runs]]) => (
              <button key={k} role="tab" aria-selected={lang === k} onClick={() => { setLang(k); setQ(''); }} className={`flex items-center gap-2 whitespace-nowrap rounded-md h-9 pl-1.5 pr-3.5 text-[14px] font-semibold transition-colors duration-200 ${lang === k ? 'bg-accent text-on-accent' : 'text-ink-2 hover:text-ink hover:bg-surface'}`}>
                <span className={`h-6 min-w-6 px-1.5 rounded grid place-items-center font-mono text-[11px] font-bold ${lang === k ? 'bg-white/20' : 'bg-soft'}`}>{e}</span>{k}{!runs && <span className="sr-only"> (runs on the server later)</span>}
              </button>
            ))}
          </div>
        </div>
      </Hero>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="relative flex items-center grow max-w-[480px]">
          <span className="absolute left-3.5 text-muted pointer-events-none"><Icon name="search" size={18} /></span>
          <input type="search" aria-label={`Search ${lang} snippets`} placeholder={`Search ${count} ${lang} snippets`} className="w-full min-h-12 pl-10 pr-3.5 rounded-xl border-[1.5px] border-field-line bg-surface text-[15px] focus:border-ink" value={q} onChange={e => setQ(e.target.value)} />
        </label>
        <span className="grow" />
        {env ? <Link to="/playground/editor" state={{ env }} className="text-[14px] font-semibold no-underline flex items-center gap-1.5"><Icon name="play" size={14} />Open {lang} in the playground →</Link>
          : <Chip tone="amber"><Icon name="clock" size={13} />{lang} cannot run in the playground yet</Chip>}
      </div>

      {!shown.length && <Card className="text-muted text-center">No {lang} snippet matches “{q}”.</Card>}
      {shown.map(([title, items]) => (
        <section key={title} className="flex flex-col gap-3">
          <H3 as="h2" className="text-[20px] flex items-center gap-2.5"><span className="w-1 h-5 rounded-full bg-accent" aria-hidden="true" />{title}</H3>
          <div className="grid gap-4 grid-cols-2 max-tablet:grid-cols-1 items-start">
            {items.map(([name, code, tip]) => (
              <Card key={name} className="p-0 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
                  <b className="text-[15px]">{name}</b>
                  <button onClick={() => copy(code)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-muted hover:text-ink hover:bg-soft" aria-label={`Copy ${name}`}><Icon name="doc" size={13} />Copy</button>
                </div>
                <pre className="m-0 bg-panel text-panel-text font-mono text-[13px] leading-[1.7] px-4 py-3.5 overflow-x-auto">{code}</pre>
                {tip && <p className="m-0 px-4 py-2.5 text-[13px] text-ink-2 flex gap-2 items-start border-t border-line"><Icon name="star" size={14} />{tip}</p>}
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
