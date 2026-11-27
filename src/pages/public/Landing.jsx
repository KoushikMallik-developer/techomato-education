import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LEVEL_TONE, Avatar, Icon, highlight, btn, Card, Chip, H2, H3, GRAD, heroBtn } from '../../ui.jsx';
import { Footer, PublicNav } from './PublicLayout.jsx';

// The hero editor is live: visitors can edit this and run it against the test cases below, in their browser.
const HERO_CODE = `// Count the pairs whose sum is below k
const nums = input().split(' ').map(Number);
const k = Number(input());
nums.sort((a, b) => a - b);
let i = 0, j = nums.length - 1, total = 0;
while (i < j) {
  if (nums[i] + nums[j] < k) { total += j - i; i++; }
  else j--;
}
console.log(total);`;
const HERO_TESTS = [['Sample 1', '1 2 3 4\n6', '4'], ['Sample 2', '5 1 7 2\n8', '3'], ['Hidden 1', '-2 0 3 9 4\n5', '5'], ['Hidden 2', '10 20\n15', '0'], ['Hidden 3', '1 1 1 1\n3', '6']].map(([name, input, output]) => ({ name, input, output }));

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
// true once the element is on screen (once), or while it is (once = false). Without IntersectionObserver it is simply on.
function useInView({ once = true, threshold = 0.4, initial = false } = {}) {
  const ref = useRef(), [on, setOn] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver !== 'function') return setOn(true);
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); if (once) io.disconnect(); } else if (!once) setOn(false); }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [once, threshold]);
  return [ref, on];
}
// Hidden until on screen, then revealed once. The hidden state is set by script just before the first paint, so without
// script (or with reduced motion) the text simply shows.
function useReveal(threshold = 0.35) {
  const [ref, seen] = useInView({ threshold });
  const [armed, setArmed] = useState(false);
  useLayoutEffect(() => { if (!reduced() && typeof IntersectionObserver === 'function') setArmed(true); }, []);
  return [ref, armed && !seen];
}
const EASE = 'ease-[cubic-bezier(.16,1,.3,1)]';
// A heading whose words rise into place one after another, each from behind its own mask.
// parts: [[text, className?]], with '\n' for a line break. Comp: the tag or component that renders it (H2 takes a ref in React 19).
function RevealText({ Comp = 'h2', parts, delay = 0, step = 55, ...p }) {
  const [ref, hidden] = useReveal(0.4);
  let n = 0;
  return (
    <Comp ref={ref} {...p}>
      {parts.map(([text, cls], pi) => text === '\n' ? <br key={pi} /> : (
        <span key={pi} className={cls}>
          {text.split(' ').map((w, wi) => {
            const i = n++;
            return (
              <Fragment key={wi}>{wi > 0 && ' '}<span className="inline-block overflow-hidden align-bottom py-[.08em] -my-[.08em]">
                <span className={`inline-block transition-transform duration-[900ms] ${EASE} ${hidden ? 'translate-y-[110%]' : ''}`} style={{ transitionDelay: hidden ? '0ms' : `${delay + i * step}ms` }}>{w}</span>
              </span></Fragment>
            );
          })}
        </span>
      ))}
    </Comp>
  );
}
// Supporting text: arrives a beat after its heading, from a soft blur.
function FadeIn({ as: T = 'div', delay = 250, className = '', style, ...p }) {
  const [ref, hidden] = useReveal(0.25);
  return <T ref={ref} {...p} className={`transition-[opacity,transform,filter] duration-700 ${EASE} ${hidden ? 'opacity-0 translate-y-2 blur-[3px]' : ''} ${className}`} style={{ ...style, transitionDelay: hidden ? '0ms' : `${delay}ms` }} />;
}

// Counts 0..n, one step every `ms`, starting when `go` turns true. Reduced motion: straight to n.
function useSweep(n, go, ms, key) {
  const [k, setK] = useState(0);
  useEffect(() => {
    if (!go) return setK(0);
    if (reduced()) return setK(n);
    setK(0);
    let i = 0;
    const t = setInterval(() => { i++; setK(i); if (i >= n) clearInterval(t); }, ms);
    return () => clearInterval(t);
  }, [n, go, ms, key]);
  return k;
}

function LiveEditor() {
  const [code, setCode] = useState(HERO_CODE);
  const [res, setRes] = useState({ r: HERO_TESTS.map(() => ({ ok: true })), at: 0 }); // the sample answer passes, so start in that state
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(reduced); // the first sweep waits for the hero to settle in (reduced motion: no wait)
  useEffect(() => { const t = setTimeout(() => setReady(true), 650); return () => clearTimeout(t); }, []);
  const shown = useSweep(HERO_TESTS.length, ready && !busy, 170, res.at); // results appear test by test, like a real grader
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try { const { grade } = await import('../../runner.js'); setRes({ r: await grade('js', code, HERO_TESTS), at: Date.now() }); } // loaded on first run only
    catch (e) { setRes({ r: HERO_TESTS.map(() => ({ ok: false })), at: Date.now(), err: e.message }); }
    setBusy(false);
  };
  const passed = res.r.filter(x => x.ok).length, all = passed === HERO_TESTS.length;
  return (
    <div className="rounded-[20px] overflow-hidden border border-white/10 bg-[#15161B] shadow-[0_40px_80px_-30px_rgba(0,0,0,.7)]">
      <div className="h-11 flex items-center justify-between gap-3 pl-4 pr-1.5 border-b border-white/10 font-mono text-[12px] text-white/55">
        <span className="flex gap-1.5" aria-hidden="true"><i className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" /><i className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" /><i className="w-2.5 h-2.5 rounded-full bg-[#28C840]" /></span>
        <span>pair_sums.js</span>
        <span className="flex items-center gap-1">
          {code !== HERO_CODE && <button type="button" onClick={() => setCode(HERO_CODE)} className="min-h-8 px-2.5 rounded-full text-white/55 hover:text-white font-sans text-[12px] font-semibold">Reset</button>}
          <button type="button" onClick={run} disabled={busy} className="min-h-8 px-3 rounded-full bg-white/10 hover:bg-white/15 text-white font-sans text-[12px] font-bold inline-flex items-center gap-1.5 disabled:opacity-60"><Icon name="play" size={12} fill="currentColor" />{busy ? 'Running…' : 'Run tests'}</button>
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid min-w-max [&>*]:[grid-area:1/1] font-mono text-[14px] max-phone:text-[12px] leading-[1.75] [tab-size:2]">
          <pre className="m-0 whitespace-pre p-[18px_22px] text-[#E7E8EC] pointer-events-none" aria-hidden="true" dangerouslySetInnerHTML={{ __html: highlight(code) + '\n' }} />
          <textarea aria-label="Try it: edit this JavaScript, then run the tests" spellCheck="false" autoCapitalize="off" autoCorrect="off" value={code} onChange={e => setCode(e.target.value)}
            onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); } }}
            className="m-0 p-[18px_22px] whitespace-pre resize-none overflow-hidden bg-transparent text-transparent caret-[#FF8A5B] outline-none border-0 font-[inherit] leading-[inherit] focus-visible:shadow-[inset_0_0_0_2px_rgba(255,138,91,.5)] selection:bg-[#FF8A5B]/30 selection:text-transparent" />
        </div>
      </div>
      <div className="flex items-center flex-wrap gap-2 px-[22px] pb-5">
        {HERO_TESTS.map((t, i) => {
          const ok = res.r[i]?.ok, done = !busy && i < shown;
          return <span key={i} className={`inline-flex items-center gap-1.5 font-mono text-[12px] px-2.5 py-1.5 rounded-lg transition-[background-color,color] duration-300 ${!done ? 'bg-white/[.06] text-white/45' : ok ? 'bg-[#17331E] text-[#8FD3A0]' : 'bg-[#3A2616] text-[#F0B27A]'}`}>
            {done ? <span key={`${res.at}-r`} className="draw inline-flex animate-tick"><Icon name={ok ? 'check' : 'x'} size={13} stroke={2.6} /></span>
              : <span className="w-[13px] grid place-items-center" aria-hidden="true"><i className={`w-1.5 h-1.5 rounded-full bg-white/45 ${busy || (ready && i === shown) ? 'animate-pulse' : ''}`} /></span>}
            {t.name}{t.name.startsWith('Hidden') && <Icon name="lock" size={11} />}
          </span>;
        })}
        <span className="ml-auto" aria-live="polite">
          {!busy && shown >= HERO_TESTS.length && <span key={res.at} className={`inline-block font-semibold text-[13px] ${all ? 'text-[#8FD3A0] animate-stamp' : 'text-[#F0B27A] animate-tick'}`}>{all ? 'Accepted' : res.err ? 'Could not run' : 'Wrong answer'} · {passed}/{HERO_TESTS.length}</span>}
          {busy && <span className="font-semibold text-[13px] text-white/55">Running tests…</span>}
        </span>
      </div>
      <p className="m-0 px-[22px] pb-4 -mt-2 text-[12px] text-white/40">This editor is live. Change the code and press Run tests (or Ctrl+Enter). It runs in your browser.</p>
    </div>
  );
}
const jump = id => e => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };

// Example data for the previews. Not real users or results.
const PROBLEMS = [['Pair sums below k', 'Two pointers', 'Medium', true], ['Balanced brackets', 'Stacks', 'Easy', true], ['Longest unique substring', 'Sliding window', 'Medium', false], ['Count the islands', 'Graphs', 'Hard', false], ['Build a pricing card', 'HTML / CSS / JS', 'Easy', false]];
const LEVEL = LEVEL_TONE;
const BOARD = [['Rohan Kumar', 1840, 21], ['Priya Banerjee', 1620, 9], ['Ananya Roy', 1595, 14], ['Sneha Mukherjee', 1495, 12], ['Imran Sheikh', 1380, 5]];
const CLIMBER = 'Ananya Roy', GAIN = 120; // solves the daily contest and passes Priya

// The leaderboard preview: once on screen, one student earns points and moves up a place (FLIP: rows slide from where they were).
function BoardPreview() {
  const [ref, seen] = useInView({ threshold: 0.6 });
  const [up, setUp] = useState(false);
  const rows = useRef({}), before = useRef(null);
  useEffect(() => {
    if (!seen) return;
    const t = setTimeout(() => { before.current = Object.fromEntries(Object.entries(rows.current).map(([k, el]) => [k, el?.getBoundingClientRect().top])); setUp(true); }, 500);
    return () => clearTimeout(t);
  }, [seen]);
  useLayoutEffect(() => {
    if (!up || !before.current || reduced()) return;
    Object.entries(rows.current).forEach(([k, el]) => {
      const dy = (before.current[k] ?? 0) - (el?.getBoundingClientRect().top ?? 0);
      if (el && dy) el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)' });
    });
  }, [up]);
  const board = BOARD.map(([name, pts, streak]) => [name, pts + (up && name === CLIMBER ? GAIN : 0), streak]).sort((a, b) => b[1] - a[1]);
  return (
    <div ref={ref} className="rounded-[28px] bg-[#0E0F13] text-white p-3 shadow-[0_30px_80px_-40px_rgba(226,87,61,.6)] max-tablet:order-2">
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] text-white/55"><span className="flex items-center gap-1.5"><Icon name="trophy" size={15} color="#FF8A5B" />Leaderboard</span><span>Points · Streak</span></div>
      {board.map(([name, pts, streak], i) => {
        const me = name === CLIMBER;
        return (
          <div key={name} ref={el => { rows.current[name] = el; }} className={`relative flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-[background-color] duration-500 ${me ? (up ? 'bg-[#FF8A5B]/[.14] z-[1]' : 'bg-white/[.05]') : ''}`}>
            <span className={`w-6 text-center font-display font-extrabold ${i < 3 ? 'text-[#FF8A5B]' : 'text-white/45'}`}>{i + 1}</span>
            <Avatar name={name} size={34} />
            <span className="grow font-semibold truncate">{name}</span>
            {me && up && <span className="animate-stamp font-mono text-[12px] font-bold text-[#8FD3A0]" aria-hidden="true">+{GAIN}</span>}
            <span className={`font-mono text-[14px] tabular-nums ${me && up ? 'text-[#FFB49A]' : ''}`}>{pts}</span>
            <span className="w-14 text-right text-[13px] text-white/60 flex items-center justify-end gap-1"><Icon name="flame" size={13} color="#FF8A5B" />{streak + (me && up ? 1 : 0)}d</span>
          </div>
        );
      })}
    </div>
  );
}

// The proctoring setup check: once on screen, it scans and ticks each item in turn, then says Ready.
function SetupPreview() {
  const [ref, seen] = useInView({ threshold: 0.5 });
  const k = useSweep(CHECKS.length, seen, 320, 0), ready = k >= CHECKS.length;
  return (
    <div ref={ref} className="rounded-[28px] bg-[#0E0F13] text-white p-7 max-phone:p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <b className="text-[17px]">Setup check</b>
        <span key={ready ? 'r' : 'c'} className={`text-[12px] font-semibold rounded-full px-2.5 py-1 ${ready ? 'bg-[#17331E] text-[#8FD3A0] animate-stamp' : 'bg-white/[.08] text-white/60'}`}>{ready ? 'Ready' : 'Checking…'}</span>
      </div>
      <div className="aspect-[16/9] rounded-2xl bg-gradient-to-br from-[#23252C] to-[#15161B] border border-white/10 grid place-items-center relative overflow-hidden" aria-hidden="true">
        <span className={`w-24 h-28 rounded-[50%] border-2 transition-[border-color] duration-500 ${ready ? 'border-solid border-[#8FD3A0]' : 'border-dashed border-white/30'}`} />
        {seen && !ready && <span className="absolute inset-x-[30%] h-px bg-[#8FD3A0] shadow-[0_0_12px_2px_rgba(143,211,160,.55)] animate-scan" />}
        <span className="absolute top-3 left-3 flex items-center gap-1.5 text-[11px] font-semibold text-white/70"><i className="w-2 h-2 rounded-full bg-[#FF5F57] animate-pulse" />Camera</span>
      </div>
      <ul className="list-none! p-0 m-0 grid grid-cols-2 max-phone:grid-cols-1 gap-x-4 gap-y-2 text-[14px]">
        {CHECKS.map((c, i) => (
          <li key={c} className={`flex items-center gap-2 transition-[color] duration-300 ${i < k ? 'text-white/85' : 'text-white/45'}`}>
            {i < k ? <span className="draw inline-flex"><Icon name="check" size={15} stroke={2.8} color="#8FD3A0" /></span> : <span className="w-[15px] h-[15px] rounded-full border border-white/25 shrink-0" />}
            {c}
          </li>
        ))}
      </ul>
    </div>
  );
}
const CHECKS = ['Camera works', 'Good lighting', 'One face, centered', 'Microphone on', 'One screen connected'];
const PROCTOR = [
  ['lock', 'Fullscreen lockdown', 'No menus, no other pages. Leaving fullscreen pauses the exam.'],
  ['eye', 'Webcam monitoring', 'A setup check before the start, then photos during the exam and at every warning.'],
  ['clock', 'Timed, with auto-submit', 'Each test has a start, an end and a time limit. Answers are saved when time runs out.'],
  ['doc', 'Full event log', 'Tab switches, paste and copy are recorded. Trainers see who was flagged and why.'],
];
const STEPS = [
  ['Sign up free', 'Use your Google account or your email. No install, no card.'],
  ['Practice and compete', 'Solve problems, take the daily contest and grow your streak.'],
  ['Take your tests', 'Your institute adds you to its courses. Sit timed, proctored tests in the same editor.'],
];
const LANGS = [['python', 'Python'], ['js', 'JavaScript'], ['cpp', 'C / C++'], ['web', 'HTML / CSS / JS']];

// The dark glowing band used for the hero and the last call to action (same look in both themes).
function Band({ children }) {
  const [ref, on] = useInView({ once: false, threshold: 0, initial: true });
  return (
  <section ref={ref} className={`relative overflow-hidden bg-[#0E0F13] text-white ${on ? '' : '[&_.animate-float]:[animation-play-state:paused]'}`}>
    <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_60%_30%,#000_25%,transparent_75%)]" aria-hidden="true" />
    <div className="absolute -top-32 right-[8%] w-[420px] h-[420px] rounded-full bg-[#E2573D] blur-[140px] opacity-35 animate-float" aria-hidden="true" />
    <div className="absolute -bottom-40 left-[5%] w-[380px] h-[380px] rounded-full bg-[#5B8DEF] blur-[140px] opacity-20 animate-float [animation-delay:-4s]" aria-hidden="true" />
    <div className="relative max-w-[1280px] mx-auto px-6">{children}</div>
  </section>
  );
}
const Kicker = ({ children }) => <span className="font-mono text-[13px] font-semibold uppercase tracking-[.14em] text-accent">{children}</span>;
const Title = ({ className = '', children }) => <RevealText Comp={H2} className={`text-[clamp(34px,4.4vw,54px)] ${className}`} parts={[[children]]} />;
const Tick = ({ children }) => <li className="flex gap-2.5 items-start"><span className="mt-0.5 w-5 h-5 rounded-full bg-pass-soft grid place-items-center shrink-0"><Icon name="check" size={13} stroke={2.8} color="var(--pass-strong)" /></span>{children}</li>;
const ghostDark = 'inline-flex items-center min-h-14 px-7 rounded-full border border-white/20 font-semibold no-underline text-white hover:bg-white/[.06]';
const bigHeroBtn = `${heroBtn} min-h-14! px-8! text-[17px]`;

// The last heading: words rise, then a coral line draws under the promise.
function CtaHeading() {
  const [ref, hidden] = useReveal(0.5);
  return (
    <div ref={ref} className="max-w-[900px]">
      <RevealText Comp={H2} className="text-[clamp(38px,5.6vw,72px)] max-w-[900px]" step={60}
        parts={[['Your next accepted answer is '], ['one click away.', `text-[#FF8A5B] bg-no-repeat bg-[linear-gradient(currentColor,currentColor)] bg-[position:0_100%] transition-[background-size] duration-[900ms] ${EASE} ${hidden ? 'bg-[length:0%_.08em]' : 'bg-[length:100%_.08em] [transition-delay:650ms]'}`]]} />
    </div>
  );
}

export default function Landing() {
  return (
    <div>
      <PublicNav onJump={jump} />

      <main>
        {/* ---------- hero ---------- */}
        <Band>
          <div className="grid grid-cols-2 gap-14 items-center pt-20 pb-24 max-laptop:grid-cols-1 max-tablet:pt-12 max-tablet:pb-16">
            <div className="flex flex-col gap-7">
              <RevealText Comp="h1" className="font-display font-extrabold tracking-[-.04em] leading-[.95] m-0 text-[clamp(48px,6.4vw,88px)]" step={120} delay={80}
                parts={[['Code.'], ['\n'], ['Compete.'], ['\n'], ['Prove it.', 'text-[#FF8A5B]']]} />
              <FadeIn as="p" delay={520} className="text-white/70 text-[19px] leading-[1.6] m-0 max-w-[540px]">
                Solve coding problems right in your browser, take on the daily contest, climb the leaderboard and sit proctored tests from your institute. All in one place.
              </FadeIn>
              <FadeIn delay={640} className="flex items-center gap-4 flex-wrap">
                <Link to="/signup" className={bigHeroBtn}>Start coding free<span className="inline-flex transition-transform duration-200 ease-out group-hover/go:translate-x-1" aria-hidden="true"><Icon name="arrow" size={18} stroke={2.4} /></span></Link>
                <a href="#/" onClick={jump('practice')} className={ghostDark}>Explore problems</a>
              </FadeIn>
              <FadeIn delay={760} className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-white/60">
                {['Free for students', 'Nothing to install', 'Sign in with Google'].map(x => <span key={x} className="flex items-center gap-1.5"><Icon name="check" size={15} stroke={2.6} color="#8FD3A0" />{x}</span>)}
              </FadeIn>
            </div>

            <div className="relative animate-rise2 [animation-delay:.12s] pb-28 pr-8 max-phone:pr-0 max-phone:pb-0" >
              <LiveEditor />
              <div className="absolute right-0 bottom-0 w-64 rounded-2xl border border-white/10 bg-[#1C1D23]/95 backdrop-blur p-4 shadow-[0_20px_50px_-20px_rgba(0,0,0,.8)] max-phone:hidden">
                <div className="flex items-center justify-between text-[12px] text-white/55"><span className="flex items-center gap-1.5"><Icon name="flame" size={14} color="#FF8A5B" />Daily contest</span><span>2h 14m left</span></div>
                <div className="font-display font-extrabold text-[30px] leading-none mt-2">Rank #3</div>
                <div className="text-[12px] text-white/55 mt-1">+120 points · 12 day streak</div>
              </div>
              <div className="absolute left-6 bottom-4 rounded-2xl border border-white/10 bg-[#1C1D23]/95 backdrop-blur px-4 py-3 flex items-center gap-3 shadow-[0_20px_50px_-20px_rgba(0,0,0,.8)] max-tablet:hidden">
                <span className="w-9 h-9 rounded-xl bg-[#4A1F1D] grid place-items-center"><Icon name="lock" size={17} color="#FFB4AE" /></span>
                <span className="flex flex-col"><b className="text-[14px]">Proctored · 42:10 left</b><span className="text-[12px] text-white/55">Fullscreen and webcam on</span></span>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-white/75 text-[15px] font-semibold">
            <span className="text-white/45 font-medium text-[13px] uppercase tracking-[.14em]">Write in</span>
            {LANGS.map(([icon, l]) => <span key={l} className="flex items-center gap-2"><Icon name={icon} size={20} />{l}</span>)}
          </div>
        </Band>

        <div className="max-w-[1280px] mx-auto px-6">
          {/* ---------- practice ---------- */}
          <section id="practice" className="grid grid-cols-2 gap-14 items-center py-24 max-tablet:grid-cols-1 max-phone:py-16 scroll-mt-20">
            <div className="flex flex-col gap-5">
              <Kicker>Practice</Kicker>
              <Title>Sharpen your skills, one problem at a time.</Title>
              <FadeIn as="p" delay={300} className="text-ink-2 text-[18px] leading-[1.6] m-0">A growing library of problems by topic and level, from your first loop to graphs. Run the samples as often as you like, then submit against hidden test cases.</FadeIn>
              <ul className="list-none! p-0 m-0 flex flex-col gap-3 text-ink-2">
                <Tick>Easy, medium and hard problems across arrays, strings, stacks, graphs and web pages</Tick>
                <Tick>Instant results: see exactly which test cases passed</Tick>
                <Tick>A playground to try ideas, and cheat sheets for every language</Tick>
              </ul>
              <Link to="/signup" className={btn('accent', 'lg', 'group/go self-start mt-2')}>Start solving<span className="inline-flex transition-transform duration-200 ease-out group-hover/go:translate-x-1" aria-hidden="true"><Icon name="arrow" size={18} stroke={2.4} /></span></Link>
            </div>
            <Card className="p-2.5!">
              <div className="flex items-center justify-between px-4 py-3 text-[13px] text-muted"><span>Problems</span><span>Level</span></div>
              {PROBLEMS.map(([t, topic, level, done]) => (
                <div key={t} className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl hover:bg-soft">
                  <span className={`w-7 h-7 rounded-full grid place-items-center shrink-0 ${done ? 'bg-pass-soft' : 'border border-line'}`}>{done && <Icon name="check" size={14} stroke={2.8} color="var(--pass-strong)" />}</span>
                  <span className="grow min-w-0 flex flex-col"><b className="truncate">{t}</b><span className="text-[13px] text-muted">{topic}</span></span>
                  <Chip tone={LEVEL[level]}>{level}</Chip>
                </div>
              ))}
            </Card>
          </section>
        </div>

        {/* ---------- competitions ---------- */}
        <section id="contests" className="bg-surface border-y border-line scroll-mt-20">
          <div className="max-w-[1280px] mx-auto px-6 grid grid-cols-2 gap-14 items-center py-24 max-tablet:grid-cols-1 max-phone:py-16">
            <BoardPreview />
            <div className="flex flex-col gap-5">
              <Kicker>Competitions</Kicker>
              <Title>A new challenge every day.</Title>
              <FadeIn as="p" delay={300} className="text-ink-2 text-[18px] leading-[1.6] m-0">The daily contest gives everyone the same problem. Solve it to earn points, keep your streak alive and climb the leaderboard against students across the platform.</FadeIn>
              <div className="grid grid-cols-3 max-phone:grid-cols-1 gap-3">
                {[['flame', 'Daily contest', 'One problem a day'], ['trophy', 'Leaderboard', 'Points for every solve'], ['medal', 'Achievements', 'Badges as you grow']].map(([icon, t, s]) => (
                  <div key={t} className="rounded-2xl border border-line bg-paper p-4 flex flex-col gap-2">
                    <span className={`w-9 h-9 rounded-xl ${GRAD} grid place-items-center`}><Icon name={icon} size={17} color="#17181C" /></span>
                    <b>{t}</b><span className="text-[13px] text-muted">{s}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-[1280px] mx-auto px-6">
          {/* ---------- proctored tests ---------- */}
          <section id="proctored" className="py-24 max-phone:py-16 flex flex-col gap-12 scroll-mt-20">
            <div className="grid grid-cols-2 gap-14 items-end max-tablet:grid-cols-1 max-tablet:gap-5">
              <div className="flex flex-col gap-5"><Kicker>Proctored tests</Kicker><Title>Tests your institute can trust.</Title></div>
              <FadeIn as="p" delay={300} className="text-ink-2 text-[18px] leading-[1.6] m-0">Your trainers set timed tests in the same editor you practise in. Proctoring keeps every result fair, so a good score means something.</FadeIn>
            </div>
            <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5 max-tablet:grid-cols-1">
              <SetupPreview />
              <div className="grid grid-cols-2 max-phone:grid-cols-1 gap-5">
                {PROCTOR.map(([icon, t, b]) => (
                  <Card as="article" key={t} className="flex flex-col gap-3 p-6">
                    <span className="w-11 h-11 rounded-xl bg-accent-soft grid place-items-center"><Icon name={icon} color="var(--accent-ink)" /></span>
                    <H3 className="text-[20px]">{t}</H3>
                    <p className="text-ink-2 m-0 leading-[1.6] text-[15px]">{b}</p>
                  </Card>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- how it works ---------- */}
          <section className="pb-24 max-phone:pb-16 flex flex-col gap-10">
            <div className="flex flex-col gap-4 items-center text-center"><Kicker>How it works</Kicker><Title className="max-w-[760px]">From sign-up to your first accepted answer.</Title></div>
            <ol className="list-none! p-0 m-0 grid grid-cols-3 max-tablet:grid-cols-1 gap-5">
              {STEPS.map(([t, b], i) => (
                <li key={t}><Card className="h-full flex flex-col gap-3 p-7">
                  <span className={`w-11 h-11 rounded-full ${GRAD} grid place-items-center font-display font-extrabold text-[18px] text-[#17181C]`}>{i + 1}</span>
                  <H3 className="text-[22px]">{t}</H3>
                  <p className="text-ink-2 m-0 leading-[1.6]">{b}</p>
                </Card></li>
              ))}
            </ol>
          </section>

          {/* ---------- plans + institutes ---------- */}
          <section id="plans" className="pb-24 max-phone:pb-16 grid grid-cols-3 gap-5 max-tablet:grid-cols-1">
            <Card as="article" className="flex flex-col gap-3 p-7">
              <Chip className="self-start">Free</Chip>
              <H3 className="text-[24px]">Everything to get started</H3>
              <p className="text-ink-2 m-0 leading-[1.6]">Practice problems, the daily contest, the leaderboard and your institute's tests. Unlimited sample runs, one graded submission per question.</p>
            </Card>
            <Card as="article" className="flex flex-col gap-3 p-7">
              <Chip tone="accent" className="self-start">Subscribed</Chip>
              <H3 className="text-[24px]">Resubmit as often as you need</H3>
              <p className="text-ink-2 m-0 leading-[1.6]">Improve your answer and push your score up. Your institute adds the subscription to your account.</p>
            </Card>
            <Card as="article" className="flex flex-col gap-3 p-7">
              <Chip tone="pass" className="self-start">For institutes</Chip>
              <H3 className="text-[24px]">Run your coding classes here</H3>
              <p className="text-ink-2 m-0 leading-[1.6]">Courses, a shared question bank, timed and proctored tests, and a score for every student.</p>
              <Link to="/for-institutes" className="mt-auto font-semibold text-accent no-underline">See how it works →</Link>
            </Card>
          </section>
        </div>

        {/* ---------- final call to action ---------- */}
        <Band>
          <div className="py-24 max-phone:py-16 flex flex-col items-center gap-6 text-center">
            <CtaHeading />
            <FadeIn as="p" delay={700} className="text-white/70 m-0 text-[19px]">Free for students. Sign up with Google or your email.</FadeIn>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <Link to="/signup" className={bigHeroBtn}>Start coding free<span className="inline-flex transition-transform duration-200 ease-out group-hover/go:translate-x-1" aria-hidden="true"><Icon name="arrow" size={18} stroke={2.4} /></span></Link>
              <Link to="/login" className={ghostDark}>Log in</Link>
            </div>
          </div>
        </Band>
      </main>

      <Footer />
    </div>
  );
}
