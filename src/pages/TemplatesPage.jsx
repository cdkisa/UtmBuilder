import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '../hooks/useToast';
import { Button, EmptyState, ComboInput, Input, Checkbox, Select } from '../components/UI';
import Modal from '../components/Modal';
import { exportToCsv, formatDate } from '../utils/utm';
import db from '../db';

export default function TemplatesPage() {
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState('');

  const templates = useLiveQuery(
    () => db.templates.toArray(),
    []
  ) || [];

  const filtered = templates.filter(t =>
    !search || t.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    const data = filtered.map(t => ({
      created_by: t.createdBy, created_at: t.createdAt, name: t.name,
      template_slug: t.slug || '', campaign: t.campaign, medium: t.medium,
      source: t.source, term: t.term, content: t.content,
    }));
    exportToCsv(data, `utm-templates-${Date.now()}.csv`);
    toast('Exported');
  };

  const handleDelete = async (id) => {
    if (confirm('Delete this template?')) {
      await db.templates.delete(id);
      toast('Template deleted');
    }
  };

  const handleDuplicate = async (tmpl) => {
    await db.templates.add({
      ...tmpl, id: undefined, name: tmpl.name + ' (copy)',
      createdAt: new Date().toISOString(),
    });
    toast('Template duplicated');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-display font-bold text-gray-900">
          UTM Templates
        </h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => toast('Import coming soon', 'info')}>Import templates via CSV</Button>
          <Button variant="secondary" size="sm" onClick={handleExport}>Export to CSV</Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Button onClick={() => { setEditItem(null); setShowCreate(true); }}>CREATE TEMPLATE</Button>
        <div className="flex-1 relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..."
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-400 pl-9" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left">
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs w-8"></th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Created By</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Created At</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Name</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Template Slug</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Campaign Name</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Medium</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Source</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Term</th>
              <th className="px-4 py-3 font-semibold text-gray-500 text-xs">Content</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => { setEditItem(t); setShowCreate(true); }} className="text-gray-400 hover:text-brand-600" title="Edit">✏️</button>
                    <button onClick={() => handleDuplicate(t)} className="text-gray-400 hover:text-brand-600" title="Duplicate">📄</button>
                    <button onClick={() => handleDelete(t.id)} className="text-gray-400 hover:text-red-500" title="Delete">🗑️</button>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">{t.createdBy}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(t.createdAt)}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{t.name}</td>
                <td className="px-4 py-3 text-gray-500">{t.slug}</td>
                <td className="px-4 py-3 text-gray-700">{t.campaign}</td>
                <td className="px-4 py-3 text-gray-700">{t.medium}</td>
                <td className="px-4 py-3 text-gray-700">{t.source}</td>
                <td className="px-4 py-3 text-gray-500">{t.term}</td>
                <td className="px-4 py-3 text-gray-500">{t.content}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <EmptyState icon="📄" message="No templates yet!" action={<Button onClick={() => setShowCreate(true)}>Create Template</Button>} />
        )}
      </div>

      <TemplateFormModal open={showCreate} onClose={() => { setShowCreate(false); setEditItem(null); }}
        editItem={editItem} />
    </div>
  );
}

function TemplateFormModal({ open, onClose, editItem }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [campaign, setCampaign] = useState('');
  const [medium, setMedium] = useState('');
  const [source, setSource] = useState('');
  const [term, setTerm] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [shortener, setShortener] = useState('none');
  const [isCommon, setIsCommon] = useState(false);

  const params = useLiveQuery(
    () => db.parameters.toArray(),
    []
  ) || [];

  useState(() => {
    if (editItem) {
      setName(editItem.name || '');
      setCampaign(editItem.campaign || '');
      setMedium(editItem.medium || '');
      setSource(editItem.source || '');
      setTerm(editItem.term || '');
      setContent(editItem.content || '');
      setIsCommon(editItem.isCommon || false);
    } else {
      setName(''); setCampaign(''); setMedium(''); setSource('');
      setTerm(''); setContent(''); setNotes(''); setShortener('none'); setIsCommon(false);
    }
  }, [editItem]);

  // Reset when editItem changes
  const handleOpen = () => {
    if (editItem) {
      setName(editItem.name || '');
      setCampaign(editItem.campaign || '');
      setMedium(editItem.medium || '');
      setSource(editItem.source || '');
      setTerm(editItem.term || '');
      setContent(editItem.content || '');
      setIsCommon(editItem.isCommon || false);
    }
  };

  // Use effect on open
  if (open && editItem && name === '' && editItem.name) {
    handleOpen();
  }

  const handleSave = async () => {
    if (!name.trim()) { toast('Template name is required', 'error'); return; }
    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const data = {
      name, slug, campaign, medium, source, term, content,
      shortener, isCommon, createdBy: 'Admin', createdAt: new Date().toISOString(),
    };
    if (editItem) {
      await db.templates.update(editItem.id, data);
      toast('Template updated');
    } else {
      await db.templates.add(data);
      toast('Template created');
    }
    setName(''); setCampaign(''); setMedium(''); setSource('');
    setTerm(''); setContent(''); setIsCommon(false);
    onClose();
  };

  const campaignOpts = params.filter(p => p.category === 'campaign').map(p => p.value);
  const mediumOpts = params.filter(p => p.category === 'medium').map(p => p.value);
  const sourceOpts = params.filter(p => p.category === 'source').map(p => p.value);

  return (
    <Modal open={open} onClose={onClose} title={editItem ? 'Edit Template' : 'Create Template'}>
      <Input label="Template Name" value={name} onChange={setName} required className="mb-5" />
      <hr className="my-4 border-gray-100" />
      <ComboInput label="campaign" value={campaign} onChange={setCampaign} options={campaignOpts}
        placeholder="e.g. holiday special, birthday promotion" className="mb-3" />
      <ComboInput label="medium" value={medium} onChange={setMedium} options={mediumOpts}
        placeholder="e.g. banner ad, email, social post" className="mb-3" />
      <ComboInput label="source" value={source} onChange={setSource} options={sourceOpts}
        placeholder="e.g. adwords, google, mailchimp" className="mb-3" />
      <ComboInput label="term" value={term} onChange={setTerm} options={[]}
        placeholder="Use to identify ppc keywords" className="mb-3" />
      <ComboInput label="content" value={content} onChange={setContent} options={[]}
        placeholder="Use to differentiate ads or words on a page" className="mb-3" />
      <Input label="notes" value={notes} onChange={setNotes} placeholder="Notes are saved in your dashboard" className="mb-3" />
      <Select label="Shortener" value={shortener} onChange={setShortener} className="mb-4"
        options={[{ value: 'none', label: "Don't shorten" }, { value: 'local', label: 'Local shortener' }]} />
      <Checkbox label="This is a common template, and should be added to all future workspaces" checked={isCommon} onChange={setIsCommon} className="mb-5" />
      <div className="flex gap-3">
        <Button onClick={handleSave}>Save Template</Button>
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
      </div>
    </Modal>
  );
}
