let editingItem = null;
let optionState = {};

const CARD_OPTIONS_CACHE_KEY = 'unoreiyaCardOptionsCache';

const text = {
  loading: '\u8aad\u307f\u8fbc\u307f\u4e2d...',
  edit: '\u7de8\u96c6',
  delete: '\u524a\u9664',
  chooseEdit: '\u7de8\u96c6\u3059\u308b\u9805\u76ee\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002',
  localItem: '\u30ed\u30fc\u30ab\u30eb\u9805\u76ee\u3067\u3059',
  confirmDelete: name => `\u300c${name}\u300d\u3092\u524a\u9664\u3057\u307e\u3059\u304b\uff1f`,
  empty: label => `${label}\u306f\u307e\u3060\u767b\u9332\u3055\u308c\u3066\u3044\u307e\u305b\u3093\u3002`,
  required: label => `${label}\u3092\u5165\u529b\u3057\u3066\u304f\u3060\u3055\u3044\u3002`,
  duplicate: label => `\u540c\u3058${label}\u304c\u3059\u3067\u306b\u767b\u9332\u3055\u308c\u3066\u3044\u307e\u3059\u3002`,
  loaded: count => `card_options\u3092${count}\u4ef6\u8aad\u307f\u8fbc\u307f\u307e\u3057\u305f\u3002`,
  loadFailed: message => `Supabase\u304b\u3089\u8aad\u307f\u8fbc\u3081\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u30ed\u30fc\u30ab\u30eb\u306e\u9078\u629e\u80a2\u3092\u8868\u793a\u3057\u3066\u3044\u307e\u3059: ${message}`,
  added: label => `${label}\u3092\u8ffd\u52a0\u3057\u307e\u3057\u305f\u3002`,
  updated: label => `${label}\u3092\u66f4\u65b0\u3057\u307e\u3057\u305f\u3002`,
  deleted: label => `${label}\u3092\u524a\u9664\u3057\u307e\u3057\u305f\u3002`,
  addFallback: message => `Supabase\u3078\u306e\u8ffd\u52a0\u306b\u5931\u6557\u3057\u305f\u305f\u3081\u3001\u30ed\u30fc\u30ab\u30eb\u306b\u8ffd\u52a0\u3057\u307e\u3057\u305f: ${message}`,
  updateFallback: message => `Supabase\u3078\u306e\u66f4\u65b0\u306b\u5931\u6557\u3057\u305f\u305f\u3081\u3001\u30ed\u30fc\u30ab\u30eb\u3067\u66f4\u65b0\u3057\u307e\u3057\u305f: ${message}`,
  deleteFallback: message => `Supabase\u304b\u3089\u524a\u9664\u3067\u304d\u306a\u304b\u3063\u305f\u305f\u3081\u3001\u30ed\u30fc\u30ab\u30eb\u4e00\u89a7\u304b\u3089\u524a\u9664\u3057\u307e\u3057\u305f: ${message}`,
  failed: message => `\u51e6\u7406\u306b\u5931\u6557\u3057\u307e\u3057\u305f: ${message}`
};

const optionConfig = {
  seasons: {
    label: '\u30b7\u30fc\u30ba\u30f3',
    kind: 'series',
    inputId: 'seasonInput',
    listId: 'seasonsList',
    addButtonId: 'addSeasonBtn',
    updateButtonId: 'updateSeasonBtn'
  },
  categories: {
    label: '\u30ab\u30c6\u30b4\u30ea',
    kind: 'category',
    inputId: 'categoryInput',
    listId: 'categoriesList',
    addButtonId: 'addCategoryBtn',
    updateButtonId: 'updateCategoryBtn'
  },
  types: {
    label: '\u30bf\u30a4\u30d7',
    kind: 'type',
    inputId: 'typeInput',
    listId: 'typesList',
    addButtonId: 'addTypeBtn',
    updateButtonId: 'updateTypeBtn'
  },
  tags: {
    label: '\u30bf\u30b0',
    kind: 'tag',
    inputId: 'tagInput',
    listId: 'tagsList',
    addButtonId: 'addTagBtn',
    updateButtonId: 'updateTagBtn'
  },
  modes: {
    label: '\u30e2\u30fc\u30c9',
    kind: 'mode',
    inputId: 'modeInput',
    listId: 'modesList',
    addButtonId: 'addModeBtn',
    updateButtonId: 'updateModeBtn'
  }
};

const allowedKinds = new Set(Object.values(optionConfig).map(config => config.kind));

function setStatus(message, isError = false) {
  const status = document.getElementById('settingsStatus');
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? '#dc3545' : '#0f172a';
}

function getInput(type) {
  return document.getElementById(optionConfig[type].inputId);
}

function getAddButton(type) {
  return document.getElementById(optionConfig[type].addButtonId);
}

function getUpdateButton(type) {
  return document.getElementById(optionConfig[type].updateButtonId);
}

function getTypeByKind(kind) {
  return Object.keys(optionConfig).find(type => optionConfig[type].kind === kind);
}

function normalizeOptionRow(row) {
  const kind = String(row.kind || '').trim();
  const name = String(row.name || '').trim();
  if (!allowedKinds.has(kind) || !name) return null;

  return {
    id: row.id || `local-${kind}-${name}`,
    kind,
    name,
    sort_order: Number(row.sort_order) || 0,
    isLocal: Boolean(row.isLocal)
  };
}

function resetOptionState() {
  optionState = Object.fromEntries(Object.keys(optionConfig).map(type => [type, []]));
}

function readCachedOptions() {
  try {
    const rows = JSON.parse(localStorage.getItem(CARD_OPTIONS_CACHE_KEY) || '[]');
    return Array.isArray(rows) ? rows.map(normalizeOptionRow).filter(Boolean) : [];
  } catch (error) {
    console.warn('Could not read card option cache.', error);
    return [];
  }
}

function writeCachedOptions(rows) {
  localStorage.setItem(CARD_OPTIONS_CACHE_KEY, JSON.stringify(rows.map(row => ({
    id: row.id,
    kind: row.kind,
    name: row.name,
    sort_order: row.sort_order,
    isLocal: row.isLocal
  }))));
}

function mergeOptionRows(primaryRows, cachedRows) {
  const rowsByKey = new Map();
  [...primaryRows, ...cachedRows].forEach(row => {
    const normalized = normalizeOptionRow(row);
    if (!normalized) return;
    rowsByKey.set(`${normalized.kind}:${normalized.name}`, normalized);
  });
  return [...rowsByKey.values()];
}

function groupOptions(rows) {
  resetOptionState();
  rows
    .map(normalizeOptionRow)
    .filter(Boolean)
    .forEach(option => {
      const type = getTypeByKind(option.kind);
      if (type) optionState[type].push(option);
    });
}

function getAllOptions() {
  return Object.values(optionState).flat();
}

function saveCurrentStateToCache() {
  writeCachedOptions(getAllOptions());
}

function getSupabaseClient() {
  if (window.supabaseClient) return window.supabaseClient;
  if (window.supabase?.createClient && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    return window.supabaseClient;
  }
  throw new Error('Supabase client is not loaded.');
}

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes(columnName.toLowerCase()) && message.includes('column');
}

async function fetchOptionsFromSupabase() {
  const supabaseClient = await getSupabaseClient();
  let { data, error } = await supabaseClient
    .from('card_options')
    .select('id, kind, name, sort_order, created_at')
    .in('kind', Array.from(allowedKinds))
    .order('created_at', { ascending: true });

  if (isMissingColumnError(error, 'created_at')) {
    ({ data, error } = await supabaseClient
      .from('card_options')
      .select('id, kind, name, sort_order')
      .in('kind', Array.from(allowedKinds))
      .order('id', { ascending: true }));
  }

  if (error) throw error;
  return data || [];
}

async function loadOptions() {
  setStatus(text.loading);
  const cachedRows = readCachedOptions();

  try {
    const supabaseRows = await fetchOptionsFromSupabase();
    const mergedRows = mergeOptionRows(supabaseRows, cachedRows.filter(row => row.isLocal));
    groupOptions(mergedRows);
    saveCurrentStateToCache();
    setStatus(text.loaded(mergedRows.length));
  } catch (error) {
    console.error(error);
    groupOptions(cachedRows);
    setStatus(text.loadFailed(error.message), true);
  }
}

function renderEmptyMessage(list, label) {
  const li = document.createElement('li');
  const span = document.createElement('span');
  span.textContent = text.empty(label);
  li.appendChild(span);
  list.appendChild(li);
}

function renderSection(type) {
  const config = optionConfig[type];
  const list = document.getElementById(config.listId);
  const items = optionState[type] || [];

  list.innerHTML = '';

  if (!items.length) {
    renderEmptyMessage(list, config.label);
    return;
  }

  items.forEach(item => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    const buttons = document.createElement('div');
    const editButton = document.createElement('button');
    const deleteButton = document.createElement('button');

    name.textContent = item.name;
    buttons.className = 'button-group';

    editButton.type = 'button';
    editButton.textContent = text.edit;
    editButton.addEventListener('click', () => startEditing(type, item));

    deleteButton.type = 'button';
    deleteButton.textContent = text.delete;
    deleteButton.addEventListener('click', () => deleteItem(type, item));

    buttons.appendChild(editButton);
    buttons.appendChild(deleteButton);
    li.appendChild(name);
    li.appendChild(buttons);
    list.appendChild(li);
  });
}

function renderAllSections() {
  Object.keys(optionConfig).forEach(renderSection);
}

function clearForm(type) {
  getInput(type).value = '';
  getAddButton(type).style.display = 'inline-block';
  getUpdateButton(type).style.display = 'none';
  if (editingItem?.type === type) editingItem = null;
}

function clearOtherEditState(activeType) {
  Object.keys(optionConfig).filter(type => type !== activeType).forEach(clearForm);
}

function getTrimmedInputValue(type) {
  return getInput(type).value.trim();
}

function hasDuplicateName(type, name, currentId = null) {
  return (optionState[type] || []).some(item => item.name === name && String(item.id) !== String(currentId));
}

function getNextSortOrder(type) {
  const orders = (optionState[type] || []).map(item => Number(item.sort_order) || 0);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

function addLocalOption(type, name) {
  const config = optionConfig[type];
  optionState[type].push({
    id: `local-${Date.now()}`,
    kind: config.kind,
    name,
    sort_order: getNextSortOrder(type),
    isLocal: true
  });
  saveCurrentStateToCache();
}

async function addItem(type) {
  const config = optionConfig[type];
  const name = getTrimmedInputValue(type);

  if (!name) {
    alert(text.required(config.label));
    return;
  }

  if (hasDuplicateName(type, name)) {
    alert(text.duplicate(config.label));
    return;
  }

  try {
    const supabaseClient = await getSupabaseClient();
    const { error } = await supabaseClient
      .from('card_options')
      .insert({ kind: config.kind, name, sort_order: getNextSortOrder(type) });
    if (error) throw error;
    await loadOptions();
    setStatus(text.added(config.label));
  } catch (error) {
    console.error(error);
    addLocalOption(type, name);
    setStatus(text.addFallback(error.message), true);
  }

  clearForm(type);
  renderAllSections();
}

function startEditing(type, item) {
  clearOtherEditState(type);
  const input = getInput(type);
  input.value = item.name;
  input.focus();
  input.select();
  editingItem = { type, id: item.id };
  getAddButton(type).style.display = 'none';
  getUpdateButton(type).style.display = 'inline-block';
}

async function updateItem(type) {
  const config = optionConfig[type];
  const name = getTrimmedInputValue(type);
  const current = (optionState[type] || []).find(item => String(item.id) === String(editingItem?.id));

  if (!current) {
    alert(text.chooseEdit);
    return;
  }

  if (!name) {
    alert(text.required(config.label));
    return;
  }

  if (hasDuplicateName(type, name, current.id)) {
    alert(text.duplicate(config.label));
    return;
  }

  try {
    if (current.isLocal || String(current.id).startsWith('local-')) throw new Error(text.localItem);
    const supabaseClient = await getSupabaseClient();
    const { error } = await supabaseClient
      .from('card_options')
      .update({ name })
      .eq('id', current.id);
    if (error) throw error;
    await loadOptions();
    setStatus(text.updated(config.label));
  } catch (error) {
    current.name = name;
    current.isLocal = true;
    saveCurrentStateToCache();
    setStatus(text.updateFallback(error.message), true);
  }

  clearForm(type);
  renderAllSections();
}

async function deleteItem(type, item) {
  const config = optionConfig[type];
  if (!confirm(text.confirmDelete(item.name))) return;

  try {
    if (item.isLocal || String(item.id).startsWith('local-')) throw new Error(text.localItem);
    const supabaseClient = await getSupabaseClient();
    const { error } = await supabaseClient
      .from('card_options')
      .delete()
      .eq('id', item.id);
    if (error) throw error;
    await loadOptions();
    setStatus(text.deleted(config.label));
  } catch (error) {
    optionState[type] = (optionState[type] || []).filter(option => String(option.id) !== String(item.id));
    saveCurrentStateToCache();
    setStatus(text.deleteFallback(error.message), true);
  }

  if (editingItem?.id === item.id) clearForm(type);
  renderAllSections();
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    console.error(error);
    setStatus(text.failed(error.message), true);
    alert(text.failed(error.message));
  }
}

function bindSection(type) {
  getAddButton(type).addEventListener('click', () => runAction(() => addItem(type)));
  getUpdateButton(type).addEventListener('click', () => runAction(() => updateItem(type)));
  getInput(type).addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    runAction(() => (editingItem?.type === type ? updateItem(type) : addItem(type)));
  });
}

async function initializeSettings() {
  resetOptionState();
  Object.keys(optionConfig).forEach(bindSection);
  await loadOptions();
  renderAllSections();
}

document.addEventListener('DOMContentLoaded', initializeSettings);
