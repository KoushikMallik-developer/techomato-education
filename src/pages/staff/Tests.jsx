import { useDeferredValue, useState } from 'react';
import { addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LANGS, fromInput, langsOf, madeUpTime, readiness, statusOf, testCode, timed, toInput, typeLabel, when, windowOf } from '../../schedule.js';
import { db, freeCode, list } from '../../firebase.js';
import { useMe } from '../../auth.jsx';
import { LEVEL_TONE, Btn, plural, Empty, Field, Icon, Loading, notify, useBusy, useLoad, Card, btn, Chip, H3, Input, SearchBox, Option, StickyBar, PageHero, heroBtn } from '../../ui.jsx';
import { useUrlState, Confirm, Pick, Meta, ms, FilterBar, matches, createdOf, updatedOf, Step, FormHead, FORM_GRID, SIDE } from './trainerShared.jsx';

// Create a test: basics, when students may join, how long they get, which questions, which courses.
export function NewTest() {
  const me = useMe();
  const { id } = useParams();
  const from = useSearchParams()[0].get('from'); // clone: a new test filled in from this one
  const src = id || from;
  const [data, reload] = useLoad(async () => ({ qs: await list(collection(db, 'questions')), courses: await list(query(collection(db, 'courses'), where('trainerId', '==', me.uid))), test: src ? (await getDoc(doc(db, 'tests', src))).data() : null }), [src]);
  if (!data) return <Loading />;
  if (src && data.test?.authorId !== me.uid) return <Empty title={from ? 'You can only clone your own tests' : 'Only the trainer who created a test can edit it'} action={<Link to="/tests" className={btn('ink')}>Back to tests</Link>} />;
  // a clone keeps the questions, languages, time limit and proctoring; it gets new dates and no courses, so nothing opens by accident
  const shown = from ? { ...data, test: { ...data.test, title: `${data.test.title} (copy)`, publishAt: undefined, endAt: undefined, draft: undefined } } : data;
  return <TestForm key={`${src}-${data.test?.publishAt}-${data.test?.endAt}`} data={shown} id={id} reload={reload} />;
}

// One form for a new test and for editing an existing one (id given).
function TestForm({ data, id, reload }) {
  const me = useMe();
  const nav = useNavigate();
  const t = data.test;
  const [title, setTitle] = useState(t?.title || '');
  const [picked, setPicked] = useState(t?.questionIds || []);
  const [proctored, setProctored] = useState(!!t?.proctored);
  const was = id ? data.courses.filter(c => c.testIds?.includes(id)).map(c => c.id) : []; // courses the test is in already
  const [courseIds, setCourseIds] = useState(was);
  const [publishAt, setPublishAt] = useState(() => toInput(t?.publishAt || Date.now()));
  const [endAt, setEndAt] = useState(() => toInput(t?.endAt || Date.now() + 7 * 864e5));
  const [mins, setMins] = useState(t?.durationMin || 60);
  const [langs, setLangs] = useState(langsOf(t));
  const [busy, run, err] = useBusy();
  const [findQ, setFindQ] = useState(''), qFind = useDeferredValue(findQ), [qCap, setQCap] = useState(30), [lvl, setLvl] = useState('');
  const isDraft = !id || !!t.draft; // a published test cannot go back to a draft
  // put the test in the ticked courses and take it out of the unticked ones
  const syncCourses = async testId => {
    try { await syncAll(testId); } catch (e) { if (!id) nav(`/tests/${testId}/edit`); throw e; } // a new test already exists: edit it, do not create a copy
  };
  const syncAll = async testId => {
    for (const c of data.courses) {
      const on = courseIds.includes(c.id), had = was.includes(c.id);
      if (on !== had) await updateDoc(doc(db, 'courses', c.id), { testIds: on ? arrayUnion(testId) : arrayRemove(testId) });
    }
  };
  const [from, to] = [fromInput(publishAt), fromInput(endAt)];
  const fields = { title: title.trim(), questionIds: picked, languages: langs, ...(Number.isFinite(from) && { publishAt: from }), ...(Number.isFinite(to) && { endAt: to }), ...(mins >= 1 && { durationMin: Math.round(mins) }) };
  const bankIds = new Set(data.qs.map(q => q.id));
  const missing = [...(langs.length ? [] : ['Allow at least one language']), ...readiness({ ...fields, durationMin: mins }, bankIds, isDraft ? Date.now() : 0, courseIds.length)];
  const save = asDraft => e => {
    e?.preventDefault();
    run(async () => {
      const owner = async () => ({ code: await freeCode('tests', 'T'), proctored, authorId: me.uid, authorName: me.name, createdAt: serverTimestamp() });
      if (asDraft) { // a draft keeps whatever is filled in, courses included, and is hidden from students until it is published
        if (!fields.title) throw new Error('Add a title to save a draft');
        let testId = id;
        if (id) await updateDoc(doc(db, 'tests', id), { ...fields, draft: true, updatedAt: serverTimestamp() });
        else testId = (await addDoc(collection(db, 'tests'), { ...fields, ...(await owner()), draft: true })).id;
        await syncCourses(testId);
        notify('Draft saved. Finish it and press Schedule test to publish.');
        return nav('/tests');
      }
      // a test is published only with a title, questions, a publish time, an end time, a time limit and at least one course
      if (missing.length) throw new Error(missing[0]);
      let testId = id;
      if (id) await updateDoc(doc(db, 'tests', id), { ...fields, ...(t.draft && { draft: false }), updatedAt: serverTimestamp() }); // proctoring cannot be switched on after creation
      else testId = (await addDoc(collection(db, 'tests'), { ...fields, ...(await owner()) })).id;
      await syncCourses(testId);
      notify(id && !t.draft ? 'Test updated' : `Test scheduled and assigned to ${plural(courseIds.length, 'course')}`);
      nav('/tests');
    });
  };
  const toggle = (on, set) => (id, yes) => set(yes ? [...on, id] : on.filter(x => x !== id));
  return (
    <div className="flex flex-col gap-5 max-w-[1240px] w-full mx-auto">
      <FormHead back="/tests" backLabel="Tests" title={id ? 'Edit test' : t ? 'Copy test' : 'New test'}
        note={id ? 'Changes apply to students straight away. Students who already started keep their own deadline, and answers they submitted stay as they are.' : t ? 'Pick the dates and courses, then save it as a new test; the original stays as it is.' : null} />
      <form onSubmit={save(false)}>
       <div className={FORM_GRID}>
        <div className="flex flex-col gap-4 min-w-0">
        <Step n={1} title="Basics" hint="What students see in their test list.">
          <Field label="Title"><Input required placeholder="e.g. Week 3 loops test" value={title} onChange={e => setTitle(e.target.value)} /></Field>
          <Option on={proctored} className={id ? 'opacity-60 cursor-not-allowed' : ''}><input type="checkbox" checked={proctored} disabled={!!id} onChange={e => setProctored(e.target.checked)} /><span className="flex flex-col"><b>Proctored</b><span className="text-[13px] text-muted">Fullscreen, camera checks and an activity log. The questions stay hidden from practice.</span></span></Option>
        </Step>

        <Step n={2} title="Schedule and time limit" hint="Students can start between the publish time and the end time. After the end time nobody can start, but a student who already started keeps the time they have left.">
          <div className="grid gap-4 grid-cols-3 max-tablet:grid-cols-1">
            <Field label="Opens"><Input type="datetime-local" required value={publishAt} onChange={e => setPublishAt(e.target.value)} /></Field>
            <Field label="Last start"><Input type="datetime-local" required value={endAt} onChange={e => setEndAt(e.target.value)} /></Field>
            <Field label="Time limit (minutes)"><Input type="number" min={1} required value={mins} onChange={e => setMins(+e.target.value)} /></Field>
          </div>
          <p className="text-[13px] text-muted m-0">The timer starts when a student presses Start. It keeps running if they close the page, and they can come back and continue with the time that is left.</p>
        </Step>

        <Step n={3} title="Allowed languages" hint="Students solve programming questions in one of these. They pick the language in the editor. Web page questions are not affected.">
          <div className="flex items-center flex-wrap gap-2.5">
            {Object.entries(LANGS).map(([k, l]) => (
              <Option key={k} on={langs.includes(k)} className="flex-[0_1_auto]">
                <input type="checkbox" checked={langs.includes(k)} onChange={e => setLangs(e.target.checked ? [...langs, k] : langs.filter(x => x !== k))} />{l}
              </Option>
            ))}
          </div>
        </Step>

        <Step n={4} title="Questions" hint="Tick questions to add them. They appear in the summary in the order you pick them."
          action={picked.length > 0 && <Chip tone="accent">{plural(picked.length, 'question')} picked</Chip>}>
          {data.qs.length ? (() => {
            const pool = data.qs.filter(q => !picked.includes(q.id) && (!lvl || q.diff === lvl) && matches(`${q.title} ${q.topic || ''} ${typeLabel(q)} ${q.diff || ''}`, qFind));
            return (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <SearchBox label="Search the question bank" placeholder={`Search ${plural(data.qs.length, 'question')}`} value={findQ} onChange={v => { setFindQ(v); setQCap(30); }} />
                  <div className="flex gap-1 p-1 rounded-lg bg-soft border border-line" role="group" aria-label="Level">
                    {[['', 'All'], ['Easy', 'Easy'], ['Medium', 'Medium'], ['Hard', 'Hard']].map(([k, l]) => (
                      <button key={l} type="button" aria-pressed={lvl === k} onClick={() => { setLvl(k); setQCap(30); }} className="min-h-8 pointer-coarse:min-h-11 px-3 rounded-md border-0 bg-transparent text-[13px] font-medium text-muted hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:font-semibold aria-pressed:shadow-[0_1px_2px_rgba(23,24,28,.1)]">{l}</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col border border-line rounded-lg max-h-[440px] overflow-y-auto">
                  {pool.length ? pool.slice(0, qCap).map(q => (
                    <label key={q.id} className="flex items-center gap-3 min-h-12 px-4 py-2.5 border-b border-line last:border-b-0 cursor-pointer hover:bg-soft text-[14px]">
                      <input type="checkbox" className="w-4.5 h-4.5 shrink-0" checked={false} onChange={() => setPicked([...picked, q.id])} />
                      <span className="grow min-w-0 truncate">{q.title}{q.topic && <span className="text-muted text-[13px]"> · {q.topic}</span>}</span>
                      {q.diff && <Chip as="span" tone={LEVEL_TONE[q.diff]}>{q.diff}</Chip>}<Chip as="span" className="max-phone:hidden">{typeLabel(q)}</Chip>
                    </label>
                  )) : <span className="text-muted text-[13px] p-4">No questions match. Try another word or level.</span>}
                  {pool.length > qCap && <button type="button" className="min-h-11 text-[13px] font-semibold text-accent-ink bg-transparent border-0 hover:bg-soft" onClick={() => setQCap(n => n + 30)}>Show more ({pool.length - qCap} left)</button>}
                </div>
              </>
            );
          })() : <span className="text-muted text-[13px]">Add questions to the bank first.</span>}
        </Step>

        <Step n={5} title="Courses" hint="Required to publish: a test that is not in any course stays a draft.">
          {data.courses.length ? data.courses.map(c => (
            <Option key={c.id} on={courseIds.includes(c.id)}>
              <input type="checkbox" checked={courseIds.includes(c.id)} onChange={e => toggle(courseIds, setCourseIds)(c.id, e.target.checked)} />
              <span className="grow">{c.title}</span><span className="text-[13px] text-muted">{c.students.length} students</span>
            </Option>
          )) : <span className="text-muted text-[13px]">No courses are assigned to you yet, so this test can only be saved as a draft.</span>}
        </Step>

        </div>

        <aside className={SIDE} aria-label="Summary">
          <Card className="flex flex-col gap-4 p-0 overflow-hidden">
            <div className="flex flex-col gap-1.5 px-5 pt-5">
              <span className="text-[12px] font-semibold text-muted">Summary</span>
              <b className="text-[18px] leading-tight break-words">{title.trim() || 'Untitled test'}</b>
              {proctored && <Chip tone="proctor" className="self-start"><Icon name="shield" size={13} />Proctored</Chip>}
            </div>
            <dl className="m-0 px-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
              <dt className="text-muted">Opens</dt><dd className="m-0 text-right">{Number.isFinite(from) ? when(from) : 'Not set'}</dd>
              <dt className="text-muted">Last start</dt><dd className="m-0 text-right">{Number.isFinite(to) ? when(to) : 'Not set'}</dd>
              <dt className="text-muted">Time limit</dt><dd className="m-0 text-right">{mins >= 1 ? `${Math.round(mins)} min` : 'Not set'}</dd>
              <dt className="text-muted">Languages</dt><dd className="m-0 text-right">{langs.length ? langs.map(k => LANGS[k]).join(', ') : 'None'}</dd>
              <dt className="text-muted">Courses</dt><dd className="m-0 text-right">{courseIds.length ? data.courses.filter(c => courseIds.includes(c.id)).map(c => c.title).join(', ') : 'None'}</dd>
            </dl>
            <div className="flex flex-col border-t border-line">
              <div className="flex items-center justify-between px-5 py-2.5"><span className="text-[13px] font-semibold">Questions</span><span className="text-[13px] text-muted tabular-nums">{picked.length}</span></div>
              {picked.length ? (
                <ol className="m-0 p-0 list-none max-h-[260px] overflow-y-auto border-t border-line">
                  {picked.map((qid, n) => { const q = data.qs.find(x => x.id === qid); return (
                    <li key={qid} className="flex items-center gap-2.5 px-5 py-2 text-[13px] border-b border-line last:border-b-0">
                      <span className="text-muted tabular-nums w-5 shrink-0">{n + 1}.</span>
                      <span className={`grow min-w-0 truncate ${q ? '' : 'text-danger'}`}>{q ? q.title : 'Deleted question'}</span>
                      {q?.diff && <Chip tone={LEVEL_TONE[q.diff]}>{q.diff}</Chip>}
                      <button type="button" className="w-7 h-7 pointer-coarse:w-11 pointer-coarse:h-11 rounded-md border-0 bg-transparent text-muted hover:bg-soft hover:text-ink grid place-items-center shrink-0" aria-label={`Remove ${q ? q.title : 'deleted question'}`} onClick={() => setPicked(picked.filter(x => x !== qid))}><Icon name="x" size={14} /></button>
                    </li>
                  ); })}
                </ol>
              ) : <p className="m-0 px-5 pb-3 text-[13px] text-muted">Tick questions in step 4.</p>}
            </div>
            <div className="flex flex-col gap-3 px-5 pb-5 pt-4 border-t border-line">
              {missing.length ? (
                <div className="flex flex-col gap-1.5 rounded-lg bg-warn-soft text-warn p-3 text-[13px]">
                  <b>To schedule this test:</b>
                  <ul className="m-0 pl-4 list-disc flex flex-col gap-0.5">{missing.map(m => <li key={m}>{m}</li>)}</ul>
                </div>
              ) : <div className="flex items-center gap-2 rounded-lg bg-pass-soft text-pass p-3 text-[13px] font-semibold"><Icon name="check" size={16} stroke={2.6} />Ready to {id && !t.draft ? 'save' : 'schedule'}</div>}
              {err && <p role="alert" className="m-0 text-[13px] font-semibold text-danger">{err}</p>}
              <div className="flex flex-wrap gap-2.5 max-laptop:hidden">
                <Btn v="accent" disabled={busy} className="grow">{id && !t.draft ? 'Save changes' : 'Schedule test'}</Btn>
                {isDraft && <Btn v="ghost" type="button" disabled={busy} onClick={save(true)}>Save draft</Btn>}
              </div>
              <Link to="/tests" className="text-[13px] font-semibold text-muted hover:text-ink no-underline self-center max-laptop:hidden">Cancel</Link>
            </div>
          </Card>
        </aside>
       </div>

        <StickyBar hideWide>{err && <p role="alert" className="m-0 mr-auto text-[13px] font-semibold text-danger max-w-[460px]">{err}</p>}
          <Link to="/tests" className={btn('plain')}>Cancel</Link>
          {isDraft && <Btn v="ghost" type="button" disabled={busy} onClick={save(true)}>Save draft</Btn>}
          <Btn v="accent" disabled={busy}>{id && !t.draft ? 'Save changes' : 'Schedule test'}</Btn>
        </StickyBar>
      </form>
      {id && <TestSettings test={{ ...t, id }} bankIds={bankIds} assigned={was.length} reload={reload} />}
    </div>
  );
}

// Force publish, force close and delete for one test. Shown at the bottom of the edit page.
function TestSettings({ test, bankIds, assigned, reload }) {
  const nav = useNavigate();
  const [ask, setAsk] = useState(null); // 'publish' | 'close' | 'delete'
  const draft = !!test.draft;
  const st = !draft && timed(test) ? windowOf(test) : null;
  const problems = readiness(test, bankIds, Date.now(), assigned);
  const change = (data, msg) => async () => { await updateDoc(doc(db, 'tests', test.id), { ...data, updatedAt: serverTimestamp() }); notify(msg); reload(); };
  return (
    <>
      <Card as="section" className="flex flex-col gap-3.5">
        <H3 className="text-[18px]">Test settings</H3>
        <span>Status: <b>{draft ? 'Draft' : st ? { soon: 'Scheduled', open: 'Open', closed: 'Closed' }[st] : 'No schedule'}</b></span>
        {!st && <p className="text-[13px] text-muted m-0">{draft ? 'This test is a draft and students cannot see it. Fill in every detail above and press Schedule test to publish it.' : 'This test has no schedule, so it is open all the time. Set a publish time, end time and time limit above to schedule it.'}</p>}
        {st === 'soon' && (problems.length ? (
          <div className="rounded-[14px] bg-warn-soft text-warn py-3 px-4 font-semibold text-[14px] flex items-start flex-col gap-1"><b>Not ready to publish</b><ul className="m-0 pl-4.5">{problems.map(x => <li key={x}>{x}</li>)}</ul></div>
        ) : <span className="text-[13px] text-muted">All required details are filled in. This test will open at {when(test.publishAt)}.</span>)}
        <div className="flex items-center flex-wrap gap-3">
          <Btn v="ink" disabled={st !== 'soon' || problems.length > 0} onClick={() => setAsk('publish')}>Force publish</Btn>
          <Btn v="ghost" disabled={st !== 'open'} onClick={() => setAsk('close')}>Force close</Btn>
        </div>
        <p className="text-[13px] text-muted m-0">Force publish opens a scheduled test right now. Force close stops anyone from starting it; students already taking it keep their remaining time.{st === 'closed' && ' This test is closed. Change the end time above to open it again.'}</p>
      </Card>

      <section className="bg-surface border rounded-lg p-[22px] max-phone:p-[18px] shadow-[0_1px_2px_rgba(23,24,28,.04),0_8px_24px_-16px_rgba(23,24,28,.12)] transition-[box-shadow,transform,border-color] duration-200 flex flex-col gap-3 border-accent">
        <H3 className="text-[18px] text-accent-ink">Danger zone</H3>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex flex-col gap-0.5 flex-[1_1_300px]">
            <b>Delete this test</b>
            <span className="text-[13px] text-muted">{st === 'open' ? 'An open test cannot be deleted. Close it first with Force close, or wait for its end time.' : 'Students lose access to it. Submissions already made stay. This cannot be undone.'}</span>
          </div>
          <Btn v="accent" disabled={st === 'open'} onClick={() => setAsk('delete')}>Delete test</Btn>
        </div>
      </section>

      {ask === 'publish' && <Confirm v="ink" title="Publish this test now?" body={`Students in the courses it is assigned to can start "${test.title}" straight away, instead of at ${when(test.publishAt)}.`} label="Publish now" onYes={change({ publishAt: Date.now() - 6e4 }, 'Test published')} onClose={() => setAsk(null)} />}
      {ask === 'close' && <Confirm title="Close this test now?" body="Nobody will be able to start it any more. Students who already started keep their remaining time." label="Close now" onYes={change({ endAt: Date.now() }, 'Test closed')} onClose={() => setAsk(null)} />}
      {ask === 'delete' && <Confirm title={`Delete "${test.title}"?`} body="Students lose access to this test. Submissions already made stay. This cannot be undone." label="Delete test" onYes={async () => { await deleteDoc(doc(db, 'tests', test.id)); notify('Test deleted'); nav('/tests'); }} onClose={() => setAsk(null)} />}
    </>
  );
}

const state = t => (!timed(t) ? null : ({ soon: ['Scheduled', 'bg-chip-amber! text-chip-amber-ink!'], open: ['Open', 'bg-chip-green! text-chip-green-ink!'], closed: ['Closed', 'bg-chip-gray! text-chip-gray-ink!'] })[windowOf(t)]);

export function TestsPage() {
  const me = useMe();
  const none = { status: 'all', proc: 'all', lang: 'all', course: 'all', sort: 'new' };
  const [f, setF] = useUrlState({ ...none, q: '' });
  const text = f.q, setText = q => setF({ ...f, q });
  const [data] = useLoad(async () => ({ courses: await list(query(collection(db, 'courses'), where('trainerId', '==', me.uid))), tests: await list(query(collection(db, 'tests'), where('authorId', '==', me.uid))), bank: new Set((await list(collection(db, 'questions'))).map(q => q.id)) }));
  if (!data) return <Loading />;
  const inCourses = t => data.courses.filter(c => c.testIds?.includes(t.id)).length;
  const status = t => statusOf(t, data.bank, inCourses(t));
  const sorts = { new: (a, b) => createdOf(b) - createdOf(a), old: (a, b) => createdOf(a) - createdOf(b), upd: (a, b) => updatedOf(b) - updatedOf(a), title: (a, b) => a.title.localeCompare(b.title),
    opens: (a, b) => (a.publishAt || Infinity) - (b.publishAt || Infinity), ends: (a, b) => (a.endAt || Infinity) - (b.endAt || Infinity) };
  const shown = data.tests.filter(t => matches(`${t.title} ${testCode(t)} ${t.authorName || ''}`, text)
    && (f.status === 'all' || status(t) === f.status) && (f.proc === 'all' || (f.proc === 'yes') === !!t.proctored) && (f.lang === 'all' || langsOf(t).includes(f.lang))
    && (f.course === 'all' || (f.course === 'none' ? inCourses(t) === 0 : data.courses.find(c => c.id === f.course)?.testIds?.includes(t.id)))).sort(sorts[f.sort]);
  return (
    <div className="flex flex-col gap-5">
      {(() => { const n = k => data.tests.filter(t => status(t) === k).length; return (
        <PageHero compact title="Tests"
          stats={[['play', 'Open', n('open'), 'students can start'], ['clock', 'Scheduled', n('soon'), 'opening later'], ['clip', 'Drafts', n('draft'), 'not published'], ['lock', 'Closed', n('closed'), 'ended']]}
          actions={<Link to="/tests/new" className={heroBtn}><Icon name="plus" size={18} />New test</Link>} />
      ); })()}
      {data.tests.length > 0 && <SearchBox label="Search tests" placeholder="Search by title, test ID or creator" value={text} onChange={setText} />}
      {data.tests.length > 0 && (
        <FilterBar changed={Object.keys(none).some(k => f[k] !== none[k])} onReset={() => setF({ ...none, q: text })}>
          <Pick label="Status" value={f.status} onChange={v => setF({ ...f, status: v })} options={[['all', 'All statuses'], ['draft', 'Draft'], ['soon', 'Scheduled'], ['open', 'Open'], ['closed', 'Closed']]} />
          <Pick label="Proctoring" value={f.proc} onChange={v => setF({ ...f, proc: v })} options={[['all', 'Proctored or not'], ['yes', 'Proctored'], ['no', 'Not proctored']]} />
          <Pick label="Language" value={f.lang} onChange={v => setF({ ...f, lang: v })} options={[['all', 'Any language'], ...Object.entries(LANGS)]} />
          <Pick label="Course" value={f.course} onChange={v => setF({ ...f, course: v })} options={[['all', 'All courses'], ['none', 'Not in any course'], ...data.courses.map(c => [c.id, c.title])]} />
          <Pick label="Sort by" value={f.sort} onChange={v => setF({ ...f, sort: v })} options={[['new', 'Newest first'], ['old', 'Oldest first'], ['upd', 'Recently updated'], ['title', 'Title A to Z'], ['opens', 'Opens soonest'], ['ends', 'Last start soonest']]} />
        </FilterBar>
      )}
      {data.tests.length === 0 ? <Empty title="No tests yet" /> : !shown.length ? <Empty title="No tests match" body="Try a different word or reset the filters." /> : shown.map(t => {
        const st = status(t) === 'draft' ? ['Draft', 'bg-chip-gray! text-chip-gray-ink!'] : state(t); // a draft is missing required details
        return (
          <Card as="article" key={t.id} className="flex flex-col gap-3.5">
            <div className="flex justify-between flex-wrap gap-2.5 items-start">
              <div className="flex items-center flex-wrap gap-2.5 min-w-0">
                <H3 as="h2" className="text-[22px]">{t.title}</H3>
                {st && <Chip as="span" className={`${st[1]}`}>{st[0]}</Chip>}
                {t.proctored && <Chip tone="proctor"><Icon name="lock" size={14} />Proctored</Chip>}
              </div>
              <div className="flex items-center gap-2.5">
                <Chip as="span" className="font-mono" title="Test ID">{testCode(t)}</Chip>
                {t.authorId === me.uid && <Link to={`/tests/new?from=${t.id}`} className={btn('ghost', 'sm')}><Icon name="copy" size={16} />Clone</Link>}
                {t.authorId === me.uid && <Link to={`/tests/${t.id}/edit`} className={btn('ghost', 'sm')}>Edit</Link>}
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
              {[['Questions', t.questionIds.length], ['Languages', langsOf(t).map(l => LANGS[l]).join(', ')], ['Time limit', t.durationMin ? `${t.durationMin} min` : null], ['Opens', t.publishAt ? when(t.publishAt) : null], ['Last start', t.endAt ? when(t.endAt) : null]].map(([k, v]) => (
                <div key={k} className="fact flex flex-col gap-0.5 py-2 px-3.5 bg-soft rounded-sm"><span className="text-[13px] text-muted">{k}</span><b>{v ?? <span className="text-muted font-medium">Not set</span>}</b></div>
              ))}
            </div>
            <Meta items={[['Created by', t.authorName || me.name], ['Created', when(ms(t.createdAt) || madeUpTime(t.id))], ['Updated', when(ms(t.updatedAt) || ms(t.createdAt) || madeUpTime(t.id))]]} />
            {!timed(t) && !t.draft && <span className="text-[13px] text-muted">Edit the test to add a schedule.</span>}
          </Card>
        );
      })}
    </div>
  );
}

