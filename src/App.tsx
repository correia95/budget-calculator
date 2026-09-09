import { useEffect, useMemo, useState } from 'react';
import {
  type Bucket,
  BUCKET_LABEL,
  BUCKETS,
  calculate,
  DEFAULT_SPLIT,
  decodeState,
  encodeState,
  type Expense,
  normaliseSplit,
  type Split,
  uid,
  verdict,
} from './budget.ts';
import { CURRENCIES, guessCurrency, money } from './intl.ts';

const LS_KEY = 'budget-calculator:v1';

function demo(): Expense[] {
  return [
    { id: uid(), name: 'Rent / mortgage', amount: 1600, bucket: 'needs' },
    { id: uid(), name: 'Groceries', amount: 450, bucket: 'needs' },
    { id: uid(), name: 'Utilities & phone', amount: 220, bucket: 'needs' },
    { id: uid(), name: 'Transport', amount: 180, bucket: 'needs' },
    { id: uid(), name: 'Eating out & fun', amount: 400, bucket: 'wants' },
    { id: uid(), name: 'Subscriptions', amount: 60, bucket: 'wants' },
    { id: uid(), name: 'Retirement / investing', amount: 500, bucket: 'savings' },
    { id: uid(), name: 'Emergency fund', amount: 200, bucket: 'savings' },
  ];
}

interface Persisted {
  currency: string;
  income: string;
  split: Split;
  expenses: Expense[];
}

function load(): Persisted {
  const base: Persisted = { currency: guessCurrency(), income: '4000', split: { ...DEFAULT_SPLIT }, expenses: demo() };
  const url = decodeState(location.search);
  if (url) {
    return {
      currency: guessCurrency(),
      income: String(url.income),
      split: url.split,
      expenses: url.expenses.map((e) => ({ ...e, id: uid() })),
    };
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p.expenses) return { ...base, ...p };
    }
  } catch {
    /* ignore */
  }
  return base;
}

export default function App() {
  const init = useMemo(load, []);
  const [currency, setCurrency] = useState(init.currency);
  const [income, setIncome] = useState(init.income);
  const [split, setSplit] = useState<Split>(init.split);
  const [expenses, setExpenses] = useState<Expense[]>(init.expenses);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ currency, income, split, expenses }));
    } catch {
      /* ignore */
    }
  }, [currency, income, split, expenses]);

  const incomeNum = Math.max(0, Number(income) || 0);
  const res = useMemo(() => calculate(incomeNum, expenses, split), [incomeNum, expenses, split]);
  const norm = normaliseSplit(split);
  const splitSum = split.needs + split.wants + split.savings;

  const m = (n: number) => money(n, currency);

  const setSplitField = (k: keyof Split, v: string) =>
    setSplit((s) => ({ ...s, [k]: Math.max(0, Number(v) || 0) }));
  const patch = (id: string, p: Partial<Expense>) =>
    setExpenses((es) => es.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const add = () => setExpenses((es) => [...es, { id: uid(), name: '', amount: 0, bucket: 'needs' }]);
  const del = (id: string) => setExpenses((es) => es.filter((e) => e.id !== id));

  const share = () => {
    const qs = encodeState({
      income: incomeNum,
      split: norm,
      expenses: expenses.map((e) => ({ name: e.name, amount: e.amount, bucket: e.bucket })),
    });
    history.replaceState(null, '', `?${qs}`);
    navigator.clipboard?.writeText(`${location.origin}${location.pathname}?${qs}`).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
      () => {},
    );
  };

  return (
    <div className="app">
      <header>
        <h1>Budget Calculator</h1>
        <p className="tag">
          Split your take-home pay into <b>needs</b>, <b>wants</b> and <b>savings</b> with the
          50/30/20 rule, then check your real expenses against each target.
        </p>
      </header>

      <div className="topbar">
        <label>
          Currency
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </label>
        <label>
          Monthly take-home income
          <input inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} aria-label="monthly income" />
        </label>
      </div>

      <div className="split">
        <span>Target split</span>
        {(['needs', 'wants', 'savings'] as (keyof Split)[]).map((k) => (
          <label key={k}>
            {BUCKET_LABEL[k]}
            <span className="pct"><input inputMode="numeric" value={String(split[k])} onChange={(e) => setSplitField(k, e.target.value)} />%</span>
          </label>
        ))}
        <button className="reset" onClick={() => setSplit({ ...DEFAULT_SPLIT })}>50/30/20</button>
      </div>
      {Math.abs(splitSum - 100) > 0.5 && (
        <p className="split-warn">Adds to {splitSum}% — rescaled to {norm.needs.toFixed(0)}/{norm.wants.toFixed(0)}/{norm.savings.toFixed(0)}.</p>
      )}

      <div className="verdict">{verdict(res)}</div>

      <div className="buckets">
        {res.buckets.map((b) => {
          const over = b.difference < -0.005;
          const pct = b.target > 0 ? Math.min(150, (b.actual / b.target) * 100) : 0;
          return (
            <div key={b.bucket} className={`bucket ${over ? 'over' : 'ok'}`}>
              <div className="b-head">
                <span className="b-name">{BUCKET_LABEL[b.bucket]}</span>
                <span className="b-target">target {m(b.target)} · {b.targetPercent.toFixed(0)}%</span>
              </div>
              <div className="b-actual">{m(b.actual)} <small>{b.actualPercent.toFixed(0)}% of income</small></div>
              <div className="b-bar"><div className="b-fill" style={{ width: `${Math.min(100, pct)}%` }} /><div className="b-line" /></div>
              <div className="b-diff">
                {over ? `${m(-b.difference)} over target` : b.difference > 0.005 ? `${m(b.difference)} to spare` : 'on target'}
              </div>
            </div>
          );
        })}
      </div>

      <div className="summary">
        <div><span>Total expenses</span><b>{m(res.totalExpenses)}</b></div>
        <div>
          <span>{res.unallocated >= 0 ? 'Left to allocate' : 'Overspending by'}</span>
          <b className={res.unallocated < 0 ? 'neg' : ''}>{m(Math.abs(res.unallocated))}</b>
        </div>
        <div><span>Savings rate</span><b>{res.savingsRate.toFixed(1)}%</b></div>
      </div>

      <h2 className="sec">Expenses</h2>
      <div className="expenses">
        {expenses.map((e) => (
          <div className="exp-row" key={e.id}>
            <input value={e.name} onChange={(ev) => patch(e.id, { name: ev.target.value })} placeholder="Name" aria-label="expense name" />
            <input inputMode="decimal" value={String(e.amount)} onChange={(ev) => patch(e.id, { amount: Number(ev.target.value) || 0 })} aria-label="amount" />
            <select value={e.bucket} onChange={(ev) => patch(e.id, { bucket: ev.target.value as Bucket })} aria-label="bucket">
              {BUCKETS.map((b) => (<option key={b} value={b}>{BUCKET_LABEL[b]}</option>))}
            </select>
            <button className="del" onClick={() => del(e.id)} aria-label="remove">×</button>
          </div>
        ))}
        <button className="add" onClick={add}>+ Add expense</button>
      </div>

      <button className="ghost" onClick={share}>{copied ? 'Link copied' : 'Share this budget'}</button>

      <section className="explainer">
        <h2>The 50/30/20 rule</h2>
        <p>
          A simple starting framework popularised by US senator Elizabeth Warren: of your
          after-tax income, aim for <b>50% on needs</b> (housing, food, utilities, transport,
          minimum debt payments, insurance), <b>30% on wants</b> (eating out, hobbies, upgrades,
          subscriptions) and <b>20% on savings and extra debt repayment</b>.
        </p>
        <h3>Adjust the split to fit</h3>
        <p>
          The numbers are a guide, not a law. In a high-cost city, needs often run to 55–60%; if
          you're chasing a goal, push savings above 20%. Change the percentages above and the
          targets update.
        </p>
        <h3>Needs vs wants</h3>
        <p>
          If you'd struggle to live or work without it, it's a need — but only the basic version.
          The premium phone plan, the nicer flat, the car upgrade: the difference over the basic
          option is a want. Debt <em>minimums</em> are a need; anything extra you pay down counts
          as savings.
        </p>
        <p className="note">
          A planning tool, not financial advice. It doesn't model tax, irregular income or annual
          bills — spread those into a monthly figure.
        </p>
        <footer>Budget Calculator · works offline · nothing is uploaded</footer>
      </section>
    </div>
  );
}
