import template1 from './template1';
import template2 from './template2';
import template3 from './template3';
import template4 from './template4';
import template5 from './template5';

export const TEMPLATES = [
  { id: 't1', name: 'Template 1', subtitle: 'Clean Blue',    accent: '#2563EB', fn: template1 },
  { id: 't2', name: 'Template 2', subtitle: 'Saffron Bold',  accent: '#FF6B00', fn: template2 },
  { id: 't3', name: 'Template 3', subtitle: 'Dark Slate',    accent: '#111827', fn: template3 },
  { id: 't4', name: 'Template 4', subtitle: 'Emerald Green', accent: '#059669', fn: template4 },
  { id: 't5', name: 'Template 5', subtitle: 'Thermal Print', accent: '#000000', fn: template5 },
];

export function buildHTML(templateId, invoice, profile) {
  const tpl = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
  return tpl.fn(invoice, profile);
}
