import { InspectionRecord, ConsumerReport } from '../types';

/**
 * Compress and resize an image for Gemini Vision OCR and local storage.
 * - Max 1600px on longest side (optimal resolution for text OCR within HTTP payload bounds)
 * - JPEG quality 0.85 (high text crispness)
 * Returns a data URL.
 */
export function compressImage(
  dataUrl: string,
  maxDim = 1600,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;
      let w = width;
      let h = height;

      // Scale down only if needed — don't upscale
      if (w > maxDim || h > maxDim) {
        if (w >= h) {
          h = Math.round((h / w) * maxDim);
          w = maxDim;
        } else {
          w = Math.round((w / h) * maxDim);
          h = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      // White background before drawing (avoids transparency issues)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });
}

export const DEFAULT_COMMODITY_IMAGE = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';

export function getCategoryFallbackImage(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('soap') || t.includes('bath') || t.includes('detergent') || t.includes('wash') || t.includes('cleaner')) {
    return 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=600&auto=format&fit=crop&q=80';
  }
  if (t.includes('creatine') || t.includes('protein') || t.includes('nutraceutical') || t.includes('supplement') || t.includes('powder')) {
    return 'https://images.unsplash.com/photo-1579722821273-0f6c7d44362f?w=600&auto=format&fit=crop&q=80';
  }
  if (t.includes('nacho') || t.includes('namkeen') || t.includes('chip') || t.includes('snack') || t.includes('kurkure') || t.includes('lays')) {
    return 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=600&auto=format&fit=crop&q=80';
  }
  if (t.includes('biscuit') || t.includes('cookie') || t.includes('parle') || t.includes('bakery') || t.includes('confectionery')) {
    return 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=600&auto=format&fit=crop&q=80';
  }
  if (t.includes('tea') || t.includes('coffee') || t.includes('chai')) {
    return 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&auto=format&fit=crop&q=80';
  }
  if (t.includes('atta') || t.includes('flour') || t.includes('wheat') || t.includes('grain') || t.includes('rice') || t.includes('dal')) {
    return 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600&auto=format&fit=crop&q=80';
  }
  if (t.includes('serum') || t.includes('hair') || t.includes('shampoo') || t.includes('oil') || t.includes('cosmetic') || t.includes('lotion')) {
    return 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&auto=format&fit=crop&q=80';
  }
  return DEFAULT_COMMODITY_IMAGE;
}

/**
 * Resolves the display image for any inspection record.
 * Guarantees a valid, high-quality image is ALWAYS returned:
 * 1. Primary captured camera photo / product image URL
 * 2. Evidence image stored on the record
 * 3. Array of images
 * 4. Categorized commodity package image (so alphabet stubs are never displayed)
 */
export function getRecordImage(record?: Partial<InspectionRecord> | null): string {
  if (!record) return DEFAULT_COMMODITY_IMAGE;

  // 1. Direct product image URL
  if (record.product?.image_url && typeof record.product.image_url === 'string' && record.product.image_url.trim().length > 5) {
    return record.product.image_url.trim();
  }

  // 2. Camera evidence image stored on the inspection
  if (record.evidence_image && typeof record.evidence_image === 'string' && record.evidence_image.trim().length > 5) {
    return record.evidence_image.trim();
  }

  // 3. Product images array
  if (record.product?.images && Array.isArray(record.product.images) && record.product.images.length > 0) {
    const first = record.product.images[0];
    if (first && typeof first === 'string' && first.trim().length > 5) {
      return first.trim();
    }
  }

  // 4. Fallback based on commodity title or category
  const title = `${record.product?.title || ''} ${record.extraction?.generic_name?.value || ''}`;
  return getCategoryFallbackImage(title);
}

/**
 * Resolves the display image for any consumer report.
 * Guarantees a valid, high-quality image is ALWAYS returned.
 */
export function getConsumerReportImage(
  report?: Partial<ConsumerReport> | null,
  inspections?: InspectionRecord[]
): string {
  if (!report) return DEFAULT_COMMODITY_IMAGE;

  // 1. Direct product image on the report
  if (report.product_image && typeof report.product_image === 'string' && report.product_image.trim().length > 5) {
    return report.product_image.trim();
  }

  // 2. Look up matching inspection if available
  if (inspections && inspections.length > 0 && report.inspection_id) {
    const matchingInspection = inspections.find(
      i => i.id === report.inspection_id || i.report_id === report.inspection_id
    );
    if (matchingInspection) {
      const inspImg = getRecordImage(matchingInspection);
      if (inspImg && inspImg !== DEFAULT_COMMODITY_IMAGE) {
        return inspImg;
      }
    }
  }

  // 3. Fallback based on product name and brand
  const info = `${report.product_name || ''} ${report.brand || ''}`;
  return getCategoryFallbackImage(info);
}
