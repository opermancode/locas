import template1 from './template1';
import template2 from './template2';
import template3 from './template3';
import template4 from './template4';
import template5 from './template5';
import template6 from './template6';
import { buildUPIQRBlock } from '../qr';

export const TEMPLATES = [
  { id: 't1', name: 'Classic',     subtitle: 'Left stripe · Navy',    accent: '#1E40AF', fn: template1 },
  { id: 't2', name: 'Bold Header', subtitle: 'Full band · Teal',      accent: '#0F766E', fn: template2 },
  { id: 't3', name: 'Elegant',     subtitle: 'Top strip · Purple',    accent: '#7C2D92', fn: template3 },
  { id: 't4', name: 'Dark Pro',    subtitle: 'Dark header · Orange',  accent: '#C2410C', fn: template4 },
  { id: 't5', name: 'Thermal',     subtitle: '58/80mm receipt',       accent: '#111111', fn: template5 },
  { id: 't6', name: 'Minimal Pro', subtitle: 'Corner accent · Blue',  accent: '#2563EB', fn: template6 },
];

export function buildHTML(templateId, invoice, profile, accentColor) {
  const tpl   = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
  const color = accentColor || tpl.accent;

  // Build UPI QR block if enabled
  const upiBlock = (profile?.show_upi_qr && profile?.upi_id)
    ? buildUPIQRBlock(profile.upi_id, profile.name || '', color)
    : '';

  return tpl.fn(invoice, profile, color, upiBlock);
}
