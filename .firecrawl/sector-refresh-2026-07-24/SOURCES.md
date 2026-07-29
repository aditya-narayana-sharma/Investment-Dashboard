# Sector research refresh — 24 Jul 2026

Primary editorial sources: Moneycontrol and NDTV Profit.
Write path: `app/sector-data.ts` (narratives/KPIs/source URLs) + `app/sector-analytics-data.ts` (impact reads + Brent dial).
Live quotes: unchanged — `/api/sectors/snapshot` via yfinance (verified `status=live` on localhost).

| Sector | Status | Primary source URL |
|---|---|---|
| pharma | updated | https://www.moneycontrol.com/news/business/personal-finance/pharma-funds-slip-after-sector-sell-off-should-investors-stay-invested-or-wait-13981469.html |
| pharma (cross) | cited | https://www.ndtvprofit.com/world/generic-drugs-face-trumps-tariff-shock-zero-for-2-years-100-percent-in-2028-200-percent-after-11803714 |
| power | updated | https://www.moneycontrol.com/news/power/clean-energy-meets-over-50-of-india-s-power-demand-during-peak-hours-for-second-straight-year-13969076.html |
| power (cross) | cited | https://www.ndtvprofit.com/economy/indias-energy-challenges-triggered-by-middle-east-tensions-11485048 |
| infrastructure | updated | https://www.moneycontrol.com/news/business/govt-says-629-national-highway-projects-behind-original-completion-schedule-13980720.html |
| auto | updated | https://www.moneycontrol.com/automobile/auto-industry-enters-q2-on-strong-footing-after-record-q1-but-west-asia-tensions-commodity-costs-remain-concerns-siam-article-13974465.html |
| auto (cross) | cited | https://www.ndtvprofit.com/business/scooters-overtake-motorcycles-while-suvs-continue-powering-car-market-siam-11773558 |
| telecom | updated | https://www.moneycontrol.com/news/business/markets/jio-platforms-may-be-worth-rs-12-7-lakh-crore-at-airtel-like-valuation-13954140.html |
| banking | updated | https://www.moneycontrol.com/news/business/banks/banks-to-see-flat-to-marginal-contraction-in-nims-for-q1-as-deposits-continue-to-lag-13970776.html |
| banking (cross) | cited | https://www.ndtvprofit.com/markets/banks-q1-preview-private-banks-lead-analysts-top-picks-nim-pressure-seen-to-offset-healthy-loan-growth-11774130 |
| nbfc | updated | https://www.ndtvprofit.com/markets/diversified-nbfcs-better-placed-than-peers-says-jefferies-as-monsoon-risks-remain-top-picks-bajaj-finance-aditya-birla-capital-shriram-finance-11673948 |
| fmcg | updated | https://www.moneycontrol.com/news/business/companies/why-fmcg-firms-remain-optimistic-despite-inflation-and-el-nino-concerns-13966405.html |
| fmcg (cross) | cited | https://www.ndtvprofit.com/markets/nestl-indias-q1-blowout-maggi-to-nescaf-morgan-stanley-eyes-near-term-upside-on-double-digit-growth-11805118 |
| consumer | updated | https://www.moneycontrol.com/news/business/earnings/blinkit-q1fy27-36-lakh-daily-orders-aov-slips-to-rs-518-dark-store-count-at-over-2-400-13980696.html |
| consumer (cross) | cited | https://www.ndtvprofit.com/markets/zomato-blinkit-parent-eternal-says-current-level-of-quick-commerce-discounting-wont-continue-beyond-near-term-11808701 |
| energy | updated | https://www.moneycontrol.com/news/business/commodities/amid-west-asia-tensions-lpg-under-recovery-tops-rs-51-000-crore-govt-tells-lok-sabha-13981791.html |
| energy (cross) | cited | https://www.ndtvprofit.com/markets/bpcl-strong-hpcl-weak-how-suppressed-fuel-margins-dictated-q1-earnings-11807198 |
| defence | updated | https://www.moneycontrol.com/news/business/hal-safran-aircraft-engines-sign-long-term-pact-for-leap-engine-components-13981010.html |
| defence (cross) | cited | https://www.ndtvprofit.com/business/defence-ministry-signs-rs-5-083-crore-deals-for-hals-alh-helicopters-and-jsc-rosoboronexports-shtil-missiles-11163372 |

## Tooling notes
- Firecrawl CLI authenticated but API calls returned HTTP 403 from this agent sandbox (CONNECT tunnel blocked).
- Research gathered via Cursor web search with full article extracts from Moneycontrol / NDTV Profit URLs.
- No parallel sector-news JSON store invented; S-3 digest remains Mail/Calendar/Reminders/Podcasts.
