# Budget Calculator

The 50/30/20 rule with your real expenses — in the browser.

- Monthly take-home income → **needs / wants / savings** targets
- Adjustable target split (defaults 50 / 30 / 20; auto-rescaled to 100%)
- An **expense list** — name, amount, bucket — compared to each target with a
  bar and an over / to-spare figure
- **Left to allocate** / overspending, total expenses, **savings rate**
- A plain-language verdict
- 10 currencies, shareable link (`?i=&sp=&e=…`), `localStorage`
- Nothing is uploaded

A planning tool, not financial advice.

## Develop

```
npm install
npm run dev
npm run build      # tsc --noEmit && vite build
node --experimental-strip-types src/budget.test.mjs
```

The maths is in `src/budget.ts` (pure). 7 Node tests in `src/budget.test.mjs`.

## Deploy

Static assets on Cloudflare Workers (`wrangler.jsonc`). Live at
<https://budget-calculator.correia95.workers.dev/>.
