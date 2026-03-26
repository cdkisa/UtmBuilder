import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Modal from '../components/Modal';
import { Button, Input, ComboInput, Select, Checkbox } from '../components/UI';
import { useWorkspace } from '../hooks/useWorkspace';
import { useToast } from '../hooks/useToast';
import { buildUtmUrl, generateShortCode, copyToClipboard } from '../utils/utm';
import db from '../db';

export default function CreateLinkModal({ open, onClose, mode: initialMode = 'single' }) {
  const { settings } = useWorkspace();
  const toast = useToast();

  const [mode, setMode] = useState(initialMode);
  const [url, setUrl] = useState('');
  const [campaign, setCampaign] = useState('');
  const [medium, setMedium] = useState('');
  const [source, setSource] = useState('');
  const [term, setTerm] = useState('');
  const [content, setContent] = useState('');
  const [notes, setNotes] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [shortener, setShortener] = useState('none');
  const [customParams, setCustomParams] = useState([]);
  const [attributeValues, setAttributeValues] = useState({});
  const [bulkUrls, setBulkUrls] = useState('');
  const [emailHtml, setEmailHtml] = useState('');
  const [processedHtml, setProcessedHtml] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const templates = useLiveQuery(() => db.templates.toArray()) || [];
  const params = useLiveQuery(() => db.parameters.toArray()) || [];
  const customParamDefs = useLiveQuery(() => db.customParameters.toArray()) || [];
  const attributes = useLiveQuery(() => db.attributes.toArray()) || [];
  const shorteners = useLiveQuery(() => db.shorteners.toArray()) || [];

  const campaignOpts = params.filter(p => p.category === 'campaign').map(p => p.value);
  const mediumOpts = params.filter(p => p.category === 'medium').map(p => p.value);
  const sourceOpts = params.filter(p => p.category === 'source').map(p => p.value);
  const termOpts = params.filter(p => p.category === 'term').map(p => p.value);
  const contentOpts = params.filter(p => p.category === 'content').map(p => p.value);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

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

  const spaceChar = settings?.spaceChar || 'hyphen';

  const generatedUrl = buildUtmUrl(url, { campaign, medium, source, term, content }, customParams, spaceChar);

  const reset = () => {
    setMode(initialMode);
    setUrl(''); setCampaign(''); setMedium(''); setSource(''); setTerm(''); setContent('');
    setNotes(''); setTemplateId(''); setShortener('none'); setCustomParams([]); setAttributeValues({}); setBulkUrls('');
    setEmailHtml(''); setProcessedHtml(''); setIsVerifying(false);
  };

  const verifyUrl = async (testUrl) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(testUrl, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return { ok: false, error: `${res.status}` };
      return { ok: true };
    } catch (e) {
      // Ignore CORS errors as we can't reliably verify those client-side without a proxy
      if (e.name === 'AbortError') return { ok: false, error: 'Timeout' };
      return { ok: true }; // Assume OK if CORS throws TypeErrror
    }
  };

  const handleSave = async () => {
    setIsVerifying(true);
    if (mode === 'email') {
      if (!emailHtml.trim()) { toast('Enter HTML email code', 'error'); setIsVerifying(false); return; }
      const newHtml = emailHtml.replace(/(href=["'])(https?:\/\/[^"']+)/g, (match, prefix, matchUrl) => {
         const fullUrl = buildUtmUrl(matchUrl, { campaign, medium, source, term, content }, customParams, spaceChar);
         return prefix + fullUrl;
      });
      setProcessedHtml(newHtml);
      await copyToClipboard(newHtml);
      toast('UTM parameters injected & HTML copied to clipboard!');
      setIsVerifying(false);
      return; 
    }

    if (mode === 'bulk') {
      const urls = bulkUrls.split('\n').map(u => u.trim()).filter(Boolean);
      if (urls.length === 0) { toast('Enter at least one URL', 'error'); setIsVerifying(false); return; }
      
      for (const u of urls) {
        const v = await verifyUrl(u);
        if (!v.ok) {
          if (!confirm(`Warning: Link verification failed for "${u}" (${v.error}). Continue saving anyway?`)) {
            setIsVerifying(false);
            return;
          }
        }
      }

      for (const u of urls) {
        const fullUrl = buildUtmUrl(u, { campaign, medium, source, term, content }, customParams, spaceChar);
        const shortUrl = shortener !== 'none' ? `https://short.local/${generateShortCode()}` : '';
        await db.links.add({
          url: u, fullUrl, shortUrl,
          campaign, medium, source, term, content,
          templateId: templateId ? Number(templateId) : null,
          notes, createdBy: 'Admin', createdAt: new Date().toISOString(),
        });
      }
      toast(`${urls.length} links created`);
    } else {
      if (!url) { toast('URL is required', 'error'); setIsVerifying(false); return; }
      const v = await verifyUrl(url);
      if (!v.ok) {
        if (!confirm(`Warning: Destination URL appears to be broken (${v.error}). Are you sure you want to save this link?`)) {
          setIsVerifying(false);
          return;
        }
      }

      const shortUrl = shortener !== 'none' ? `https://short.local/${generateShortCode()}` : '';
      const linkId = await db.links.add({
        url, fullUrl: generatedUrl, shortUrl,
        campaign, medium, source, term, content,
        templateId: templateId ? Number(templateId) : null,
        notes, createdBy: 'Admin', createdAt: new Date().toISOString(),
      });
      for (const cp of customParams) {
        if (cp.name && cp.value) {
          await db.linkCustomParams.add({ linkId, paramName: cp.name, paramValue: cp.value });
        }
      }
      for (const attr of attributes) {
        const values = attributeValues[attr.id];
        if (!values) continue;
        const toSave = Array.isArray(values) ? values : [values];
        for (const v of toSave) {
          if (v != null && String(v).trim() !== '') {
            await db.linkAttributes.add({ linkId, attributeId: attr.id, value: String(v).trim() });
          }
        }
      }
      await copyToClipboard(shortUrl || generatedUrl);
      toast('Link created and copied to clipboard');
    }
    setIsVerifying(false);
    reset();
    onClose();
  };

  const clearTemplate = () => {
    setTemplateId('');
  };

  const addCustomParam = () => {
    setCustomParams([...customParams, { name: '', value: '' }]);
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title={mode === 'bulk' ? 'Create Link' : 'Create Link'} width="max-w-xl">
      {/* Mode tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setMode('single')} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${mode === 'single' ? 'bg-brand-500 text-white' : 'text-gray-600 hover:text-gray-800'}`}>
          Single URL
        </button>
        <button onClick={() => setMode('bulk')} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${mode === 'bulk' ? 'bg-brand-500 text-white' : 'text-gray-600 hover:text-gray-800'}`}>
          Multiple URLs
        </button>
        <button onClick={() => setMode('email')} className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${mode === 'email' ? 'bg-brand-500 text-white' : 'text-gray-600 hover:text-gray-800'}`}>
          HTML Email
        </button>
      </div>

      {mode === 'single' && (
        <Input label="URL" value={url} onChange={setUrl} placeholder="https://example.com" required className="mb-4" />
      )}
      {mode === 'bulk' && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-brand-600 mb-1">
            <span className="text-red-500 mr-0.5">*</span>URL List <span className="text-gray-400 font-normal">One URL per line</span>
          </label>
          <textarea value={bulkUrls} onChange={e => setBulkUrls(e.target.value)}
            placeholder="https://example.com/page1&#10;https://example.com/page2"
            rows={5} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-200 outline-none resize-y" />
        </div>
      )}
      {mode === 'email' && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-brand-600 mb-1">
            <span className="text-red-500 mr-0.5">*</span>HTML Source Code
          </label>
          <textarea value={emailHtml} onChange={e => setEmailHtml(e.target.value)}
            placeholder='<a href="https://example.com">Click Here</a>'
            rows={5} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-200 outline-none resize-y font-mono" />
        </div>
      )}

      {/* Template */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-brand-600 mb-1">Template</label>
        <div className="flex gap-2">
          <select value={templateId} onChange={e => setTemplateId(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-400 outline-none bg-white">
            <option value="">Select template...</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {templateId && (
            <button onClick={clearTemplate} className="px-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">CLEAR</button>
          )}
        </div>
      </div>

      {/* UTM Params */}
      <ComboInput label="campaign" value={campaign} onChange={setCampaign}
        options={campaignOpts} placeholder="e.g. holiday special, birthday promotion" className="mb-3" />
      <ComboInput label="medium" value={medium} onChange={setMedium}
        options={mediumOpts} placeholder="e.g. banner ad, email, social post" className="mb-3" />
      <ComboInput label="source" value={source} onChange={setSource}
        options={sourceOpts} placeholder="e.g. adwords, google, mailchimp" className="mb-3" />
      <ComboInput label="term" value={term} onChange={setTerm}
        options={termOpts} placeholder="Use to identify ppc keywords" className="mb-3" />
      <ComboInput label="content" value={content} onChange={setContent}
        options={contentOpts} placeholder="Use to differentiate ads or words on a page" className="mb-3" />

      {/* Custom URL params */}
      <button onClick={addCustomParam} className="text-xs text-brand-600 font-semibold mb-3 hover:text-brand-700">
        + Add custom URL parameter
      </button>
      {customParams.map((cp, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input value={cp.name} onChange={e => {
            const next = [...customParams]; next[i].name = e.target.value; setCustomParams(next);
          }} placeholder="Param name" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
          <input value={cp.value} onChange={e => {
            const next = [...customParams]; next[i].value = e.target.value; setCustomParams(next);
          }} placeholder="Param value" className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
          <button onClick={() => setCustomParams(customParams.filter((_, j) => j !== i))}
            className="text-red-400 hover:text-red-600 px-2">&times;</button>
        </div>
      ))}

      {/* Custom Attributes */}
      {attributes.length > 0 && (
        <div className="mb-4">
          <label className="block text-xs font-semibold text-brand-600 mb-2">Custom Attributes</label>
          <div className="space-y-3">
            {attributes.map(attr => {
              const isFreeform = attr.fieldType === 'Freeform (Default)';
              const allowMultiple = isFreeform && (attr.allowMultiple === true);
              const values = attributeValues[attr.id];
              const valueList = Array.isArray(values) ? values : values != null && values !== '' ? [values] : [];
              const displayValues = valueList.length > 0 ? valueList : [''];

              if (isFreeform) {
                const options = (attr.sampleValues && Array.isArray(attr.sampleValues)) ? attr.sampleValues : [];
                return (
                  <div key={attr.id} className="space-y-2">
                    {displayValues.map((val, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <ComboInput
                          label={i === 0 ? attr.fieldName : null}
                          value={val}
                          onChange={v => {
                            const next = [...displayValues];
                            next[i] = v;
                            setAttributeValues(prev => ({ ...prev, [attr.id]: next }));
                          }}
                          options={options}
                          placeholder="Select or type attributes"
                          className="flex-1"
                        />
                        {displayValues.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = displayValues.filter((_, j) => j !== i);
                              setAttributeValues(prev => ({ ...prev, [attr.id]: next.length > 0 ? next : [''] }));
                            }}
                            className="shrink-0 mt-5 p-2 text-gray-400 hover:text-red-600 rounded"
                            aria-label="Remove value"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {allowMultiple && (
                      <button
                        type="button"
                        onClick={() => setAttributeValues(prev => ({
                          ...prev,
                          [attr.id]: [...(Array.isArray(prev[attr.id]) ? prev[attr.id] : prev[attr.id] ? [prev[attr.id]] : []), ''],
                        }))}
                        className="text-xs text-brand-600 font-semibold hover:text-brand-700"
                      >
                        + Add another {attr.fieldName}
                      </button>
                    )}
                  </div>
                );
              }
              if (attr.fieldType === 'Number') {
                const v = displayValues[0] ?? '';
                return (
                  <Input
                    key={attr.id}
                    label={attr.fieldName}
                    type="number"
                    value={v}
                    onChange={val => setAttributeValues(prev => ({ ...prev, [attr.id]: [val] }))}
                    placeholder="Enter a number"
                    className="mb-0"
                  />
                );
              }
              if (attr.fieldType === 'Date') {
                const v = displayValues[0] ?? '';
                return (
                  <div key={attr.id} className={attr.id ? '' : ''}>
                    <label className="block text-xs font-semibold text-brand-600 mb-1">{attr.fieldName}</label>
                    <input
                      type="date"
                      value={v}
                      onChange={e => setAttributeValues(prev => ({ ...prev, [attr.id]: [e.target.value] }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand-400 focus:ring-1 focus:ring-brand-200 outline-none bg-white"
                    />
                    {!v && (
                      <span className="text-gray-400 text-xs mt-1 inline-block">Click to choose a date</span>
                    )}
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      <Input label="notes" value={notes} onChange={setNotes} placeholder="Notes are saved in your dashboard, not visible on links" className="mb-4" />

      {/* Shortener */}
      <Select label="Shortener" value={shortener} onChange={setShortener} className="mb-5"
        options={[
          { value: 'none', label: "Don't shorten" },
          { value: 'local', label: 'Local shortener (offline)' },
          ...shorteners.map(s => ({ value: String(s.id), label: s.domain || s.type })),
        ]} />

      {/* Preview */}
      {mode === 'single' && generatedUrl && (
        <div className="mb-5 p-3 bg-gray-50 rounded-lg">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Generated URL</label>
          <p className="text-xs text-brand-700 break-all font-mono">{generatedUrl}</p>
        </div>
      )}
      {mode === 'email' && processedHtml && (
        <div className="mb-5 p-3 bg-gray-50 rounded-lg">
          <label className="block text-xs font-semibold text-gray-500 mb-1">Processed HTML (Copied to Clipboard)</label>
          <p className="text-xs text-brand-700 break-all font-mono line-clamp-4">{processedHtml}</p>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => { reset(); onClose(); }}>Cancel</Button>
        <Button onClick={handleSave} disabled={isVerifying}>
          {isVerifying ? 'Verifying...' : mode === 'email' ? 'Process & Copy HTML' : mode === 'bulk' ? 'Bulk Create and Save' : 'Copy & Save'}
        </Button>
      </div>
    </Modal>
  );
}
