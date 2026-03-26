import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useToast } from '../hooks/useToast';
import { Button, EmptyState, Input, Checkbox } from '../components/UI';
import Modal from '../components/Modal';
import { exportToCsv } from '../utils/utm';
import db from '../db';

export default function AttributesPage() {
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [menuOpenId, setMenuOpenId] = useState(null);

  const attributes = useLiveQuery(
    () => db.attributes.toArray(),
    []
  ) || [];

  const filtered = attributes.filter(a =>
    !search || a.fieldName.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id) => {
    setMenuOpenId(null);
    if (!confirm('Delete this attribute?')) return;
    await db.attributes.delete(id);
    await db.linkAttributes.where('attributeId').equals(id).delete();
    toast('Attribute deleted');
  };

  const handleExport = () => {
    const data = filtered.map(a => ({
      field_name: a.fieldName,
      field_type: a.fieldType,
      ...(a.fieldType === 'Date' && a.dateFormat ? { date_format: a.dateFormat } : {}),
      ...(a.fieldType === 'Freeform (Default)' ? { allow_multiple_values: true } : {}),
      is_common: a.isCommon,
    }));
    exportToCsv(data, `utm-attributes-${Date.now()}.csv`);
    toast('Exported');
  };

  return (
    <div>
      {/* Header: title + ADD ATTRIBUTE + search */}
      <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-display font-bold text-gray-900">
          Your first workspace Attributes
        </h1>
        <div className="flex items-center gap-3 flex-1 sm:max-w-md">
          <Button onClick={() => setShowAdd(true)}>ADD ATTRIBUTE</Button>
          <div className="flex-1 relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search attributes..."
              className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-400 bg-[#F0F4F8] pl-9"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          </div>
        </div>
      </div>

      {/* Secondary actions */}
      <div className="flex gap-2 mb-4">
        <Button variant="secondary" size="sm" onClick={() => toast('Import coming soon', 'info')}>
          Import Attributes via CSV
        </Button>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          Export to CSV
        </Button>
      </div>

      {/* Attribute cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(a => (
          <AttributeCard
            key={a.id}
            attribute={a}
            menuOpen={menuOpenId === a.id}
            onMenuToggle={() => setMenuOpenId(menuOpenId === a.id ? null : a.id)}
            onDelete={() => handleDelete(a.id)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon="🏷️"
          message="No attributes created yet!"
          action={<Button onClick={() => setShowAdd(true)}>Add Attribute</Button>}
        />
      )}

      <AddAttributeModal open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}

function AttributeCard({ attribute, menuOpen, onMenuToggle, onDelete }) {
  const toast = useToast();
  const isFreeform = attribute.fieldType === 'Freeform (Default)';
  const initialValues = attribute.sampleValues && Array.isArray(attribute.sampleValues)
    ? attribute.sampleValues
    : [];
  const [values, setValues] = useState(initialValues.length > 0 ? initialValues : ['']);

  const handleFreeformChange = (index, text) => {
    const next = [...values];
    if (index >= next.length) next.push('');
    next[index] = text;
    setValues(next);
  };

  const handleFreeformBlur = () => {
    const next = values.map(v => (v && typeof v === 'string' ? v.trim() : ''));
    const uniqueNext = next.filter((v, i, arr) => v === '' || arr.indexOf(v) === i);
    
    if (uniqueNext.length < next.length) {
      toast('Duplicate values removed', 'info');
    }

    const kept = uniqueNext.some(v => v !== '') 
      ? uniqueNext.filter((v, i) => v !== '' || i === uniqueNext.length - 1) 
      : [''];
    if (kept.length === 0) kept.push('');
    if (JSON.stringify(kept) !== JSON.stringify(values)) {
      setValues(kept);
      db.attributes.update(attribute.id, { sampleValues: kept });
    }
  };

  const addFreeformValue = () => {
    const next = [...values, ''];
    setValues(next);
    db.attributes.update(attribute.id, { sampleValues: next });
  };

  const removeFreeformValue = (index) => {
    const next = values.filter((_, i) => i !== index);
    const toSave = next.length > 0 ? next : [''];
    setValues(toSave);
    db.attributes.update(attribute.id, { sampleValues: toSave });
  };

  return (
    <div
      className={`rounded-xl border border-gray-100 bg-[#F0F4F8] shadow-sm overflow-hidden flex flex-col ${
        isFreeform ? 'min-h-[200px]' : ''
      }`}
    >
      {/* Card header: name + 3-dot menu */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60 bg-white/50">
        <span className="font-semibold text-gray-900 text-sm truncate">{attribute.fieldName}</span>
        <div className="relative">
          <button
            type="button"
            onClick={onMenuToggle}
            className="p-1 rounded text-gray-500 hover:bg-gray-200/80 hover:text-gray-700 text-lg leading-none"
            aria-label="Options"
          >
            ⋮
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={onMenuToggle} aria-hidden="true" />
              <div className="absolute right-0 top-full mt-1 py-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[120px]">
                <button
                  type="button"
                  onClick={onDelete}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Card content by type */}
      <div className="p-4 flex-1 flex flex-col">
        {isFreeform && (
          <>
            <div className="space-y-2 flex-1">
              {values.map((val, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={val}
                    onChange={e => handleFreeformChange(i, e.target.value)}
                    onBlur={handleFreeformBlur}
                    placeholder={`Value ${i + 1}`}
                    className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-800 placeholder-gray-400 focus:border-brand-400 focus:ring-1 focus:ring-brand-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeFreeformValue(i)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                    aria-label={`Remove value ${i + 1}`}
                    title="Remove value"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addFreeformValue}
              className="mt-3 text-sm font-semibold text-brand-600 hover:text-brand-700 text-left"
            >
              + Add another {attribute.fieldName}
            </button>
          </>
        )}
        {attribute.fieldType === 'Number' && (
          <div className="text-sm">
            <p className="font-semibold text-gray-800 mb-1">Number Field</p>
            <p className="text-gray-500">
              The user will be prompted to enter a value in a text box.
            </p>
          </div>
        )}
        {attribute.fieldType === 'Date' && (
          <div className="text-sm">
            <p className="font-semibold text-gray-800 mb-1">Date Picker</p>
            <p className="text-gray-500">
              The user will be prompted to select a {attribute.dateFormat || 'MM-DD-YYYY'} date with a calendar picker.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const DEFAULT_DATE_FORMAT = 'MM-DD-YYYY';

function AddAttributeModal({ open, onClose }) {
  const toast = useToast();
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('Freeform (Default)');
  const [dateFormat, setDateFormat] = useState(DEFAULT_DATE_FORMAT);
  const [isCommon, setIsCommon] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const handleAdd = async () => {
    if (!fieldName.trim()) { toast('Field name is required', 'error'); return; }
    if (fieldType === 'Date' && !dateFormat.trim()) {
      toast('Date format is required for Date attributes', 'error');
      return;
    }
    const payload = {
      fieldName: fieldName.trim(),
      fieldType,
      isCommon,
    };
    if (fieldType === 'Date') {
      payload.dateFormat = dateFormat.trim();
    }
    if (fieldType === 'Freeform (Default)') {
      payload.allowMultiple = true;
      payload.sampleValues = [];
    }
    await db.attributes.add(payload);
    toast('Attribute added');
    setFieldName('');
    setFieldType('Freeform (Default)');
    setDateFormat(DEFAULT_DATE_FORMAT);
    setIsCommon(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add new attribute" width="max-w-sm">
      <Input label="Field name" value={fieldName} onChange={setFieldName} required className="mb-4" />
      <div className="mb-4">
        <label className="block text-xs font-semibold text-brand-600 mb-1">
          <span className="text-red-500 mr-0.5">*</span>Attribute type
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
      {fieldType === 'Freeform (Default)' && (
        <p className="text-xs text-gray-500 mb-4">
          Freeform attributes allow 1 or more values per link (e.g. multiple tags or labels).
        </p>
      )}
      {fieldType === 'Date' && (
        <div className="mb-4">
          <Input
            label="Attribute date format"
            value={dateFormat}
            onChange={setDateFormat}
            required
            placeholder="MM-DD-YYYY"
          />
          <p className="mt-1 text-xs text-gray-500">
            You can use the date formatting options available with{' '}
            <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">dynamic variables</a>
            {' '}(without brackets).
          </p>
        </div>
      )}
      <Checkbox label="This is a common attribute, and should be added to all future workspaces" checked={isCommon} onChange={setIsCommon} className="mb-5" />
      <div className="flex justify-end">
        <Button onClick={handleAdd}>Add attribute</Button>
      </div>
    </Modal>
  );
}
