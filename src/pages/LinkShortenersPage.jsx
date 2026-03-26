import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '../hooks/useToast';
import { Button, EmptyState, Input, Badge } from '../components/UI';
import Modal from '../components/Modal';
import { exportToCsv } from '../utils/utm';
import db from '../db';

export default function LinkShortenersPage() {
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const shorteners = useLiveQuery(
    () => db.shorteners.toArray(),
    []
  ) || [];

  const filtered = shorteners.filter(s =>
    !search || (s.domain || s.type).toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id) => {
    if (!confirm('Remove this shortener?')) return;
    await db.shorteners.delete(id);
    toast('Shortener removed');
  };

  const handleToggle = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Disabled' : 'Active';
    await db.shorteners.update(id, { status: newStatus });
    toast(`Shortener ${newStatus.toLowerCase()}`);
  };

  const handleExport = () => {
    const data = filtered.map(s => ({
      type: s.type, domain: s.domain || '', status: s.status,
      default_redirect: s.defaultRedirect || '',
    }));
    exportToCsv(data, `utm-shorteners-${Date.now()}.csv`);
    toast('Exported');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-display font-bold text-gray-900">Link Shorteners</h1>
        <Button variant="secondary" size="sm" onClick={handleExport}>Export to CSV</Button>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Button onClick={() => setShowAdd(true)}>ADD LINK SHORTENER</Button>
        <div className="flex-1 relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-400 pl-9" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs w-10"></th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Link Shorteners</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Status</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Default Redirect</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Workspaces</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => handleDelete(s.id)} className="text-gray-400 hover:text-red-500 text-xs">🗑️</button>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{s.domain || s.type}</td>
                <td className="px-4 py-3">
                  <Badge color={s.status === 'Active' ? 'green' : 'gray'}>{s.status}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-500">{s.defaultRedirect || '-'}</td>
                <td className="px-4 py-3 text-gray-500">All</td>
                <td className="px-4 py-3">
                  <Button variant="secondary" size="sm"
                    onClick={() => handleToggle(s.id, s.status)}>
                    {s.status === 'Active' ? 'Disable' : 'Enable'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <EmptyState icon="✂️" message="No link shorteners configured yet!"
            action={<Button onClick={() => setShowAdd(true)}>Add Link Shortener</Button>} />
        )}
      </div>
      <div className="mt-3 text-xs text-gray-400">{filtered.length} records</div>

      <AddShortenerModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}

function AddShortenerModal({ open, onClose }) {
  const toast = useToast();
  const [step, setStep] = useState('choose');
  const [domain, setDomain] = useState('');
  const [defaultRedirect, setDefaultRedirect] = useState('');

  const handleAddLocal = async () => {
    await db.shorteners.add({
      type: 'local', domain: 'short.local',
      defaultRedirect: '', status: 'Active',
    });
    toast('Local shortener added');
    onClose();
    setStep('choose');
  };

  const handleAddCustom = async () => {
    if (!domain.trim()) { toast('Domain is required', 'error'); return; }
    await db.shorteners.add({
      type: 'custom', domain: domain.trim(),
      defaultRedirect: defaultRedirect.trim(), status: 'Active',
    });
    toast('Custom domain shortener added');
    setDomain(''); setDefaultRedirect('');
    onClose();
    setStep('choose');
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={() => { onClose(); setStep('choose'); }} title="Add New Link Shortener" width="max-w-lg">
      {step === 'choose' ? (
        <div className="flex gap-3 justify-center py-4">
          <Button onClick={() => setStep('custom')}>Custom Branded Domain</Button>
          <Button onClick={handleAddLocal}>Local Shortener (Offline)</Button>
        </div>
      ) : (
        <div>
          <p className="text-sm text-gray-600 mb-4">Configure a custom branded domain for your short links. Note: since this app runs offline, the domain won't actually resolve, but URLs will be generated with your branded domain.</p>
          <Input label="Domain" value={domain} onChange={setDomain} placeholder="Enter Branded Domain" required className="mb-3" />
          <Input label="Default Redirect" value={defaultRedirect} onChange={setDefaultRedirect} placeholder="Default Redirect URL" className="mb-5" />
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setStep('choose')}>Back</Button>
            <Button onClick={handleAddCustom}>Next</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
