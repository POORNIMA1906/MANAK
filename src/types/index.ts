export type UserRole = 'officer' | 'consumer' | null;

export type AppScreen =
  // Shared
  | 'splash'
  | 'role_select'
  | 'ocr_extracting'
  | 'review_extraction'
  // Officer
  | 'officer_login'
  | 'officer_dashboard'
  | 'scan_camera'
  | 'check_url'
  | 'ocr_processing'
  | 'analysis_results'
  | 'inspection_report'
  | 'inspection_history'
  | 'compliance_chat'
  | 'manak_ai_offline'
  | 'officer_consumer_reports'
  | 'officer_profile'
  // Consumer
  | 'consumer_login'
  | 'consumer_dashboard'
  | 'consumer_check'
  | 'consumer_report'
  | 'consumer_confirm'
  | 'consumer_my_reports';

export type ProductSource = 'store' | 'ecommerce';

export interface Product {
  id: string;
  source_type: ProductSource;
  title: string;
  brand: string;
  category: string;
  barcode?: string;
  image_url?: string;
  images?: string[];
  ecommerce_platform?: 'amazon' | 'flipkart' | 'blinkit' | 'zepto' | null;
  ecommerce_url?: string;
  manufacturer_raw?: string;
}

export interface ExtractionField<T = string> {
  value: T | null;
  source: 'ocr' | 'dom' | 'secondary' | 'manual';
  confidence: number;
}

export interface ExtractionResult {
  manufacturer: ExtractionField<string>;
  generic_name: ExtractionField<string>;
  net_quantity: ExtractionField<{ amount: number; unit: string }>;
  mrp: ExtractionField<{ amount: number; raw_text: string; is_inclusive_taxes: boolean }>;
  mfg_date: ExtractionField<string>;
  expiry_date?: ExtractionField<string>;
  consumer_care: ExtractionField<{ phone?: string; email?: string; address?: string }>;
  country_of_origin: ExtractionField<string>;
  numeral_height_mm: {
    value: number | null;
    reference_detected: boolean;
    note?: string;
  };
  raw_ocr_text: string;
  detected_regions?: Array<{
    field: string;
    text: string;
    confidence: number;
  }>;
}

export type EvaluationChannel = 'physical_label' | 'online_listing';

export interface ComplianceRule {
  rule_id: string;
  rule_source: string;
  category: string;
  requirement_name: string;
  check_type: 'presence' | 'format' | 'numeric_range' | 'custom';
  severity_default: 'critical' | 'major' | 'minor';
  penalty_amount: number;
  legal_citation: string;
  explanation_template: string;
  online_required?: boolean;
  exemption_rule?: string;
  verification_note?: string;
}

export interface RuleEvaluation {
  rule_id: string;
  rule_source: string;
  requirement_name: string;
  category: string;
  status: 'compliant' | 'violation' | 'unverifiable' | 'exempt';
  severity: 'critical' | 'major' | 'minor' | 'info';
  found_value: string | null;
  expected_value: string;
  explanation: string;
  citation: string;
  penalty: number;
  confidence?: number;
  confidence_basis?: string;
}

export interface InspectionRecord {
  id: string;
  product: Product;
  performed_by: {
    id: string;
    name: string;
    badge_id: string;
    role: UserRole;
    zone: string;
  };
  mode: 'scan' | 'url_check';
  status: 'verified' | 'provisional' | 'failed';
  geo: {
    lat: number;
    lng: number;
    address: string;
  };
  timestamp: string;
  evidence_image: string;
  evidence_hash: string;
  extraction: ExtractionResult;
  evaluations: RuleEvaluation[];
  is_compliant: boolean;
  total_violations: number;
  total_penalty: number;
  is_signed: boolean;
  signature_details?: {
    signed_by: string;
    timestamp: string;
    provider: 'documenso' | 'digilocker' | 'local';
    certificate_id: string;
  };
  report_id?: string;
  synced: boolean;
}

export interface ConsumerReport {
  id: string;
  reference_id: string;
  inspection_id: string;
  product_name: string;
  brand: string;
  product_image: string;
  violations_summary: string[];
  consumer_note?: string;
  submitted_at: string;
  status: 'submitted' | 'officer_assigned' | 'under_review' | 'action_taken' | 'dismissed';
  assigned_officer?: string;
  officer_remark?: string;
}
