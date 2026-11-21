// Worker for the lightweight in-browser languages: C++ (JSCPP interpreter) and JavaScript (stdin via input()).
// shortcut: JSCPP is an interpreter covering core C/C++ (iostream, cstdio, cmath, cstring, ...), not the full STL; upgrade to a server runner for full C++/Java.
import JSCPP from 'JSCPP';

onmessage = ({ data: { env, code, input } }) => {
  let out = '', err = '';
  try {
    if (env === 'cpp') {
      JSCPP.run(code, input, { stdio: { write: s => { out += s; } } });
    } else {
      const lines = input ? input.replace(/\n$/, '').split('\n') : [];
      const log = (...a) => { out += a.join(' ') + '\n'; };
      new Function('input', 'console', code)(() => lines.shift(), { log });
    }
  } catch (e) { err = String(e.message || e); }
  postMessage({ out, err });
};
