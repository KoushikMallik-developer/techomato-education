// Runs Python in a worker so an infinite loop can be killed with worker.terminate().
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');
const ready = loadPyodide().then(py => { postMessage({ ready: true }); return py; });
onmessage = async ({ data: { code, input } }) => {
  const py = await ready;
  const lines = input ? input.replace(/\n$/, '').split('\n') : [];
  let out = '', err = '';
  py.setStdin({ stdin: () => (lines.length ? lines.shift() : undefined) });
  py.setStdout({ batched: s => { out += s + '\n'; } });
  py.setStderr({ batched: s => { err += s + '\n'; } });
  const g = py.globals.get('dict')();
  try { py.runPython(code, { globals: g }); } catch (e) { err = String(e.message).split('\n').slice(-4).join('\n'); }
  g.destroy();
  postMessage({ out, err });
};
