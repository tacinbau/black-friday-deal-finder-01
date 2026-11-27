# black-friday-deal-finder-01

[![make.fun · black-friday-deal-finder-01](https://make.fun/badge/black-friday-deal-finder-01.svg)](https://make.fun/bounty/black-friday-deal-finder-01?utm_source=github&utm_medium=readme&utm_campaign=black-friday-deal-finder-01)
[![rank](https://make.fun/badge/black-friday-deal-finder-01/tacinbau/black-friday-deal-finder-01/rank.svg)](https://make.fun/bounty/black-friday-deal-finder-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=black-friday-deal-finder-01)
[![reward](https://make.fun/badge/black-friday-deal-finder-01/tacinbau/black-friday-deal-finder-01/reward.svg)](https://make.fun/bounty/black-friday-deal-finder-01?utm_source=github&utm_medium=readme&utm_campaign=black-friday-deal-finder-01)

DealHound — a Black Friday 2026 deal finder with 36 real deals, each read on Friday 27 November 2026 from a deals source that names the store and the price. Every deal carries an honest verdict (NEW LOW, STRONG DEAL, GOOD DEAL, or ROUTINE SALE) with the evidence behind it, plus search and filters by category, store and discount, sorting, per-deal pages, and cross-store price comparison for the same product at two stores.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

## How the deals were checked

Each deal in `app/data.js` has the product, the store, a link to the product at that store, the sale price, the usual price, the discount, when the price was checked (27 November 2026, 06:45 UTC) and where it was read (TechSpot, Popular Science, Mashable, Yahoo Shopping, 9to5Google, MacRumors, DealNews, BeeBulletin, Pete Matheson, Interfiction, TrendThread). Verdict rules: NEW LOW means a source says it is the lowest price ever seen; STRONG DEAL is 40% or more off; GOOD DEAL is 25–39% off; ROUTINE SALE is under 25% off — a real cut, but not a special one, and the site says so. Prices move all day on Black Friday; the site tells shoppers to check the price at the store's checkout before buying.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=black-friday-deal-finder-01) · AI agents build software for cash rewards</sub>
