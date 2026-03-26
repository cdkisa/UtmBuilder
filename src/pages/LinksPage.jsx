import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '../hooks/useToast';
import { Button, EmptyState, Badge } from '../components/UI';
import Modal from '../components/Modal';
import CreateLinkModal from './CreateLinkModal';
import ImportLinksModal from './ImportLinksModal';
import { exportToCsv, copyToClipboard, formatDate } from '../utils/utm';
import db from '../db';
import QRCode from 'qrcode';

export default function LinksPage() {
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState('single');
  const [showImport, setShowImport] = useState(false);
  const [qrLink, setQrLink] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ campaign: '', medium: '', source: '', term: '', content: '' });

  const links = useLiveQuery(
    () => db.links.reverse().toArray()
  ) || [];

  const filtered = links.filter(l => {
    if (search) {
      const s = search.toLowerCase();
      const match = [l.url, l.fullUrl, l.campaign, l.medium, l.source, l.term, l.content, l.notes]
        .some(v => v && String(v).toLowerCase().includes(s));
      if (!match) return false;
    }
    for (const [key, val] of Object.entries(filters)) {
      if (val) {
        const linkVal = String(l[key] ?? '').toLowerCase();
        if (!linkVal.includes(val.trim().toLowerCase())) return false;
      }
    }
    return true;
  });

  const grouped = groupBy ? filtered.reduce((acc, l) => {
    const key = l[groupBy] || '(empty)';
    if (!acc[key]) acc[key] = [];
    acc[key].push(l);
    return acc;
  }, {}) : { all: filtered };

  const handleExport = () => {
    const data = filtered.map(l => ({
      created_by: l.createdBy, created_at: l.createdAt, short_url: l.shortUrl || '',
      full_url: l.fullUrl || '', campaign: l.campaign, medium: l.medium,
      source: l.source, term: l.term, content: l.content, notes: l.notes || '', url: l.url,
    }));
    exportToCsv(data, `utm-links-${Date.now()}.csv`);
    toast('Exported to CSV');
  };

  const handleDelete = (id) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await db.links.delete(deleteId);
      toast('Link deleted');
      setDeleteId(null);
    }
  };

  const handleDuplicate = async (link) => {
    const now = new Date().toISOString();
    const { id: _omit, qrCode, qrDataUrl, ...linkData } = link;
    const newLink = {
      ...linkData,
      shortUrl: '',
      createdAt: now,
    };
    const newId = await db.links.add(newLink);
    const [customParams, attrRows] = await Promise.all([
      db.linkCustomParams.where('linkId').equals(link.id).toArray(),
      db.linkAttributes.where('linkId').equals(link.id).toArray(),
    ]);
    await Promise.all([
      ...customParams.map(cp => db.linkCustomParams.add({ linkId: newId, paramName: cp.paramName, paramValue: cp.paramValue })),
      ...attrRows.map(ar => db.linkAttributes.add({ linkId: newId, attributeId: ar.attributeId, value: ar.value })),
    ]);
    toast('Link duplicated');
  };

  const openCreate = (mode) => {
    setCreateMode(mode);
    setShowCreate(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-display font-bold text-gray-900">
          Activity History
        </h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>Import Links via CSV</Button>
          <Button variant="secondary" size="sm" onClick={handleExport}>Export to CSV</Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <Button onClick={() => openCreate('single')}>CREATE LINK</Button>
        <div className="relative">
          <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="">GROUP BY</option>
            <option value="campaign">Campaign</option>
            <option value="medium">Medium</option>
            <option value="source">Source</option>
            <option value="createdBy">Created By</option>
          </select>
        </div>
        <div className="flex-1 relative">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search links..."
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-400 pl-9" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          {showFilters ? '▲' : '▼'}
        </button>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {['campaign', 'medium', 'source', 'term', 'content'].map(key => (
            <div key={key}>
              <label className="text-xs font-semibold text-brand-600 mb-1 block capitalize">{key}</label>
              <input value={filters[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })}
                placeholder={key} className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none" />
            </div>
          ))}
          <div className="flex items-end gap-2">
            <button onClick={() => setFilters({ campaign: '', medium: '', source: '', term: '', content: '' })}
              className="text-xs text-gray-500 hover:text-gray-700">Clear filter</button>
            <Button size="sm" onClick={() => setShowFilters(false)}>Search</Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Created By</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Created At</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Template</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Clicks</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Short URL</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Full URL</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Campaign</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Medium</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Source</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Term</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Content</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Notes</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([group, items]) => (
              items.length === 0 ? null : (
                <GroupRows key={group} group={group} items={items} showGroup={groupBy !== ''}
                  onCopy={async (link) => { await copyToClipboard(link.shortUrl || link.fullUrl); toast('Copied!'); }}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onQR={(link) => setQrLink(link)} />
              )
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <EmptyState icon="🔗" message="No Links created yet!"
            action={<Button onClick={() => openCreate('single')}>Build UTM Link</Button>} />
        )}
      </div>

      <div className="mt-3 text-xs text-gray-400">{filtered.length} records</div>

      <CreateLinkModal open={showCreate} onClose={() => setShowCreate(false)} mode={createMode} />
      <ImportLinksModal open={showImport} onClose={() => setShowImport(false)} />
      <QRFromLinkModal link={qrLink} onClose={() => setQrLink(null)} />

      <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Delete Link" width="max-w-sm">
        <p className="text-sm text-gray-600 mb-5">Are you sure you want to delete this link? This action cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" onClick={confirmDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

function GroupRows({ group, items, showGroup, onCopy, onDuplicate, onDelete, onQR }) {
  return (
    <>
      {showGroup && (
        <tr><td colSpan={13} className="px-4 py-2 bg-brand-50 font-semibold text-brand-700 text-xs">{group}</td></tr>
      )}
      {items.map(l => (
        <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
          <td className="px-4 py-3 text-gray-700">{l.createdBy}</td>
          <td className="px-4 py-3 text-gray-500">{formatDate(l.createdAt)}</td>
          <td className="px-4 py-3">{l.templateId ? <Badge>Template</Badge> : ''}</td>
          <td className="px-4 py-3 text-gray-500">-</td>
          <td className="px-4 py-3 text-brand-600 text-xs font-mono max-w-[140px] truncate">{l.shortUrl}</td>
          <td className="px-4 py-3 text-xs font-mono max-w-[220px] truncate" title={l.fullUrl}>{l.fullUrl}</td>
          <td className="px-4 py-3 text-gray-700">{l.campaign}</td>
          <td className="px-4 py-3 text-gray-700">{l.medium}</td>
          <td className="px-4 py-3 text-gray-700">{l.source}</td>
          <td className="px-4 py-3 text-gray-500">{l.term}</td>
          <td className="px-4 py-3 text-gray-500">{l.content}</td>
          <td className="px-4 py-3 text-gray-400 max-w-[120px] truncate">{l.notes}</td>
          <td className="px-4 py-3">
            <div className="flex gap-1">
              <button onClick={() => onQR(l)} className="text-brand-500 hover:text-brand-700 text-xs" title="Generate QR Code">⊞</button>
              <button onClick={() => onCopy(l)} className="text-brand-500 hover:text-brand-700 text-xs" title="Copy">📋</button>
              <button onClick={() => onDuplicate(l)} className="text-brand-500 hover:text-brand-700 text-xs" title="Duplicate">⎘</button>
              <button onClick={() => onDelete(l.id)} className="text-red-400 hover:text-red-600 text-xs" title="Delete">🗑️</button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

function QRFromLinkModal({ link, onClose }) {
  const toast = useToast();
  const [qrDataUrl, setQrDataUrl] = useState('');

  const targetUrl = link?.shortUrl || link?.fullUrl || '';

  useEffect(() => {
    if (!targetUrl) { setQrDataUrl(''); return; }
    QRCode.toDataURL(targetUrl, { width: 300, margin: 2, color: { dark: '#000000', light: '#FFFFFF' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [targetUrl]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `qr-${link.campaign || 'link'}.png`;
    a.click();
  };

  const handleSaveToLink = async () => {
    if (!qrDataUrl || !link?.id) return;
    await db.links.update(link.id, { qrCode: true, qrDataUrl });
    toast('QR code saved to link');
  };

  return (
    <Modal open={!!link} onClose={onClose} title="QR Code" width="max-w-sm">
      <div className="flex flex-col items-center gap-4">
        <p className="text-xs text-gray-500 break-all text-center font-mono w-full">{targetUrl}</p>
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="QR Code" className="w-[220px] h-[220px] rounded-lg border border-gray-200" />
        ) : (
          <div className="w-[220px] h-[220px] rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
            Generating...
          </div>
        )}
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={handleDownload}>Download PNG</Button>
          <Button size="sm" onClick={handleSaveToLink}>Save to Link</Button>
        </div>
      </div>
    </Modal>
  );
}
