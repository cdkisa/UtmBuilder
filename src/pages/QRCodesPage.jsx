import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useWorkspace } from '../hooks/useWorkspace';
import { useToast } from '../hooks/useToast';
import { Button, EmptyState, ComboInput, Input, Select, Checkbox } from '../components/UI';
import Modal from '../components/Modal';
import { buildUtmUrl, formatDate, exportToCsv, copyToClipboard } from '../utils/utm';
import db from '../db';
import QRCode from 'qrcode';
import QRCodeStyling from 'qr-code-styling';

export default function QRCodesPage() {
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [showDesign, setShowDesign] = useState(false);
  const [showEditDesign, setShowEditDesign] = useState(false);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const links = useLiveQuery(
    () => db.links.filter(l => l.qrCode).toArray(),
    []
  ) || [];

  const filtered = links.filter(l =>
    !search || [l.url, l.campaign, l.source].some(v => v && v.toLowerCase().includes(search.toLowerCase()))
  );

  const handleExport = () => {
    const data = filtered.map(l => ({
      created_by: l.createdBy, created_at: l.createdAt, url: l.url,
      campaign: l.campaign, medium: l.medium, source: l.source,
    }));
    exportToCsv(data, `utm-qrcodes-${Date.now()}.csv`);
    toast('Exported');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-display font-bold text-gray-900">Custom QR Codes</h1>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Button onClick={() => setShowCreate(true)}>CREATE QR CODE</Button>
        <Button variant="secondary" onClick={() => setShowDesign(true)}>DESIGN QR TEMPLATE</Button>
        <Button variant="secondary" onClick={() => setShowEditDesign(true)}>EDIT QR TEMPLATE</Button>
        <div className="flex-1 relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-400 pl-9" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          {showFilters ? '▲' : '▼'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Created By</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Created At</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Template</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Short URL</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Clicks</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Full URL</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Campaign</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Medium</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Source</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">QR</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3 text-gray-700">{l.createdBy}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(l.createdAt)}</td>
                <td className="px-4 py-3 text-gray-500">{l.templateId || '-'}</td>
                <td className="px-4 py-3 text-brand-600 text-xs font-mono">{l.shortUrl}</td>
                <td className="px-4 py-3 text-gray-500">-</td>
                <td className="px-4 py-3 text-xs font-mono max-w-[200px] truncate">{l.fullUrl}</td>
                <td className="px-4 py-3 text-gray-700">{l.campaign}</td>
                <td className="px-4 py-3 text-gray-700">{l.medium}</td>
                <td className="px-4 py-3 text-gray-700">{l.source}</td>
                <td className="px-4 py-3">
                  {l.qrDataUrl && <img src={l.qrDataUrl} alt="QR" className="w-10 h-10" />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <EmptyState icon="⊞" message="No QR Codes created yet!"
            action={<Button onClick={() => setShowCreate(true)}>Build UTM Link</Button>} />
        )}
      </div>

      <CreateQRModal open={showCreate} onClose={() => setShowCreate(false)} />
      <DesignQRModal open={showDesign} onClose={() => setShowDesign(false)} />
      <EditQRTemplateModal open={showEditDesign} onClose={() => setShowEditDesign(false)} />
    </div>
  );
}

function CreateQRModal({ open, onClose }) {
  const { settings } = useWorkspace();
  const toast = useToast();

  const [mode, setMode] = useState('new');
  const [selectedLinkId, setSelectedLinkId] = useState('');
  const [linkSearch, setLinkSearch] = useState('');
  const [url, setUrl] = useState('');
  const [campaign, setCampaign] = useState('');
  const [medium, setMedium] = useState('');
  const [source, setSource] = useState('');
  const [term, setTerm] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [shortener, setShortener] = useState('none');
  const [qrDesignId, setQrDesignId] = useState('');
  const [qrPreview, setQrPreview] = useState('');

  const existingLinks = useLiveQuery(
    () => db.links.reverse().toArray(),
    []
  ) || [];

  const templates = useLiveQuery(
    () => db.templates.toArray(),
    []
  ) || [];

  const qrTemplates = useLiveQuery(
    () => db.qrTemplates.toArray(),
    []
  ) || [];

  const params = useLiveQuery(
    () => db.parameters.toArray(),
    []
  ) || [];

  const filteredLinks = existingLinks.filter(l => {
    if (!linkSearch) return true;
    const s = linkSearch.toLowerCase();
    return [l.url, l.fullUrl, l.campaign, l.medium, l.source].some(v => v && v.toLowerCase().includes(s));
  });

  // When an existing link is selected, populate all fields
  useEffect(() => {
    if (mode !== 'existing' || !selectedLinkId) return;
    const link = existingLinks.find(l => l.id === Number(selectedLinkId));
    if (link) {
      setUrl(link.url || '');
      setCampaign(link.campaign || '');
      setMedium(link.medium || '');
      setSource(link.source || '');
      setTerm(link.term || '');
      setContent(link.content || '');
      setNotes(link.notes || '');
    }
  }, [selectedLinkId, mode, existingLinks]);

  const spaceChar = settings?.spaceChar || 'hyphen';
  const targetUrl = mode === 'existing' && selectedLinkId
    ? (() => { const l = existingLinks.find(lk => lk.id === Number(selectedLinkId)); return l?.shortUrl || l?.fullUrl || ''; })()
    : '';
  const generatedUrl = mode === 'new'
    ? buildUtmUrl(url, { campaign, medium, source, term, content }, [], spaceChar)
    : targetUrl;

  useEffect(() => {
    if (generatedUrl) {
      const qrTmpl = qrTemplates.find(t => t.id === Number(qrDesignId));
      const opts = {
        width: 200,
        margin: 2,
        color: {
          dark: qrTmpl?.codeColor || '#000000',
          light: qrTmpl?.bgColor || '#FFFFFF',
        },
      };
      QRCode.toDataURL(generatedUrl, opts).then(setQrPreview).catch(() => setQrPreview(''));
    } else {
      setQrPreview('');
    }
  }, [generatedUrl, qrDesignId, qrTemplates]);

  useEffect(() => {
    if (templateId) {
      const tmpl = templates.find(t => t.id === Number(templateId));
      if (tmpl) {
        if (tmpl.campaign) setCampaign(tmpl.campaign);
        if (tmpl.medium) setMedium(tmpl.medium);
        if (tmpl.source) setSource(tmpl.source);
        if (tmpl.term) setTerm(tmpl.term);
        if (tmpl.content) setContent(tmpl.content);
      }
    }
  }, [templateId, templates]);

  const reset = () => {
    setMode('new'); setSelectedLinkId(''); setLinkSearch('');
    setUrl(''); setCampaign(''); setMedium(''); setSource(''); setTerm(''); setContent('');
    setNotes(''); setTemplateId(''); setShortener('none'); setQrDesignId(''); setQrPreview('');
  };

  const handleSave = async () => {
    if (mode === 'existing') {
      if (!selectedLinkId) { toast('Select a link first', 'error'); return; }

      const qrTmpl = qrTemplates.find(t => t.id === Number(qrDesignId));
      const opts = {
        width: 400, margin: 2,
        color: { dark: qrTmpl?.codeColor || '#000000', light: qrTmpl?.bgColor || '#FFFFFF' },
      };
      let qrDataUrl = '';
      try {
        qrDataUrl = await QRCode.toDataURL(generatedUrl, opts);
      } catch (e) {
        toast('Failed to generate QR code', 'error');
        return;
      }

      await db.links.update(Number(selectedLinkId), {
        qrCode: true, qrDataUrl, qrDesignId: qrDesignId ? Number(qrDesignId) : null,
      });

      await copyToClipboard(generatedUrl);
      toast('QR Code added to existing link');
    } else {
      if (!url) { toast('URL is required', 'error'); return; }

      const qrTmpl = qrTemplates.find(t => t.id === Number(qrDesignId));
      const opts = {
        width: 400, margin: 2,
        color: { dark: qrTmpl?.codeColor || '#000000', light: qrTmpl?.bgColor || '#FFFFFF' },
      };
      let qrDataUrl = '';
      try {
        qrDataUrl = await QRCode.toDataURL(generatedUrl || url, opts);
      } catch (e) {
        toast('Failed to generate QR code', 'error');
        return;
      }

      await db.links.add({
        url, fullUrl: generatedUrl, shortUrl: '',
        campaign, medium, source, term, content,
        templateId: templateId ? Number(templateId) : null,
        notes, createdBy: 'Admin', createdAt: new Date().toISOString(),
        qrCode: true, qrDataUrl, qrDesignId: qrDesignId ? Number(qrDesignId) : null,
      });

      await copyToClipboard(generatedUrl);
      toast('QR Code created and link copied');
    }

    reset();
    onClose();
  };

  const campaignOpts = params.filter(p => p.category === 'campaign').map(p => p.value);
  const mediumOpts = params.filter(p => p.category === 'medium').map(p => p.value);
  const sourceOpts = params.filter(p => p.category === 'source').map(p => p.value);

  const selectedLink = mode === 'existing' && selectedLinkId
    ? existingLinks.find(l => l.id === Number(selectedLinkId))
    : null;

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Create QR Code" width="max-w-2xl">
      {/* Mode tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => { setMode('new'); setSelectedLinkId(''); }}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${mode === 'new' ? 'bg-brand-500 text-white' : 'text-gray-600 hover:text-gray-800'}`}>
          New Link
        </button>
        <button onClick={() => setMode('existing')}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${mode === 'existing' ? 'bg-brand-500 text-white' : 'text-gray-600 hover:text-gray-800'}`}>
          Existing Link
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-6">
        <div>
          {mode === 'existing' ? (
            <>
              {/* Search & select existing link */}
              <div className="mb-3">
                <label className="block text-xs font-semibold text-brand-600 mb-1">
                  <span className="text-red-500 mr-0.5">*</span>Select a Link
                </label>
                <input value={linkSearch} onChange={e => setLinkSearch(e.target.value)}
                  placeholder="Search links by URL, campaign, source..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-400 mb-2" />
                <div className="border border-gray-200 rounded-lg max-h-[200px] overflow-y-auto">
                  {filteredLinks.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-gray-400 text-center">No links found</p>
                  ) : (
                    filteredLinks.map(l => (
                      <button key={l.id} onClick={() => setSelectedLinkId(String(l.id))}
                        className={`w-full text-left px-3 py-2.5 text-sm border-b border-gray-50 last:border-0 transition hover:bg-brand-50 ${
                          selectedLinkId === String(l.id) ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700'
                        }`}>
                        <span className="block text-xs font-mono text-gray-500 truncate">{l.shortUrl || l.fullUrl}</span>
                        <span className="flex gap-2 mt-0.5 text-xs text-gray-400">
                          {l.campaign && <span>{l.campaign}</span>}
                          {l.medium && <span>{l.medium}</span>}
                          {l.source && <span>{l.source}</span>}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Show selected link details */}
              {selectedLink && (
                <div className="p-3 bg-gray-50 rounded-lg mb-3">
                  <p className="text-xs font-semibold text-gray-600 mb-1">Selected Link</p>
                  <p className="text-xs font-mono text-brand-700 break-all">{selectedLink.shortUrl || selectedLink.fullUrl}</p>
                  <div className="flex gap-3 mt-1.5 text-xs text-gray-500">
                    {selectedLink.campaign && <span>Campaign: {selectedLink.campaign}</span>}
                    {selectedLink.medium && <span>Medium: {selectedLink.medium}</span>}
                    {selectedLink.source && <span>Source: {selectedLink.source}</span>}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <Input label="URL" value={url} onChange={setUrl} required className="mb-3" />
              <div className="mb-3">
                <label className="block text-xs font-semibold text-brand-600 mb-1">Template</label>
                <div className="flex gap-2">
                  <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none bg-white">
                    <option value="">Select template...</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {templateId && (
                    <button onClick={() => setTemplateId('')} className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500">CLEAR</button>
                  )}
                </div>
              </div>
              <ComboInput label="campaign" value={campaign} onChange={setCampaign} options={campaignOpts}
                placeholder="e.g. holiday special" className="mb-3" />
              <ComboInput label="medium" value={medium} onChange={setMedium} options={mediumOpts}
                placeholder="e.g. social" className="mb-3" />
              <ComboInput label="source" value={source} onChange={setSource} options={sourceOpts}
                placeholder="e.g. facebook" className="mb-3" />
              <ComboInput label="term" value={term} onChange={setTerm} options={[]} placeholder="ppc keywords" className="mb-3" />
              <ComboInput label="content" value={content} onChange={setContent} options={[]} placeholder="differentiate ads" className="mb-3" />
              <Input label="notes" value={notes} onChange={setNotes} className="mb-3" />
              <Select label="Shortener" value={shortener} onChange={setShortener} className="mb-4"
                options={[{ value: 'none', label: "Don't shorten" }, { value: 'local', label: 'Local shortener' }]} />
            </>
          )}

          <Select label="QR Code Design" value={qrDesignId} onChange={setQrDesignId} className="mb-3"
            placeholder="No Template"
            options={qrTemplates.map(t => ({ value: String(t.id), label: t.name }))} />
        </div>

        <div className="flex flex-col items-center gap-3">
          {qrPreview ? (
            <img src={qrPreview} alt="QR Preview" className="w-[180px] h-[180px] rounded-lg border border-gray-200" />
          ) : (
            <div className="w-[180px] h-[180px] rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
              Preview
            </div>
          )}
          {qrPreview && (
            <button onClick={() => {
              const a = document.createElement('a');
              a.href = qrPreview;
              a.download = 'qrcode.png';
              a.click();
            }} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
              Download QR
            </button>
          )}
        </div>
      </div>

      {generatedUrl && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-brand-700 break-all font-mono">{generatedUrl}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 mt-5">
        <Button variant="secondary" onClick={() => { reset(); onClose(); }}>Cancel</Button>
        <Button onClick={handleSave}>
          {mode === 'existing' ? 'Generate & Save' : 'Copy & Save'}
        </Button>
      </div>
    </Modal>
  );
}

const DOT_TYPES = ['square', 'rounded', 'dots', 'extra-rounded', 'classy', 'classy-rounded'];
const PATTERN_SVGS = [
  <svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="4" height="4"/><rect x="9" y="2" width="4" height="4"/><rect x="16" y="2" width="4" height="4"/><rect x="2" y="9" width="4" height="4"/><rect x="16" y="9" width="4" height="4"/><rect x="2" y="16" width="4" height="4"/><rect x="9" y="16" width="4" height="4"/><rect x="16" y="16" width="4" height="4"/></svg>,
  <svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="4" height="4" rx="1"/><rect x="9" y="2" width="4" height="4" rx="1"/><rect x="16" y="2" width="4" height="4" rx="1"/><rect x="2" y="9" width="4" height="4" rx="1"/><rect x="16" y="9" width="4" height="4" rx="1"/><rect x="2" y="16" width="4" height="4" rx="1"/><rect x="9" y="16" width="4" height="4" rx="1"/><rect x="16" y="16" width="4" height="4" rx="1"/></svg>,
  <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="4" cy="4" r="2.2"/><circle cx="11" cy="4" r="2.2"/><circle cx="18" cy="4" r="2.2"/><circle cx="4" cy="11" r="2.2"/><circle cx="18" cy="11" r="2.2"/><circle cx="4" cy="18" r="2.2"/><circle cx="11" cy="18" r="2.2"/><circle cx="18" cy="18" r="2.2"/></svg>,
  <svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="2" width="4" height="4" rx="2"/><rect x="9" y="2" width="4" height="4" rx="2"/><rect x="16" y="2" width="4" height="4" rx="2"/><rect x="2" y="9" width="4" height="4" rx="2"/><rect x="16" y="9" width="4" height="4" rx="2"/><rect x="2" y="16" width="4" height="4" rx="2"/><rect x="9" y="16" width="4" height="4" rx="2"/><rect x="16" y="16" width="4" height="4" rx="2"/></svg>,
  <svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="4" width="4" height="4"/><rect x="9" y="2" width="4" height="4"/><rect x="16" y="4" width="4" height="4"/><rect x="2" y="9" width="4" height="4"/><rect x="16" y="9" width="4" height="4"/><rect x="2" y="16" width="4" height="4"/><rect x="9" y="16" width="4" height="4"/><rect x="16" y="16" width="4" height="4"/></svg>,
  <svg viewBox="0 0 24 24" fill="currentColor"><rect x="2" y="4" width="4" height="4" rx="1"/><rect x="9" y="2" width="4" height="4" rx="1"/><rect x="16" y="4" width="4" height="4" rx="1"/><rect x="2" y="9" width="4" height="4" rx="1"/><rect x="16" y="9" width="4" height="4" rx="1"/><rect x="2" y="16" width="4" height="4" rx="1"/><rect x="9" y="16" width="4" height="4" rx="1"/><rect x="16" y="16" width="4" height="4" rx="1"/></svg>,
];

const CORNER_CONFIGS = [
  { squareType: 'square', dotType: 'square' },
  { squareType: 'square', dotType: 'dot' },
  { squareType: 'extra-rounded', dotType: 'square' },
  { squareType: 'dot', dotType: 'dot' },
  { squareType: 'square', dotType: 'dot' },
  { squareType: 'extra-rounded', dotType: 'dot' },
  { squareType: 'dot', dotType: 'square' },
];
const CORNER_SVGS = [
  <svg viewBox="0 0 28 28" fill="currentColor"><rect x="1" y="1" width="26" height="26" rx="0" stroke="currentColor" strokeWidth="4" fill="none"/><rect x="8" y="8" width="12" height="12"/></svg>,
  <svg viewBox="0 0 28 28" fill="currentColor"><rect x="1" y="1" width="26" height="26" rx="0" stroke="currentColor" strokeWidth="4" fill="none"/><circle cx="14" cy="14" r="5"/></svg>,
  <svg viewBox="0 0 28 28" fill="currentColor"><rect x="1" y="1" width="26" height="26" rx="8" stroke="currentColor" strokeWidth="4" fill="none"/><rect x="8" y="8" width="12" height="12" rx="2"/></svg>,
  <svg viewBox="0 0 28 28" fill="currentColor"><circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="4" fill="none"/><circle cx="14" cy="14" r="5"/></svg>,
  <svg viewBox="0 0 28 28" fill="currentColor"><rect x="1" y="1" width="26" height="26" rx="4" stroke="currentColor" strokeWidth="4" fill="none"/><circle cx="14" cy="14" r="5"/></svg>,
  <svg viewBox="0 0 28 28" fill="currentColor"><rect x="1" y="1" width="26" height="26" rx="8" stroke="currentColor" strokeWidth="4" fill="none"/><circle cx="14" cy="14" r="5"/></svg>,
  <svg viewBox="0 0 28 28" fill="currentColor"><circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="4" fill="none"/><rect x="8" y="8" width="12" height="12" rx="2"/></svg>,
];

const COLOR_TYPES = ['Single Color', 'Linear Gradient', 'Radial Gradient'];

function makeColorOpts(type, c1, c2) {
  if (type === 'Single Color') return { color: c1 };
  return {
    gradient: {
      type: type === 'Linear Gradient' ? 'linear' : 'radial',
      colorStops: [{ offset: 0, color: c1 }, { offset: 1, color: c2 }],
    },
  };
}

function ColorPicker({ label, colorType, setColorType, color1, setColor1, color2, setColor2 }) {
  const [showDropdown, setShowDropdown] = useState(false);
  return (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-brand-600 mb-1">{label}</label>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <button onClick={() => setShowDropdown(!showDropdown)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-left bg-white flex items-center gap-1 min-w-[140px] justify-between">
            {colorType} <span className="text-gray-400 text-xs">▾</span>
          </button>
          {showDropdown && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[160px]">
              {COLOR_TYPES.map(t => (
                <button key={t} onClick={() => { setColorType(t); setShowDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 ${t === colorType ? 'font-semibold' : ''}`}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
        <input type="color" value={color1} onChange={e => setColor1(e.target.value)}
          className="w-8 h-8 rounded border border-gray-200 cursor-pointer" />
        <span className="text-xs text-gray-600 font-mono">{color1}</span>
      </div>
      {colorType !== 'Single Color' && (
        <div className="flex items-center gap-2 mt-2 ml-[156px]">
          <input type="color" value={color2} onChange={e => setColor2(e.target.value)}
            className="w-8 h-8 rounded border border-gray-200 cursor-pointer" />
          <span className="text-xs text-gray-600 font-mono">{color2}</span>
        </div>
      )}
    </div>
  );
}

function DesignQRModal({ open, onClose }) {
  const toast = useToast();
  const previewRef = useRef(null);
  const [name, setName] = useState('');
  const [pattern, setPattern] = useState(0);
  const [corners, setCorners] = useState(0);
  const [codeColor, setCodeColor] = useState('#000000');
  const [codeColor2, setCodeColor2] = useState('#7C3AED');
  const [codeColorType, setCodeColorType] = useState('Single Color');
  const [bgColor, setBgColor] = useState('#FFFFFF');
  const [bgColor2, setBgColor2] = useState('#F3F4F6');
  const [bgColorType, setBgColorType] = useState('Single Color');
  const [logoDataUrl, setLogoDataUrl] = useState(null);
  const [isCommon, setIsCommon] = useState(false);

  useEffect(() => {
    if (!previewRef.current || !open) return;
    previewRef.current.innerHTML = '';

    const cornerCfg = CORNER_CONFIGS[corners] || CORNER_CONFIGS[0];
    const codeOpts = makeColorOpts(codeColorType, codeColor, codeColor2);
    const bgOpts = makeColorOpts(bgColorType, bgColor, bgColor2);

    const qr = new QRCodeStyling({
      width: 200,
      height: 200,
      data: 'https://example.com',
      dotsOptions: { type: DOT_TYPES[pattern] || 'square', ...codeOpts },
      cornersSquareOptions: { type: cornerCfg.squareType, ...codeOpts },
      cornersDotOptions: { type: cornerCfg.dotType, ...codeOpts },
      backgroundOptions: bgOpts,
      imageOptions: { crossOrigin: 'anonymous', margin: 4 },
      ...(logoDataUrl ? { image: logoDataUrl } : {}),
    });

    qr.append(previewRef.current);
  }, [open, pattern, corners, codeColor, codeColor2, codeColorType, bgColor, bgColor2, bgColorType, logoDataUrl]);

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast('Template name is required', 'error'); return; }
    try {
      await db.qrTemplates.add({
        name, pattern, corners,
        codeColor, codeColor2, codeColorType,
        bgColor, bgColor2, bgColorType,
        logoDataUrl, isCommon,
      });
      toast('QR template saved');
      setName(''); setPattern(0); setCorners(0);
      setCodeColor('#000000'); setCodeColor2('#7C3AED'); setCodeColorType('Single Color');
      setBgColor('#FFFFFF'); setBgColor2('#F3F4F6'); setBgColorType('Single Color');
      setLogoDataUrl(null); setIsCommon(false);
      onClose();
    } catch (e) {
      toast('Failed to save QR template', 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Customize QR Code" width="max-w-2xl">
      <Input label="Template Name" value={name} onChange={setName} required placeholder="e.g. Brand QR, Dark Theme" className="mb-5" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-brand-600 mb-2">Pattern</label>
            <div className="flex gap-2 flex-wrap">
              {PATTERN_SVGS.map((svg, i) => (
                <button key={i} onClick={() => setPattern(i)}
                  className={`w-12 h-12 rounded border-2 flex items-center justify-center p-1.5 transition ${pattern === i ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  {svg}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-brand-600 mb-2">Corners</label>
            <div className="flex gap-2 flex-wrap">
              {CORNER_SVGS.map((svg, i) => (
                <button key={i} onClick={() => setCorners(i)}
                  className={`w-12 h-12 rounded border-2 flex items-center justify-center p-1.5 transition ${corners === i ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  {svg}
                </button>
              ))}
            </div>
          </div>

          <ColorPicker label="Code Color" colorType={codeColorType} setColorType={setCodeColorType}
            color1={codeColor} setColor1={setCodeColor} color2={codeColor2} setColor2={setCodeColor2} />

          <ColorPicker label="Background Color" colorType={bgColorType} setColorType={setBgColorType}
            color1={bgColor} setColor1={setBgColor} color2={bgColor2} setColor2={setBgColor2} />

          <div className="mb-4">
            <label className="block text-xs font-semibold text-brand-600 mb-1">Add Logo</label>
            <div className="flex items-center gap-3">
              <label className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm cursor-pointer hover:bg-gray-50 inline-flex items-center gap-1.5">
                Upload
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
              </label>
              {logoDataUrl && (
                <>
                  <img src={logoDataUrl} alt="Logo" className="w-8 h-8 rounded object-contain border border-gray-200" />
                  <button onClick={() => setLogoDataUrl(null)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                </>
              )}
            </div>
          </div>

          <Checkbox label="This is a common QR code design"
            checked={isCommon} onChange={setIsCommon} className="mb-4" />
        </div>

        <div className="flex flex-col items-center gap-4">
          <div ref={previewRef} className="w-[200px] h-[200px] rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center bg-white" data-testid="qr-preview" />
        </div>
      </div>

      <div className="flex justify-end mt-5">
        <Button onClick={handleSave}>ADD QR CODE DESIGN</Button>
      </div>
    </Modal>
  );
}

function EditQRTemplateModal({ open, onClose }) {
  const toast = useToast();

  const qrTemplates = useLiveQuery(
    () => db.qrTemplates.toArray(),
    []
  ) || [];

  const handleDelete = async (id) => {
    if (!confirm('Delete this QR template?')) return;
    await db.qrTemplates.delete(id);
    toast('QR template deleted');
  };

  return (
    <Modal open={open} onClose={onClose} title="QR Code Templates" width="max-w-md">
      {qrTemplates.length === 0 ? (
        <p className="text-sm text-gray-500 py-4">No QR templates yet. Design one first.</p>
      ) : (
        <div className="space-y-2">
          {qrTemplates.map(t => (
            <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded" style={{ background: t.codeColor }}></div>
                <span className="text-sm font-medium text-gray-800">{t.name}</span>
              </div>
              <button onClick={() => handleDelete(t.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
