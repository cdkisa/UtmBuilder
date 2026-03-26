import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useWorkspace } from '../hooks/useWorkspace';
import { useToast } from '../hooks/useToast';
import { Button, EmptyState, Input, Checkbox, Select } from '../components/UI';
import db from '../db';

const PARAMS = ['campaign', 'medium', 'source', 'term', 'content'];

export default function RulesPage() {
  const { settings } = useWorkspace();
  const toast = useToast();

  const rules = useLiveQuery(
    () => db.rules.toArray(),
    []
  ) || [];

  // Workspace-level settings
  const [spaceChar, setSpaceChar] = useState(settings?.spaceChar || 'hyphen');
  const [prohibitedChars, setProhibitedChars] = useState(settings?.prohibitedChars || '');
  const [forceLowercase, setForceLowercase] = useState(settings?.forceLowercase || false);
  const [requireTemplate, setRequireTemplate] = useState(settings?.requireTemplate || false);
  const [defaultTemplateId, setDefaultTemplateId] = useState(settings?.defaultTemplateId || '');
  const [lockTemplates, setLockTemplates] = useState(settings?.lockTemplates || false);
  const [allowQrCustomize, setAllowQrCustomize] = useState(settings?.allowQrCustomize || false);
  
  const [expandedRules, setExpandedRules] = useState({});

  const templates = useLiveQuery(() => db.templates.toArray()) || [];

  // Sync from settings when they load
  useState(() => {
    if (settings?.id) {
      setSpaceChar(settings.spaceChar || 'hyphen');
      setProhibitedChars(settings.prohibitedChars || '');
      setForceLowercase(settings.forceLowercase || false);
      setRequireTemplate(settings.requireTemplate || false);
      setDefaultTemplateId(settings.defaultTemplateId || '');
      setLockTemplates(settings.lockTemplates || false);
      setAllowQrCustomize(settings.allowQrCustomize || false);
    }
  }, [settings]);

  const handleSaveSettings = async () => {
    if (!settings?.id) return;
    await db.workspaceSettings.update(settings.id, {
      spaceChar, prohibitedChars, forceLowercase,
      requireTemplate, defaultTemplateId, lockTemplates, allowQrCustomize,
    });
    toast('Workspace settings saved');
  };

  const handleCreateRule = async () => {
    const name = `Rule ${rules.length + 1}`;
    const config = {};
    for (const p of PARAMS) {
      config[p] = {
        required: false, blocked: false, forceLowercase: false,
        canType: true, hidden: false, unique: false,
        maxChars: '', prohibitedValues: '', customInstructions: '',
      };
    }
    await db.rules.add({ name, config });
    toast('Rule created');
  };

  const handleDeleteRule = async (id) => {
    if (!confirm('Delete this rule?')) return;
    await db.rules.delete(id);
    toast('Rule deleted');
  };

  const handleUpdateRuleConfig = async (ruleId, param, field, value) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    const newConfig = { ...rule.config };
    newConfig[param] = { ...newConfig[param], [field]: value };
    await db.rules.update(ruleId, { config: newConfig });
  };

  return (
    <div>
      {/* Workspace Defaults */}
      <div className="mb-10">
        <h1 className="text-2xl mb-6">
          <span className="font-semibold text-gray-900">Manage </span>
          <span className="text-gray-900">{settings?.name || 'Your first workspace'}</span>
          <span className="font-semibold text-gray-900"> Workspace Defaults</span>
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 px-1">
          {/* Left Column */}
          <div>
            <div className="flex items-end gap-3 mb-6">
              <div className="flex-1">
                <Select label="Space Character" value={spaceChar} onChange={setSpaceChar}
                  options={[
                    { value: 'hyphen', label: 'Hyphen' },
                    { value: 'underscore', label: 'Underscore' },
                    { value: 'plus', label: 'Plus' },
                  ]} />
              </div>
              <p className="text-[11px] text-gray-400 pb-[10px] w-1/2 leading-tight">Replaces spaces in parameters with your chosen character</p>
            </div>

            <div className="mb-8 flex items-center">
              <Checkbox label="Force all campaigns parameters to lowercase" checked={forceLowercase} onChange={setForceLowercase} />
              <span className="text-[11px] text-gray-400 ml-2 pt-0.5">Helps maintain consistency</span>
            </div>

            <div className="mb-4">
              <label className="block text-[11px] text-gray-600 mb-1.5">Choose the Default QR Code Design</label>
              <select className="w-2/3 px-3 py-2 border border-gray-200 rounded text-sm bg-white text-gray-400 outline-none">
                <option>No Template</option>
              </select>
            </div>
            <div>
              <Checkbox label="Allow the members to customize the QR code designs"
                checked={allowQrCustomize} onChange={setAllowQrCustomize} />
            </div>
          </div>

          {/* Right Column */}
          <div>
            <div className="flex items-end gap-3 mb-6">
              <div className="flex-1">
                <Input label={<span className="text-brand-500">Prohibited Characters <span className="text-gray-400 text-[9px] border border-gray-300 rounded-full px-1 ml-0.5">i</span></span>} 
                  value={prohibitedChars} onChange={setProhibitedChars} placeholder="" className="mb-0" />
              </div>
              <p className="text-[11px] text-gray-400 pb-[2px] w-1/2 leading-tight">Characters which are not allowed to use in the builder, separated with a comma</p>
            </div>

            <div className="mb-3">
              <Checkbox label={<span className="text-gray-600 font-medium">Require template selection in link builder <span className="text-gray-400 font-normal text-[9px] border border-gray-300 rounded-full px-1 ml-0.5">i</span></span>}
                checked={requireTemplate} onChange={setRequireTemplate} />
            </div>

            <div className="mb-4">
              <label className="block text-[11px] text-gray-600 mb-1.5">Choose the default template for your workspace <span className="text-gray-400 text-[9px] border border-gray-300 rounded-full px-1 ml-0.5">i</span></label>
              <select value={defaultTemplateId} onChange={e => setDefaultTemplateId(e.target.value)} className="w-2/3 px-3 py-2 border border-gray-200 rounded text-sm bg-white text-gray-400 outline-none">
                <option value="">No Templates Selected</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>

            <div>
              <Checkbox label={<span className="text-gray-600">Do not allow members to select different templates <span className="text-gray-400 text-[9px] border border-gray-300 rounded-full px-1 ml-0.5">i</span></span>}
                checked={lockTemplates} onChange={setLockTemplates} />
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Rules */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl">
          <span className="font-semibold text-gray-900">Manage </span>
          <span className="text-gray-900">{settings?.name || 'Your first workspace'}</span>
          <span className="font-semibold text-gray-900"> Workspace Rules</span>
        </h2>
        <div className="flex gap-4">
          <button onClick={handleCreateRule} className="px-5 py-2.5 bg-brand-400 hover:bg-brand-500 text-white text-sm font-semibold rounded-full shadow-sm transition">
            + Create Rule
          </button>
          <button onClick={handleSaveSettings} className="px-5 py-2.5 bg-brand-400 hover:bg-brand-500 text-white text-sm font-semibold rounded-full shadow-sm transition">
            Save Workspace Settings
          </button>
        </div>
      </div>

      {rules.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-8">
          <EmptyState icon="📏" message="No rules created yet."
            action={<Button onClick={handleCreateRule}>+ Create Rule</Button>} />
        </div>
      ) : (
        rules.map(rule => {
          const isExpanded = expandedRules[rule.id] !== false;
          return (
          <div key={rule.id} className="bg-white rounded-xl border border-gray-100 mb-6 overflow-hidden shadow-sm">
            <div 
              className="flex items-center justify-between px-6 py-4 bg-[#EDF2F7] cursor-pointer"
              onClick={() => setExpandedRules(p => ({ ...p, [rule.id]: !isExpanded }))}
            >
              <div className="flex items-center gap-3">
                <h3 className="font-medium text-sm text-gray-700">{rule.name}</h3>
                <button onClick={(e) => {
                  e.stopPropagation();
                  const newName = prompt('Rename rule:', rule.name);
                  if (newName) db.rules.update(rule.id, { name: newName });
                }} className="text-[10px] text-gray-500 hover:text-brand-600">✏️</button>
                <button onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteRule(rule.id);
                }} className="text-[10px] text-gray-500 hover:text-red-500">🗑️</button>
              </div>
              <button className="text-gray-400 font-bold text-sm">
                {isExpanded ? '^' : 'v'}
              </button>
            </div>

            {isExpanded && (
            <div className="overflow-x-auto py-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left">
                    <th className="px-6 py-3 font-semibold text-gray-800 text-[11px]">Parameter</th>
                    <th className="px-3 py-3 font-semibold text-gray-800 text-[11px] text-center">Required</th>
                    <th className="px-3 py-3 font-semibold text-gray-800 text-[11px] text-center">Blocked</th>
                    <th className="px-3 py-3 font-semibold text-gray-800 text-[11px] text-center">Force Lowercase</th>
                    <th className="px-3 py-3 font-semibold text-gray-800 text-[11px] text-center">Can Type</th>
                    <th className="px-3 py-3 font-semibold text-gray-800 text-[11px] text-center">Hidden</th>
                    <th className="px-3 py-3 font-semibold text-gray-800 text-[11px] text-center">Unique</th>
                    <th className="px-4 py-3 font-semibold text-gray-800 text-[11px]">Max. characters</th>
                    <th className="px-4 py-3 font-semibold text-gray-800 text-[11px]">Prohibited values</th>
                    <th className="px-4 py-3 font-semibold text-gray-800 text-[11px]">Custom Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {PARAMS.map(p => {
                    const cfg = rule.config?.[p] || {};
                    return (
                      <tr key={p} className="border-b border-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{p}</td>
                        <td className="px-4 py-3 text-center">
                          <input type="checkbox" checked={cfg.required || false}
                            onChange={e => handleUpdateRuleConfig(rule.id, p, 'required', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-500" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input type="checkbox" checked={cfg.blocked || false}
                            onChange={e => handleUpdateRuleConfig(rule.id, p, 'blocked', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-500" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input type="checkbox" checked={cfg.forceLowercase || false}
                            onChange={e => handleUpdateRuleConfig(rule.id, p, 'forceLowercase', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-500" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input type="checkbox" checked={cfg.canType !== false}
                            onChange={e => handleUpdateRuleConfig(rule.id, p, 'canType', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-500" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input type="checkbox" checked={cfg.hidden || false}
                            onChange={e => handleUpdateRuleConfig(rule.id, p, 'hidden', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-500" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input type="checkbox" checked={cfg.unique || false}
                            onChange={e => handleUpdateRuleConfig(rule.id, p, 'unique', e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-brand-500" />
                        </td>
                        <td className="px-4 py-3">
                          <input value={cfg.maxChars || ''} placeholder="Enter Value"
                            onChange={e => handleUpdateRuleConfig(rule.id, p, 'maxChars', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-200 rounded text-xs outline-none" />
                        </td>
                        <td className="px-4 py-4">
                          <input value={cfg.prohibitedValues || ''} placeholder="Prohibited values separated..."
                            onChange={e => handleUpdateRuleConfig(rule.id, p, 'prohibitedValues', e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded text-xs outline-none text-gray-500 placeholder-gray-400" />
                        </td>
                        <td className="px-4 py-4">
                          <input value={cfg.customInstructions || ''} placeholder="e.g. holiday special, birthda..."
                            onChange={e => handleUpdateRuleConfig(rule.id, p, 'customInstructions', e.target.value)}
                            className="w-full px-3 py-1.5 border border-gray-200 rounded text-xs outline-none text-gray-500 placeholder-gray-400" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>
        );
        })
      )}
    </div>
  );
}
