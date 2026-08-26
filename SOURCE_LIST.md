# Source List

Official AMC/SEBI/AMFI sources used for the MF-Facts ingestion pipeline.

All sources are from HDFC Mutual Fund's official website (hdfcfund.com) or their hosted document server.

---

## HDFC Top 100 Fund

| # | URL | Type | Fact Types |
|---|-----|------|------------|
| 1 | https://files.hdfcfund.com/s3fs-public/Others/2024-05/Fund%20Facts%20-%20HDFC%20Top%20100%20Fund_May%2024.pdf | PDF | expense_ratio, exit_load, fund_manager, benchmark, objective |

**Source:** HDFC Top 100 Fund Factsheet (May 2024)
**Date Accessed:** 2026-08-20

---

## HDFC Flexi Cap Fund

| # | URL | Type | Fact Types |
|---|-----|------|------------|
| 2 | https://www.hdfcfund.com/explore/mutual-funds/hdfc-flexi-cap-fund/regular | HTML | expense_ratio, exit_load, fund_manager, benchmark, objective |

**Source:** HDFC Flexi Cap Fund scheme page (Regular Plan)
**Date Accessed:** 2026-08-20

---

## HDFC ELSS Tax Saver

| # | URL | Type | Fact Types |
|---|-----|------|------------|
| 3 | https://www.hdfcfund.com/explore/mutual-funds/hdfc-elss-tax-saver/regular | HTML | expense_ratio, exit_load, lock_in, fund_manager, benchmark, objective |

**Source:** HDFC ELSS Tax Saver scheme page (Regular Plan)
**Date Accessed:** 2026-08-20

---

## HDFC Mid-Cap Opportunities Fund

| # | URL | Type | Fact Types |
|---|-----|------|------------|
| 4 | https://files.hdfcfund.com/s3fs-public/Others/2025-02/Fund%20Facts%20-%20HDFC%20Mid-Cap%20Opportunities%20Fund_Feb%2025.pdf | PDF | expense_ratio, exit_load, fund_manager, benchmark, objective |

**Source:** HDFC Mid-Cap Opportunities Fund Factsheet (February 2025)
**Date Accessed:** 2026-08-20

---

## Summary

| Scheme | Sources | Document Type |
|--------|---------|---------------|
| HDFC Top 100 Fund | 1 | PDF factsheet |
| HDFC Flexi Cap Fund | 1 | HTML scheme page |
| HDFC ELSS Tax Saver | 1 | HTML scheme page |
| HDFC Mid-Cap Opportunities Fund | 1 | PDF factsheet |

**Total unique source URLs:** 4
**Total source entries (with fact_type splits):** 21
**Total chunks ingested:** 63 (3 chunks per source entry)

---

## Notes

- PDF sources are hosted on HDFC's S3 bucket (files.hdfcfund.com)
- HTML sources are the official scheme pages on hdfcfund.com
- All URLs are publicly accessible — no authentication required
- Source data is accessed once during ingestion; the app does not re-fetch in production
- To update data, modify `data/source_list.csv` and re-run `npm run ingest`
