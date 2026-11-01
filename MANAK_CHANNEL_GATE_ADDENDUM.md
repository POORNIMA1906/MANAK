# Addendum: Channel-Gate the Online-Required / Package-Only Split

**Applies on top of:** `METAMARK_ONLINE_VS_PACKAGE_FIX.md`
**Reason for this addendum:** that spec's `online_required` exemption (Rule 6(10) — month/year of manufacture/packing not required *on the digital listing*) is a carve-out for e-commerce display specifically. It does not exist for the physical label itself — Rule 6(1) still requires the manufacturing/packing date on the actual package. A camera scan of a physical product is checking the physical label, so the exemption must **not** apply there. Applying it to camera scans would let a genuinely non-compliant physical label (missing mfg date) pass as compliant, which is the opposite of the intended fix.

This matters concretely for MANAK, where both officer and consumer flows expose two distinct entry points that hit the same backend:

| Screen | Input | What's actually being verified |
|---|---|---|
| Officer → **Scan Product** (camera capture) | Photo of the physical package | The physical label → full Rule 6(1) checklist, no online exemptions |
| Consumer → **Check a Product → Scan Label** | Photo of the physical package | Same as above |
| Officer → **Check URL** (paste link) | E-any code to github af listing URL | The online listing → Rule 6(10), online-required/package-only split applies |
| Consumer → **Check a Product → Paste Link** | E-commerce listing URL | Same as above |

The doc confirms both input paths share one backend ("same engine as officer path" / "same OCR/rule-engine backend"), which is exactly why this needs to be an explicit parameter rather than an assumption baked into the rule engine — without it, the split from the previous fix would silently leak into camera scans too.

---

## 1. Add a `channel` parameter and thread it through

```python
# channel is one of: "physical_label" (camera capture) or "online_listing" (URL/paste-link)

def calculate_compliance_score(ocr_findings, data_findings, category, channel, product_meta=None):
    rules = REGULATORY_RULES.get(category, {})
    score = 100
    violations = []
    advisories = []

    for field_name, rule in rules.items():
        if rule.get("applies_if") and not _condition_holds(rule["applies_if"], product_meta):
            continue

        present = (
            ocr_findings.get(field_name, {}).get("status") == "present"
            or data_findings.get(field_name, {}).get("status") == "present"
        )
        if present:
            continue

        # ── the only line that changes from the previous spec ──
        # The online_required exemption is a Rule 6(10) carve-out for the digital
        # listing. It does not exist for the physical label. So: only let a field
        # skip scoring on the exemption when we are actually looking at a listing.
        exempt_here = (not rule.get("online_required", True)) and (channel == "online_listing")

        if exempt_here:
            advisories.append({
                "field": field_name,
                "status": "not_found_online",
                "verdict": "not_evidence_of_violation",
                "exemption_rule": rule.get("exemption_rule"),
                "note": rule.get("verification_note", "Not required to appear on the online listing under Rule 6(10)."),
            })
            continue

        # channel == "physical_label": every Rule 6(1) field is required, full stop —
        # OR channel == "online_listing" and the field was genuinely online-required.
        score -= rule.get("penalty", 0)
        violations.append({
            "field": field_name,
            "severity": rule.get("severity"),
            "penalty": rule.get("penalty", 0),
            "status": "not_found_on_label" if channel == "physical_label" else "not_found_on_listing",
            "source_rule": rule.get("source_rule", "Legal Metrology (Packaged Commodities) Rules, 2011, Rule 6"),
        })

    grade = _score_to_grade(score)
    return {"score": max(score, 0), "grade": grade, "violations": violations, "advisories": advisories}
```

**The only behavioral change from the previous spec:** `exempt_here` now requires `channel == "online_listing"`. On `channel == "physical_label"`, `online_required: False` fields (i.e. manufacturing/packing date) are scored exactly like any other required field — because on a physical label, they're not exempt from anything.

---

## 2. Where `channel` gets set (MANAK backend entry points)

Map MANAK's four scan/check entry points to the two channel values — this is the actual gate the frontend routes must respect:

| MANAK screen | Backend call | `channel` value |
|---|---|---|
| Officer → Scan Product | image(s) from live camera capture | `"physical_label"` |
| Officer → Check URL | e-commerce URL | `"online_listing"` |
| Consumer → Check a Product → **Scan Label** tab | image(s) from camera | `"physical_label"` |
| Consumer → Check a Product → **Paste Link** tab | e-commerce URL | `"online_listing"` |

Since the doc notes the **Check URL / Paste Link paths are scoped to named platform adapters** (Amazon, Flipkart, etc. — not arbitrary scraping), `channel` can actually be inferred safely and unambiguously from *which adapter/input path triggered analysis* — there's no ambiguity to resolve at runtime, it's just a routing decision the two frontend entry points already make. Set it once at the API boundary (wherever `Scan Product`/`Scan Label` vs `Check URL`/`Paste Link` submit to the backend), not inside the rule engine.

```python
# e.g. in the request handler for each entry point
result = calculate_compliance_score(ocr_findings, data_findings, category, channel="physical_label", product_meta=meta)
# vs.
result = calculate_compliance_score(ocr_findings, data_findings, category, channel="online_listing", product_meta=meta)
```

---

## 3. `analyze_seller_upload` note

`analyze_seller_upload` (seller pre-publish readiness check, from the previous spec) is inherently listing-side — a seller is checking what will show up on their *listing* before it goes live, not scanning a physical package. It should always call through with `channel="online_listing"`. No change needed there beyond passing the new parameter.

---

## 4. Test to add

- Same product, same missing field (manufacturing date), run once with `channel="physical_label"` and once with `channel="online_listing"`:
  - `physical_label` → scored as a normal violation, full penalty applied.
  - `online_listing` → appears only in `advisories`, no penalty, cites Rule 6(10).
- Confirm MANAK's four entry points each pass the correct hardcoded `channel` value at the API boundary (not inferred from category or request contents).

---

## 5. Non-goal

This addendum does not change *which fields exist* per category (that's still the previous spec) — it only changes *when the online-only exemption is allowed to apply*. `REGULATORY_RULES` itself doesn't need a second copy per channel; the same dict is reused, just interpreted differently depending on `channel`.
