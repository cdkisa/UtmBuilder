import Dexie from 'dexie';

const db = new Dexie('UTMBuilder');

db.version(1).stores({
  workspaces: '++id, name, createdAt',
  links: '++id, workspaceId, url, shortUrl, campaign, medium, source, term, content, templateId, notes, createdBy, createdAt',
  templates: '++id, workspaceId, name, slug, campaign, medium, source, term, content, shortener, isCommon, createdBy, createdAt',
  parameters: '++id, workspaceId, category, value, prettyName',
  customParameters: '++id, workspaceId, fieldName, fieldType, isCommon',
  attributes: '++id, workspaceId, fieldName, fieldType, isCommon',
  linkAttributes: '++id, linkId, attributeId, value',
  linkCustomParams: '++id, linkId, paramName, paramValue',
  shorteners: '++id, workspaceId, type, domain, defaultRedirect, status',
  rules: '++id, workspaceId, name, config',
  members: '++id, workspaceId, email, role, status, isAdmin',
  workspaceSettings: '++id, workspaceId, spaceChar, prohibitedChars, forceLowercase, defaultQrTemplate, requireTemplate, defaultTemplate, allowQrCustomize, lockTemplates',
  qrTemplates: '++id, workspaceId, name, pattern, corners, codeColor, codeColorType, bgColor, bgColorType, logoDataUrl, isCommon',
});

db.version(2).stores({
  workspaces: null,
  links: '++id, url, shortUrl, campaign, medium, source, term, content, templateId, notes, createdBy, createdAt',
  templates: '++id, name, slug, campaign, medium, source, term, content, shortener, isCommon, createdBy, createdAt',
  parameters: '++id, category, value, prettyName',
  customParameters: '++id, fieldName, fieldType, isCommon',
  attributes: '++id, fieldName, fieldType, isCommon',
  linkAttributes: '++id, linkId, attributeId, value',
  linkCustomParams: '++id, linkId, paramName, paramValue',
  shorteners: '++id, type, domain, defaultRedirect, status',
  rules: '++id, name, config',
  members: '++id, email, role, status, isAdmin',
  workspaceSettings: '++id, spaceChar, prohibitedChars, forceLowercase, defaultQrTemplate, requireTemplate, defaultTemplate, allowQrCustomize, lockTemplates',
  qrTemplates: '++id, name, pattern, corners, codeColor, codeColorType, bgColor, bgColorType, logoDataUrl, isCommon',
});

db.on('populate', async () => {
  await db.workspaceSettings.add({
    spaceChar: 'hyphen',
    prohibitedChars: '',
    forceLowercase: false,
    defaultQrTemplate: null,
    requireTemplate: false,
    defaultTemplate: null,
    allowQrCustomize: false,
    lockTemplates: false,
  });

  await db.members.add({
    email: 'admin@local.app',
    role: 'Admin',
    status: 'Active',
    isAdmin: true,
  });

  const defaultParams = {
    medium: ['social', 'cpc', 'display', 'email', 'affiliate'],
    source: ['facebook', 'twitter', 'linkedin', 'instagram', 'youtube', 'pinterest', 'google', 'bing', 'reddit'],
    campaign: [],
    term: [],
    content: [],
  };

  for (const [category, values] of Object.entries(defaultParams)) {
    for (const value of values) {
      await db.parameters.add({ category, value, prettyName: '' });
    }
  }
});

export default db;
