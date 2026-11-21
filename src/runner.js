// Grades student code in the browser. Python: Pyodide in a worker. Web: sandboxed iframe + postMessage.
// shortcut: grading is client-side, so a determined student can tamper with scores. Move to Cloud Functions + Judge0 if that matters.
// shortcut: Java is not supported (no browser runtime wired up).
const norm = s => (s || '').replace(/\r/g, '').trim().split('\n').map(l => l.trimEnd()).join('\n');
const LIMIT = 5000;

let worker, ready;
function boot() {
  worker = new Worker(import.meta.env.BASE_URL + 'pyodide-worker.js');
  ready = new Promise(res => { worker.onmessage = e => e.data.ready && res(); });
}
async function runPy(code, input) {
  if (!worker) boot();
  await ready; // loading Pyodide (first run only) doesn't count against the time limit
  return new Promise(resolve => {
    const timer = setTimeout(() => { worker.terminate(); worker = null; resolve({ err: 'Time limit exceeded' }); }, LIMIT);
    worker.onmessage = e => { clearTimeout(timer); resolve(e.data); };
    worker.postMessage({ code, input });
  });
}

// C++ / JS: a fresh worker per run, so a hung program is simply terminated.
function runLang(env, code, input) {
  return new Promise(resolve => {
    const w = new Worker(new URL('./lang-worker.js', import.meta.url), { type: 'module' });
    const done = r => { clearTimeout(timer); w.terminate(); resolve(r); };
    const timer = setTimeout(() => done({ err: 'Time limit exceeded' }), LIMIT);
    w.onmessage = e => done(e.data);
    w.onerror = e => done({ err: e.message || 'Runner failed' });
    w.postMessage({ env, code, input });
  });
}

function runWeb(code, tests) {
  return new Promise(resolve => {
    const id = Math.random().toString(36).slice(2);
    const exprs = JSON.stringify(tests.map(t => t.expr)).replace(/</g, '\\u003c');
    const harness = `<script>addEventListener('load',()=>{const r=${exprs}.map(e=>{try{return !!eval(e)}catch(x){return false}});parent.postMessage({tk:'${id}',r},'*')})</script>`;
    const f = document.createElement('iframe');
    f.sandbox = 'allow-scripts'; // opaque origin: student code can't touch the app or its Firebase session
    f.style.display = 'none';
    const done = r => { clearTimeout(timer); removeEventListener('message', on); f.remove(); resolve(r); };
    const on = e => e.data?.tk === id && done(e.data.r.map(ok => ({ ok })));
    const timer = setTimeout(() => done(tests.map(() => ({ ok: false, error: 'Time limit exceeded' }))), 3000);
    addEventListener('message', on);
    f.srcdoc = code + harness;
    document.body.appendChild(f);
  });
}

export async function grade(env, code, tests) {
  if (env === 'web') return runWeb(code, tests);
  if (!['python', 'cpp', 'js'].includes(env)) throw new Error(`${env} is not supported yet`);
  const out = [];
  for (const t of tests) {
    const r = env === 'python' ? await runPy(code, t.input) : await runLang(env, code, t.input);
    out.push({ ok: !r.err && norm(r.out) === norm(t.output), got: r.out?.slice(0, 500), expected: t.output, error: r.err?.slice(0, 500) });
  }
  return out;
}

// Playground: run once with free-form input. Returns {out, err}. (Web pages are previewed by the caller, not run here.)
export const runOnce = (env, code, input) => (env === 'python' ? runPy(code, input) : runLang(env, code, input));
