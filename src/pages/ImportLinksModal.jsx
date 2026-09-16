import { useState } from 'react';
import Modal from '../components/Modal';
import { Button } from '../components/UI';
import { useToast } from '../hooks/useToast';
import { useLinkPolicy } from '../hooks/useLinks';
import { parseCsvText } from '../utils/utm';
import { composeLink, saveLinks } from '../links';

export default function ImportLinksModal({ open, onClose }) {

  const toast = useToast();
  const [file, setFile] = useState(null);
  const policy = useLinkPolicy();

  const handleFile = (e) => {
    setFile(e.target.files[0]);
  };

  const handleImport = async () => {
    if (!file) { toast('Choose a CSV file first', 'error'); return; }
    const text = await file.text();
    const rows = parseCsvText(text);
    if (rows.length === 0) { toast('No rows found in CSV', 'error'); return; }

    const drafts = [];
    const skipped = [];

    for (const [index, row] of rows.entries()) {
      // A row's own UTM columns win over anything already on the URL (ADR-0002).
      const destination = row.full_url || row.url || row.URL || '';
      if (!destination) continue;

      const result = composeLink(
        {
          destination,
          utm: {
            campaign: row.utm_campaign || row.campaign || '',
            medium: row.utm_medium || row.medium || '',
            source: row.utm_source || row.source || '',
            term: row.utm_term || row.term || '',
            content: row.utm_content || row.content || '',
          },
          customParameters: [],
          attributes: {},
          templateId: null,
          shortener: null,
          notes: row.notes || '',
          author: 'Import',
        },
        policy,
      );

      if (!result.ok) {
        skipped.push(index + 2);
        continue;
      }

      drafts.push({ ...result.draft, shortUrl: row.short_url || '' });
    }

    if (drafts.length === 0) { toast('No importable rows found', 'error'); return; }

    await saveLinks(drafts);

    toast(
      skipped.length > 0
        ? `Imported ${drafts.length} links, skipped ${skipped.length}`
        : `Imported ${drafts.length} links`,
    );
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
