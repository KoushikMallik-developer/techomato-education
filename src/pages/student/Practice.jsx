import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, doc, documentId, getDoc, limit, query, where } from 'firebase/firestore';
import { auth, db, list, questions } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { SOLVE_POINTS, activityByDay, dailyOf, dayKey } from '../../score.js';
import { NAV } from '../../Shell.jsx';
import { isPublic } from './data.js';
import { langOfSub, typeLabel } from '../../schedule.js';
import { Avatar, LEVEL_TONE, Empty, Icon, Loading, useLoad, Card, Chip, Btn, btn, Input, H3, notify, plural, GRAD, Hero, HeroPill, HeroTitle, Ring, heroBtn } from '../../ui.jsx';

const mySubs = uid => list(query(collection(db, 'submissions'), where('userId', '==', uid)));
export const solvedIds = subs => new Set(subs.filter(s => s.passed === s.total).map(s => s.questionId));

/* The question of the day: the same for everyone, changes at midnight. shortcut: picks by day number, so adding questions reshuffles it. */

export function useCountdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const end = new Date(); end.setHours(23, 59, 59, 0);
  const s = Math.max(0, Math.floor((end - now) / 1000)), p = x => String(x).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/* ---------- problems bank ---------- */

// The bank can hold thousands of questions, so Problems reads it in pages. Level and "Web page" are filtered by Firestore;
// private questions and "Programming" are dropped here, and more raw pages are read until 50 are found.
// shortcut: the search box only covers the problems already loaded (press Show 50 more to reach the rest). Server-side title search needs an index per filter combination.
const PAGE = 50, RAW = 100;
async function fetchProblems(f, after) {
  const base = [...(f.diff !== 'all' ? [where('diff', '==', f.diff)] : []), ...(f.env === 'web' ? [where('env', '==', 'web')] : [])];
  const rows = [];
  let cur = after, more = true;
  while (rows.length < PAGE && more) {
    const got = await list(query(collection(db, 'questions'), ...base, ...(cur ? [where(documentId(), '>', cur)] : []), limit(RAW)));
    let i = 0;
    for (; i < got.length && rows.length < PAGE; i++) if (isPublic(got[i]) && (f.env !== 'code' || got[i].env !== 'web')) rows.push(got[i]);
    more = i < got.length || got.length === RAW; // stopped at 50 mid-batch, or Firestore may have more
    cur = got[i - 1]?.id ?? cur; // next page starts right after the last question looked at
  }
  return { rows, cur, more };
}

// Shown on Problems and the Dashboard so students know what solving earns them.
export const PointsPromo = ({ to, label }) => (
  <Card className="flex items-center gap-4 flex-wrap border-accent/40 bg-accent-soft">
    <span className="w-12 h-12 rounded-full bg-accent text-on-accent grid place-items-center shrink-0"><Icon name="star" size={24} /></span>
    <span className="flex flex-col gap-0.5 grow basis-60">
      <b className="text-[18px]">Earn {SOLVE_POINTS} points for every problem you solve</b>
      <span className="text-ink-2 text-[14px]">Pass every test case on a Practice problem to add {SOLVE_POINTS} points to your score, once per problem. Points rank you on the leaderboard.</span>
    </span>
    <Link to={to} className={btn('accent')}>{label}</Link>
  </Card>
);

const LEVEL = LEVEL_TONE;

export function Problems() {
  const me = useMe();
  const [subs] = useLoad(() => mySubs(me.uid));
  const [f, setF] = useState({ text: '', env: 'all', diff: 'all', status: 'all' });
  const [pg, setPg] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    setPg(null);
    fetchProblems(f).then(p => live && setPg(p)).catch(e => { console.error(e); notify('Could not load problems. Check your connection and refresh.'); });
    return () => { live = false; };
  }, [f.diff, f.env]); // text and status only filter what is already loaded
  const more = async () => {
    setBusy(true);
    try { const n = await fetchProblems(f, pg.cur); setPg({ rows: [...pg.rows, ...n.rows], cur: n.cur, more: n.more }); } catch (e) { console.error(e); notify('Could not load more problems.'); }
    setBusy(false);
  };
  const d = subs && { qs: pg?.rows || [], subs };
  if (!d) return <Loading />;
  const done = solvedIds(d.subs);
  const rows = d.qs.filter(q =>
    (f.env === 'all' || (f.env === 'web') === (q.env === 'web')) && (f.diff === 'all' || q.diff === f.diff) &&
    (f.status === 'all' || (f.status === 'solved') === done.has(q.id)) &&
    `${q.title} ${q.topic || ''}`.toLowerCase().includes(f.text.toLowerCase()));
  const tried = new Set(d.subs.map(s => s.questionId)).size;
  return (
    <div className="flex flex-col gap-5">
      <Hero>
        <div className="grid gap-8 grid-cols-[1fr_auto] max-tablet:grid-cols-1 items-center">
          <div className="flex flex-col gap-5 min-w-0">
            <div><HeroPill>Problems</HeroPill></div>
            <HeroTitle>Sharpen your skills.</HeroTitle>
            <div className="grid grid-cols-3 max-phone:grid-cols-2 gap-3">
              {[['check', 'Solved', done.size, 'all cases passed'], ['clip', 'Attempted', tried, `${tried - done.size} to finish`], ['star', 'Reward', `+${SOLVE_POINTS}`, 'points per solve']].map(([icon, label, big]) => (
                <div key={label} className="rounded-lg bg-soft border border-line p-4 max-phone:p-3 flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 text-[11px] text-muted"><Icon name={icon} size={14} />{label}</span>
                  <b className="font-display text-[30px] max-phone:text-[24px] leading-none">{big}</b>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-3 items-center">
              <Link to="/contest" className={heroBtn}><Icon name="flame" size={17} />Today's challenge<span className="transition-transform duration-200 group-hover/go:translate-x-1"><Icon name="arrow" size={18} stroke={2.4} /></span></Link>
              <Link to="/leaderboard" className="text-ink-2 hover:text-accent-ink text-[14px] font-semibold no-underline">See the leaderboard →</Link>
            </div>
          </div>
          <div className="justify-self-center">
            <Ring pct={tried ? (100 * done.size) / tried : 0}>
              <b className="text-[36px] leading-none font-display">{tried ? Math.round((100 * done.size) / tried) : 0}%</b>
              <span className="text-muted text-[12px] mt-1.5 max-w-24">of your attempts fully solved</span>
            </Ring>
          </div>
        </div>
      </Hero>
      <Card className="grid gap-3 grid-cols-[1fr_170px_170px_170px] max-tablet:grid-cols-3 max-phone:gap-2 items-end">
        <label className="relative flex items-center max-tablet:col-span-3">
          <span className="absolute left-3.5 text-muted pointer-events-none"><Icon name="search" size={18} /></span>
          <Input type="search" className="w-full pl-10" placeholder="Search by title or topic" aria-label="Search problems" value={f.text} onChange={e => setF({ ...f, text: e.target.value })} />
        </label>
        {[['env', 'Type', [['all', 'All types'], ['code', 'Programming'], ['web', 'Web page']]],
          ['diff', 'Level', [['all', 'Any level'], ['Easy', 'Easy'], ['Medium', 'Medium'], ['Hard', 'Hard']]],
          ['status', 'Status', [['all', 'Any status'], ['solved', 'Solved'], ['todo', 'Unsolved']]]].map(([k, label, opts]) => (
          <label key={k} className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold uppercase tracking-wider text-muted">{label}</span>
            <Input as="select" value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })}>{opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Input>
          </label>
        ))}
      </Card>
      {!pg ? <Loading /> : rows.length === 0 && !pg.more ? <Empty title="No problems match" body="Try clearing a filter." /> : (
        <Card className="p-0 overflow-hidden">
          <div className="grid grid-cols-[28px_1fr_150px_90px_16px] max-tablet:grid-cols-[24px_1fr_auto_12px] gap-4 max-phone:gap-3 px-5 max-phone:px-4 py-3 border-b border-line text-[12px] font-semibold uppercase tracking-wider text-muted" aria-hidden="true">
            <span /><span>Problem</span><span className="max-tablet:hidden">Type</span><span>Level</span><span />
          </div>
          {rows.map(q => (
            <Link key={q.id} to={`/solve/practice/practice/${q.id}`} className="group/rl grid grid-cols-[28px_1fr_150px_90px_16px] max-tablet:grid-cols-[24px_1fr_auto_12px] items-center gap-4 max-phone:gap-3 px-5 max-phone:px-4 py-3.5 no-underline hover:bg-soft [&+&]:border-t [&+&]:border-line">
              {done.has(q.id) ? <span className="w-6 h-6 rounded-full bg-pass-soft grid place-items-center" title="Solved"><Icon name="check" size={14} stroke={2.6} color="var(--pass-strong)" /></span> : <span className="w-6 h-6 rounded-full border-2 border-line" title="To do" />}
              <span className="flex flex-col min-w-0">
                <span className="font-semibold truncate">{q.title}</span>
                {q.topic && <span className="text-muted text-[13px] truncate">{q.topic}</span>}
              </span>
              <span className="max-tablet:hidden"><Chip as="span" className="text-[12px]">{typeLabel(q)}</Chip></span>
              <span>{q.diff && <Chip as="span" tone={LEVEL[q.diff]} className="text-[12px] font-bold">{q.diff}</Chip>}</span>
              <span className="text-muted transition-transform duration-150 group-hover/rl:translate-x-[3px] group-hover/rl:text-ink" aria-hidden="true">›</span>
            </Link>
          ))}
          {rows.length === 0 && <p className="text-muted px-5 py-4 m-0">None of the problems loaded so far match. Show more to keep looking.</p>}
        </Card>
      )}
      {pg && <div className="flex flex-col items-center gap-2">
        <span className="text-muted text-[13px]">{pg.more ? `Showing ${plural(rows.length, 'problem')}` : `Showing all ${plural(rows.length, 'problem')}`}</span>
        {pg.more && <Btn v="ghost" onClick={more} disabled={busy}>{busy ? 'Loading…' : 'Show 50 more'}</Btn>}
      </div>}
    </div>
  );
}

/* ---------- daily contest ---------- */
const Tile = ({ v, label }) => (
  <div className="flex flex-col items-center gap-1">
    <span className="font-mono text-[30px] max-phone:text-[24px] font-bold tabular-nums w-[68px] max-phone:w-[56px] py-2 rounded-xl bg-soft border border-line text-center">{v}</span>
    <span className="text-[12px] text-muted">{label}</span>
  </div>
);

export function Contest() {
  const me = useMe();
  const left = useCountdown();
  const [d] = useLoad(async () => {
    const [qs, subs, lb] = await Promise.all([questions(), mySubs(me.uid), getDoc(doc(db, 'leaderboard', me.uid))]);
    const q = dailyOf(qs.filter(isPublic));
    const all = q ? subs.filter(s => s.questionId === q.id) : []; // any attempt counts: in a test or in practice
    return { q, subs, lb: lb.data() || {}, sub: all.sort((a, b) => b.passed - a.passed)[0] || null };
  });
  if (!d) return <Loading />;
  if (!d.q) return <Empty title="No contest today" body="The question bank is empty." />;
  const { q, sub, lb } = d, solved = sub && sub.passed === sub.total;
  const pct = sub?.total ? Math.round((100 * sub.passed) / sub.total) : 0;
  const [hh, mm, ss] = left.split(':');
  const days = activityByDay(d.subs);
  const week = Array.from({ length: 7 }, (_, i) => { const t = new Date(Date.now() - (6 - i) * 864e5); return { t, n: days[dayKey(t)] || 0 }; });
  const text = q.statement || '', brief = text.length > 220 ? text.slice(0, 220).trimEnd() + '…' : text;
  const go = `/solve/practice/practice/${q.id}`;
  return (
    <div className="flex flex-col gap-5">
      {/* hero: a dark "mission control" panel in both themes */}
      <Hero>
        <div className="grid gap-8 grid-cols-[1fr_auto] max-tablet:grid-cols-1 items-center">
          <div className="flex flex-col gap-5 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <HeroPill>Daily challenge</HeroPill>
              <span className="text-muted text-[13px]">{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
            <HeroTitle>{q.title}</HeroTitle>
            <div className="flex flex-wrap gap-2 text-[13px] font-semibold">
              {[q.diff, q.topic, typeLabel(q)].filter(Boolean).map(x => <span key={x} className="rounded-md border border-line bg-soft px-3 py-1">{x}</span>)}
              <span className={`rounded-md ${GRAD} text-on-accent px-3 py-1 inline-flex items-center gap-1`}><Icon name="star" size={14} stroke={2.4} />+{SOLVE_POINTS} points</span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[12px] text-muted">Next challenge in</span>
              <div className="flex items-start gap-2" role="timer" aria-label={`${hh} hours ${mm} minutes ${ss} seconds left`}>
                <Tile v={hh} label="hours" /><span className="font-mono text-[26px] text-muted pt-2" aria-hidden="true">:</span>
                <Tile v={mm} label="min" /><span className="font-mono text-[26px] text-muted pt-2" aria-hidden="true">:</span>
                <Tile v={ss} label="sec" />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-3 items-center">
              <Link to={go} className={heroBtn}>
                {solved ? 'View your solution' : sub ? 'Try again' : 'Accept the challenge'}<span className="transition-transform duration-200 group-hover/go:translate-x-1"><Icon name="arrow" size={18} stroke={2.4} /></span>
              </Link>
              <span className="text-muted text-[14px]">{solved ? 'Challenge complete. See you tomorrow!' : sub ? 'So close! Pass every case to claim the points.' : 'Ready when you are.'}</span>
            </div>
          </div>
          <div className="justify-self-center">
            <Ring pct={solved ? 100 : pct}>
              {solved ? <><Icon name="trophy" size={40} stroke={2} color="var(--accent)" /><b className="text-[15px] mt-1.5">Solved!</b></>
                : <><b className="text-[36px] leading-none font-display">{sub ? `${sub.passed}/${sub.total}` : '0%'}</b><span className="text-muted text-[12px] mt-1.5">{sub ? 'cases passed' : 'not started'}</span></>}
            </Ring>
          </div>
        </div>
      </Hero>

      {/* power-ups */}
      <div className="grid gap-4 grid-cols-3 max-tablet:grid-cols-1">
        {[['star', 'Reward', `+${SOLVE_POINTS}`, 'points for a full solve'],
          ['flame', 'Your streak', `${lb.streak || 0}`, `${(lb.streak || 0) === 1 ? 'day' : 'days'} in a row`],
          ['trophy', 'Your points', `${lb.points || 0}`, 'on the leaderboard']].map(([icon, label, big], i) => (
          <Card key={label} className={`flex items-center gap-4 animate-rise2`} style={{ animationDelay: `${80 + i * 70}ms` }}>
            <span className="w-12 h-12 rounded-lg bg-accent-soft text-accent-ink grid place-items-center shrink-0"><Icon name={icon} size={22} /></span>
            <span className="flex flex-col">
              <span className="text-muted text-[13px]">{label}</span>
              <b className="text-[28px] leading-tight font-display">{big}</b>
            </span>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-[1.3fr_1fr] max-tablet:grid-cols-1">
        <Card className="flex flex-col gap-3 animate-rise2 [animation-delay:300ms]">
          <div className="flex items-center justify-between gap-3"><H3 className="text-[20px]">Mission brief</H3><span className="font-mono text-[12px] text-muted">{plural(q.tests.length, 'test case')}</span></div>
          <div className="rounded-lg bg-panel text-panel-text font-mono text-[13.5px] leading-relaxed p-4 border border-panel-line">
            <span className="text-[#FF8A5B]">&gt; </span>{brief}<span className="inline-block w-2 h-4 align-middle ml-1 bg-[#FF8A5B] animate-pulse" aria-hidden="true" />
          </div>
          <Link to={go} className="text-[14px] font-semibold self-start">Open the full problem →</Link>
        </Card>
        <Card className="flex flex-col gap-4 animate-rise2 [animation-delay:360ms]">
          <H3 className="text-[20px]">Your week</H3>
          <div className="grid grid-cols-7 gap-2">
            {week.map(({ t, n }, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <span className={`w-full aspect-square rounded-xl grid place-items-center text-[13px] font-bold transition-transform hover:scale-110 ${n ? `bg-accent text-on-accent` : 'bg-soft text-muted border border-line'} ${i === 6 ? 'ring-2 ring-offset-2 ring-offset-surface ring-accent/50' : ''}`} title={`${n} ${n === 1 ? 'answer' : 'answers'}`}>
                  {n ? <Icon name="check" size={16} stroke={2.6} /> : t.getDate()}
                </span>
                <span className="text-[11px] text-muted">{t.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              </div>
            ))}
          </div>
          <p className="text-muted text-[13px] m-0">Lit days are days you saved an answer. Keep the chain going to grow your streak.</p>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-3 max-tablet:grid-cols-1">
        {[['Crack it', 'A fresh problem drops every midnight. Same one for everyone.'],
          ['Pass every case', 'Run the samples, then submit. Hidden cases are checked too.'],
          ['Level up', `Earn ${SOLVE_POINTS} points and keep your streak alive.`]].map(([t, b], i) => (
          <Card key={t} className="flex gap-4 items-start animate-rise2" style={{ animationDelay: `${420 + i * 60}ms` }}>
            <span className="font-display font-bold text-[28px] leading-none text-accent">0{i + 1}</span>
            <span className="flex flex-col gap-1"><b className="text-[16px]">{t}</b><span className="text-muted text-[14px]">{b}</span></span>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- achievements ---------- */
// [name, how to earn it, icon, progress as [have, need]]
const BADGES = [
  ['First steps', 'Submit your first answer', 'play', s => [s.subs.length, 1]],
  ['Green across the board', 'Pass every test case on a question', 'check', s => [s.solved, 1]],
  ['High five', 'Fully solve 5 questions', 'star', s => [s.solved, 5]],
  ['Double digits', 'Fully solve 10 questions', 'target', s => [s.solved, 10]],
  ['Problem crusher', 'Fully solve 25 questions', 'trophy', s => [s.solved, 25]],
  ['Polyglot', 'Solve questions in 2 languages', 'code', s => [s.envs, 2]],
  ['Century', 'Earn 100 points', 'medal', s => [s.points, 100]],
  ['Point collector', 'Earn 500 points', 'chart', s => [s.points, 500]],
  ['On a roll', 'Reach a 3-day streak', 'flame', s => [s.streak, 3]],
  ['Week warrior', 'Reach a 7-day streak', 'flame', s => [s.streak, 7]],
  ['Unstoppable', 'Reach a 30-day streak', 'flame', s => [s.streak, 30]],
  ['Supporter', 'Have an active subscription', 'shield', s => [s.subscribed ? 1 : 0, 1]],
];
export function Achievements() {
  const me = useMe();
  const [d] = useLoad(async () => ({ subs: await mySubs(me.uid), qs: await questions(), lb: (await getDoc(doc(db, 'leaderboard', me.uid))).data() || {} }));
  if (!d) return <Loading />;
  const done = solvedIds(d.subs);
  const s = { subs: d.subs, solved: done.size, points: d.lb.points || 0, streak: d.lb.streak || 0, subscribed: !!me.subscribed,
    envs: new Set(d.subs.filter(x => done.has(x.questionId)).map(x => { const q = d.qs.find(y => y.id === x.questionId); return q ? (q.env === 'web' ? 'web' : langOfSub(x, q)) : null; }).filter(Boolean)).size };
  const list = BADGES.map(([name, how, icon, f]) => { const [have, need] = f(s); return { name, how, icon, have: Math.min(have, need), need, on: have >= need }; });
  const got = list.filter(b => b.on).length;
  // the locked badge you are closest to
  const next = list.filter(b => !b.on).sort((a, b) => b.have / b.need - a.have / a.need)[0];
  return (
    <div className="flex flex-col gap-5">
      <Hero>
        <div className="grid gap-8 grid-cols-[1fr_auto] max-tablet:grid-cols-1 items-center">
          <div className="flex flex-col gap-5 min-w-0">
            <div><HeroPill>Achievements</HeroPill></div>
            <HeroTitle>{got} of {list.length} unlocked</HeroTitle>
            {next && (
              <div className="rounded-lg bg-soft border border-line p-4 flex items-center gap-4">
                <span className="w-12 h-12 rounded-xl bg-soft border border-line text-ink-2 grid place-items-center shrink-0"><Icon name="lock" size={20} /></span>
                <span className="flex flex-col gap-1.5 grow min-w-0">
                  <span className="text-[11px] text-muted">Up next</span>
                  <b className="text-[16px]">{next.name}<span className="font-normal text-muted"> · {next.how}</span></b>
                  <span className="flex items-center gap-3"><span className="grow h-2 rounded-full bg-soft overflow-hidden"><span className="block h-full rounded-full bg-accent" style={{ width: `${(100 * next.have) / next.need}%` }} /></span><span className="font-mono text-[12px] text-muted">{next.have}/{next.need}</span></span>
                </span>
              </div>
            )}
          </div>
          <div className="justify-self-center">
            <Ring pct={(100 * got) / list.length}>
              <b className="text-[36px] leading-none font-display">{Math.round((100 * got) / list.length)}%</b>
              <span className="text-muted text-[12px] mt-1.5">collected</span>
            </Ring>
          </div>
        </div>
      </Hero>

      <div className="grid gap-4 grid-cols-4 max-laptop:grid-cols-3 max-tablet:grid-cols-2 max-phone:grid-cols-1">
        {list.map((b, i) => (
          <Card key={b.name} className={`relative overflow-hidden flex flex-col items-center text-center gap-2.5 px-5 py-6 transition-transform duration-200 hover:-translate-y-1 ${b.on ? 'bg-accent-soft/60 border-accent/30' : ''}`} style={{ animationDelay: `${i * 40}ms` }}>
            {b.on && <span className="absolute top-3 right-3 text-pass-strong" title="Unlocked"><Icon name="check" size={16} stroke={2.6} /></span>}
            <span className={`w-16 h-16 rounded-xl grid place-items-center ${b.on ? 'bg-accent text-on-accent' : 'bg-soft text-muted'}`}><Icon name={b.on ? b.icon : 'lock'} size={28} /></span>
            <b className="text-[15px]">{b.name}</b>
            <span className="text-[13px] text-muted">{b.how}</span>
            {!b.on && (
              <span className="w-full flex items-center gap-2 mt-1">
                <span className="grow h-1.5 rounded-full bg-soft overflow-hidden"><span className="block h-full rounded-full bg-accent" style={{ width: `${(100 * b.have) / b.need}%` }} /></span>
                <span className="font-mono text-[11px] text-muted">{b.have}/{b.need}</span>
              </span>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------- phone "More" tab ---------- */
export function More() {
  const me = useMe();
  return (
    <div className="flex flex-col gap-3.5">
      <Card as={Link} to="/profile" className="flex items-center gap-3 p-4 no-underline text-ink hover:bg-soft"><Avatar name={me.name} size={40} /><span className="flex flex-col grow min-w-0"><b className="truncate">{me.name}</b><span className="text-[13px] text-muted">Profile and settings</span></span><Icon name="gear" size={18} /></Card>
      {(NAV[me.role] || []).map(([g, items]) => (
        <Card as="section" key={g} className="flex flex-col gap-0.5 p-2">
          <div className="text-[12px] font-bold tracking-[.08em] uppercase text-muted pt-2.5 px-3 pb-0.5">{g}</div>
          {items.map(([l, to, ic]) => <Link key={to} to={to} className="flex items-center gap-2.5 w-full min-h-[42px] py-1.5 px-2.5 rounded-sm border-0 bg-transparent text-left text-[14px] hover:bg-soft no-underline"><Icon name={ic} size={18} />{l}</Link>)}
        </Card>
      ))}
      <button className={btn('ghost', 'md', 'self-start')} onClick={() => signOut(auth)}><Icon name="logout" size={18} />Log out</button>
    </div>
  );
}
