import { useSearchParams } from 'react-router-dom';
import { deleteDoc, doc } from 'firebase/firestore';
import { madeUpTime } from '../../schedule.js';
import { db, forgetQuestions } from '../../firebase.js';
import { Btn, Modal, attempt, notify, useBusy, btn, H2, H3, Icon, Input, Card, Back } from '../../ui.jsx';

export const blank = { input: '', output: '', expr: '', desc: '', hidden: false };

export const remove = (col, item, reload) => attempt(async () => { await deleteDoc(doc(db, col, item.id)); if (col === 'questions') forgetQuestions(); notify('Deleted'); reload(); });

// List filters kept in the URL (?q=...&sort=...), so Back returns to the same filtered list. replace: no history entry per keystroke.
export function useUrlState(defaults) {
  const [sp, setSp] = useSearchParams();
  const value = { ...defaults, ...Object.fromEntries([...sp].filter(([k]) => k in defaults)) };
  return [value, next => setSp(Object.entries(next).filter(([k, v]) => v !== defaults[k]), { replace: true })];
}

// A yes/no dialog for actions that are hard to undo.
export const Confirm = ({ title, body, label, v = 'accent', onYes, onClose }) => {
  const [busy, run] = useBusy();
  return (
    <Modal onClose={onClose}>
      <H3 as="h2" className="text-[24px]">{title}</H3>
      <p className="text-ink-2 m-0">{body}</p>
      <div className="flex items-center gap-3 justify-end flex-wrap">
        <Btn v="ghost" onClick={onClose}>Cancel</Btn>
        <Btn v={v} disabled={busy} onClick={() => run(async () => { await onYes(); onClose(); })}>{label}</Btn>
      </div>
    </Modal>
  );
};

// All of this trainer's courses at a glance: who attempted each test and the average. Details are on the course page.
// A labelled dropdown for the filter and sort bars. options: [[value, label], ...]
export const Pick = ({ label, value, onChange, options }) => (
  <label className="flex flex-col gap-1.5 [:where(&)>span]:text-[14px] [:where(&)>span]:font-semibold min-w-32.5 flex-[1_1_150px] max-w-[190px]"><span>{label}</span>
    <Input as="select" value={value} onChange={e => onChange(e.target.value)}>{options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Input>
  </label>
);
export const Meta = ({ items }) => ( // labelled details in a row, e.g. Created by: You
  <div className="flex items-center text-[13px] flex-wrap gap-[4px_22px]">
    {items.map(([k, v]) => <span key={k}><span className="text-muted">{k}: </span><b>{v}</b></span>)}
  </div>
);
export const ms = v => v?.toMillis?.() ?? v ?? 0; // a stored time is a number in demo mode and a Timestamp in Firebase
export const FilterBar = ({ changed, onReset, children }) => (
  <div className="flex flex-wrap gap-3 items-end">
    {children}
    {changed && <button type="button" className={btn('plain', 'sm')} onClick={onReset}>Reset</button>}
  </div>
);
export const matches = (text, q) => text.toLowerCase().includes(q.trim().toLowerCase());
// created and updated times, with the same made-up fallback the cards show
export const createdOf = x => ms(x.createdAt) || madeUpTime(x.id);
export const updatedOf = x => ms(x.updatedAt) || createdOf(x);

export const STATUS_BADGE = { open: ['Open', 'bg-chip-green! text-chip-green-ink!'], closed: ['Closed', 'bg-chip-gray! text-chip-gray-ink!'] };
export const pct = (n, d) => (d ? Math.round((100 * n) / d) : null);
export const barColor = v => (v >= 70 ? 'var(--pass-strong)' : v >= 40 ? 'var(--warn)' : 'var(--accent)');


// One numbered block of the question form.
export const Step = ({ n, title, hint, action, children }) => (
  <Card as="section" className="flex flex-col gap-3.5">
    <div className="flex justify-between gap-3 items-start flex-wrap">
      <div className="flex gap-3 items-start min-w-0 flex-[1_1_280px]">
        <span className="rounded-full bg-ink text-paper inline-flex items-center justify-center font-bold shrink-0 w-7 h-7 text-[13px]" aria-hidden="true">{n}</span>
        <div><H3 as="h2" className="text-[18px]">{title}</H3>{hint && <p className="text-[13px] text-muted m-[2px_0_0]">{hint}</p>}</div>
      </div>
      {action}
    </div>
    {children}
  </Card>
);

// What a form still needs: [label, done, optional]
export const Checklist = ({ items }) => (
  <ul className="m-0 p-0 list-none flex flex-col gap-2">
    {items.map(([label, ok, optional]) => (
      <li key={label} className="flex items-center gap-2.5 text-[14px]">
        <span className={`w-5 h-5 rounded-full grid place-items-center shrink-0 ${ok ? 'bg-pass-soft text-pass' : 'border-[1.5px] border-field-line'}`}>{ok && <Icon name="check" size={12} stroke={3} />}</span>
        <span className={ok ? 'text-ink' : 'text-ink-2'}>{label}{optional && <span className="text-muted"> (optional)</span>}</span>
      </li>
    ))}
  </ul>
);
// Title row of the create and edit pages
export const FormHead = ({ back, backLabel, title, note }) => (
  <div className="flex flex-col gap-2">
    <Back to={back}>{backLabel}</Back>
    <H2 as="h1" className="text-[28px] max-phone:text-[24px]">{title}</H2>
    {note && <p className="text-[13px] text-muted m-0 max-w-[760px]">{note}</p>}
  </div>
);
// Two columns: the form, and a side panel that stays in view (below the form on small screens)
export const FORM_GRID = 'grid gap-6 grid-cols-[minmax(0,1fr)_360px] max-laptop:grid-cols-1 items-start';
export const SIDE = 'flex flex-col gap-4 sticky top-6 max-laptop:static';
