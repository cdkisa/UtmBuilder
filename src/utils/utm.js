import { nanoid } from 'nanoid';

export function buildUtmUrl(baseUrl, params, customParams = [], spaceChar = '-') {
  if (!baseUrl) return '';

  let url = baseUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  const utmMap = {
    campaign: 'utm_campaign',
    medium: 'utm_medium',
    source: 'utm_source',
    term: 'utm_term',
    content: 'utm_content',
  };

  const separator = spaceChar === 'hyphen' ? '-' : spaceChar === 'underscore' ? '_' : '+';
  const queryParts = [];

  for (const [key, utmKey] of Object.entries(utmMap)) {
    if (params[key]) {
      const val = params[key].replace(/\s+/g, separator);
      queryParts.push(`${utmKey}=${encodeURIComponent(val)}`);
    }
  }

  for (const cp of customParams) {
    if (cp.name && cp.value) {
      queryParts.push(`${encodeURIComponent(cp.name)}=${encodeURIComponent(cp.value)}`);
    }
  }

  if (queryParts.length === 0) return url;

  const hasQuery = url.includes('?');
  return url + (hasQuery ? '&' : '?') + queryParts.join('&');
}

export function generateShortCode() {
  return nanoid(7);
}

export function parseUtmFromUrl(fullUrl) {
  try {
    const url = new URL(fullUrl);
    return {
      campaign: url.searchParams.get('utm_campaign') || '',
      medium: url.searchParams.get('utm_medium') || '',
      source: url.searchParams.get('utm_source') || '',
      term: url.searchParams.get('utm_term') || '',
      content: url.searchParams.get('utm_content') || '',
    };
  } catch {
    return { campaign: '', medium: '', source: '', term: '', content: '' };
  }
}

export function exportToCsv(data, filename) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => {
    const val = String(row[h] ?? '');
    return val.includes(',') || val.includes('"') || val.includes('\n')
      ? `"${val.replace(/"/g, '""')}"`
      : val;
  }).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function parseCsvText(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const vals = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { vals.push(current.trim()); current = ''; }
      else { current += char; }
    }
    vals.push(current.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  }
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day}${suffix} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}
