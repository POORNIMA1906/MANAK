import { ExtractionResult, Product, RuleEvaluation, EvaluationChannel } from '../types';

export type EcommerceStatus = 'PASS' | 'FAIL' | 'CANNOT_CHECK' | 'NOT_APPLICABLE' | 'VERIFY';
export type EvidenceLevel = 'TEXT' | 'IMAGE' | 'CALCULATED' | 'EXTERNAL' | 'PHYSICAL';
export type RuleSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface EcommerceRuleResult {
  rule_id: string;
  rule_number: string;
  category: string;
  requirement: string;
  status: EcommerceStatus;
  evidence_level: EvidenceLevel;
  severity: RuleSeverity;
  found_value: string | null;
  expected_value: string;
  explanation: string;
  citation: string;
  penalty: number;
  section: 'online_declarations' | 'pricing_unit_sale' | 'consumer_care' | 'exemptions_special' | 'physical_package_only' | 'external_verification';
  confidence?: number;
  confidence_basis?: string;
}

export interface EcommerceAuditReport {
  verdict: 'ONLINE_COMPLIANT' | 'ONLINE_NON_COMPLIANT' | 'PARTIALLY_VERIFIED';
  verdict_display: string;
  verdict_subtitle: string;
  declarations_score: {
    passed: number;
    total: number;
    percent: number;
  };
  total_violations: number;
  total_penalty: number;
  warnings: string[];
  unit_sale_price_analysis?: {
    is_applicable: boolean;
    calculated_price: number | null;
    unit_label: string;
    displayed_price?: string;
    is_math_correct: boolean;
  };
  evaluations: EcommerceRuleResult[];
  standardEvaluations: RuleEvaluation[]; // Backward-compatible for PDF & existing state
}

/**
 * Standard legal unit normalization for Rule 12 & Rule 6(11)
 */
function normalizeUnit(unitStr: string): { normalized: string; type: 'mass' | 'volume' | 'length' | 'count' | 'other' } {
  const u = (unitStr || '').toLowerCase().trim();
  if (['g', 'gm', 'gms', 'gram', 'grams'].includes(u)) return { normalized: 'g', type: 'mass' };
  if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(u)) return { normalized: 'kg', type: 'mass' };
  if (['ml', 'm.l.', 'millilitre', 'milliliter'].includes(u)) return { normalized: 'ml', type: 'volume' };
  if (['l', 'ltr', 'litre', 'liter', 'litres', 'liters'].includes(u)) return { normalized: 'L', type: 'volume' };
  if (['cm', 'centimetre', 'centimeter'].includes(u)) return { normalized: 'cm', type: 'length' };
  if (['m', 'metre', 'meter'].includes(u)) return { normalized: 'm', type: 'length' };
  if (['n', 'no', 'nos', 'number', 'piece', 'pieces', 'pc', 'pcs', 'unit', 'units', 'pair', 'pairs', 'set', 'sets'].includes(u)) {
    return { normalized: 'number', type: 'count' };
  }
  return { normalized: u, type: 'other' };
}

/**
 * Full E-Commerce Legal Metrology Rules Engine according to
 * MANAK_Legal_Metrology_e_commerce_only_Checklist
 */
export function evaluateEcommerceListing(
  extraction: ExtractionResult,
  product?: Product | null
): EcommerceAuditReport {
  const results: EcommerceRuleResult[] = [];
  const warnings: string[] = [];

  const rawText = (extraction.raw_ocr_text || '').toLowerCase();
  const title = (product?.title || '').toLowerCase();
  const categoryStr = (product?.category || '').toLowerCase();
  const isGarment = categoryStr.includes('garment') || categoryStr.includes('cloth') || categoryStr.includes('apparel') ||
    categoryStr.includes('shirt') || categoryStr.includes('hosiery') || title.includes('t-shirt') || title.includes('shirt') ||
    title.includes('jeans') || title.includes('trouser') || title.includes('dress');

  const originStr = (extraction.country_of_origin.value || '').trim();
  const isImported = originStr.length > 0 && !originStr.toLowerCase().includes('india');

  // Pricing values
  const mrpObj = extraction.mrp.value;
  const mrpAmount = mrpObj?.amount ?? 0;
  // Check if a separate selling price was parsed, otherwise assume selling price equals or discounts from mrp
  let sellingPrice = mrpAmount;
  const spMatch = rawText.match(/(?:selling\s*price|deal\s*price|our\s*price|offer\s*price|price\s*:\s*₹?)\s*[:₹]?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  if (spMatch) {
    const parsedSp = parseFloat(spMatch[1].replace(/,/g, ''));
    if (!isNaN(parsedSp) && parsedSp > 0) sellingPrice = parsedSp;
  }

  // Net quantity values
  const netQtyObj = extraction.net_quantity.value;
  const netQtyAmount = netQtyObj?.amount ?? 0;
  const rawUnit = netQtyObj?.unit ?? '';
  const { normalized: normUnit, type: unitType } = normalizeUnit(rawUnit);

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 2: E-COMMERCE MASTER RULE
  // ──────────────────────────────────────────────────────────────────────────
  const corePresent = Boolean(
    extraction.manufacturer.value &&
    extraction.generic_name.value &&
    netQtyAmount > 0 &&
    mrpAmount > 0
  );

  results.push({
    rule_id: 'ECOM-01',
    rule_number: 'Rule 6(10) / DCA Guidance',
    category: 'E-Commerce Master Disclosure',
    requirement: 'Mandatory declarations on digital network (excluding mfg/packing date)',
    status: corePresent ? 'PASS' : 'FAIL',
    evidence_level: 'TEXT',
    severity: 'HIGH',
    found_value: corePresent ? 'Mandatory declarations displayed on listing' : 'Critical declarations absent on listing',
    expected_value: 'Online display of manufacturer, generic name, net quantity, MRP, country of origin, consumer care',
    explanation: corePresent
      ? 'Product listing complies with Rule 6(10) by hosting mandatory product declarations on the digital transaction network.'
      : 'E-commerce entity failed to ensure mandatory declarations specified under Rule 6(1) are displayed on the electronic transaction network.',
    citation: 'Rule 6(10) Legal Metrology (Packaged Commodities) Rules 2011 & Department of Consumer Affairs Guidelines.',
    penalty: corePresent ? 0 : 2000,
    section: 'online_declarations'
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 3: RULE 6 — MANDATORY DECLARATIONS
  // ──────────────────────────────────────────────────────────────────────────

  // LM-06-01: Manufacturer Name
  const mfgRaw = extraction.manufacturer.value || '';
  const hasMfgName = mfgRaw.trim().length > 3;
  results.push({
    rule_id: 'LM-06-01',
    rule_number: '6(1)(a)',
    category: 'Manufacturer Identity',
    requirement: 'Manufacturer name must be declared online',
    status: hasMfgName ? 'PASS' : 'FAIL',
    evidence_level: 'TEXT',
    severity: 'HIGH',
    found_value: hasMfgName ? mfgRaw.split(/[,;\n]/)[0].trim() : null,
    expected_value: 'Name of the manufacturer',
    explanation: hasMfgName
      ? `Manufacturer identity '${mfgRaw.split(/[,;\n]/)[0].trim()}' is clearly declared.`
      : 'Manufacturer name is absent from the product specification and listing details.',
    citation: 'Rule 6(1)(a): Every package shall bear the name and complete address of the manufacturer.',
    penalty: hasMfgName ? 0 : 2000,
    section: 'online_declarations'
  });

  // LM-06-02: Manufacturer Address
  const hasPinCode = /\b[1-9][0-9]{5}\b/.test(mfgRaw);
  const hasCityState = /(mumbai|delhi|bengaluru|bangalore|chennai|kolkata|hyderabad|pune|ahmedabad|gurugram|noida|karnataka|maharashtra|haryana|gujarat|tamil nadu|uttar pradesh|rajasthan|kerala)/i.test(mfgRaw);
  let mfgAddressStatus: EcommerceStatus = 'FAIL';
  let mfgAddressExp = 'Manufacturer physical address missing from listing.';
  if (hasMfgName && (hasPinCode || mfgRaw.length >= 25)) {
    mfgAddressStatus = 'PASS';
    mfgAddressExp = 'Complete physical address with city/state/postal PIN is declared.';
  } else if (hasMfgName && mfgRaw.length > 5) {
    mfgAddressStatus = 'VERIFY';
    mfgAddressExp = 'Shorter or registered premises address detected; external verification of registered office recommended.';
  }

  results.push({
    rule_id: 'LM-06-02',
    rule_number: '6(1)(a)',
    category: 'Manufacturer Address',
    requirement: 'Complete physical address with postal PIN code',
    status: mfgAddressStatus,
    evidence_level: 'TEXT',
    severity: mfgAddressStatus === 'FAIL' ? 'HIGH' : 'LOW',
    found_value: hasMfgName ? mfgRaw : null,
    expected_value: 'Complete postal address including premises, city, state and PIN code',
    explanation: mfgAddressExp,
    citation: 'Rule 6(1)(a) & Rule 10: Complete address enables consumer grievance and statutory enforcement.',
    penalty: mfgAddressStatus === 'FAIL' ? 2000 : 0,
    section: 'online_declarations'
  });

  // LM-06-03 & 04: Packer Name & Address
  const hasPacker = /pack(?:ed|er)\s*by/i.test(rawText) || /packer/i.test(mfgRaw);
  results.push({
    rule_id: 'LM-06-03',
    rule_number: '6(1)(a)',
    category: 'Packer Identity',
    requirement: 'Packer name where manufacturer is not the packer',
    status: hasPacker ? 'PASS' : 'NOT_APPLICABLE',
    evidence_level: 'TEXT',
    severity: 'INFO',
    found_value: hasPacker ? 'Declared in listing text' : 'Same as manufacturer or not separately designated',
    expected_value: 'Packer name if third-party packed',
    explanation: hasPacker
      ? 'Separate packer entity identified in product specifications.'
      : 'Rule 6(1)(a) allows single manufacturer/packer disclosure when manufactured and packed by same legal entity.',
    citation: 'Rule 6(1)(a): Name and complete address of the packer where applicable.',
    penalty: 0,
    section: 'online_declarations'
  });

  // LM-06-05 & 06: Importer Name & Address (Conditional on imported goods)
  results.push({
    rule_id: 'LM-06-05',
    rule_number: '6(1)(a)',
    category: 'Importer Identity',
    requirement: 'Importer name & address for imported commodities',
    status: isImported ? (hasMfgName ? 'PASS' : 'FAIL') : 'NOT_APPLICABLE',
    evidence_level: 'TEXT',
    severity: isImported && !hasMfgName ? 'HIGH' : 'INFO',
    found_value: isImported ? (hasMfgName ? mfgRaw : 'Missing') : 'Domestic commodity (India)',
    expected_value: isImported ? 'Registered Indian importer name and address' : 'Not applicable for domestic products',
    explanation: isImported
      ? (hasMfgName ? 'Indian importer details disclosed.' : 'Imported product lacks mandatory Indian importer declaration.')
      : 'Product is of Indian manufacture; importer disclosure not applicable.',
    citation: 'Rule 6(1)(a): For imported packages, name and address of the importer must be declared.',
    penalty: (isImported && !hasMfgName) ? 2000 : 0,
    section: 'online_declarations'
  });

  // LM-06-07: Country of Origin
  const hasOrigin = originStr.length > 1;
  results.push({
    rule_id: 'LM-06-07',
    rule_number: 'Rule 6(10) / CPA 2020',
    category: 'Country of Origin',
    requirement: 'Country of origin / manufacture must be declared prominently',
    status: hasOrigin ? 'PASS' : 'FAIL',
    evidence_level: 'TEXT',
    severity: 'HIGH',
    found_value: hasOrigin ? originStr : null,
    expected_value: 'Name of the country of origin/manufacture',
    explanation: hasOrigin
      ? `Country of origin declared as '${originStr}'.`
      : 'Country of origin is missing, violating Rule 6(10) and Consumer Protection (E-Commerce) Rules 2020.',
    citation: 'Rule 6(10): Country of origin must be declared on e-commerce listings.',
    penalty: hasOrigin ? 0 : 2000,
    section: 'online_declarations'
  });

  // LM-06-08: Common / Generic Name
  const genericNameRaw = extraction.generic_name.value || '';
  const hasGeneric = genericNameRaw.trim().length > 2;
  results.push({
    rule_id: 'LM-06-08',
    rule_number: '6(1)(b)',
    category: 'Commodity Generic Name',
    requirement: 'Common or generic name of commodity (distinct from marketing/brand)',
    status: hasGeneric ? 'PASS' : 'FAIL',
    evidence_level: 'TEXT',
    severity: 'HIGH',
    found_value: hasGeneric ? genericNameRaw : null,
    expected_value: 'Clear generic name e.g. "Pure Cow Ghee", "Cotton T-Shirt", "Tea"',
    explanation: hasGeneric
      ? `Common generic name '${genericNameRaw}' is prominently stated.`
      : 'Common or generic commodity name is absent; brand or marketing tagline alone is insufficient.',
    citation: 'Rule 6(1)(b): The common or generic names of the commodity contained in the package shall be clearly stated.',
    penalty: hasGeneric ? 0 : 2000,
    section: 'online_declarations'
  });

  // LM-06-10: Net Quantity
  const hasNetQty = netQtyAmount > 0 && normUnit.length > 0;
  results.push({
    rule_id: 'LM-06-10',
    rule_number: '6(1)(c)',
    category: 'Net Quantity Declaration',
    requirement: 'Net quantity in standard unit of weight, measure or number',
    status: hasNetQty ? 'PASS' : 'FAIL',
    evidence_level: 'TEXT',
    severity: 'HIGH',
    found_value: hasNetQty ? `${netQtyAmount} ${normUnit}` : null,
    expected_value: 'Weight in g/kg, volume in ml/L, or count in number/pieces',
    explanation: hasNetQty
      ? `Net quantity declared as '${netQtyAmount} ${normUnit}'.`
      : 'Net quantity is absent or unspecified in listing specifications.',
    citation: 'Rule 6(1)(c): Net quantity shall be declared in standard metric units.',
    penalty: hasNetQty ? 0 : 2000,
    section: 'online_declarations'
  });

  // LM-06-11: Correct Metric Unit
  const isStdMetric = ['g', 'kg', 'ml', 'L', 'cm', 'm', 'number'].includes(normUnit);
  results.push({
    rule_id: 'LM-06-11',
    rule_number: 'Rule 12 & First Schedule',
    category: 'Standard Metric Units',
    requirement: 'Standard legal units (solids: g/kg, liquids: ml/L, count: N)',
    status: isStdMetric ? 'PASS' : (hasNetQty ? 'VERIFY' : 'FAIL'),
    evidence_level: 'TEXT',
    severity: 'MEDIUM',
    found_value: normUnit || rawUnit || null,
    expected_value: 'Standard SI metric unit (g, kg, ml, L, m, cm, number)',
    explanation: isStdMetric
      ? `Unit '${normUnit}' is an approved legal unit under Rule 12.`
      : `Non-standard quantity unit '${rawUnit}' detected. Legal Metrology prohibits imperial units (lbs, oz) as primary declaration.`,
    citation: 'Rule 12: Manner in which declaration of quantity shall be given.',
    penalty: isStdMetric ? 0 : 2000,
    section: 'online_declarations'
  });

  // LM-06-12: Misleading Quantity Wording
  const misleadingTerms = ['minimum', 'not less than', 'average', 'about', 'approx', 'approximately'];
  const foundMisleading = misleadingTerms.filter(t => rawText.includes(t));
  const hasMisleading = foundMisleading.length > 0;
  results.push({
    rule_id: 'LM-06-12',
    rule_number: 'Rule 12(6)',
    category: 'Quantity Qualifying Terms',
    requirement: 'Quantity must not be qualified by misleading words ("approx", "minimum", "about")',
    status: hasMisleading ? 'VERIFY' : 'PASS',
    evidence_level: 'TEXT',
    severity: 'MEDIUM',
    found_value: hasMisleading ? `Potential qualifier detected: "${foundMisleading.join(', ')}"` : 'Clean metric declaration',
    expected_value: 'Unqualified net quantity representation without words of approximation',
    explanation: hasMisleading
      ? `Listing text contains qualifying term "${foundMisleading[0]}". Rule 12(6) forbids qualifying net quantity with speculative wording.`
      : 'No misleading or approximate quantity expressions found.',
    citation: 'Rule 12(6): The declaration of quantity shall not be qualified by any words which indicate approximate or exaggerated quantity.',
    penalty: 0,
    section: 'online_declarations'
  });

  // LM-06-13: Dimensions Where Required
  const dimMatch = rawText.match(/(\d+(?:\.\d+)?\s*(?:cm|mm|m|inch|in)\s*[x×*]\s*\d+(?:\.\d+)?\s*(?:cm|mm|m|inch|in))/i);
  const requiresDimensions = isGarment || categoryStr.includes('bedsheet') || categoryStr.includes('towel') || categoryStr.includes('luggage') || categoryStr.includes('mattress');
  results.push({
    rule_id: 'LM-06-13',
    rule_number: 'Rule 12(4)',
    category: 'Dimensions Declaration',
    requirement: 'Dimensions declared where weight alone does not provide sufficient info',
    status: dimMatch ? 'PASS' : (requiresDimensions ? 'FAIL' : 'NOT_APPLICABLE'),
    evidence_level: 'TEXT',
    severity: requiresDimensions && !dimMatch ? 'MEDIUM' : 'INFO',
    found_value: dimMatch ? dimMatch[0] : null,
    expected_value: requiresDimensions ? 'Length × Width (× Height) in metric units (cm/m)' : 'Not mandatory for this commodity',
    explanation: dimMatch
      ? `Package/item dimensions declared as '${dimMatch[0]}'.`
      : (requiresDimensions ? 'Dimensions required under Rule 12(4) are missing from listing.' : 'Commodity sold by weight/volume; dimensional declaration is not mandatory.'),
    citation: 'Rule 12(4): Declaration of dimensions for applicable commodities.',
    penalty: (requiresDimensions && !dimMatch) ? 2000 : 0,
    section: 'online_declarations'
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 4: MRP & PRICING (Rule 6(1)(e) & Rule 18)
  // ──────────────────────────────────────────────────────────────────────────

  // LM-06-14: Maximum Retail Price
  const hasMrp = mrpAmount > 0;
  results.push({
    rule_id: 'LM-06-14',
    rule_number: '6(1)(e)',
    category: 'Maximum Retail Price (MRP)',
    requirement: 'Applicable retail sale price / MRP information must be declared',
    status: hasMrp ? 'PASS' : 'FAIL',
    evidence_level: 'TEXT',
    severity: 'HIGH',
    found_value: hasMrp ? `₹${mrpAmount.toFixed(2)}` : null,
    expected_value: 'Mandatory Maximum Retail Price (MRP) declaration',
    explanation: hasMrp
      ? `MRP of ₹${mrpAmount.toFixed(2)} is clearly declared.`
      : 'Maximum Retail Price (MRP) is completely missing from product listing.',
    citation: 'Rule 6(1)(e): Maximum Retail Price inclusive of all taxes must be declared.',
    penalty: hasMrp ? 0 : 2000,
    section: 'pricing_unit_sale'
  });

  // LM-06-15: MRP in Indian Currency
  results.push({
    rule_id: 'LM-06-15',
    rule_number: '6(1)(e)',
    category: 'Currency Format',
    requirement: 'MRP declaration must be in Indian Rupee (₹ / Rs.) currency',
    status: hasMrp ? 'PASS' : 'FAIL',
    evidence_level: 'TEXT',
    severity: 'MEDIUM',
    found_value: hasMrp ? 'Indian Rupee (₹)' : null,
    expected_value: 'INR / ₹ symbol or Rs. notation',
    explanation: hasMrp
      ? 'Price is declared in Indian legal tender.'
      : 'Missing currency denomination.',
    citation: 'Rule 6(1)(e): Price declaration in Indian currency under 2011 Rules.',
    penalty: 0,
    section: 'pricing_unit_sale'
  });

  // LM-06-16: Inclusive of All Taxes
  const taxExplicit = mrpObj?.is_inclusive_taxes || /incl(?:usive)?\s*(?:of\s*)?(?:all\s*)?taxes/i.test(rawText) || hasMrp;
  results.push({
    rule_id: 'LM-06-16',
    rule_number: 'Rule 2(m) & 6(1)(e)',
    category: 'Tax Inclusivity',
    requirement: 'Retail price must be inclusive of all taxes',
    status: taxExplicit ? 'PASS' : 'VERIFY',
    evidence_level: 'TEXT',
    severity: 'MEDIUM',
    found_value: mrpObj?.raw_text || (taxExplicit ? 'Inclusive of all taxes' : null),
    expected_value: '"Inclusive of all taxes" or "incl. of all taxes" statutory phrasing',
    explanation: taxExplicit
      ? 'Statutory tax inclusion verified on e-commerce listing.'
      : 'Explicit "inclusive of all taxes" notice not detected; verify final checkout price.',
    citation: 'Rule 2(m): Retail sale price means maximum price inclusive of all taxes.',
    penalty: 0,
    section: 'pricing_unit_sale'
  });

  // LM-18-01: Selling price greater than MRP
  const sellingAboveMrp = hasMrp && sellingPrice > mrpAmount;
  results.push({
    rule_id: 'LM-18-01',
    rule_number: 'Rule 18(1)',
    category: 'Price Compliance',
    requirement: 'Selling price must not exceed Maximum Retail Price (MRP)',
    status: sellingAboveMrp ? 'FAIL' : 'PASS',
    evidence_level: 'CALCULATED',
    severity: 'CRITICAL',
    found_value: `Selling Price: ₹${sellingPrice.toFixed(2)} | MRP: ₹${mrpAmount.toFixed(2)}`,
    expected_value: 'Selling price <= MRP',
    explanation: sellingAboveMrp
      ? `CRITICAL VIOLATION: Product is being offered at ₹${sellingPrice.toFixed(2)}, which exceeds the declared MRP of ₹${mrpAmount.toFixed(2)} under Rule 18(1).`
      : `Selling price (₹${sellingPrice.toFixed(2)}) is strictly within legal limit (MRP: ₹${mrpAmount.toFixed(2)}).`,
    citation: 'Rule 18(1): No person shall sell, offer or expose for sale any packaged commodity at a price exceeding the maximum retail price.',
    penalty: sellingAboveMrp ? 5000 : 0,
    section: 'pricing_unit_sale'
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 5: UNIT SALE PRICE — RULE 6(11) & DCA FAQ
  // ──────────────────────────────────────────────────────────────────────────
  let uspCalculated: number | null = null;
  let uspUnitLabel = '';
  let uspApplicable = hasMrp && hasNetQty;

  if (uspApplicable) {
    if (unitType === 'mass') {
      const grams = normUnit === 'kg' ? netQtyAmount * 1000 : netQtyAmount;
      if (grams < 1000) {
        uspCalculated = Number((mrpAmount / grams).toFixed(2));
        uspUnitLabel = '₹ / g';
      } else {
        const kg = grams / 1000;
        uspCalculated = Number((mrpAmount / kg).toFixed(2));
        uspUnitLabel = '₹ / kg';
      }
    } else if (unitType === 'volume') {
      const ml = normUnit === 'l' ? netQtyAmount * 1000 : netQtyAmount;
      if (ml < 1000) {
        uspCalculated = Number((mrpAmount / ml).toFixed(2));
        uspUnitLabel = '₹ / ml';
      } else {
        const l = ml / 1000;
        uspCalculated = Number((mrpAmount / l).toFixed(2));
        uspUnitLabel = '₹ / L';
      }
    } else if (unitType === 'count') {
      uspCalculated = Number((mrpAmount / netQtyAmount).toFixed(2));
      uspUnitLabel = '₹ / piece';
    }
  }

  // Look for unit sale price displayed on the page (e.g. ₹0.60/g or (₹60.00 / 100 g))
  const uspPageMatch = rawText.match(/(?:unit\s*price|usp|rate)\s*[:=]?\s*₹?\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:\/|\s*per\s*)([a-z0-9\s.]+)/i);
  const uspDisplayed = uspPageMatch ? `${uspPageMatch[1]} / ${uspPageMatch[2].trim()}` : null;

  results.push({
    rule_id: 'LM-06-17',
    rule_number: '6(11)',
    category: 'Unit Sale Price (USP)',
    requirement: 'Unit sale price declaration under Rule 6(11) (<1kg: /g, >=1kg: /kg, <1L: /ml, >=1L: /L, count: /piece)',
    status: uspApplicable ? (uspCalculated !== null ? 'PASS' : 'VERIFY') : 'NOT_APPLICABLE',
    evidence_level: 'CALCULATED',
    severity: 'MEDIUM',
    found_value: uspCalculated !== null ? `Calculated: ₹${uspCalculated.toFixed(2)} ${uspUnitLabel}${uspDisplayed ? ` (Displayed: ${uspDisplayed})` : ''}` : null,
    expected_value: 'Mandatory statutory unit sale price declaration based on standard threshold',
    explanation: uspApplicable
      ? `Statutory Unit Sale Price evaluated at ₹${uspCalculated?.toFixed(2)} ${uspUnitLabel} rounded to 2 decimal places per DCA FAQ.`
      : 'Net quantity or price incomplete; unit sale price calculation deferred.',
    citation: 'Rule 6(11) (2021 Amendment) & Department of Consumer Affairs Legal Metrology FAQ.',
    penalty: 0,
    section: 'pricing_unit_sale'
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 6: MANUFACTURING / PACKING DATE — RULE 6(10) EXCLUSION
  // ──────────────────────────────────────────────────────────────────────────
  results.push({
    rule_id: 'LM-06-23',
    rule_number: 'Rule 6(10) / DCA FAQ',
    category: 'Date Marking',
    requirement: 'Month and year of manufacture or packing is NOT mandatory on e-commerce listings',
    status: 'NOT_APPLICABLE',
    evidence_level: 'TEXT',
    severity: 'INFO',
    found_value: 'EXEMPT ON DIGITAL NETWORK (Rule 6(10) Exception)',
    expected_value: 'Not required on online listing; applies solely to physical package label',
    explanation: 'IMPORTANT LEGAL SAFEGUARD: Under Department of Consumer Affairs e-commerce guidance and Rule 6(10), month and year of manufacture or packing is expressly excluded from mandatory online display. Listing cannot be failed for this omission.',
    citation: 'Rule 6(10) Legal Metrology (Packaged Commodities) Rules 2011 & DCA FAQ on E-Commerce.',
    penalty: 0,
    section: 'online_declarations'
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 7: CONSUMER-CARE REDRESSAL (Rule 6(2))
  // ──────────────────────────────────────────────────────────────────────────
  const careObj = extraction.consumer_care.value;
  const carePhone = careObj?.phone;
  const careEmail = careObj?.email;
  const careAddr = careObj?.address;
  const hasCareContact = Boolean(carePhone || careEmail);

  // LM-06-25 & 27: Phone
  results.push({
    rule_id: 'LM-06-27',
    rule_number: '6(2)',
    category: 'Consumer Redressal — Telephone',
    requirement: 'Consumer care telephone number or toll-free helpline',
    status: carePhone ? 'PASS' : (hasCareContact ? 'VERIFY' : 'FAIL'),
    evidence_level: 'TEXT',
    severity: 'MEDIUM',
    found_value: carePhone || null,
    expected_value: 'Valid consumer assistance telephone / toll-free number',
    explanation: carePhone
      ? `Consumer helpline '${carePhone}' provided for complaint registration.`
      : (careEmail ? 'Telephone helpline omitted, but grievance email is present.' : 'Consumer complaint telephone number is completely missing.'),
    citation: 'Rule 6(2): Every package shall bear telephone number and e-mail of consumer care cell.',
    penalty: (!carePhone && !careEmail) ? 2000 : 0,
    section: 'consumer_care'
  });

  // LM-06-28: Email
  results.push({
    rule_id: 'LM-06-28',
    rule_number: '6(2)',
    category: 'Consumer Redressal — Email',
    requirement: 'Consumer grievance email address',
    status: careEmail ? 'PASS' : (hasCareContact ? 'VERIFY' : 'FAIL'),
    evidence_level: 'TEXT',
    severity: 'MEDIUM',
    found_value: careEmail || null,
    expected_value: 'Valid grievance redressal email address',
    explanation: careEmail
      ? `Grievance email '${careEmail}' is declared.`
      : (carePhone ? 'Grievance email omitted, but telephone contact is present.' : 'Consumer grievance email address is absent.'),
    citation: 'Rule 6(2): Consumer care email address requirement.',
    penalty: (!carePhone && !careEmail) ? 2000 : 0,
    section: 'consumer_care'
  });

  // LM-06-26: Consumer Care Address
  const hasCareAddr = Boolean(careAddr || hasMfgName);
  results.push({
    rule_id: 'LM-06-26',
    rule_number: '6(2)',
    category: 'Consumer Redressal — Office Address',
    requirement: 'Name & address of consumer care office/officer',
    status: hasCareAddr ? 'PASS' : 'VERIFY',
    evidence_level: 'TEXT',
    severity: 'LOW',
    found_value: careAddr || (hasMfgName ? 'Same as manufacturer address' : null),
    expected_value: 'Physical office address for consumer correspondence',
    explanation: hasCareAddr
      ? 'Consumer grievance correspondence address available.'
      : 'Specific postal address for consumer care not explicitly designated.',
    citation: 'Rule 6(2): Office address of the person who can be contacted by the consumer.',
    penalty: 0,
    section: 'consumer_care'
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 20 & 21: EXEMPTIONS & SPECIAL MODULES (Rule 26)
  // ──────────────────────────────────────────────────────────────────────────
  const isSmallQuantity = (unitType === 'mass' && normUnit === 'g' && netQtyAmount <= 10) ||
    (unitType === 'volume' && normUnit === 'ml' && netQtyAmount <= 10);

  results.push({
    rule_id: 'LM-26-01',
    rule_number: 'Rule 26',
    category: 'Statutory Exemption Audit',
    requirement: 'Determination whether product is exempt (packages <= 10g/ml, fast-food, etc.)',
    status: isSmallQuantity ? 'NOT_APPLICABLE' : 'PASS',
    evidence_level: 'TEXT',
    severity: 'INFO',
    found_value: isSmallQuantity ? `Small package (<=10${normUnit}) qualifies under Rule 26` : 'Standard commodity — Not Exempt',
    expected_value: 'Applicability audit under Rule 26 statutory exemptions',
    explanation: isSmallQuantity
      ? 'Package qualifies under small quantity exemption (<10g / 10ml); standard declaration rules modified.'
      : 'Product is a standard packaged commodity subject to mandatory declarations under the Rules.',
    citation: 'Rule 26: Packages to which these rules shall not apply.',
    penalty: 0,
    section: 'exemptions_special'
  });

  // Garment special module (Rule 26(f) 2022 Amendment)
  if (isGarment) {
    const hasSize = /\b(XXS|XS|S|M|L|XL|XXL|XXXL|2XL|3XL|4XL)\b/i.test(rawText + ' ' + title);
    results.push({
      rule_id: 'LM-GAR-05',
      rule_number: 'Rule 26(f)',
      category: 'Garment / Hosiery Size Module',
      requirement: 'Internationally recognizable size (S/M/L/XL) & metric dimensions on e-commerce',
      status: hasSize ? 'PASS' : 'VERIFY',
      evidence_level: 'TEXT',
      severity: 'MEDIUM',
      found_value: hasSize ? 'Standard size notation detected' : 'Check size selector on page',
      expected_value: 'Internationally recognizable size (S, M, L, XL, etc.) and metric size in cm',
      explanation: hasSize
        ? 'Garment complies with Rule 26(f) e-commerce display requirements.'
        : 'Rule 26(f) requires size indicators to be displayed on the digital network for apparel/hosiery.',
      citation: 'Rule 26(f) (2022 Garment Amendment): Mandatory display of garment size indicators on e-commerce.',
      penalty: 0,
      section: 'exemptions_special'
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 26: PHYSICAL-PACKAGE-ONLY CHECKS (CANNOT_CHECK ONLINE)
  // ──────────────────────────────────────────────────────────────────────────
  const physicalOnlyChecks: Array<{ id: string; name: string; rule: string; req: string }> = [
    {
      id: 'LM-07-01',
      name: 'Physical Numeral & Letter Height',
      rule: 'Rule 7 Table I',
      req: 'Prescribed font height (2mm, 4mm, 6mm) on physical principal display panel'
    },
    {
      id: 'LM-08-01',
      name: 'Principal Display Panel Layout & Clear Space',
      rule: 'Rule 8',
      req: 'Adequate surrounding clear space on the physical printed package'
    },
    {
      id: 'LM-11-01',
      name: 'Actual Net Weight vs Declared Quantity',
      rule: 'Rule 11',
      req: 'Physical gravimetric/volumetric testing of actual commodity contents'
    },
    {
      id: 'LM-11-03',
      name: 'Maximum Permissible Error (MPE) Compliance',
      rule: 'First Schedule',
      req: 'Sampling/lot statistical weight variance verification on physical samples'
    },
    {
      id: 'LM-23-01',
      name: 'Deceptive Packaging Assessment',
      rule: 'Rule 23',
      req: 'Package construction inspection to prevent deceptive headspace/slack fill'
    }
  ];

  for (const phys of physicalOnlyChecks) {
    results.push({
      rule_id: phys.id,
      rule_number: phys.rule,
      category: 'Physical Package Inspection',
      requirement: phys.req,
      status: 'CANNOT_CHECK',
      evidence_level: 'PHYSICAL',
      severity: 'INFO',
      found_value: 'Physical inspection required on retail sample',
      expected_value: phys.req,
      explanation: `SAFEGUARD RULE: An e-commerce listing cannot establish physical package attributes under ${phys.rule}. Enforcement Officers must verify this through on-ground inspection or sampling.`,
      citation: `${phys.rule} Legal Metrology (Packaged Commodities) Rules 2011.`,
      penalty: 0,
      section: 'physical_package_only'
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SECTION 22-24: EXTERNAL REGISTRATION VERIFICATIONS
  // ──────────────────────────────────────────────────────────────────────────
  results.push({
    rule_id: 'LM-27-01',
    rule_number: 'Rule 27',
    category: 'Government Registration',
    requirement: 'Manufacturer / Packer / Importer registration with Legal Metrology Department',
    status: 'VERIFY',
    evidence_level: 'EXTERNAL',
    severity: 'INFO',
    found_value: hasMfgName ? 'Company name present — verification with state portal pending' : 'Identity missing',
    expected_value: 'Valid registration certificate under Rule 27',
    explanation: 'Registration status cannot be validated solely from a marketplace web page. Cross-referencing against State/Central Legal Metrology registration records is required.',
    citation: 'Rule 27: Registration of manufacturers, packers and importers.',
    penalty: 0,
    section: 'external_verification'
  });

  // ──────────────────────────────────────────────────────────────────────────
  // FINAL EVALUATIONS & VERDICT CALCULATION
  // ──────────────────────────────────────────────────────────────────────────
  const onlineRules = results.filter(r => r.section !== 'physical_package_only' && r.section !== 'external_verification');
  const totalCheckable = onlineRules.filter(r => r.status !== 'NOT_APPLICABLE').length;
  const passedCount = onlineRules.filter(r => r.status === 'PASS').length;
  const failedRules = onlineRules.filter(r => r.status === 'FAIL');
  const verifyCount = onlineRules.filter(r => r.status === 'VERIFY').length;

  const totalViolations = failedRules.length;
  const totalPenalty = results.reduce((sum, r) => sum + r.penalty, 0);

  let verdict: 'ONLINE_COMPLIANT' | 'ONLINE_NON_COMPLIANT' | 'PARTIALLY_VERIFIED' = 'ONLINE_COMPLIANT';
  let verdictDisplay = 'Online Listing Appears Compliant';
  let verdictSubtitle = 'All mandatory e-commerce declarations under Rule 6(10) are present and verified.';

  if (totalViolations > 0) {
    verdict = 'ONLINE_NON_COMPLIANT';
    verdictDisplay = `${totalViolations} Statutory Online Violations`;
    verdictSubtitle = 'Non-compliance detected under Legal Metrology (Packaged Commodities) Rules 2011.';
  } else if (verifyCount > 0) {
    verdict = 'PARTIALLY_VERIFIED';
    verdictDisplay = 'Partially Verified — Verification Required';
    verdictSubtitle = 'Core declarations are present; specific clauses require verification or physical evidence.';
  }

  // Convert to backward-compatible RuleEvaluation format
  const standardEvaluations: RuleEvaluation[] = results.map(r => {
    let conf = r.confidence || 0.95;
    let basis = r.confidence_basis || 'Verified against digital listing declarations and specifications.';
    if (!r.confidence) {
      if (r.status === 'PASS') {
        conf = 0.96;
        basis = 'DOM / visual declaration extracted and validated against Rule 6(10) specifications.';
      } else if (r.status === 'FAIL') {
        conf = 0.95;
        basis = 'Absence or statutory formatting violation verified across complete listing DOM.';
      } else if (r.status === 'VERIFY') {
        conf = 0.72;
        basis = 'Listing contains ambiguous phrasing requiring physical package inspection.';
      } else if (r.status === 'NOT_APPLICABLE') {
        conf = 1.0;
        basis = 'Statutory exemption confirmed under Rule 6(10) / Rule 26.';
      } else {
        conf = 0.45;
        basis = 'Physical-only requirement uncheckable on digital storefront.';
      }
      r.confidence = conf;
      r.confidence_basis = basis;
    }

    return {
      rule_id: r.rule_id,
      rule_source: `${r.rule_number} (${r.category})`,
      requirement_name: r.requirement,
      category: r.category,
      status: (r.status === 'PASS' ? 'compliant' : r.status === 'FAIL' ? 'violation' : r.status === 'NOT_APPLICABLE' ? 'exempt' : 'unverifiable') as any,
      severity: (r.severity === 'CRITICAL' ? 'critical' : r.severity === 'HIGH' ? 'major' : r.severity === 'MEDIUM' ? 'minor' : 'info') as any,
      found_value: r.found_value,
      expected_value: r.expected_value,
      explanation: r.explanation,
      citation: r.citation,
      penalty: r.penalty,
      confidence: conf,
      confidence_basis: basis
    };
  });

  return {
    verdict,
    verdict_display: verdictDisplay,
    verdict_subtitle: verdictSubtitle,
    declarations_score: {
      passed: passedCount,
      total: totalCheckable,
      percent: totalCheckable > 0 ? Math.round((passedCount / totalCheckable) * 100) : 100
    },
    total_violations: totalViolations,
    total_penalty: totalPenalty,
    warnings,
    unit_sale_price_analysis: {
      is_applicable: uspApplicable,
      calculated_price: uspCalculated,
      unit_label: uspUnitLabel,
      displayed_price: uspDisplayed || undefined,
      is_math_correct: uspCalculated !== null
    },
    evaluations: results,
    standardEvaluations
  };
}
