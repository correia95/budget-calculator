import assert from 'node:assert/strict';
import {
  normaliseSplit,
  calculate,
  verdict,
  DEFAULT_SPLIT,
  encodeState,
  decodeState,
} from './budget.ts';

let pass = 0;
const t = (name, fn) => {
  try {
    fn();
    pass++;
    console.log('ok  -', name);
  } catch (e) {
    console.error('FAIL-', name, '\n   ', e.message);
    process.exitCode = 1;
  }
};
const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

const E = (name, amount, bucket) => ({ id: name, name, amount, bucket });

t('normaliseSplit rescales to 100', () => {
  const s = normaliseSplit({ needs: 60, wants: 30, savings: 30 });
  near(s.needs + s.wants + s.savings, 100);
  near(s.needs, 50);
  assert.deepEqual(normaliseSplit({ needs: 0, wants: 0, savings: 0 }), DEFAULT_SPLIT);
});

t('targets from a 4000 income with 50/30/20', () => {
  const r = calculate(4000, [], DEFAULT_SPLIT);
  const [n, w, s] = r.buckets;
  near(n.target, 2000);
  near(w.target, 1200);
  near(s.target, 800);
});

t('actuals bucket the expenses', () => {
  const r = calculate(4000, [
    E('Rent', 1500, 'needs'),
    E('Groceries', 400, 'needs'),
    E('Dining', 300, 'wants'),
    E('Streaming', 50, 'wants'),
    E('401k', 500, 'savings'),
  ], DEFAULT_SPLIT);
  const b = Object.fromEntries(r.buckets.map((x) => [x.bucket, x]));
  near(b.needs.actual, 1900);
  near(b.wants.actual, 350);
  near(b.savings.actual, 500);
  near(r.totalExpenses, 2750);
  near(r.unallocated, 1250);
  near(b.needs.difference, 100); // 2000 target - 1900
  near(b.wants.difference, 850);
  near(r.savingsRate, 12.5);
});

t('difference goes negative when over target', () => {
  const r = calculate(3000, [E('Rent', 1800, 'needs')], DEFAULT_SPLIT);
  const needs = r.buckets.find((b) => b.bucket === 'needs');
  near(needs.target, 1500);
  near(needs.difference, -300);
  near(needs.actualPercent, 60);
});

t('verdict messages', () => {
  assert.match(verdict(calculate(0, [], DEFAULT_SPLIT)), /income/);
  assert.match(
    verdict(calculate(2000, [E('Rent', 2500, 'needs')], DEFAULT_SPLIT)),
    /more than you earn/,
  );
  assert.match(
    verdict(calculate(4000, [E('Rent', 3000, 'needs')], DEFAULT_SPLIT)),
    /Over target in needs/,
  );
  assert.match(
    verdict(calculate(4000, [E('Rent', 1000, 'needs'), E('Fun', 500, 'wants'), E('Save', 800, 'savings')], DEFAULT_SPLIT)),
    /unassigned/,
  );
});

t('zero income -> zero targets, no divide error', () => {
  const r = calculate(0, [E('Rent', 100, 'needs')], DEFAULT_SPLIT);
  assert.equal(r.buckets[0].target, 0);
  assert.equal(r.buckets[0].actualPercent, 0);
  assert.equal(r.savingsRate, 0);
});

t('encode / decode state', () => {
  const st = {
    income: 5000,
    split: { needs: 50, wants: 30, savings: 20 },
    expenses: [
      { name: 'Rent', amount: 1800, bucket: 'needs' },
      { name: 'Fun ~ stuff', amount: 300, bucket: 'wants' },
    ],
  };
  const enc = encodeState(st);
  const back = decodeState(enc);
  assert.equal(back.income, 5000);
  assert.deepEqual(back.split, { needs: 50, wants: 30, savings: 20 });
  assert.equal(back.expenses.length, 2);
  assert.equal(back.expenses[1].name, 'Fun ~ stuff');
  assert.equal(back.expenses[1].bucket, 'wants');
  assert.equal(decodeState(''), null);
});

console.log(`\n${pass} passed`);
