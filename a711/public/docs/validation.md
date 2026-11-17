# Leverix validation record

**Checked:** 27 September 2026 (UTC); public links rechecked 17 November 2026 (Asia/Shanghai)  
**Scope:** Robinhood Chain testnet prototype and rebranded public materials.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run check:format` | Passed after formatting the updated Vue and CSS files. |
| `npm run build` | Passed; Vite generated the static website in `website/dist/`. |
| `npm --prefix contracts test` | Passed; 13 local EVM tests. |
| `python scripts/render-docs.py` | Passed; rendered the business plan HTML and synchronized website document copies. |
| `python brand/generate_assets.py` | Passed; regenerated the Leverix artwork and social assets. |

The contract test runner emitted a Ganache µWS compatibility warning and used its JavaScript fallback. It did not affect test results.

## Browser review

The local website was reviewed at desktop (1440 px) and mobile (390 px) widths. The home market workspace rendered at both sizes, the market search and region filters were exercised, and `/trade?market=NIKKEI` retained the expected market selection and testnet disclosures. The wallet dialog behavior was reviewed for Escape dismissal and focus restoration. No real wallet transaction was signed as part of this UI review.

The 17 November 2026 link pass additionally verified that the masthead and footer render an X link to `https://x.com/LeverixRh` at both widths, that the link's accessible name resolves to “Leverix on X (@LeverixRh)”, and that the built `index.html` carries `twitter:site`, `twitter:creator`, a canonical `https://leverix.top/` URL and the same social image. The pass also checked 390, 560, 768, 1024 and 1440 px widths for horizontal overflow; the document width matched the viewport at every size. The repeatable script is `output/playwright/link-check.py` and its result is `output/playwright/link-check.json`. Screenshots from this pass are stored under `output/playwright/`.

## Deployment and product boundaries

- The displayed network is Robinhood Chain Testnet, chain ID `46630`.
- Quotes shown in the website and launch artwork are synthetic demonstration data, not live market prices.
- Testnet dUSD has no monetary value. The deployed token's immutable on-chain name remains `LATQOR Demo USD`; the rebrand does not rename that deployment.
- Contract addresses, transaction receipts and source-verification evidence remain tied to their original deployments.
- The X posts are prepared copy and images only. This workflow did not register a domain, change X account credentials, or publish a post.
- The website's public links point to the final identifiers: `leverix.top` for the site and [@LeverixRh](https://x.com/LeverixRh) for X.
- The public materials do not claim Robinhood affiliation, an audit, production readiness, customer traction, or real-money trading.

## Availability evidence

The final public identifiers are `leverix.top` and `@LeverixRh`. Public DNS and profile observations from 17 November 2026 are recorded in [name-availability.md](name-availability.md); the earlier `leverix.xyz` / `@leverix` checks are retained there as superseded history. Availability is time-sensitive and is not a registration, hosting or trademark clearance.
