# Data model (written first, 2026-10-17)

The need, in the words of Twin Cities job postings (Sept–Oct 2026): *"Prepare financial
and management reports for the owner"*, *"Prepare sales reports and metrics for Sales
Manager review"*, *"compile operational information and metrics"*, *"daily operational
reporting"*, *"Translate data into clear, actionable recommendations"*. 25 distinct
employers posted a version of this step. The ideal tool takes the export a business
already has and hands back the report the owner asked for.

## Entities

**Export** — the CSV the customer's system already produces (POS, DMS, job board, timecards).

| field | answers |
|---|---|
| columns | what is in it (name, inferred type: number, date, text) |
| rows | the records |

**Question** — what the owner wants to know, in their words. Default: "What should the owner know from this?"

**Metric** — one computed figure the report needs (planned by Claude, computed by code).

| field | answers |
|---|---|
| label | what it is called in the report |
| op | sum, count, average, min, max, distinct count |
| column | over which column |
| group_by | broken out by which column (optional) |
| filter | which rows (optional: column, equals) |
| values | computed by code from the rows |

**Finding** — one sentence the owner reads, citing only Metric values.

**Report** — headline, findings, tables (one per grouped Metric).

## Reality check, field by field

| field | source | fillable? |
|---|---|---|
| Export.* | the customer's CSV | yes |
| Question | the customer, or the default | yes |
| Metric plan | Claude, from the column names and a sample of rows | yes |
| Metric values | code over every row | yes; the model never sees or sums the full data |
| Findings | Claude, given only the computed values; any sentence whose numbers do not appear in the computed values is dropped by code | yes |

No field needs data we don't hold. Not covered: connecting to their system so the
report runs itself every Monday; that is the custom-build line.
