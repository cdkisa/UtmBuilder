import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '../hooks/useToast';
import { Button, EmptyState, Input, Select, Checkbox } from '../components/UI';
import Modal from '../components/Modal';
import { exportToCsv } from '../utils/utm';
import db from '../db';

const CATEGORIES = ['campaign', 'medium', 'source', 'term', 'content'];

const CATEGORY_GUIDANCE = {
  campaign: "Product promotion or strategic campaign (e.g. summer_sale).",
  medium: "This specifies the acquisition method (e.g. cpc, email, social).",
  source: "The referrer or platform sending traffic (e.g. google, facebook).",
  term: "Keywords used for paid search campaigns.",
  content: "Differentiate ads/links pointing to the same URL (e.g. logolink)."
};

export default function ParametersPage() {
  const toast = useToast();
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [editParam, setEditParam] = useState(null);
  const [search, setSearch] = useState('');
  const [addingTo, setAddingTo] = useState('');
  const [newValue, setNewValue] = useState('');

  const params = useLiveQuery(
    () => db.parameters.toArray(),
    []
  ) || [];

  const customParamDefs = useLiveQuery(
    () => db.customParameters.toArray(),
    []
  ) || [];

  const grouped = {};
  for (const cat of CATEGORIES) {
    grouped[cat] = params.filter(p => p.category === cat && (!search || p.value.toLowerCase().includes(search.toLowerCase())));
  }

  // Custom param groups
  for (const cpd of customParamDefs) {
    grouped[cpd.fieldName] = params.filter(p => p.category === cpd.fieldName && (!search || p.value.toLowerCase().includes(search.toLowerCase())));
  }

  const handleAddValue = async (category) => {
    if (!newValue.trim()) return;
    await db.parameters.add({ category, value: newValue.trim(), prettyName: '' });
    toast(`Added "${newValue.trim()}" to ${category}`);
    setNewValue('');
    setAddingTo('');
  };

  const handleEditParam = (param) => {
    setEditParam(param);
  };

  const handleSaveEdit = async (id, value, prettyName) => {
    await db.parameters.update(id, { value, prettyName });
    setEditParam(null);
    toast('Parameter updated');
  };

  const handleDeleteParam = async (id) => {
    await db.parameters.delete(id);
    toast('Parameter removed');
  };

  const handleDeleteCustomDef = async (id, fieldName) => {
    if (!confirm(`Delete custom parameter "${fieldName}" and all its values?`)) return;
    await db.customParameters.delete(id);
    await db.parameters.where('category').equals(fieldName).delete();
    toast('Custom parameter deleted');
  };

  const handleExport = () => {
    const data = params.map(p => ({ category: p.category, value: p.value, pretty_name: p.prettyName || '' }));
    exportToCsv(data, `utm-parameters-${Date.now()}.csv`);
    toast('Exported');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-baseline gap-4">
          <h1 className="text-xl font-display font-bold text-gray-900">Parameters</h1>
          <a href="https://labs.google.com/pomelli/about/" target="_blank" rel="noopener noreferrer" className="text-sm text-brand-600 hover:text-brand-700 hover:underline font-medium">Learn about Pomelli</a>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => toast('Import coming soon', 'info')}>Import Parameters via CSV</Button>
          <Button variant="secondary" size="sm" onClick={handleExport}>Export to CSV</Button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <Button onClick={() => setShowAddCustom(true)}>ADD CUSTOM URL PARAMETER</Button>
        <div className="flex-1 relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parameters..."
            className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-400 pl-9" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        </div>
      </div>

      {/* Parameter columns */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Object.entries(grouped).map(([category, values]) => {
          const customDef = customParamDefs.find(d => d.fieldName === category);
          const headerGuidance = CATEGORY_GUIDANCE[category] || customDef?.description;

          return (
            <div key={category} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-gray-800">{category}</h3>
                  {!CATEGORIES.includes(category) && (
                    <button onClick={() => {
                      if (customDef) handleDeleteCustomDef(customDef.id, category);
                    }} className="text-xs text-gray-400 hover:text-red-500" title="Delete custom parameter" aria-label="Delete">⋮</button>
                  )}
                </div>
                {headerGuidance && (
                  <p className="mt-1.5 text-[11px] text-gray-500 leading-tight">
                    {headerGuidance}
                  </p>
                )}
              </div>
              <div className="divide-y divide-gray-50">
                {values.map(p => (
                  <div key={p.id} className="px-4 py-2.5 flex items-center justify-between group hover:bg-gray-50/50">
                    <span className="text-sm text-gray-700">{p.value}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={() => handleEditParam(p)} className="text-xs text-gray-400 hover:text-brand-600">✏️</button>
                      <button onClick={() => handleDeleteParam(p.id)} className="text-xs text-gray-400 hover:text-red-500">✕</button>
                    </div>
                  </div>
                ))}
              </div>
              {addingTo === category ? (
                <div className="px-3 py-2 flex gap-2">
                  <input value={newValue} onChange={e => setNewValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddValue(category); if (e.key === 'Escape') { setAddingTo(''); setNewValue(''); } }}
                    placeholder={`New ${category} value`} autoFocus
                    className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-400" />
                  <button onClick={() => handleAddValue(category)}
                    className="px-3 py-1.5 bg-brand-500 text-white text-xs font-semibold rounded-lg hover:bg-brand-600">Add</button>
                  <button onClick={() => { setAddingTo(''); setNewValue(''); }}
                    className="px-2 py-1.5 text-gray-400 hover:text-gray-600 text-xs">&times;</button>
                </div>
              ) : (
                <button onClick={() => { setAddingTo(category); setNewValue(''); }}
                  className="w-full px-4 py-2.5 text-xs text-brand-600 font-medium hover:bg-brand-50 transition text-left">
                  + Add another {category}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit param modal */}
      {editParam && (
        <ParamSettingsModal param={editParam} onClose={() => setEditParam(null)} onSave={handleSaveEdit} />
      )}

      <AddCustomParamModal open={showAddCustom} onClose={() => setShowAddCustom(false)} />
    </div>
  );
}

function ParamSettingsModal({ param, onClose, onSave }) {
  const [value, setValue] = useState(param.value);
  const [prettyName, setPrettyName] = useState(param.prettyName || '');

  return (
    <Modal open={true} onClose={onClose} title={`${param.category} Settings`} width="max-w-sm">
      <Input label="Parameter name" value={param.category} onChange={() => { }} disabled className="mb-3" />
      <Input label="Parameter value" value={value} onChange={setValue} required className="mb-3" />
      <Input label="Pretty name" value={prettyName} onChange={setPrettyName} className="mb-5" />
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        <Button onClick={() => onSave(param.id, value, prettyName)}>SAVE</Button>
      </div>
    </Modal>
  );
}

function AddCustomParamModal({ open, onClose }) {
  const toast = useToast();
  const [fieldName, setFieldName] = useState('');
  const [description, setDescription] = useState('');
  const [fieldType, setFieldType] = useState('Freeform (Default)');
  const [isCommon, setIsCommon] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const handleAdd = async () => {
    if (!fieldName.trim()) { toast('Field name is required', 'error'); return; }
    await db.customParameters.add({
      fieldName: fieldName.trim().toLowerCase(),
      description: description.trim(),
      fieldType, isCommon,
    });
    toast('Custom parameter added');
    setFieldName(''); setDescription(''); setFieldType('Freeform (Default)'); setIsCommon(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add new custom parameter" width="max-w-sm">
      <Input label="Field name" value={fieldName} onChange={setFieldName} required className="mb-4" />
      <Input label="Description (optional)" value={description} onChange={setDescription} placeholder="What is this used for?" className="mb-4" />
      <div className="mb-4">
        <label className="block text-xs font-semibold text-brand-600 mb-1">
          <span className="text-red-500 mr-0.5">*</span>Parameter type
        </label>
        <div className="relative">
          <button onClick={() => setShowTypeDropdown(!showTypeDropdown)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-left bg-white flex items-center justify-between">
            {fieldType}
            <span className="text-gray-400">▾</span>
          </button>
          {showTypeDropdown && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1">
              {['Freeform (Default)', 'Number', 'Date'].map(t => (
                <button key={t} onClick={() => { setFieldType(t); setShowTypeDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-brand-50 ${t === fieldType ? 'font-semibold' : ''}`}>
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <Checkbox label="This is a common parameter, and should be added to all future workspaces" checked={isCommon} onChange={setIsCommon} className="mb-5" />
      <div className="flex justify-end">
        <Button onClick={handleAdd}>Add parameter</Button>
      </div>
    </Modal>
  );
}
