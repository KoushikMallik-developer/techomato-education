import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDoc, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { questionStats } from '../../score.js';
import { madeUpTime, typeLabel, when } from '../../schedule.js';
import { db, forgetQuestions, list, listIn } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { LEVEL_TONE, Btn, CodeBlock, IOPair, ProblemView, plural, Empty, STARTERS, Field, Icon, Loading, notify, useBusy, useLoad, Card, btn, Chip, Bar, H3, Input, Back, SearchBox, IconBtn, Option, StickyBar, PageHero, heroBtn } from '../../ui.jsx';
import { useUrlState, blank, remove, Confirm, Pick, Meta, ms, FilterBar, matches, createdOf, updatedOf, Step, Checklist, FormHead, FORM_GRID, SIDE } from './trainerShared.jsx';

// A question on its own page: the way a student sees it, then what only trainers see. The author and admins can edit or delete it.
export function QuestionDetail() {
  const { id } = useParams();
  const me = useMe();
  const nav = useNavigate();
  const [q] = useLoad(async () => { const snap = await getDoc(doc(db, 'questions', id)); return snap.exists() ? { id, ...snap.data() } : { gone: true }; }, [id]);
  const [ask, setAsk] = useState(false);
  const back = me.role === 'admin' ? '/' : '/questions';
  if (!q) return <Loading />;
  if (q.gone) return <Empty title="Question not found" body="It may have been deleted." action={<Link to={back} className={btn('ink')}>Back</Link>} />;
  const web = q.env === 'web', shown = q.tests.filter(t => !t.hidden), hidden = q.tests.filter(t => t.hidden);
  const mine = q.authorId === me.uid || me.role === 'admin';
  return (
    <div className="flex flex-col gap-5 max-w-[900px] w-[100%] m-[0_auto]">
      <Back to={back}>{me.role === 'admin' ? 'Back' : 'Question bank'}</Back>
      <Card as="section" className="flex flex-col gap-4">
        <div className="flex justify-between flex-wrap gap-3 items-start">
          <div className="flex flex-col gap-2.5 min-w-0">
            <span className="text-[13px] text-muted">This is how a student sees the question.</span>
            <H3 as="h2" className="text-[28px] w-fit" style={{ viewTransitionName: `q-${id}` }}>{q.title}</H3>
            <div className="flex items-center flex-wrap gap-2">
              <Chip as="span">{typeLabel(q)}</Chip>
              {q.diff && <Chip as="span" tone={LEVEL_TONE[q.diff]}>{q.diff}</Chip>}
              {q.topic && <Chip as="span">{q.topic}</Chip>}
            </div>
          </div>
          <div className="flex gap-2">
            <Link to={`/questions/new?from=${id}`} className={btn('ghost', 'sm')}><Icon name="copy" size={16} />Clone</Link>
            {mine && <Link to={`/questions/${id}/edit`} className={btn('ghost', 'sm')}><Icon name="edit" size={16} />Edit</Link>}
          </div>
        </div>
        <ProblemView q={q} shown={shown} />
        {hidden.length > 0 && <p className="text-[13px] text-muted m-0">Hidden test cases checked when the student submits: {hidden.length}.</p>}
        {web && q.starter && <div className="flex flex-col gap-1.5"><h3 className="m-0 text-[14px]">Starter code in the editor</h3><CodeBlock code={q.starter} /></div>}
      </Card>

      <Card as="section" className="flex flex-col gap-3">
        <H3 className="text-[18px]">Only trainers see this</H3>
        <Meta items={[['Visibility', q.public === false ? 'Private (tests only)' : 'Public (practice and daily contests)'], ['Test cases', q.tests.length], ['Hidden', hidden.length], ['Created by', q.authorName || 'A former trainer'], ['Created', when(ms(q.createdAt) || madeUpTime(q.id))], ['Updated', when(ms(q.updatedAt) || ms(q.createdAt) || madeUpTime(q.id))]]} />
        {hidden.map((t, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <span className="text-[13px] text-muted">Hidden test case {i + 1}</span>
            {web ? <p className="text-[13px] m-0">{t.desc || t.expr}{t.desc && t.expr ? <span className="font-mono text-muted"> ({t.expr})</span> : null}</p> : <IOPair input={t.input} output={t.output} />}
          </div>
        ))}
      </Card>

      {mine && (
        <section className="bg-surface border rounded-lg p-[22px] max-phone:p-[18px] shadow-[0_1px_2px_rgba(23,24,28,.04),0_8px_24px_-16px_rgba(23,24,28,.12)] transition-[box-shadow,transform,border-color] duration-200 flex flex-col gap-2.5 border-accent">
          <H3 className="text-[18px] text-accent-ink">Danger zone</H3>
          <p className="text-[13px] text-muted m-0">Deleting removes the question from the bank for everyone, and tests that use it lose it. Answers students already submitted stay.</p>
          <div><Btn v="accent" onClick={() => setAsk(true)}><Icon name="trash" size={16} />Delete question</Btn></div>
        </section>
      )}
      {ask && <Confirm title={`Delete "${q.title}"?`} body="It is removed from the question bank for everyone, and tests that use it lose it. Submissions already made stay. This cannot be undone." label="Delete question" onYes={async () => { await deleteDoc(doc(db, 'questions', id)); forgetQuestions(); notify('Question deleted'); nav(back); }} onClose={() => setAsk(false)} />}
    </div>
  );
}


// q given = editing that question (its type cannot change: web and programming answers are graded differently); with copy, q only fills in a new question
function QuestionForm({ onSaved, q, copy }) {
  const editing = q && !copy;
  const me = useMe();
  const [env, setEnv] = useState(q ? (q.env === 'web' ? 'web' : 'code') : 'code'); // 'code' = programming (any language), 'web' = an HTML/CSS/JS page
  const [title, setTitle] = useState(q?.title || '');
  const [statement, setStatement] = useState(q?.statement || '');
  const [constraints, setConstraints] = useState(q?.constraints || '');
  const [diff, setDiff] = useState(q?.diff || 'Easy');
  const [topic, setTopic] = useState(q?.topic || '');
  const [starter, setStarter] = useState(q?.env === 'web' ? q.starter : STARTERS.web);
  const [pub, setPub] = useState(q ? q.public !== false : true);
  const [tests, setTests] = useState(q ? q.tests.map(t => ({ ...blank, ...t })) : [{ ...blank }]);
  const web = env === 'web';
  const [busy, run, err] = useBusy();
  const [askEnv, setAskEnv] = useState(null); // a type change waiting for confirmation
  const switchEnv = v => { setEnv(v); setTests([{ ...blank }]); };
  const pickEnv = v => (tests.some(t => t.input || t.output || t.expr || t.desc) ? setAskEnv(v) : switchEnv(v)); // the cases do not carry over between types
  const edit = (i, patch) => setTests(tests.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const pairs = tests.map((t, i) => [t, i]);
  const examples = pairs.filter(([t]) => !t.hidden), hiddenCases = pairs.filter(([t]) => t.hidden);
  const caseCard = (t, i, label, example) => (
    <div key={i} className="flex flex-col gap-3 bg-soft border border-line rounded-lg p-3.5">
      <div className="flex items-center justify-between gap-3"><b className="text-[13px]">{label}</b><button type="button" className="rounded-lg border border-line bg-surface hover:bg-paper inline-flex items-center justify-center shrink-0 w-8 h-8" aria-label={`Remove ${label}`} onClick={() => setTests(tests.filter((_, j) => j !== i))}><Icon name="x" size={16} /></button></div>
      <div className="grid gap-4 grid-cols-2 max-phone:grid-cols-1">
        <Field label="Input"><Input as="textarea" className="font-mono py-3 leading-[1.55] resize-y" rows={2} value={t.input} onChange={e => edit(i, { input: e.target.value })} /></Field>
        <Field label="Output"><Input as="textarea" className="font-mono py-3 leading-[1.55] resize-y" rows={2} value={t.output} onChange={e => edit(i, { output: e.target.value })} /></Field>
      </div>
      {example && <Field label="Explanation (optional)"><Input placeholder="Why this input gives this output" value={t.note || ''} onChange={e => edit(i, { note: e.target.value })} /></Field>}
    </div>
  );
  const save = e => {
    e.preventDefault();
    run(async () => {
      const ok = tests.filter(t => (web ? t.expr.trim() : t.output.trim())).map(({ note, ...t }) => (note?.trim() ? { ...t, note: note.trim() } : t));
      if (!ok.length) throw new Error('Add at least one complete test case');
      if (!web && !ok.some(t => !t.hidden)) throw new Error('Add at least one example test case (one that students can see)');
      if (editing) {
        await updateDoc(doc(db, 'questions', q.id), { title, statement, constraints: constraints.trim(), env, starter: web ? starter : '', diff, topic: topic.trim(), tests: ok, public: pub, updatedAt: serverTimestamp() });
      } else await addDoc(collection(db, 'questions'), { title, statement, ...(constraints.trim() ? { constraints: constraints.trim() } : {}), env, starter: web ? starter : '', diff, topic: topic.trim(), tests: ok, public: pub, authorId: me.uid, authorName: me.name, createdAt: serverTimestamp() });
      forgetQuestions();
      notify(editing ? 'Question updated' : 'Saved to the question bank');
      onSaved();
    });
  };
  return (
    <form onSubmit={save}>
     <div className={FORM_GRID}>
      <div className="flex flex-col gap-4 min-w-0">
      <Step n={1} title="Basics" hint="What students see in the question list.">
        <Field label="Title"><Input required placeholder="e.g. Reverse a string" value={title} onChange={e => setTitle(e.target.value)} /></Field>
        <div className="grid gap-4 grid-cols-3 max-tablet:grid-cols-1">
          <Field label="Question type">
            <Input as="select" value={env} disabled={editing} onChange={e => pickEnv(e.target.value)}>
              <option value="code">Programming (any language)</option>
              <option value="web">Web page (HTML / CSS / JS)</option>
            </Input>
          </Field>
          <Field label="Difficulty"><Input as="select" value={diff} onChange={e => setDiff(e.target.value)}>{['Easy', 'Medium', 'Hard'].map(x => <option key={x}>{x}</option>)}</Input></Field>
          <Field label="Topic (optional)"><Input placeholder="e.g. Strings" value={topic} onChange={e => setTopic(e.target.value)} /></Field>
        </div>
      </Step>

      <Step n={2} title="Problem" hint="Explain the task clearly. Say what the input and output look like.">
        <Field label="Problem statement"><Input as="textarea" className="py-3 leading-[1.55] resize-y" rows={5} required value={statement} onChange={e => setStatement(e.target.value)} /></Field>
        <Field label="Constraints (optional)"><Input as="textarea" className="font-mono py-3 leading-[1.55] resize-y" rows={3} placeholder={'One per line, for example:\n1 <= n <= 1000\nTime limit: 1 second'} value={constraints} onChange={e => setConstraints(e.target.value)} /></Field>
      </Step>

      {web ? (
        <Step n={3} title="Requirements" hint="Each requirement is a JavaScript expression run against the student's page. It must be truthy, e.g. document.querySelector('h1').textContent === 'Hello'"
          action={<button type="button" className={btn('ghost', 'sm')} onClick={() => setTests([...tests, { ...blank }])}><Icon name="plus" size={16} />Requirement</button>}>
          {tests.map((t, i) => (
            <div key={i} className="flex gap-3 items-start flex-wrap">
              <Input className="flex-[1_1_200px]" aria-label="Description shown to the student" placeholder="Description shown to the student" value={t.desc} onChange={e => edit(i, { desc: e.target.value })} />
              <Input className="font-mono flex-[2_1_260px]" aria-label="JS expression" placeholder="JS expression" value={t.expr} onChange={e => edit(i, { expr: e.target.value })} />
              <label className="flex items-center text-[13px] gap-1.5 min-h-11"><input type="checkbox" checked={t.hidden} onChange={e => edit(i, { hidden: e.target.checked })} />Hidden</label>
              <IconBtn type="button" aria-label="Remove requirement" onClick={() => setTests(tests.filter((_, j) => j !== i))}><Icon name="x" size={18} /></IconBtn>
            </div>
          ))}
        </Step>
      ) : (
        <>
          <Step n={3} title="Example test cases" hint="Students see these on the question page, and they are checked when the student submits. Add as many as help explain the problem."
            action={<button type="button" className={btn('ghost', 'sm')} onClick={() => setTests([...tests, { ...blank }])}><Icon name="plus" size={16} />Example test case</button>}>
            {examples.map(([t, i], n) => caseCard(t, i, `Example test case ${n + 1}`, true))}
          </Step>
          <Step n={4} title="Hidden test cases" hint="Optional. Also checked on submit, but students never see them. They catch answers that only work for the example ones."
            action={<button type="button" className={btn('ghost', 'sm')} onClick={() => setTests([...tests, { ...blank, hidden: true }])}><Icon name="plus" size={16} />Hidden test case</button>}>
            {hiddenCases.length ? hiddenCases.map(([t, i], n) => caseCard(t, i, `Hidden test case ${n + 1}`, false)) : <p className="text-[13px] text-muted m-0">None yet. Add one or two with different inputs from the example ones.</p>}
          </Step>
        </>
      )}

      {web && (
        <Step n={4} title="Starter code" hint="What students see in the editor when they open the question.">
          <Input as="textarea" className="font-mono py-3 leading-[1.55] resize-y" rows={6} aria-label="Starter code" value={starter} onChange={e => setStarter(e.target.value)} />
        </Step>
      )}

      <Step n={5} title="Publish to the public?" hint="Public questions appear in student Practice, search and the daily contest. Private ones can only be used in tests.">
        <Option on={pub}><input type="radio" name="vis" checked={pub} onChange={() => setPub(true)} /><span><b>Public</b> <span className="text-[13px] text-muted">Everyone can practise it and it can come up as the daily contest</span></span></Option>
        <Option on={!pub}><input type="radio" name="vis" checked={!pub} onChange={() => setPub(false)} /><span><b>Private</b> <span className="text-[13px] text-muted">Only students taking a test that uses it can see it</span></span></Option>
      </Step>

      </div>

      <aside className={SIDE} aria-label="Summary">
        <Card className="flex flex-col gap-3.5">
          <H3 as="h2" className="text-[16px]">Before you save</H3>
          <Checklist items={[
            ['Title', !!title.trim()],
            ['Problem statement', !!statement.trim()],
            web ? ['At least one requirement', tests.some(t => t.expr.trim())] : ['At least one example test case', examples.some(([t]) => t.output.trim())],
            ...(web ? [] : [['Hidden test cases', hiddenCases.some(([t]) => t.output.trim()), true]]),
          ]} />
          {err && <p role="alert" className="m-0 text-[13px] font-semibold text-danger">{err}</p>}
          <div className="flex gap-2.5 max-laptop:hidden">
            <Btn v="accent" disabled={busy} className="grow">{editing ? 'Save changes' : 'Save to question bank'}</Btn>
            <Link to="/questions" className={btn('ghost')}>Cancel</Link>
          </div>
        </Card>
        <Card className="flex flex-col gap-3.5 max-h-[calc(100dvh-290px)] overflow-y-auto max-laptop:max-h-none">
          <div className="flex items-center justify-between gap-3"><H3 as="h2" className="text-[16px]">Student preview</H3><span className="text-[12px] text-muted">Updates as you type</span></div>
          <div className="flex flex-col gap-1.5">
            <b className="text-[18px] leading-tight">{title.trim() || 'Untitled question'}</b>
            <div className="flex flex-wrap gap-1.5"><Chip tone={LEVEL_TONE[diff]}>{diff}</Chip>{topic.trim() && <Chip>{topic.trim()}</Chip>}<Chip>{web ? 'Web page' : 'Programming'}</Chip></div>
          </div>
          {statement.trim() ? <ProblemView q={{ statement, constraints: constraints.trim(), env: web ? 'web' : 'code' }} shown={tests.filter(t => !t.hidden && (web ? t.desc || t.expr : t.input || t.output))} />
            : <p className="m-0 text-[13px] text-muted">The problem statement and the example test cases show up here, as students will see them.</p>}
        </Card>
      </aside>
     </div>

      {askEnv && <Confirm title="Change the question type?" body="Programming and web page questions use different test cases, so the test cases you added will be cleared." label="Change type" onYes={() => switchEnv(askEnv)} onClose={() => setAskEnv(null)} />}
      <StickyBar hideWide>{err && <p role="alert" className="m-0 mr-auto text-[13px] font-semibold text-danger max-w-[460px]">{err}</p>}
        <Link to="/questions" className={btn('plain')}>Cancel</Link>
        <Btn v="accent" disabled={busy}>{editing ? 'Save changes' : 'Save to question bank'}</Btn>
      </StickyBar>
    </form>
  );
}

// Its own page (/questions/new) so the bank stays a clean list.
export function NewQuestion() {
  const nav = useNavigate();
  const { id } = useParams();
  const from = useSearchParams()[0].get('from'); // clone: a new question filled in from this one
  const me = useMe();
  const src = id || from;
  const [d] = useLoad(async () => (src ? { q: { id: src, ...(await getDoc(doc(db, 'questions', src))).data() } } : {}), [src]);
  if (!d) return <Loading />;
  const q = from && d.q.title ? { ...d.q, title: `${d.q.title} (copy)` } : d.q;
  if (id && q.authorId !== me.uid && me.role !== 'admin') return <Empty title="Only the trainer who added a question, or an admin, can edit it" action={<Link to="/questions" className={btn('ink')}>Back to the question bank</Link>} />;
  return (
    <div className="flex flex-col gap-5 max-w-[1240px] w-full mx-auto">
      <FormHead back={id ? `/questions/${id}` : '/questions'} backLabel={id ? 'Back to the question' : 'Question bank'} title={id ? 'Edit question' : from ? 'Copy question' : 'New question'}
        note={id ? 'Changes apply everywhere this question is used, straight away. Answers students already submitted keep their saved score. The question type cannot be changed.' : from ? 'Saving adds this copy to the bank as a new question; the original stays as it is.' : null} />
      <QuestionForm key={src || 'new'} q={q} copy={!!from} onSaved={() => nav(id ? `/questions/${id}` : '/questions')} />
    </div>
  );
}

export function Questions() {
  const me = useMe();
  // shortcut: reads every submission on this trainer's own tests to build the averages; fine for a few thousand, move to a counters doc when the class grows
  const [data, reload] = useLoad(async () => { const [qs, tests] = await Promise.all([list(collection(db, 'questions')), list(collection(db, 'tests'))]);
    const subs = await listIn(tests.filter(t => t.authorId === me.uid).map(t => t.id), ids => query(collection(db, 'submissions'), where('testId', 'in', ids))); // questions saved before authorName existed: look the author up once per trainer
    const missing = [...new Set(qs.filter(q => !q.authorName && q.authorId).map(q => q.authorId))];
    const names = Object.fromEntries(await Promise.all(missing.map(async id => [id, (await getDoc(doc(db, 'users', id))).data()?.name])));
    return { qs: qs.map(q => ({ ...q, authorName: q.authorName || names[q.authorId] })), stats: questionStats(qs, tests, subs) }; });
  const [del, setDel] = useState(null);
  const none = { env: 'all', diff: 'all', vis: 'all', by: 'all', sort: 'new' };
  const [f, setF] = useUrlState({ ...none, q: '' });
  const text = f.q, setText = q => setF({ ...f, q });
  const find = useDeferredValue(text); // typing stays instant; the list catches up a frame later
  // the bank can hold thousands of questions: draw 40 rows, and 40 more each time the end comes near
  const [limit, setLimit] = useState(40), end = useRef();
  const fk = JSON.stringify(f);
  useEffect(() => setLimit(40), [find, fk]);
  useEffect(() => {
    if (!end.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLimit(n => n + 40), { rootMargin: '800px' });
    io.observe(end.current);
    return () => io.disconnect();
  });
  if (!data) return <Loading />;
  const { qs, stats } = data;
  const authors = [...new Map(qs.filter(q => q.authorId && q.authorId !== me.uid).map(q => [q.authorId, q.authorName || 'Unknown'])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const sorts = { new: (a, b) => createdOf(b) - createdOf(a), old: (a, b) => createdOf(a) - createdOf(b), upd: (a, b) => updatedOf(b) - updatedOf(a), title: (a, b) => a.title.localeCompare(b.title),
    used: (a, b) => stats[b.id].tests.length - stats[a.id].tests.length, unused: (a, b) => stats[a.id].tests.length - stats[b.id].tests.length, high: (a, b) => (stats[b.id].avg ?? -1) - (stats[a.id].avg ?? -1), low: (a, b) => (stats[a.id].avg ?? 101) - (stats[b.id].avg ?? 101) };
  const shown = qs.filter(q => matches(`${q.title} ${q.topic || ''} ${typeLabel(q)} ${q.diff || ''}`, find)
    && (f.env === 'all' || (f.env === 'web') === (q.env === 'web')) && (f.diff === 'all' || q.diff === f.diff)
    && (f.vis === 'all' || (f.vis === 'private') === (q.public === false)) && (f.by === 'all' || q.authorId === (f.by === 'me' ? me.uid : f.by))).sort(sorts[f.sort]);
  return (
    <div className="flex flex-col gap-5">
      <PageHero compact title="Question bank"
        stats={[['code', 'Questions', qs.length, 'in the bank'], ['user', 'Yours', qs.filter(q => q.authorId === me.uid).length, 'written by you'], ['lock', 'Private', qs.filter(q => q.public === false).length, 'tests only']]}
        actions={<Link to="/questions/new" className={heroBtn}><Icon name="plus" size={18} />New question</Link>} />
      <SearchBox label="Search questions" placeholder="Search by title, topic, language or level" value={text} onChange={setText} />
      {qs.length > 0 && (
        <FilterBar changed={Object.keys(none).some(k => f[k] !== none[k])} onReset={() => setF({ ...none, q: text })}>
          <Pick label="Type" value={f.env} onChange={v => setF({ ...f, env: v })} options={[['all', 'All types'], ['code', 'Programming'], ['web', 'Web page']]} />
          <Pick label="Level" value={f.diff} onChange={v => setF({ ...f, diff: v })} options={[['all', 'All levels'], ['Easy', 'Easy'], ['Medium', 'Medium'], ['Hard', 'Hard']]} />
          <Pick label="Visibility" value={f.vis} onChange={v => setF({ ...f, vis: v })} options={[['all', 'Public and private'], ['public', 'Public'], ['private', 'Private']]} />
          <Pick label="Created by" value={f.by} onChange={v => setF({ ...f, by: v })} options={[['all', 'Everyone'], ['me', 'Me'], ...authors]} />
          <Pick label="Sort by" value={f.sort} onChange={v => setF({ ...f, sort: v })} options={[['new', 'Newest first'], ['old', 'Oldest first'], ['upd', 'Recently updated'], ['title', 'Title A to Z'], ['used', 'Most used in tests'], ['unused', 'Least used in tests'], ['high', 'Highest average result'], ['low', 'Lowest average result']]} />
        </FilterBar>
      )}
      {qs.length === 0 ? <Empty title="The question bank is empty" body="Add your first question to start building tests." /> : shown.length === 0 ? <Empty title="No questions match" body="Try a different word or reset the filters." /> : (
        <div className="flex flex-col gap-3">
          <h2 className="sr-only">Questions</h2>
          <p className="m-0 text-[13px] text-muted tabular-nums" aria-live="polite">{shown.length === qs.length ? plural(qs.length, 'question') : `${shown.length} of ${plural(qs.length, 'question')}`}</p>
          {shown.slice(0, limit).map(q => {
            const st = stats[q.id], used = st.tests;
            return (
              <Card as="article" key={q.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_140px] grid grid-cols-[minmax(0,1fr)_80px_170px_148px] gap-5 items-center py-4 px-[18px] max-[701px]:grid-cols-[1fr_1fr_148px] max-[701px]:[:where(&)>:first-child]:col-[1/-1]">
                <div className="flex flex-col gap-2 min-w-0">
                  <H3 as="h3" className="text-[20px] w-fit" style={{ viewTransitionName: `q-${q.id}` }}><Link to={`/questions/${q.id}`} className="bg-none border-0 p-0 font-[inherit] text-inherit text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2 focus-visible:rounded" title="Open the question">{q.title}</Link></H3>
                  <div className="flex items-center flex-wrap gap-2">
                    <Chip as="span">{typeLabel(q)}</Chip>
                    {q.diff && <Chip as="span" tone={LEVEL_TONE[q.diff]}>{q.diff}</Chip>}
                    {q.topic && <Chip as="span">{q.topic}</Chip>}
                    <Chip as="span">{plural(q.tests.length, 'test case')}</Chip>
                    {q.public === false && <Chip tone="warn"><Icon name="lock" size={14} />Private</Chip>}
                  </div>
                  <Meta items={[['Created by', q.authorId === me.uid ? 'You' : q.authorName || 'A former trainer'], ['Created', when(ms(q.createdAt) || madeUpTime(q.id))], ['Updated', when(ms(q.updatedAt) || ms(q.createdAt) || madeUpTime(q.id))]]} />
                </div>
                <div className="flex flex-col gap-1" title="How many tests use this question">
                  <span className="text-[13px] text-muted">Used in</span>
                  <b className="text-[24px] leading-[1.1]" style={{ color: used.length ? 'var(--ink)' : 'var(--muted)' }}>{used.length}<span className="text-[13px] text-muted font-medium"> {used.length === 1 ? 'test' : 'tests'}</span></b>
                </div>
                <div className="flex flex-col gap-1">
                  {st.students ? (
                    <>
                      <span className="text-[13px] text-muted">Average result</span>
                      <b className="text-[24px] leading-[1.1]">{st.avg}%</b>
                      <Bar pct={st.avg} color={st.avg >= 70 ? 'var(--pass-strong)' : st.avg >= 40 ? 'var(--warn)' : 'var(--accent)'} role="img" aria-label={`Average result ${st.avg}%`} />
                    </>
                  ) : <span className="text-[13px] text-muted">No attempts yet</span>}
                </div>
                <div className="flex items-center justify-end gap-2">{/* fixed-width column: rows without buttons keep the same layout */}
                  <IconBtn as={Link} to={`/questions/new?from=${q.id}`} aria-label={`Clone ${q.title}`} title="Clone"><Icon name="copy" size={16} /></IconBtn>
                  {q.authorId === me.uid && <IconBtn as={Link} to={`/questions/${q.id}/edit`} aria-label={`Edit ${q.title}`}><Icon name="edit" size={16} /></IconBtn>}
                  {(q.authorId === me.uid || me.role === 'admin') && <IconBtn aria-label={`Delete ${q.title}`} onClick={() => setDel(q)}><Icon name="trash" size={16} /></IconBtn>}
                </div>
              </Card>
            );
          })}
          {shown.length > limit && <Btn v="ghost" ref={end} className="self-center" onClick={() => setLimit(n => n + 40)}>Show more ({shown.length - limit} left)</Btn>}
        </div>
      )}
      {del && <Confirm title={`Delete "${del.title}"?`} body="It is removed from the question bank for everyone, and tests that use it lose it. Submissions already made stay. This cannot be undone." label="Delete question" onYes={() => remove('questions', del, reload)} onClose={() => setDel(null)} />}
    </div>
  );
}

