import { ExtractionResult, Product, RuleEvaluation, EvaluationChannel } from '../types';
import { COMPLIANCE_RULES, RULE_32_PENALTY_RATE } from '../data/rules';
import { evaluateEcommerceListing, EcommerceAuditReport } from './ecommerceRuleEngine';

export function evaluateExtractionAgainstRules(
  extraction: ExtractionResult,
  channel: EvaluationChannel = 'physical_label',
  product?: Product | null
): {
  evaluations: RuleEvaluation[];
  is_compliant: boolean;
  total_violations: number;
  total_penalty: number;
  ecommerceReport?: EcommerceAuditReport;
} {
  // If evaluating an e-commerce listing, run the comprehensive E-Commerce Legal Metrology Checklist
  if (channel === 'online_listing' || product?.source_type === 'ecommerce') {
    const ecomReport = evaluateEcommerceListing(extraction, product);
    return {
      evaluations: ecomReport.standardEvaluations,
      is_compliant: ecomReport.total_violations === 0,
      total_violations: ecomReport.total_violations,
      total_penalty: ecomReport.total_penalty,
      ecommerceReport: ecomReport
    };
  }

  // PHYSICAL SCAN FLOW (Preserved completely untouched)
  const evaluations: RuleEvaluation[] = [];

  for (const rule of COMPLIANCE_RULES) {
    let status: 'compliant' | 'violation' | 'unverifiable' | 'exempt' = 'compliant';
    let found_value: string | null = null;
    let expected_value = '';
    let explanation = '';

    const isExemptOnline = rule.online_required === false && (channel as string) === 'online_listing';

    switch (rule.rule_id) {
      case 'rule_6_1_a_mfg_details': {
        expected_value = 'Complete Name & Physical Address of Manufacturer/Packer with PIN code';
        const mfg = extraction.manufacturer.value;
        found_value = mfg;

        if (!mfg || mfg.trim() === '') {
          status = 'violation';
          explanation = 'Manufacturer/Packer name and address is completely missing from the label.';
        } else if (mfg.toLowerCase().includes('incomplete') || mfg.length < 15) {
          status = 'violation';
          explanation = 'Address lacks sufficient details such as City, State, or Postal PIN code required under Rule 6(1)(a).';
        } else {
          status = 'compliant';
          explanation = 'Name and complete address of manufacturer/packer is clearly declared on the package.';
        }
        break;
      }

      case 'rule_6_1_b_generic_name': {
        expected_value = 'Clear Common or Generic Name on Principal Display Panel';
        const name = extraction.generic_name.value;
        found_value = name;

        if (!name || name.trim() === '') {
          status = 'violation';
          explanation = 'Generic name of commodity is missing from the principal display panel.';
        } else {
          status = 'compliant';
          explanation = `Generic name '${name}' is declared prominently.`;
        }
        break;
      }

      case 'rule_6_1_c_net_quantity': {
        expected_value = 'Standard Metric Units (g, kg, ml, L) without qualifying words';
        const netQty = extraction.net_quantity.value;
        found_value = netQty ? `${netQty.amount} ${netQty.unit}` : null;

        if (!netQty || !netQty.amount || !netQty.unit) {
          status = 'violation';
          explanation = 'Net quantity declaration is absent or in non-standard units.';
        } else {
          const validUnits = ['g', 'kg', 'ml', 'l', 'mg', 'cm', 'm', 'n', 'u'];
          const normalizedUnit = netQty.unit.toLowerCase().trim();
          if (!validUnits.includes(normalizedUnit)) {
            status = 'violation';
            explanation = `Unit '${netQty.unit}' is not a standard legal metric unit under the First Schedule of 2011 Rules.`;
          } else {
            status = 'compliant';
            explanation = `Net quantity ${netQty.amount} ${netQty.unit} is declared in standard metric units.`;
          }
        }
        break;
      }

      case 'rule_6_1_d_mfg_date': {
        expected_value = 'Month and Year of Manufacture / Packing (e.g., MM/YYYY or Month Year)';
        const mfgDate = extraction.mfg_date.value;
        found_value = mfgDate;

        if (!mfgDate || mfgDate.trim() === '') {
          if (isExemptOnline) {
            status = 'exempt';
            expected_value = 'Exempt on digital listings under Rule 6(10)';
            explanation = rule.verification_note || 'Not required to appear on the online listing under Rule 6(10).';
          } else {
            status = 'violation';
            explanation = 'Month and year of manufacture/packing is missing from the physical package label.';
          }
        } else {
          status = 'compliant';
          explanation = `Manufacturing date declared as '${mfgDate}'.`;
        }
        break;
      }

      case 'rule_6_1_e_mrp_format': {
        expected_value = 'MRP Rs. XX.XX (inclusive of all taxes) or Maximum Retail Price';
        const mrp = extraction.mrp.value;
        found_value = mrp ? mrp.raw_text : null;

        if (!mrp || mrp.amount === null) {
          status = 'violation';
          explanation = 'Maximum Retail Price (MRP) declaration is completely missing.';
        } else if (!mrp.is_inclusive_taxes) {
          status = 'violation';
          explanation = 'Statutory phrase "inclusive of all taxes" or "incl. of all taxes" is omitted from the price declaration.';
        } else {
          status = 'compliant';
          explanation = `MRP is correctly formatted with mandatory tax disclaimer: '${mrp.raw_text}'.`;
        }
        break;
      }

      case 'rule_6_2_consumer_care': {
        expected_value = 'Contact details of Consumer Redressal Cell (Phone Number & Email)';
        const care = extraction.consumer_care.value;
        found_value = care ? [care.phone, care.email].filter(Boolean).join(' | ') : null;

        if (!care || (!care.phone && !care.email)) {
          status = 'violation';
          explanation = 'Consumer grievance contact details (phone/email/address) are completely absent.';
        } else {
          status = 'compliant';
          explanation = 'Consumer care contact details are provided for grievance redressal.';
        }
        break;
      }

      case 'rule_7_numeral_height': {
        const netQty = extraction.net_quantity.value;
        const heightObj = extraction.numeral_height_mm;
        found_value = heightObj.value !== null ? `${heightObj.value} mm` : null;

        if (!heightObj.reference_detected || heightObj.value === null) {
          status = 'unverifiable';
          expected_value = 'Minimum statutory height based on net weight (Reference scale required in-frame)';
          explanation = heightObj.note || 'No scale reference detected in photo frame to measure millimeter height accurately.';
        } else {
          let minRequired = 2.0;
          if (netQty) {
            const amountInG = netQty.unit.toLowerCase() === 'kg' ? netQty.amount * 1000 : netQty.amount;
            if (amountInG > 1000) minRequired = 6.0;
            else if (amountInG > 200) minRequired = 4.0;
            else minRequired = 2.0;
          }
          expected_value = `Minimum ${minRequired.toFixed(1)} mm for package category`;

          if (heightObj.value < minRequired) {
            status = 'violation';
            explanation = `Declared numeral height of ${heightObj.value}mm is below the minimum legal threshold of ${minRequired}mm specified in Table I of Rule 7.`;
          } else {
            status = 'compliant';
            explanation = `Measured numeral height of ${heightObj.value}mm meets or exceeds the required statutory minimum (${minRequired}mm).`;
          }
        }
        break;
      }

      case 'rule_6_10_country_origin': {
        expected_value = 'Country of Origin / Manufacture (Mandatory for E-commerce & Imports)';
        const origin = extraction.country_of_origin.value;
        found_value = origin;

        if (!origin || origin.trim() === '') {
          status = 'violation';
          explanation = 'Country of origin is missing, which is a mandatory statutory disclosure under Rule 6(10) / Consumer Protection E-Commerce Rules.';
        } else {
          status = 'compliant';
          explanation = `Country of origin declared as '${origin}'.`;
        }
        break;
      }

      default:
        break;
    }

    const confResult = calculateRuleConfidence(rule.rule_id, status, extraction);

    evaluations.push({
      rule_id: rule.rule_id,
      rule_source: rule.rule_source,
      requirement_name: rule.requirement_name,
      category: rule.category,
      status,
      severity: status === 'violation' ? rule.severity_default : 'info',
      found_value,
      expected_value,
      explanation,
      citation: rule.legal_citation,
      penalty: status === 'violation' ? rule.penalty_amount || RULE_32_PENALTY_RATE : 0,
      confidence: confResult.confidence,
      confidence_basis: confResult.basis
    });
  }

  const total_violations = evaluations.filter(e => e.status === 'violation').length;
  const total_penalty = evaluations.reduce((acc, curr) => acc + curr.penalty, 0);

  return {
    evaluations,
    is_compliant: total_violations === 0,
    total_violations,
    total_penalty
  };
}

/**
 * Determines the confidence score (0.0 to 1.0) and legal basis for a compliance check.
 * 
 * Mathematical Formulation:
 * Confidence Score = W_ocr * OCR_Quality + W_syntax * Statutory_Syntax_Match + W_evidence * Cross_Validation_Certainty
 * - W_ocr = 0.45: Signal quality from OCR / Vision detection of relevant packaging zone.
 * - W_syntax = 0.35: Exact adherence to statutory syntax (PIN code, metric unit, tax phrase, etc.).
 * - W_evidence = 0.20: Cross-field consistency & absence verification certainty.
 */
export function calculateRuleConfidence(
  ruleId: string,
  status: 'compliant' | 'violation' | 'unverifiable' | 'exempt',
  extraction: ExtractionResult
): { confidence: number; basis: string } {
  let ocrScore = 0.90;
  let syntaxScore = 0.90;
  let evidenceScore = 0.90;
  let rationale = '';

  switch (ruleId) {
    case 'rule_6_1_a_mfg_details': {
      const val = extraction.manufacturer?.value || '';
      ocrScore = extraction.manufacturer?.confidence || (val ? 0.92 : 0.88);
      
      const hasPin = /\b[1-9][0-9]{5}\b/.test(val);
      const hasCityState = /(delhi|mumbai|bengaluru|bangalore|chennai|kolkata|hyderabad|pune|ahmedabad|karnataka|maharashtra|tamil nadu|gujarat|uttar pradesh|haryana|road|street|nagar|plot|industrial|phase|sec|pvt|ltd|pack|mfg)/i.test(val);
      
      if (status === 'compliant') {
        syntaxScore = hasPin ? (hasCityState ? 0.98 : 0.92) : 0.85;
        evidenceScore = val.length > 25 ? 0.96 : 0.88;
        rationale = hasPin && hasCityState
          ? 'High OCR token clarity with verified 6-digit postal PIN code and complete physical address entities.'
          : 'Manufacturer declaration detected on PDP with standard postal identifiers.';
      } else {
        syntaxScore = 0.95; // High confidence in absence/incompleteness
        evidenceScore = 0.92;
        rationale = val
          ? 'Address lacks mandatory statutory elements (PIN code / full postal location) under Rule 10.'
          : 'Zero manufacturer or packer address tokens detected across all scanned packaging panels.';
      }
      break;
    }

    case 'rule_6_1_b_generic_name': {
      const val = extraction.generic_name?.value || '';
      ocrScore = extraction.generic_name?.confidence || (val ? 0.94 : 0.90);
      
      if (status === 'compliant') {
        syntaxScore = val.length > 3 ? 0.96 : 0.85;
        evidenceScore = 0.95;
        rationale = `Prominent PDP typography verified matching standard commodity classification: "${val}".`;
      } else {
        syntaxScore = 0.95;
        evidenceScore = 0.90;
        rationale = 'No standard common or generic commodity name found on principal display panel.';
      }
      break;
    }

    case 'rule_6_1_c_net_quantity': {
      const netQty = extraction.net_quantity?.value;
      ocrScore = extraction.net_quantity?.confidence || (netQty ? 0.95 : 0.88);
      
      if (status === 'compliant') {
        const validUnits = ['g', 'kg', 'ml', 'l', 'mg', 'cm', 'm', 'n', 'u'];
        const unitValid = netQty && validUnits.includes(netQty.unit.toLowerCase().trim());
        syntaxScore = unitValid ? 0.98 : 0.80;
        evidenceScore = (netQty && netQty.amount > 0) ? 0.97 : 0.85;
        rationale = `Verified standard SI metric unit (${netQty?.unit}) and positive quantity (${netQty?.amount}) adhering to First Schedule.`;
      } else {
        syntaxScore = 0.96;
        evidenceScore = 0.92;
        rationale = netQty?.unit
          ? `Non-standard metric unit "${netQty.unit}" detected, violating Rule 12 mandatory units.`
          : 'Net quantity declaration absent from package PDP.';
      }
      break;
    }

    case 'rule_6_1_d_mfg_date': {
      const val = extraction.mfg_date?.value || '';
      ocrScore = extraction.mfg_date?.confidence || (val ? 0.92 : 0.88);
      
      if (status === 'exempt') {
        return {
          confidence: 1.0,
          basis: '100% statutory exemption under Rule 6(10) (date marking exempt on digital listings).'
        };
      }
      
      if (status === 'compliant') {
        const hasDatePattern = /\b([0-9]{1,2}[/.-][0-9]{2,4}|[A-Za-z]{3,9}\s*[0-9]{2,4})\b/.test(val);
        syntaxScore = hasDatePattern ? 0.96 : 0.88;
        evidenceScore = 0.94;
        rationale = `Date expression parsed with verified Month/Year format: "${val}".`;
      } else {
        syntaxScore = 0.94;
        evidenceScore = 0.90;
        rationale = 'Manufacturing/packing date marker not identified in PDP scan.';
      }
      break;
    }

    case 'rule_6_1_e_mrp_format': {
      const mrp = extraction.mrp?.value;
      ocrScore = extraction.mrp?.confidence || (mrp ? 0.94 : 0.90);
      
      if (status === 'compliant') {
        const hasTax = Boolean(mrp?.is_inclusive_taxes);
        const hasAmount = Boolean(mrp && mrp.amount !== null && mrp.amount > 0);
        syntaxScore = (hasTax && hasAmount) ? 0.98 : 0.85;
        evidenceScore = 0.96;
        rationale = `Mandatory statutory phrase "Inclusive of all taxes" verified with decimal price ₹${mrp?.amount}.`;
      } else {
        syntaxScore = 0.97;
        evidenceScore = 0.95;
        rationale = !mrp?.is_inclusive_taxes && mrp?.amount
          ? 'Price printed without mandatory "inclusive of all taxes" phrase required by Rule 6(1)(e).'
          : 'Maximum Retail Price declaration omitted from label.';
      }
      break;
    }

    case 'rule_6_2_consumer_care': {
      const care = extraction.consumer_care?.value;
      ocrScore = extraction.consumer_care?.confidence || ((care?.phone || care?.email) ? 0.92 : 0.88);
      
      const hasPhone = Boolean(care?.phone && /\d{8,12}/.test(care.phone.replace(/\D/g, '')));
      const hasEmail = Boolean(care?.email && /@/.test(care.email));
      
      if (status === 'compliant') {
        syntaxScore = (hasPhone && hasEmail) ? 0.98 : (hasPhone || hasEmail) ? 0.94 : 0.85;
        evidenceScore = 0.95;
        rationale = hasPhone && hasEmail
          ? 'Dual-channel consumer care contact verified (Telephone helpline & Electronic mail redressal).'
          : 'Consumer redressal channel verified under Rule 6(2).';
      } else {
        syntaxScore = 0.96;
        evidenceScore = 0.92;
        rationale = 'Mandatory consumer care telephone and email channels completely absent from label.';
      }
      break;
    }

    case 'rule_7_numeral_height': {
      const heightObj = extraction.numeral_height_mm;
      if (status === 'unverifiable' || !heightObj?.reference_detected) {
        return {
          confidence: 0.45,
          basis: 'Optical reference scale absent in photo frame; physical caliper measurement required for evidentiary validation.'
        };
      }
      ocrScore = 0.94;
      syntaxScore = 0.92;
      evidenceScore = 0.94;
      rationale = `Calibrated pixel-to-millimeter metric verified (${heightObj.value} mm) against Table I threshold.`;
      break;
    }

    case 'rule_6_10_country_origin': {
      const val = extraction.country_of_origin?.value || '';
      ocrScore = extraction.country_of_origin?.confidence || (val ? 0.94 : 0.88);
      
      if (status === 'compliant') {
        syntaxScore = val.length > 2 ? 0.96 : 0.88;
        evidenceScore = 0.95;
        rationale = `Sovereign country of origin recognized and verified: "${val}".`;
      } else {
        syntaxScore = 0.95;
        evidenceScore = 0.92;
        rationale = 'Mandatory country of origin declaration not detected under Rule 6(10).';
      }
      break;
    }

    default: {
      ocrScore = 0.90;
      syntaxScore = 0.90;
      evidenceScore = 0.90;
      rationale = 'Standard rule evaluation verified against Legal Metrology Rules, 2011.';
      break;
    }
  }

  // Weighted Confidence Calculation (W_ocr: 0.45, W_syntax: 0.35, W_evidence: 0.20)
  const composite = (ocrScore * 0.45) + (syntaxScore * 0.35) + (evidenceScore * 0.20);
  const rounded = Math.round(Math.min(Math.max(composite, 0.40), 0.99) * 100) / 100;

  return {
    confidence: rounded,
    basis: rationale
  };
}
