import { useState } from 'react';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { db, list } from '../../firebase.js';
import { buckets, series } from '../../score.js';
import { download, toCsv } from '../../csv.js';
import { LineChart } from '../../Charts.jsx';
import { useMe } from '../../auth.jsx';
import { toInput, fromInput } from '../../schedule.js';
import { Modal, Avatar, Btn, Card, Chip, Empty, Field, H3, Icon, Input, Loading, Logo, PageHero, SearchBox, heroBtn, btn, notify, plural, useBusy, useLoad } from '../../ui.jsx';
import { ms } from './trainerShared.jsx';
import { TD, TH, rupees, what } from './Admin.jsx';

const PAGE = 50;
const RANGES = [['today', 'Today'], ['week', '7 days'], ['month', 'Month'], ['year', 'Year'], ['all', 'All'], ['custom', 'Custom']];
const SORTS = { new: ['Newest first', (a, b) => ms(b.at) - ms(a.at)], old: ['Oldest first', (a, b) => ms(a.at) - ms(b.at)], high: ['Highest amount', (a, b) => b.amount - a.amount], low: ['Lowest amount', (a, b) => a.amount - b.amount] };
export const receiptNo = p => `R-${p.id.slice(-8).toUpperCase()}`;
const stamp = t => (t ? new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const day = t => new Date(t).toISOString().slice(0, 10);
const SEG = 'grow min-h-8 pointer-coarse:min-h-11 px-2.5 rounded-md border-0 bg-transparent text-[13px] font-medium text-muted whitespace-nowrap hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:font-semibold aria-pressed:shadow-[0_1px_2px_rgba(23,24,28,.1)]';

export function AdminPayments() {
  const [d, reload] = useLoad(async () => ({ pays: await list(collection(db, 'payments')), users: await list(collection(db, 'users')) }));
  const [range, setRange] = useState('month');
  const [from, setFrom] = useState(() => day(Date.now() - 29 * 864e5)), [to, setTo] = useState(() => day(Date.now()));
  const [text, setText] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('new');
  const [cap, setCap] = useState(PAGE);
  const [open, setOpen] = useState(null); // the payment whose receipt is open
  const [adding, setAdding] = useState(false);
  if (!d) return <Loading />;
  const email = Object.fromEntries(d.users.map(u => [u.id, u.email]));
  const pays = d.pays.map(p => ({ ...p, t: ms(p.at) }));
  const [f, t] = [new Date(`${from}T00:00`).getTime(), new Date(`${to}T00:00`).getTime()]; // the chosen days, local midnight
  const { starts } = buckets(range, Date.now(), Math.min(Date.now(), ...pays.map(p => p.t).filter(Boolean)), f, t);
  const q = text.trim().toLowerCase();
  const inRange = pays.filter(p => p.t >= starts[0] && p.t < starts[starts.length - 1] && (!q || `${p.userName} ${email[p.userId] || ''} ${receiptNo(p)} ${what(p)}`.toLowerCase().includes(q)));
  const rows = inRange.filter(p => status === 'all' || (status === 'refunded') === !!p.refunded).sort(SORTS[sort][1]);
  const paid = inRange.filter(p => !p.refunded), refunded = inRange.filter(p => p.refunded);
  const net = paid.reduce((n, p) => n + (p.amount || 0), 0);
  const graph = series(paid.map(p => [p.t, p.amount]), range, Date.now(), f, t);
  const exportCsv = () => download(`payments-${day(Date.now())}.csv`, toCsv([['Receipt', 'Date', 'Student', 'Email', 'For', 'Amount (INR)', 'Status', 'Refund reason'],
    ...rows.map(p => [receiptNo(p), new Date(p.t).toISOString(), p.userName, email[p.userId] || '', what(p), p.amount, p.refunded ? 'Refunded' : 'Paid', p.refundReason || ''])]));
  const pick = r => { setRange(r); setCap(PAGE); };
  return (
    <div className="flex flex-col gap-5">
      {open && <Receipt p={open} email={email[open.userId]} user={d.users.find(u => u.id === open.userId)} onClose={() => setOpen(null)} onChange={() => { setOpen(null); reload(); }} />}
      {adding && <RecordPayment users={d.users} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />}
      <PageHero compact title="Payments"
        stats={[['chart', 'Received', rupees(net)], ['doc', 'Payments', paid.length], ['star', 'Average payment', paid.length ? rupees(Math.round(net / paid.length)) : '—'], ['back', 'Refunded', rupees(refunded.reduce((n, p) => n + (p.amount || 0), 0))]]}
        actions={<>
          <button className={btn('ghost')} onClick={exportCsv} disabled={!rows.length}><Icon name="doc" size={18} />Export CSV</button>
          <button className={heroBtn} onClick={() => setAdding(true)}><Icon name="plus" size={18} />Record payment</button>
        </>} />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-lg bg-soft border border-line" role="group" aria-label="Date range">
          {RANGES.map(([k, l]) => <button key={k} type="button" aria-pressed={range === k} className={SEG} onClick={() => pick(k)}>{l}</button>)}
        </div>
        {range === 'custom' && (
          <span className="flex items-center gap-2 text-[13px] text-muted">
            <Input type="date" className="w-auto!" aria-label="From" value={from} max={to} onChange={e => e.target.value && setFrom(e.target.value)} />to
            <Input type="date" className="w-auto!" aria-label="To" value={to} min={from} onChange={e => e.target.value && setTo(e.target.value)} />
          </span>
        )}
      </div>

      <Card as="section" className="flex flex-col gap-2.5">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div><H3 as="h2" className="text-[18px]">Revenue</H3><p className="text-[13px] text-muted m-[2px_0_0]">{rupees(net)} received{refunded.length ? `, refunds not included` : ''}</p></div>
        </div>
        <LineChart data={graph} label="Rupees received" color="var(--accent)" w={1000} />
      </Card>

      <div className="flex items-center gap-3 flex-wrap">
        <SearchBox label="Search payments" placeholder="Search by student, email or receipt" value={text} onChange={v => { setText(v); setCap(PAGE); }} />
        <Input as="select" className="w-auto! min-w-[140px]" aria-label="Status" value={status} onChange={e => { setStatus(e.target.value); setCap(PAGE); }}>
          <option value="all">Paid and refunded</option><option value="paid">Paid only</option><option value="refunded">Refunded only</option>
        </Input>
        <Input as="select" className="w-auto! min-w-[150px]" aria-label="Sort" value={sort} onChange={e => setSort(e.target.value)}>
          {Object.entries(SORTS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </Input>
      </div>

      {rows.length === 0 ? <Empty title={d.pays.length ? 'No payments match' : 'No payments yet'} body={d.pays.length ? 'Try another date range or search.' : 'Payments are recorded when you switch on Pro for a student, or with Record payment.'} /> : (
        <Card className="overflow-x-auto p-0">
          <table className="border-collapse w-full">
            <thead><tr><th className={TH}>Date</th><th className={`${TH} max-tablet:hidden`}>Receipt</th><th className={TH}>Student</th><th className={`${TH} max-phone:hidden`}>For</th><th className={`${TH} text-right!`}>Amount</th><th className={TH}><span className="sr-only">Receipt</span></th></tr></thead>
            <tbody>{rows.slice(0, cap).map(p => (
              <tr key={p.id} className="hover:bg-soft/60 [&:last-child>td]:border-b-0">
                <td className={`${TD} text-[13px] text-ink-2 whitespace-nowrap`}>{stamp(p.t)}</td>
                <td className={`${TD} font-mono text-[13px] text-muted max-tablet:hidden`}>{receiptNo(p)}</td>
                <td className={TD}><span className="flex items-center gap-3 min-w-0"><Avatar name={p.userName} size={30} /><span className="flex flex-col min-w-0"><b className="truncate text-[14px]">{p.userName}</b><span className="text-[12px] text-muted truncate">{email[p.userId] || 'No longer a user'}</span></span></span></td>
                <td className={`${TD} text-[14px] text-ink-2 max-phone:hidden`}>{what(p)}</td>
                <td className={`${TD} text-right whitespace-nowrap`}>{p.refunded ? <span className="flex flex-col items-end gap-1"><s className="font-mono text-muted">{rupees(p.amount)}</s><Chip tone="danger">Refunded</Chip></span> : <b className="font-mono">{rupees(p.amount)}</b>}</td>
                <td className={`${TD} text-right`}><Btn v="ghost" size="sm" onClick={() => setOpen(p)}>Receipt</Btn></td>
              </tr>
            ))}</tbody>
          </table>
          <div className="flex items-center justify-between gap-3 flex-wrap px-4 py-3 border-t border-line text-[13px] text-muted">
            <span>Showing {Math.min(cap, rows.length)} of {plural(rows.length, 'payment')}</span>
            {rows.length > cap && <Btn v="ghost" size="sm" onClick={() => setCap(n => n + PAGE)}>Show {Math.min(PAGE, rows.length - cap)} more</Btn>}
          </div>
        </Card>
      )}
    </div>
  );
}

// A receipt that prints on its own (see the print rules in index.css), and the refund for that payment.
function Receipt({ p, email, user, onClose, onChange }) {
  const me = useMe();
  const [refund, setRefund] = useState(false), [reason, setReason] = useState(''), [proOff, setProOff] = useState(p.kind === 'pro' && !!user?.subscribed);
  const [busy, run] = useBusy();
  const doRefund = e => {
    e.preventDefault();
    run(async () => {
      const b = writeBatch(db);
      b.update(doc(db, 'payments', p.id), { refunded: true, refundedAt: Date.now(), refundReason: reason.trim(), refundedBy: me.name });
      if (proOff && user) b.update(doc(db, 'users', user.id), { subscribed: false });
      await b.commit();
      notify(`Refund recorded for ${p.userName}`);
      onChange();
    });
  };
  const row = (l, v) => <div className="flex justify-between gap-4 py-2 border-b border-line text-[14px]"><span className="text-muted">{l}</span><span className="text-right font-medium">{v}</span></div>;
  return (
    <Modal onClose={onClose}>
      <div className="receipt flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <Logo size={24} />
          <span className="text-right"><H3 as="h2" className="text-[18px]">Receipt</H3><span className="font-mono text-[13px] text-muted">{receiptNo(p)}</span></span>
        </div>
        <div className="flex flex-col items-center gap-1 py-4 rounded-lg bg-soft">
          <span className="text-[13px] text-muted">{p.refunded ? 'Amount (refunded)' : 'Amount paid'}</span>
          <b className={`text-[32px] leading-none font-mono ${p.refunded ? 'line-through text-muted' : ''}`}>{rupees(p.amount)}</b>
          {p.refunded && <Chip tone="danger" className="mt-1">Refunded</Chip>}
        </div>
        <div className="flex flex-col">
          {row('Date', stamp(p.t))}
          {row('Billed to', <>{p.userName}{email && <span className="block text-[12px] text-muted font-normal">{email}</span>}</>)}
          {row('For', what(p))}
          {p.refunded && row('Refunded on', stamp(p.refundedAt))}
          {p.refunded && p.refundReason && row('Reason', p.refundReason)}
        </div>
        <p className="m-0 text-[12px] text-muted">Thank you. This receipt was made by Techomato Education.</p>
      </div>
      {refund ? (
        <form className="flex flex-col gap-3 pt-4 border-t border-line" onSubmit={doRefund}>
          <Field label="Reason for the refund"><Input required maxLength={200} placeholder="e.g. Paid twice by mistake" value={reason} onChange={e => setReason(e.target.value)} /></Field>
          {p.kind === 'pro' && user?.subscribed && <label className="flex items-center gap-2.5 text-[14px] cursor-pointer"><input type="checkbox" className="w-4.5 h-4.5" checked={proOff} onChange={e => setProOff(e.target.checked)} />Also switch off Pro for {p.userName}</label>}
          <p className="m-0 text-[12px] text-muted">This records the refund here. Send the money back the same way it was paid.</p>
          <div className="flex gap-2.5 justify-end flex-wrap"><Btn type="button" v="ghost" onClick={() => setRefund(false)}>Back</Btn><Btn v="accent" disabled={busy}>Record refund</Btn></div>
        </form>
      ) : (
        <div className="flex gap-2.5 justify-end flex-wrap pt-2">
          {!p.refunded && <Btn v="plain" className="mr-auto text-danger!" onClick={() => setRefund(true)}>Refund…</Btn>}
          <Btn v="ghost" onClick={onClose}>Close</Btn>
          <Btn v="ink" onClick={() => window.print()}><Icon name="doc" size={16} />Print or save PDF</Btn>
        </div>
      )}
    </Modal>
  );
}

// A payment taken outside the app (cash, bank transfer), entered by hand.
function RecordPayment({ users, onClose, onDone }) {
  const me = useMe();
  const students = users.filter(u => u.role === 'student').sort((a, b) => a.name.localeCompare(b.name));
  const [uid, setUid] = useState(''), [amount, setAmount] = useState(''), [note, setNote] = useState(''), [at, setAt] = useState(() => toInput(Date.now())), [pro, setPro] = useState(false);
  const [busy, run] = useBusy();
  const u = students.find(s => s.id === uid);
  const save = e => {
    e.preventDefault();
    run(async () => {
      const when = fromInput(at);
      if (!u) throw new Error('Pick a student');
      if (!(Number(amount) > 0)) throw new Error('Enter an amount above 0');
      if (!Number.isFinite(when) || when > Date.now() + 6e4) throw new Error('The date cannot be in the future');
      const b = writeBatch(db);
      b.set(doc(collection(db, 'payments')), { userId: u.id, userName: u.name, kind: pro ? 'pro' : 'manual', amount: Math.round(Number(amount)), at: when, ...(note.trim() && { note: note.trim() }), recordedBy: me.name });
      if (pro && !u.subscribed) b.update(doc(db, 'users', u.id), { subscribed: true });
      await b.commit();
      notify(`Payment of ${rupees(Math.round(Number(amount)))} recorded for ${u.name}`);
      onDone();
    });
  };
  return (
    <Modal onClose={onClose}>
      <form className="flex flex-col gap-3.5" onSubmit={save}>
        <H3 as="h2" className="text-[22px]">Record a payment</H3>
        <Field label="Student">
          <Input as="select" required value={uid} onChange={e => setUid(e.target.value)}>
            <option value="">Pick a student…</option>{students.map(s => <option key={s.id} value={s.id}>{s.name} · {s.email}</option>)}
          </Input>
        </Field>
        <div className="grid gap-3 grid-cols-2 max-phone:grid-cols-1">
          <Field label="Amount (₹)"><Input type="number" min="1" step="1" required inputMode="numeric" placeholder="499" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
          <Field label="Paid on"><Input type="datetime-local" required value={at} max={toInput(Date.now())} onChange={e => setAt(e.target.value)} /></Field>
        </div>
        <Field label="Note (optional)"><Input maxLength={120} placeholder="e.g. Cash, course fee" value={note} onChange={e => setNote(e.target.value)} /></Field>
        <label className="flex items-center gap-2.5 text-[14px] cursor-pointer"><input type="checkbox" className="w-4.5 h-4.5" checked={pro} onChange={e => setPro(e.target.checked)} />This is a Pro subscription{u && !u.subscribed ? ': also switch on Pro' : ''}</label>
        <div className="flex gap-2.5 justify-end flex-wrap"><Btn type="button" v="ghost" onClick={onClose}>Cancel</Btn><Btn v="accent" disabled={busy}>Record payment</Btn></div>
      </form>
    </Modal>
  );
}
