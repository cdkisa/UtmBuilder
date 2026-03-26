import { useState } from 'react';
import Modal from '../components/Modal';
import { Button } from '../components/UI';
import { useWorkspace } from '../hooks/useWorkspace';
import { useToast } from '../hooks/useToast';
import { parseCsvText, buildUtmUrl } from '../utils/utm';
import db from '../db';

export default function ImportLinksModal({ open, onClose }) {
  const { settings } = useWorkspace();
  const toast = useToast();
  const [file, setFile] = useState(null);

  const handleFile = (e) => {
    setFile(e.target.files[0]);
  };

  const handleImport = async () => {
    if (!file) { toast('Choose a CSV file first', 'error'); return; }
    const text = await file.text();
    const rows = parseCsvText(text);
    if (rows.length === 0) { toast('No rows found in CSV', 'error'); return; }

    let count = 0;
    for (const row of rows) {
      const url = row.full_url || row.url || row.URL || '';
      if (!url) continue;
      const campaign = row.utm_campaign || row.campaign || '';
      const medium = row.utm_medium || row.medium || '';
      const source = row.utm_source || row.source || '';
      const term = row.utm_term || row.term || '';
      const content = row.utm_content || row.content || '';
      const notes = row.notes || '';
      const shortUrl = row.short_url || '';

      const fullUrl = buildUtmUrl(url, { campaign, medium, source, term, content }, [], settings?.spaceChar || 'hyphen');

      await db.links.add({
        url, fullUrl, shortUrl,
        campaign, medium, source, term, content,
        templateId: null, notes, createdBy: 'Import',
        createdAt: new Date().toISOString(),
      });
      count++;
    }

    toast(`Imported ${count} links`);
    setFile(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Import Links">
      <p className="text-sm text-gray-600 mb-3">
        Migrate your short URLs from another platform. The Import Link feature allows you to bulk import links from a .csv file.
      </p>
      <p className="text-xs text-gray-500 mb-2">The file format must specify the following fields as headers of columns:</p>
      <code className="block bg-gray-50 px-3 py-2 rounded text-xs text-gray-700 mb-4 font-mono">
        full_url,short_url,utm_source,utm_campaign,utm_medium,utm_term,utm_content,notes
      </code>
      <p className="text-xs text-gray-400 mb-4">
        Currently, this feature does not support generating bulk UTM links, short URLs, or editing of existing links.
      </p>

      <div className="mb-5">
        <label className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 text-sm text-gray-700">
          <span>📁</span> Choose the file to import
          <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </label>
        {file && <span className="ml-3 text-sm text-gray-600">{file.name}</span>}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleImport} disabled={!file}>Continue</Button>
        <button onClick={() => {
          const tpl = 'full_url,short_url,utm_source,utm_campaign,utm_medium,utm_term,utm_content,notes\nhttps://example.com,,google,summer-sale,cpc,brand,hero-banner,Example link';
          const blob = new Blob([tpl], { type: 'text/csv' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'utm-import-template.csv';
          link.click();
        }} className="text-sm text-blue-600 hover:text-blue-700">
          Download a template for CSV import file
        </button>
      </div>
    </Modal>
  );
}
