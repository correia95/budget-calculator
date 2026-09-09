// 50/30/20 budgeting maths. Pure, dependency-free. All figures monthly, in the
// display currency's major unit.

export type Bucket = 'needs' | 'wants' | 'savings';

export const BUCKETS: Bucket[] = ['needs', 'wants', 'savings'];

export const BUCKET_LABEL: Record<Bucket, string> = {
  needs: 'Needs',
  wants: 'Wants',
  savings: 'Savings & debt',
};

export interface Split {
  needs: number; // percent
  wants: number;
  savings: number;
}

export const DEFAULT_SPLIT: Split = { needs: 50, wants: 30, savings: 20 };

export interface Expense {
  id: string;
  name: string;
  amount: number;
  bucket: Bucket;
}

export const uid = () => Math.random().toString(36).slice(2, 9);

export interface BucketResult {
  bucket: Bucket;
  targetPercent: number;
  target: number; // currency
  actual: number;
  difference: number; // target - actual; positive = room left, negative = over
  actualPercent: number; // of income
}

export interface BudgetResult {
  income: number;
  totalExpenses: number;
  unallocated: number; // income - totalExpenses (what's left over / short)
  buckets: BucketResult[];
  savingsRate: number; // savings bucket actual / income, %
}

export function normaliseSplit(s: Split): Split {
  const n = Math.max(0, s.needs || 0);
  const w = Math.max(0, s.wants || 0);
  const v = Math.max(0, s.savings || 0);
  const sum = n + w + v;
  if (sum === 0) return { ...DEFAULT_SPLIT };
  return { needs: (n / sum) * 100, wants: (w / sum) * 100, savings: (v / sum) * 100 };
}

export function calculate(incomeRaw: number, expenses: Expense[], splitRaw: Split): BudgetResult {
  const income = Math.max(0, incomeRaw || 0);
  const split = normaliseSplit(splitRaw);

  const actualByBucket: Record<Bucket, number> = { needs: 0, wants: 0, savings: 0 };
  for (const e of expenses) {
    actualByBucket[e.bucket] += Math.max(0, e.amount || 0);
  }
  const totalExpenses = actualByBucket.needs + actualByBucket.wants + actualByBucket.savings;

  const buckets: BucketResult[] = BUCKETS.map((bucket) => {
    const targetPercent = split[bucket];
    const target = (income * targetPercent) / 100;
    const actual = actualByBucket[bucket];
    return {
      bucket,
      targetPercent,
      target,
      actual,
      difference: target - actual,
      actualPercent: income > 0 ? (actual / income) * 100 : 0,
    };
  });

  return {
    income,
    totalExpenses,
    unallocated: income - totalExpenses,
    buckets,
    savingsRate: income > 0 ? (actualByBucket.savings / income) * 100 : 0,
  };
}

// A verdict string for the whole budget.
export function verdict(r: BudgetResult): string {
  if (r.income <= 0) return 'Enter your monthly take-home income.';
  if (r.unallocated < -0.005) return `You're spending ${Math.abs(r.unallocated).toFixed(0)} more than you earn each month.`;
  const over = r.buckets.filter((b) => b.difference < -0.005);
  if (over.length === 0 && r.unallocated > 0.005)
    return `Every bucket is within target with ${r.unallocated.toFixed(0)} still unassigned.`;
  if (over.length === 0) return 'Every bucket is within its 50/30/20 target.';
  return `Over target in ${over.map((b) => BUCKET_LABEL[b.bucket].toLowerCase()).join(' and ')}.`;
}

// --- URL state ---------------------------------------
export interface ShareState {
  income: number;
  split: Split;
  expenses: { name: string; amount: number; bucket: Bucket }[];
}

const B_CODE: Record<Bucket, string> = { needs: 'n', wants: 'w', savings: 's' };
const CODE_B: Record<string, Bucket> = { n: 'needs', w: 'wants', s: 'savings' };

export function encodeState(st: ShareState): string {
  const p = new URLSearchParams();
  p.set('i', String(st.income));
  p.set('sp', `${Math.round(st.split.needs)}-${Math.round(st.split.wants)}-${Math.round(st.split.savings)}`);
  p.set(
    'e',
    st.expenses
      .map((e) => `${encodeURIComponent(e.name).replace(/~/g, '%7E')}~${e.amount}~${B_CODE[e.bucket]}`)
      .join('|'),
  );
  return p.toString();
}

export function decodeState(query: string): ShareState | null {
  const p = new URLSearchParams(query);
  if (!p.has('i')) return null;
  const income = Number(p.get('i'));
  if (!Number.isFinite(income)) return null;

  let split = { ...DEFAULT_SPLIT };
  const sp = p.get('sp');
  if (sp) {
    const [n, w, s] = sp.split('-').map(Number);
    if ([n, w, s].every((x) => Number.isFinite(x))) split = { needs: n, wants: w, savings: s };
  }

  const expenses: ShareState['expenses'] = [];
  const e = p.get('e');
  if (e) {
    for (const part of e.split('|')) {
      const [name, amount, b] = part.split('~');
      if (name == null) continue;
      expenses.push({
        name: decodeURIComponent(name) || 'Expense',
        amount: Math.max(0, Number(amount) || 0),
        bucket: CODE_B[b] ?? 'needs',
      });
    }
  }

  return { income, split, expenses };
}
