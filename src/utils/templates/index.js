import template1 from './template1';
import template2 from './template2';
import template3 from './template3';
import template4 from './template4';
import template5 from './template5';

export const TEMPLATES = [
  { id: 't1', name: 'Template 1', subtitle: 'Navy Professional', accent: '#1E3A5F', fn: template1 },
  { id: 't2', name: 'Template 2', subtitle: 'Gold Classic',      accent: '#B8860B', fn: template2 },
  { id: 't3', name: 'Template 3', subtitle: 'Green Structured',  accent: '#1B6B3A', fn: template3 },
  { id: 't4', name: 'Template 4', subtitle: 'Emerald Sidebar',   accent: '#059669', fn: template4 },
  { id: 't5', name: 'Template 5', subtitle: 'Thermal Receipt',   accent: '#000000', fn: template5 },
];

export function buildHTML(templateId, invoice, profile, accentColor) {
  const tpl   = TEMPLATES.find(t => t.id === templateId) || TEMPLATES[0];
  const color = accentColor || tpl.accent;
  return tpl.fn(invoice, profile, color);
}