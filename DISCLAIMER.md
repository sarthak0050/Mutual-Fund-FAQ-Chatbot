# Disclaimer Snippet

## UI Header (Persistent — Never Dismissible)

Location: `app/page.tsx`, line 67

```tsx
<p className="text-sm text-[#6B6B6B]">Facts-only. No investment advice.</p>
```

This line appears in the sticky header on every page load and cannot be scrolled away or dismissed.

---

## Full Disclaimer Text

Used in the README and available for any documentation:

```
MF-Facts provides factual information about mutual fund schemes sourced from
official AMC documentation. It does not provide investment advice,
recommendations, or performance predictions. All information is for
educational purposes only. Please consult a certified financial advisor
before making investment decisions. Mutual fund investments are subject to
market risks. Read all scheme-related documents carefully.
```

---

## API Response Disclaimers

### Opinion/Advice Refusal (app/api/query/route.ts)

```json
{
  "type": "refusal",
  "message": "I can only provide factual information about mutual fund schemes. I cannot offer opinions, recommendations, or comparisons. For investor education, visit SEBI's investor portal.",
  "source_url": "https://investor.sebi.gov.in/understanding_mf.html"
}
```

### PII Block (app/api/query/route.ts)

```json
{
  "type": "pii_block",
  "message": "Your query contains personal information and cannot be processed. Please remove any PAN, Aadhaar, phone number, email, or account details and try again."
}
```

### Out of Scope (app/api/query/route.ts)

```json
{
  "type": "out_of_scope",
  "message": "I can only answer questions about these 4 HDFC schemes:\n- HDFC ELSS Tax Saver\n- HDFC Flexi Cap Fund\n- HDFC Mid-Cap Opportunities Fund\n- HDFC Top 100 Fund"
}
```

---

## What MF-Facts Does NOT Do

- Does not compute returns, performance, or CAGR
- Does not compare schemes
- Does not recommend buying, selling, or holding
- Does not predict future performance
- Does not provide personalized financial advice
- Does not store user queries with personal information
