# Sample Q&A

Representative queries and responses from MF-Facts. All answers are sourced from official HDFC Mutual Fund documentation.

---

## Q1: Factual — Expense Ratio

**Query:** "What is the expense ratio of HDFC Flexi Cap Fund?"

**Answer:**
```json
{
  "type": "answer",
  "answer": "The Total Expense Ratio (TER) for HDFC Flexi Cap Fund is 1.37%. The TER represents the costs for running and managing the scheme, calculated as a percentage of the scheme's average Net Asset Value (NAV).",
  "source_url": "https://www.hdfcfund.com/explore/mutual-funds/hdfc-flexi-cap-fund/regular",
  "fact_type": "expense_ratio",
  "scheme_id": "flexicap"
}
```
**Source:** HDFC Mutual Fund official website

---

## Q2: Factual — Lock-in Period

**Query:** "ELSS lock-in period?"

**Answer:**
```json
{
  "type": "answer",
  "answer": "The ELSS lock-in period is 3 years. During this fixed duration, investors cannot sell or redeem their scheme units.",
  "source_url": "https://www.hdfcfund.com/explore/mutual-funds/hdfc-elss-tax-saver/regular",
  "fact_type": "lock_in",
  "scheme_id": "elsstaxsaver"
}
```
**Source:** HDFC ELSS Tax Saver scheme page

---

## Q3: Opinion/Advice — Should Refuse

**Query:** "Should I buy HDFC ELSS Tax Saver?"

**Answer:**
```json
{
  "type": "refusal",
  "message": "I can only provide factual information about mutual fund schemes. I cannot offer opinions, recommendations, or comparisons. For investor education, visit SEBI's investor portal.",
  "source_url": "https://investor.sebi.gov.in/understanding_mf.html"
}
```
**Behavior:** Polite refusal with educational link to SEBI investor portal.

---

## Q4: Out of Scope — Wrong Scheme

**Query:** "What is the expense ratio of SBI Bluechip Fund?"

**Answer:**
```json
{
  "type": "out_of_scope",
  "message": "I can only answer questions about these 4 HDFC schemes:\n- HDFC ELSS Tax Saver\n- HDFC Flexi Cap Fund\n- HDFC Mid-Cap Opportunities Fund\n- HDFC Top 100 Fund"
}
```
**Behavior:** Lists the 4 in-scope schemes, does not attempt to answer.

---

## Q5: PII Detected — Should Block

**Query:** "My PAN is ABCDE1234F, what is my portfolio return?"

**Answer:**
```json
{
  "type": "pii_block",
  "message": "Your query contains personal information and cannot be processed. Please remove any PAN, Aadhaar, phone number, email, or account details and try again."
}
```
**Behavior:** Blocks immediately. No raw query text stored in logs or database.

---

## Q6: Factual — Fund Manager

**Query:** "Who manages HDFC Mid-Cap Opportunities Fund?"

**Expected Answer:**
```json
{
  "type": "answer",
  "answer": "HDFC Mid-Cap Opportunities Fund is managed by Mr. Chirag Setalvad (since June 25, 2007).",
  "source_url": "https://files.hdfcfund.com/s3fs-public/Others/2025-02/Fund%20Facts%20-%20HDFC%20Mid-Cap%20Opportunities%20Fund_Feb%2025.pdf",
  "fact_type": "fund_manager",
  "scheme_id": "midcap"
}
```
**Source:** HDFC Mid-Cap Opportunities Fund Factsheet (February 2025)

---

## Q7: Factual — Exit Load

**Query:** "What is the exit load for HDFC Top 100 Fund?"

**Expected Answer:**
```json
{
  "type": "answer",
  "answer": "An Exit Load of 1.00% is payable if units are redeemed or switched out within 1 year from the date of allotment. No Exit Load is payable if units are redeemed after 1 year.",
  "source_url": "https://files.hdfcfund.com/s3fs-public/Others/2024-05/Fund%20Facts%20-%20HDFC%20Top%20100%20Fund_May%2024.pdf",
  "fact_type": "exit_load",
  "scheme_id": "top100"
}
```
**Source:** HDFC Top 100 Fund Factsheet (May 2024)

---

## Q8: Factual — Benchmark

**Query:** "What benchmark does HDFC ELSS Tax Saver track?"

**Expected Answer:**
```json
{
  "type": "answer",
  "answer": "HDFC ELSS Tax Saver is benchmarked against the NIFTY 500 Total Returns Index.",
  "source_url": "https://www.hdfcfund.com/explore/mutual-funds/hdfc-elss-tax-saver/regular",
  "fact_type": "benchmark",
  "scheme_id": "elsstaxsaver"
}
```
**Source:** HDFC ELSS Tax Saver scheme page

---

## Q9: Comparison — Should Refuse

**Query:** "Compare returns of HDFC Flexi Cap vs Top 100"

**Expected Answer:**
```json
{
  "type": "refusal",
  "message": "I can only provide factual information about mutual fund schemes. I cannot offer opinions, recommendations, or comparisons. For investor education, visit SEBI's investor portal.",
  "source_url": "https://investor.sebi.gov.in/understanding_mf.html"
}
```
**Behavior:** Comparisons are treated as opinion/advice and refused.

---

## Q10: Factual — Investment Objective

**Query:** "What is the investment objective of HDFC Top 100 Fund?"

**Expected Answer:**
```json
{
  "type": "answer",
  "answer": "To provide long-term capital appreciation/income by investing predominantly in Large-Cap companies. There is no assurance that the investment objective of the Scheme will be realized.",
  "source_url": "https://files.hdfcfund.com/s3fs-public/Others/2024-05/Fund%20Facts%20-%20HDFC%20Top%20100%20Fund_May%2024.pdf",
  "fact_type": "objective",
  "scheme_id": "top100"
}
```
**Source:** HDFC Top 100 Fund Factsheet (May 2024)

---

## Query Log Verification

The `query_logs` table stores only metadata — never raw query text:

| log_id | intent_type | fact_type | scheme_id | resolved |
|--------|-------------|-----------|-----------|----------|
| 1 | factual | expense_ratio | flexicap | true |
| 2 | factual | lock_in | elsstaxsaver | true |

No PII, no raw queries, no opinion queries (blocked before logging).
