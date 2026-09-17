import { supabase } from '../lib/supabase';
import { InspectionRecord, ConsumerReport, Product, ExtractionResult, RuleEvaluation } from '../types';

/**
 * Ensures a string is a valid UUID or converts it to a standard UUID v4 format.
 */
export function ensureUUID(id?: string): string {
  if (!id) return crypto.randomUUID();
  // Standard UUID v4 regex
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;

  // Hash string into valid UUID format
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `${hex.slice(0, 8)}-4000-8000-0000-${hex.padEnd(12, '0').slice(0, 12)}`;
}

/**
 * Saves inspection record directly to Supabase tables (products, inspections, violations).
 */
export async function saveInspectionDirectToSupabase(record: InspectionRecord): Promise<boolean> {
  try {
    const productId = ensureUUID(record.product?.id);
    const inspectionId = ensureUUID(record.id);

    // 1. Insert/Upsert Product
    if (record.product) {
      const { error: prodErr } = await supabase.from('products').upsert({
        id: productId,
        source_type: record.product.source_type || (record.mode === 'url_check' ? 'ecommerce' : 'store'),
        ecommerce_platform: record.product.ecommerce_platform || null,
        ecommerce_url: record.product.ecommerce_url || null,
        title: record.product.title || 'Packaged Product',
        brand: record.product.brand || null,
        category: record.product.category || 'Retail Commodity',
        image_url: record.product.image_url || record.evidence_image || null
      });
      if (prodErr) console.warn('[Supabase Direct] Product upsert warning:', prodErr.message);
    }

    // 2. Insert Inspection
    const { error: inspErr } = await supabase.from('inspections').upsert({
      id: inspectionId,
      product_id: productId,
      mode: record.mode || 'scan',
      status: record.status || 'verified',
      geo_lat: record.geo?.lat || null,
      geo_lng: record.geo?.lng || null,
      address: record.geo?.address || null,
      evidence_image: record.evidence_image || record.product?.image_url || null,
      evidence_hash: record.evidence_hash || null,
      extraction_result: record.extraction || {},
      compliance_result: {
        evaluations: record.evaluations || [],
        is_compliant: record.is_compliant,
        total_violations: record.total_violations,
        total_penalty: record.total_penalty
      },
      is_compliant: record.is_compliant ?? false,
      total_violations: record.total_violations || 0,
      total_penalty: record.total_penalty || 0,
      is_signed: record.is_signed ?? true,
      report_id: record.report_id || null,
      synced_at: new Date().toISOString()
    });

    if (inspErr) {
      console.warn('[Supabase Direct] Inspection insert warning:', inspErr.message);
      return false;
    }

    // 3. Insert Violations breakdown
    if (record.evaluations && record.evaluations.length > 0) {
      const violationRows = record.evaluations
        .filter(e => e.status === 'violation')
        .map(e => ({
          id: crypto.randomUUID(),
          inspection_id: inspectionId,
          rule_id: e.rule_id,
          requirement_name: e.requirement_name,
          severity: e.severity || 'major',
          status: e.status,
          expected: e.expected_value || null,
          found: e.found_value || null,
          explanation: e.explanation || null,
          rule_citation: e.citation || null,
          penalty: e.penalty || 2000
        }));

      if (violationRows.length > 0) {
        const { error: violErr } = await supabase.from('violations').insert(violationRows);
        if (violErr) console.warn('[Supabase Direct] Violations insert warning:', violErr.message);
      }
    }

    console.log(`[Supabase Direct] Inspection ${inspectionId} saved to database successfully.`);
    return true;
  } catch (err) {
    console.error('[Supabase Direct] Failed to save inspection:', (err as Error).message);
    return false;
  }
}

/**
 * Saves consumer report directly to Supabase table.
 */
export async function saveConsumerReportDirectToSupabase(report: ConsumerReport): Promise<boolean> {
  try {
    const reportId = ensureUUID(report.id);
    const { error } = await supabase.from('consumer_reports').upsert({
      id: reportId,
      reference_id: report.reference_id,
      product_name: report.product_name,
      brand: report.brand || null,
      product_image: report.product_image || null,
      violations_summary: report.violations_summary || [],
      consumer_note: report.consumer_note || null,
      status: report.status || 'submitted',
      assigned_officer: report.assigned_officer || 'Legal Metrology Division',
      created_at: report.submitted_at || new Date().toISOString()
    });

    if (error) {
      console.warn('[Supabase Direct] Consumer report insert warning:', error.message);
      return false;
    }
    console.log(`[Supabase Direct] Consumer report ${report.reference_id} saved to database successfully.`);
    return true;
  } catch (err) {
    console.error('[Supabase Direct] Consumer report error:', (err as Error).message);
    return false;
  }
}

/**
 * Fetches inspection history directly from Supabase.
 */
export async function fetchHistoryDirectFromSupabase(): Promise<InspectionRecord[]> {
  try {
    const { data, error } = await supabase
      .from('inspections')
      .select('*, product:products(*)')
      .order('device_timestamp', { ascending: false });

    if (error || !data) {
      console.warn('[Supabase Direct] Fetch history warning:', error?.message);
      return [];
    }

    return data.map((row: any) => mapSupabaseRowToInspectionRecord(row));
  } catch (err) {
    console.error('[Supabase Direct] Fetch history error:', (err as Error).message);
    return [];
  }
}

/**
 * Fetches consumer reports directly from Supabase.
 */
export async function fetchConsumerReportsDirectFromSupabase(): Promise<ConsumerReport[]> {
  try {
    const { data, error } = await supabase
      .from('consumer_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.warn('[Supabase Direct] Fetch consumer reports warning:', error?.message);
      return [];
    }

    return data.map((row: any) => ({
      id: row.id,
      reference_id: row.reference_id,
      inspection_id: row.inspection_id || `insp-${row.id.slice(0, 6)}`,
      product_name: row.product_name,
      brand: row.brand || 'Generic',
      product_image: row.product_image || '',
      violations_summary: row.violations_summary || [],
      consumer_note: row.consumer_note || '',
      submitted_at: row.created_at ? new Date(row.created_at).toISOString().replace('T', ' ').substring(0, 19) : new Date().toISOString(),
      status: row.status || 'submitted',
      assigned_officer: row.assigned_officer || 'Legal Metrology Division',
      officer_remark: row.officer_remark || undefined
    }));
  } catch (err) {
    console.error('[Supabase Direct] Fetch consumer reports error:', (err as Error).message);
    return [];
  }
}

/**
 * Helper to transform Supabase Postgres row to app InspectionRecord.
 */
export function mapSupabaseRowToInspectionRecord(row: any): InspectionRecord {
  const prod = row.product || {};
  const extraction: ExtractionResult = row.extraction_result || {};
  const compliance = row.compliance_result || {};

  return {
    id: row.id,
    product: {
      id: prod.id || row.product_id || `prod-${row.id.slice(0, 6)}`,
      source_type: prod.source_type || (row.mode === 'url_check' ? 'ecommerce' : 'store'),
      title: prod.title || extraction.generic_name?.value || 'Inspected Commodity',
      brand: prod.brand || extraction.manufacturer?.value?.split(',')[0] || 'Manufacturer',
      category: prod.category || 'Retail Commodity',
      ecommerce_platform: prod.ecommerce_platform || undefined,
      ecommerce_url: prod.ecommerce_url || undefined,
      image_url: prod.image_url || row.evidence_image || undefined
    },
    performed_by: {
      id: 'usr-officer-01',
      name: 'Enforcement Official',
      badge_id: 'LM-OFFICER-01',
      role: 'officer',
      zone: 'Legal Metrology Division'
    },
    mode: row.mode || 'scan',
    status: row.status || 'verified',
    geo: {
      lat: Number(row.geo_lat) || 28.6139,
      lng: Number(row.geo_lng) || 77.2090,
      address: row.address || 'Field Audit Location'
    },
    timestamp: row.device_timestamp ? new Date(row.device_timestamp).toISOString().replace('T', ' ').substring(0, 19) : new Date().toISOString(),
    evidence_image: row.evidence_image || prod.image_url || '',
    evidence_hash: row.evidence_hash || `sha256-${row.id.slice(0, 8)}`,
    extraction,
    evaluations: compliance.evaluations || [],
    is_compliant: row.is_compliant ?? true,
    total_violations: row.total_violations || 0,
    total_penalty: Number(row.total_penalty) || 0,
    is_signed: row.is_signed ?? true,
    signature_details: {
      signed_by: 'Officer (DSC)',
      timestamp: row.synced_at || new Date().toISOString(),
      provider: 'documenso',
      certificate_id: `DSC-IN-LM-${row.id.slice(0, 6)}`
    },
    report_id: row.report_id || `MANAK-REP-2026-${row.id.slice(0, 5)}`,
    synced: true
  };
}
