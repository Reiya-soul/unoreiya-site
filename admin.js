const ADMIN_PASSWORD = 'unoreiya';
const ADMIN_AUTH_STORAGE_KEY = 'unoreiyaAdminAuthenticated';
const CARD_OPTIONS_CACHE_KEY = 'unoreiyaCardOptionsCache';
const DELETED_CARD_IDS_STORAGE_KEY = 'unoreiyaDeletedCardIds';
let editingIndex = -1;
let adminCards = [];
let imagePreviewObjectUrl = '';
const supportedImageExtensions = ['png', 'jpg', 'jpeg', 'webp'];
const CARD_IMAGE_BUCKET = 'card-images';
let adminCardsLoaded = false;
const fallbackCardOptions = {
  seasons: ['Original', 'Special', 'Stock制', 'UNO Flip', 'High Class', 'その他'],
  categories: ['キャラクターカード', 'SPカード', 'フィールドカード', 'ボスカード', 'High Class', 'その他'],
  types: ['攻撃', '防御', '妨害', 'サポート', 'ドロー', '交換', '特殊', 'その他'],
  modes: ['Original', 'Special', 'Stock制', 'UNO Flip', 'High Class', 'その他'],
  tags: ['妨害', 'ドロー', '手札交換', '山札操作', '捨て札操作', 'ターンスキップ', 'ボス', 'フィールド', '状態異常', 'SP', '強カード', 'その他']
};
const cardOptionKinds = {
  seasons: 'series',
  categories: 'category',
  types: 'type',
  modes: 'mode',
  tags: 'tag'
};
const cardOptionKindAliases = {
  season: 'series',
  seasons: 'series',
  series: 'series',
  category: 'category',
  categories: 'category',
  type: 'type',
  types: 'type',
  mode: 'mode',
  modes: 'mode',
  tag: 'tag',
  tags: 'tag'
};

function isAdminAuthenticated() {
  return sessionStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === 'true';
}

function showAdminContent() {
  document.getElementById('adminLogin').hidden = true;
  document.getElementById('adminContent').hidden = false;
  if (!adminCardsLoaded) {
    loadCards();
    adminCardsLoaded = true;
  }
}

function showAdminLogin() {
  document.getElementById('adminLogin').hidden = false;
  document.getElementById('adminContent').hidden = true;
  document.getElementById('adminPassword').focus();
}

function handleAdminLogin(event) {
  event.preventDefault();
  const passwordInput = document.getElementById('adminPassword');
  const errorMessage = document.getElementById('adminLoginError');
  if (passwordInput.value === ADMIN_PASSWORD) {
    sessionStorage.setItem(ADMIN_AUTH_STORAGE_KEY, 'true');
    passwordInput.value = '';
    errorMessage.hidden = true;
    showAdminContent();
    return;
  }

  errorMessage.hidden = false;
  passwordInput.select();
}

function initializeAdminAuth() {
  document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
  if (isAdminAuthenticated()) {
    showAdminContent();
  } else {
    showAdminLogin();
  }
}

function populateSelect(selectId, options) {
  const select = document.getElementById(selectId);
  select.innerHTML = '<option value="">選択してください</option>';
  options.forEach(option => {
    const opt = document.createElement('option');
    opt.value = option;
    opt.textContent = option;
    select.appendChild(opt);
  });
}

function populateFilterSelect(selectId, options) {
  const select = document.getElementById(selectId);
  select.innerHTML = '<option value="">すべて</option>';
  options.forEach(option => {
    const opt = document.createElement('option');
    opt.value = option;
    opt.textContent = option;
    select.appendChild(opt);
  });
}

function renderTagSelect(selectId, tags) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">タグを選択</option>';
  tags.forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.textContent = tag;
    select.appendChild(option);
  });
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map(tag => String(tag).trim()).filter(Boolean);
  }
  if (typeof tags === 'string') {
    return tags.split(',').map(t => t.trim()).filter(t => t);
  }
  return [];
}

function readDeletedCardIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(DELETED_CARD_IDS_STORAGE_KEY) || '[]');
    return Array.isArray(ids) ? ids.map(id => String(id)) : [];
  } catch (error) {
    console.warn('削除済みカードIDを読み込めませんでした。', error);
    return [];
  }
}

function writeDeletedCardIds(ids) {
  localStorage.setItem(DELETED_CARD_IDS_STORAGE_KEY, JSON.stringify([...new Set(ids.filter(Boolean))]));
}

function markCardDeletedLocally(cardId) {
  writeDeletedCardIds([...readDeletedCardIds(), cardId]);
}

function unmarkCardDeletedLocally(cardId) {
  writeDeletedCardIds(readDeletedCardIds().filter(id => id !== cardId));
}

function applyLocalDeletedCards(cards) {
  const deletedIds = new Set(readDeletedCardIds());
  return cards.filter(card => !deletedIds.has(card.id));
}

function upsertLocalCard(card) {
  unmarkCardDeletedLocally(card.id);
  const normalizedCard = normalizeCard(card);
  const nextCards = adminCards.filter(existing => existing.id !== normalizedCard.id);
  nextCards.push(normalizedCard);
  saveCards(nextCards);
  applyFilters();
}

function deleteLocalCard(cardId) {
  markCardDeletedLocally(cardId);
  saveCards(adminCards.filter(card => card.id !== cardId));
  applyFilters();
}

function readCachedOptionRows() {
  try {
    const rows = JSON.parse(localStorage.getItem(CARD_OPTIONS_CACHE_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.warn('選択肢キャッシュを読み込めませんでした。', error);
    return [];
  }
}
function isMissingColumnError(error, columnName) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(columnName.toLowerCase()) && message.includes('column');
}

function groupOptionRows(rows) {
  const normalizedRows = rows
    .map(option => ({
      ...option,
      kind: cardOptionKindAliases[String(option.kind || '').trim().toLowerCase()] || '',
      name: String(option.name || '').trim()
    }))
    .filter(option => option.kind && option.name);

  return Object.fromEntries(
    Object.entries(cardOptionKinds).map(([key, kind]) => [
      key,
      normalizedRows
        .filter(option => option.kind === kind)
        .map(option => option.name)
    ])
  );
}

async function loadCardOptions() {
  try {
    const supabaseClient = await getSupabaseClient();
    let { data, error } = await supabaseClient
      .from('card_options')
      .select('id, kind, name, sort_order, created_at')
      .order('created_at', { ascending: true });

    if (isMissingColumnError(error, 'created_at')) {
      ({ data, error } = await supabaseClient
        .from('card_options')
        .select('id, kind, name, sort_order')
        .order('id', { ascending: true }));
    }

    if (error) throw error;
    console.info(`card_optionsを${data?.length || 0}件読み込みました。`);
    const options = groupOptionRows(data || []);
    const cachedOptions = groupOptionRows(readCachedOptionRows());
    return Object.fromEntries(
      Object.keys(fallbackCardOptions).map(key => [
        key,
        [...new Set([...(options[key] || []), ...(cachedOptions[key] || [])])]
      ])
    );
  } catch (error) {
    console.warn('Supabaseから選択肢を読み込めませんでした。固定選択肢を使います。', error);
    const cachedOptions = groupOptionRows(readCachedOptionRows());
    return Object.fromEntries(
      Object.keys(fallbackCardOptions).map(key => [
        key,
        cachedOptions[key]?.length ? cachedOptions[key] : fallbackCardOptions[key]
      ])
    );
  }
}

function getFileExtension(fileName) {
  const extension = fileName.split('.').pop();
  return extension ? extension.toLowerCase() : '';
}

function isSupportedImageFileName(fileName) {
  return supportedImageExtensions.includes(getFileExtension(fileName));
}

function getSelectedImageFile() {
  const imageFileInput = document.getElementById('imageFile');
  return imageFileInput?.files?.[0] || null;
}

function getSupabaseImageFileName(cardId, fileName) {
  const extension = getFileExtension(fileName);
  const safeId = cardId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return safeId && extension ? `${safeId}-${Date.now()}.${extension}` : '';
}

function setUploadImageStatus(message, isError = false) {
  const status = document.getElementById('uploadImageStatus');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('is-error', isError);
}

function isDuplicateStorageError(error) {
  const message = `${error?.message || ''} ${error?.error || ''}`.toLowerCase();
  return error?.statusCode === '409' || error?.status === 409 || message.includes('already exists') || message.includes('duplicate');
}

function getSupabaseClient() {
  if (window.supabaseClient) return window.supabaseClient;
  if (window.supabase?.createClient && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
    window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    return window.supabaseClient;
  }
  throw new Error('Supabaseを読み込めませんでした。');
}

function getSupabaseRestUrl(path) {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    throw new Error('Supabase設定を読み込めませんでした。');
  }
  return `${window.SUPABASE_URL}/rest/v1/${path}`;
}

function getSupabaseRestHeaders(extraHeaders = {}) {
  return {
    apikey: window.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${window.SUPABASE_ANON_KEY}`,
    ...extraHeaders
  };
}

async function fetchSupabaseRows(path) {
  const response = await fetch(getSupabaseRestUrl(path), {
    headers: getSupabaseRestHeaders()
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

async function upsertSupabaseRow(table, payload, conflictColumn = 'id') {
  const response = await fetch(getSupabaseRestUrl(`${table}?on_conflict=${encodeURIComponent(conflictColumn)}`), {
    method: 'POST',
    headers: getSupabaseRestHeaders({
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    }),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

async function deleteSupabaseRow(table, column, value) {
  const response = await fetch(getSupabaseRestUrl(`${table}?${encodeURIComponent(column)}=eq.${encodeURIComponent(value)}`), {
    method: 'DELETE',
    headers: getSupabaseRestHeaders({
      Prefer: 'return=minimal'
    })
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
}

async function uploadImageFile(supabaseClient, storageFileName, file, options = {}) {
  return supabaseClient.storage
    .from(CARD_IMAGE_BUCKET)
    .upload(storageFileName, file, options);
}

async function uploadImageFileWithOverwrite(supabaseClient, storageFileName, file) {
  const uploadOptions = {
    cacheControl: '3600',
    contentType: file.type || undefined,
    upsert: false
  };

  let uploadResult = await uploadImageFile(supabaseClient, storageFileName, file, uploadOptions);
  if (!uploadResult.error) {
    return uploadResult;
  }

  const firstError = uploadResult.error;
  const { error: removeError } = await supabaseClient.storage
    .from(CARD_IMAGE_BUCKET)
    .remove([storageFileName]);

  if (removeError) {
    return { data: null, error: firstError };
  }

  return uploadImageFile(supabaseClient, storageFileName, file, {
    cacheControl: '3600',
    contentType: file.type || undefined
  });
}

function toSupabaseCard(card) {
  const normalized = normalizeCard(card);
  return {
    id: normalized.id,
    name: normalized.name,
    text: normalized.text,
    effectShort: normalized.effectShort,
    series: normalized.series,
    category: normalized.category,
    tags: normalized.tags,
    keywords: normalized.keywords,
    type: normalized.type,
    image: normalized.image
  };
}

function toSupabaseCardWithSnakeCase(card) {
  const payload = toSupabaseCard(card);
  payload.effect_short = payload.effectShort;
  delete payload.effectShort;
  return payload;
}

function toSupabaseCardMinimal(card) {
  const payload = toSupabaseCard(card);
  delete payload.effectShort;
  return payload;
}

async function fetchCardsFromSupabase() {
  const buildCardsQuery = supabaseClient => supabaseClient
    .from('cards')
    .select('*')
    .not('id', 'is', null)
    .neq('id', '')
    .not('name', 'is', null)
    .neq('name', '');

  try {
    const supabaseClient = await getSupabaseClient();
    let { data, error } = await buildCardsQuery(supabaseClient).order('created_at', { ascending: true });

    if (isMissingColumnError(error, 'created_at')) {
      ({ data, error } = await buildCardsQuery(supabaseClient));
    }

    if (error) throw error;
    return applyLocalDeletedCards(Array.isArray(data) ? data.map(normalizeCard) : []);
  } catch (error) {
    console.warn('Supabase JS clientでカードを読めませんでした。RESTで再試行します。', error);
    try {
      const data = await fetchSupabaseRows('cards?select=*&id=not.is.null&id=neq.&name=not.is.null&name=neq.&order=created_at.asc');
      return applyLocalDeletedCards(Array.isArray(data) ? data.map(normalizeCard) : []);
    } catch (restError) {
      if (!isMissingColumnError(restError, 'created_at')) throw restError;
      const data = await fetchSupabaseRows('cards?select=*&id=not.is.null&id=neq.&name=not.is.null&name=neq.');
      return applyLocalDeletedCards(Array.isArray(data) ? data.map(normalizeCard) : []);
    }
  }
}

async function saveCardToSupabase(card) {
  let result;
  try {
    const supabaseClient = await getSupabaseClient();
    result = await supabaseClient
      .from('cards')
      .upsert(toSupabaseCard(card), { onConflict: 'id' });
  } catch (error) {
    console.warn('Supabase JS clientでカード保存できませんでした。RESTで再試行します。', error);
    try {
      await upsertSupabaseRow('cards', toSupabaseCard(card));
    } catch (restError) {
      if (!isMissingColumnError(restError, 'effectShort')) throw restError;
      try {
        await upsertSupabaseRow('cards', toSupabaseCardWithSnakeCase(card));
      } catch (snakeError) {
        if (!isMissingColumnError(snakeError, 'effect_short')) throw snakeError;
        await upsertSupabaseRow('cards', toSupabaseCardMinimal(card));
      }
    }
    return;
  }

  if (!result.error) {
    return;
  }

  if (isMissingColumnError(result.error, 'effectShort')) {
    const retry = await supabaseClient
      .from('cards')
      .upsert(toSupabaseCardWithSnakeCase(card), { onConflict: 'id' });
    if (!retry.error) {
      return;
    }
    if (isMissingColumnError(retry.error, 'effect_short')) {
      const minimalRetry = await supabaseClient
        .from('cards')
        .upsert(toSupabaseCardMinimal(card), { onConflict: 'id' });
      if (!minimalRetry.error) {
        return;
      }
      throw minimalRetry.error;
    }
    throw retry.error;
  }

  throw result.error;
}

async function deleteCardFromSupabase(cardId) {
  try {
    const supabaseClient = await getSupabaseClient();
    const { error } = await supabaseClient
      .from('cards')
      .delete()
      .eq('id', cardId);
    if (error) throw error;
  } catch (error) {
    console.warn('Supabase JS clientでカード削除できませんでした。RESTで再試行します。', error);
    await deleteSupabaseRow('cards', 'id', cardId);
  }
}

async function syncCardToSupabase(card, actionLabel) {
  try {
    await saveCardToSupabase(card);
  } catch (error) {
    alert(`${actionLabel}に失敗しました。ローカルには反映します。\n${error.message}`);
    throw error;
  }
}

async function syncDeleteToSupabase(cardId) {
  try {
    await deleteCardFromSupabase(cardId);
  } catch (error) {
    alert(`Supabaseからの削除に失敗しました。ローカル一覧からは削除します。\n${error.message}`);
    throw error;
  }
}

function clearImagePreviewObjectUrl() {
  if (imagePreviewObjectUrl) {
    URL.revokeObjectURL(imagePreviewObjectUrl);
    imagePreviewObjectUrl = '';
  }
}

function updateImagePreview(src) {
  const preview = document.getElementById('imagePreview');
  const placeholder = document.getElementById('imagePreviewPlaceholder');
  if (!preview || !placeholder) return;

  clearImagePreviewObjectUrl();
  if (!src) {
    preview.src = '';
    preview.style.display = 'none';
    placeholder.style.display = 'flex';
    return;
  }

  preview.src = src;
  preview.style.display = 'block';
  placeholder.style.display = 'none';
  preview.onerror = () => {
    preview.style.display = 'none';
    placeholder.style.display = 'flex';
  };
}

function updateImagePreviewFromPath() {
  const imagePath = document.getElementById('image')?.value.trim() || '';
  updateImagePreview(imagePath);
}

function handleImageFileChange(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!isSupportedImageFileName(file.name)) {
    alert('画像は png / jpg / jpeg / webp のいずれかを選択してください。');
    event.target.value = '';
    return;
  }

  clearImagePreviewObjectUrl();
  imagePreviewObjectUrl = URL.createObjectURL(file);
  const preview = document.getElementById('imagePreview');
  const placeholder = document.getElementById('imagePreviewPlaceholder');
  if (!preview || !placeholder) return;

  preview.src = imagePreviewObjectUrl;
  preview.style.display = 'block';
  placeholder.style.display = 'none';
  setUploadImageStatus('');
}

async function uploadSelectedImageForCard(cardId, file) {
  if (!cardId) {
    alert('画像をアップロードする前にカードIDを入力してください。');
    return '';
  }
  if (!file) {
    return '';
  }
  if (!isSupportedImageFileName(file.name)) {
    alert('画像は png / jpg / jpeg / webp のいずれかを選択してください。');
    return '';
  }

  const storageFileName = getSupabaseImageFileName(cardId, file.name);
  if (!storageFileName) {
    alert('カードIDまたは画像ファイル名を確認してください。');
    return '';
  }

  setUploadImageStatus('画像をアップロード中...');

  let supabaseClient;
  try {
    supabaseClient = await getSupabaseClient();
  } catch (error) {
    setUploadImageStatus('Supabaseを読み込めませんでした。', true);
    alert(`Supabaseを読み込めませんでした: ${error.message}`);
    return '';
  }

  let uploadResult;
  try {
    uploadResult = await uploadImageFileWithOverwrite(supabaseClient, storageFileName, file);
  } catch (error) {
    const message = 'アップロードに失敗しました。';
    setUploadImageStatus(message, true);
    alert(`${message}${error.message ? `\n${error.message}` : ''}`);
    return '';
  }

  const uploadError = uploadResult.error;
  if (uploadError) {
    const message = isDuplicateStorageError(uploadError) ? '同じファイル名の上書きに失敗しました。' : 'アップロードに失敗しました。';
    setUploadImageStatus(message, true);
    alert(`${message}${uploadError.message ? `\n${uploadError.message}` : ''}`);
    return '';
  }

  const { data } = supabaseClient.storage
    .from(CARD_IMAGE_BUCKET)
    .getPublicUrl(storageFileName);
  const publicUrl = data?.publicUrl || '';

  if (!publicUrl) {
    setUploadImageStatus('公開URLを取得できませんでした。', true);
    alert('公開URLを取得できませんでした。');
    return '';
  }

  setUploadImageStatus('画像アップロード完了');
  return publicUrl;
}

async function attachSelectedImageToCard(card, existingCard = null) {
  const file = getSelectedImageFile();
  if (!file) {
    return {
      ...card,
      image: card.image || existingCard?.image || ''
    };
  }

  const publicUrl = await uploadSelectedImageForCard(card.id, file);
  if (!publicUrl) {
    return null;
  }

  document.getElementById('image').value = publicUrl;
  updateImagePreview(publicUrl);
  return {
    ...card,
    image: publicUrl
  };
}

function getShortText(text) {
  return text.length > 40 ? text.substring(0, 40) + '...' : text;
}

function appendTextWithBreaks(parent, text) {
  const lines = String(text || '').split('\n');
  lines.forEach((line, index) => {
    if (index > 0) {
      parent.appendChild(document.createElement('br'));
    }
    if (line) {
      parent.appendChild(document.createTextNode(line));
    }
  });
}

function appendFormattedText(parent, text) {
  const parts = String(text || '').split('**');
  parts.forEach((part, index) => {
    if (!part) return;
    const isClosedBold = index % 2 === 1 && index < parts.length - 1;
    if (isClosedBold) {
      const strong = document.createElement('strong');
      appendTextWithBreaks(strong, part);
      parent.appendChild(strong);
    } else if (index % 2 === 1) {
      parent.appendChild(document.createTextNode(`**${part}`));
    } else {
      appendTextWithBreaks(parent, part);
    }
  });
}

function createCardListParagraph(label, value, formatValue = false) {
  const paragraph = document.createElement('p');
  const labelElement = document.createElement('strong');
  labelElement.textContent = `${label}:`;
  paragraph.appendChild(labelElement);
  paragraph.appendChild(document.createTextNode(' '));
  if (formatValue) {
    appendFormattedText(paragraph, value);
  } else {
    paragraph.appendChild(document.createTextNode(value || ''));
  }
  return paragraph;
}

function normalizeCard(card) {
  card = card || {};
  const text = card.text || card.effectFull || card.effect || '';
  const type = card.type || (Array.isArray(card.modes) ? card.modes.join(' / ') : card.modes || '');
  return {
    id: card.id || '',
    name: card.name || '',
    text: text,
    effectShort: card.effectShort || card.effect_short || card.effectshort || getShortText(text),
    series: card.series || '',
    category: card.category || '',
    tags: normalizeTags(card.tags),
    keywords: normalizeTags(card.keywords),
    type: type,
    image: typeof card.image === 'string' ? card.image.trim() : ''
  };
}

function buildCardFromForm() {
  const text = document.getElementById('effectFull').value.trim();
  return {
    id: document.getElementById('id').value.trim(),
    name: document.getElementById('name').value.trim(),
    text: text,
    effectShort: getShortText(text),
    series: document.getElementById('series').value.trim(),
    category: document.getElementById('category').value.trim(),
    tags: getSelectedTags(),
    keywords: getSelectedRelatedIds(),
    type: document.getElementById('type').value.trim(),
    image: document.getElementById('image').value.trim()
  };
}

function getSelectedTags() {
  const selectedTagsDiv = document.getElementById('selectedTags');
  if (!selectedTagsDiv) return [];
  return Array.from(selectedTagsDiv.querySelectorAll('.selected-tag')).map(tag => tag.textContent.replace('×', '').trim());
}

function setSelectedTags(tags) {
  const selectedTagsDiv = document.getElementById('selectedTags');
  if (!selectedTagsDiv) return;
  selectedTagsDiv.innerHTML = '';
  const normalized = normalizeTags(tags);
  normalized.forEach(tag => {
    addSelectedTag(tag);
  });
}

function addSelectedTag(tag) {
  const selectedTagsDiv = document.getElementById('selectedTags');
  if (!selectedTagsDiv) return;
  // 重複チェック
  if (getSelectedTags().includes(tag)) return;
  const tagDiv = document.createElement('div');
  tagDiv.className = 'selected-tag';
  tagDiv.textContent = tag;
  const removeBtn = document.createElement('span');
  removeBtn.className = 'remove-tag';
  removeBtn.textContent = '×';
  removeBtn.onclick = () => {
    tagDiv.remove();
  };
  tagDiv.appendChild(removeBtn);
  selectedTagsDiv.appendChild(tagDiv);
}

function getCardLabel(card) {
  if (!card) return '';
  return [card.id, card.name].filter(Boolean).join(' / ');
}

function getSelectedRelatedIds() {
  const selectedRelatedCards = document.getElementById('selectedRelatedCards');
  if (!selectedRelatedCards) {
    return normalizeTags(document.getElementById('keywords')?.value || '');
  }
  return Array.from(selectedRelatedCards.querySelectorAll('[data-related-id]'))
    .map(item => item.dataset.relatedId)
    .filter(Boolean);
}

function syncRelatedIdsInput() {
  const keywordsInput = document.getElementById('keywords');
  if (keywordsInput) {
    keywordsInput.value = getSelectedRelatedIds().join(', ');
  }
}

function addSelectedRelatedCard(cardOrId) {
  const selectedRelatedCards = document.getElementById('selectedRelatedCards');
  if (!selectedRelatedCards) return;

  const relatedId = String(typeof cardOrId === 'object' ? cardOrId.id : cardOrId || '').trim();
  if (!relatedId || getSelectedRelatedIds().includes(relatedId)) return;

  const currentId = document.getElementById('id')?.value.trim();
  if (currentId && relatedId === currentId) return;

  const card = adminCards.find(item => String(item.id) === relatedId) || { id: relatedId, name: relatedId };
  const item = document.createElement('span');
  item.className = 'selected-related-card';
  item.dataset.relatedId = relatedId;
  item.appendChild(document.createTextNode(getCardLabel(card)));

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.textContent = '×';
  removeButton.setAttribute('aria-label', '関連から削除');
  removeButton.addEventListener('click', () => {
    item.remove();
    syncRelatedIdsInput();
  });

  item.appendChild(removeButton);
  selectedRelatedCards.appendChild(item);
  syncRelatedIdsInput();
}

function setSelectedRelatedCards(relatedIds) {
  const selectedRelatedCards = document.getElementById('selectedRelatedCards');
  if (!selectedRelatedCards) return;
  selectedRelatedCards.innerHTML = '';
  normalizeTags(relatedIds).forEach(relatedId => addSelectedRelatedCard(relatedId));
  syncRelatedIdsInput();
}

function renderRelatedSearchResults() {
  const searchInput = document.getElementById('relatedCardSearch');
  const results = document.getElementById('relatedCardSearchResults');
  if (!searchInput || !results) return;

  const query = searchInput.value.trim().toLowerCase();
  results.textContent = '';
  if (!query) return;

  const selectedIds = new Set(getSelectedRelatedIds());
  const currentId = document.getElementById('id')?.value.trim();
  const matches = adminCards
    .filter(card => {
      const id = String(card.id || '');
      if (!id || id === currentId || selectedIds.has(id)) return false;
      return getCardLabel(card).toLowerCase().includes(query);
    })
    .slice(0, 8);

  matches.forEach(card => {
    const row = document.createElement('div');
    row.className = 'related-search-result';

    const label = document.createElement('span');
    label.textContent = getCardLabel(card);
    row.appendChild(label);

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '追加';
    button.addEventListener('click', () => {
      addSelectedRelatedCard(card);
      searchInput.value = '';
      renderRelatedSearchResults();
    });
    row.appendChild(button);
    results.appendChild(row);
  });
}

async function loadCards() {
  try {
    adminCards = await fetchCardsFromSupabase();
    saveCards(adminCards);
  } catch (error) {
    console.warn('Could not load cards from Supabase. Using local cache.', error);
    adminCards = applyLocalDeletedCards(JSON.parse(localStorage.getItem('adminCards') || '[]').map(normalizeCard));
  }

  const options = await loadCardOptions();
  populateSelect('series', options.seasons);
  populateSelect('category', options.categories);
  populateSelect('type', options.types);
  populateFilterSelect('filterCategory', options.categories);
  populateFilterSelect('filterSeries', options.seasons);
  populateFilterSelect('filterType', [...new Set([...options.types, ...options.modes])]);
  renderTagSelect('tagSelect', options.tags);
  setSelectedTags([]);
  setSelectedRelatedCards([]);
  applyFilters();

  // タグ追加ボタンのイベント
  document.getElementById('addTagBtn').addEventListener('click', function() {
    const tagSelect = document.getElementById('tagSelect');
    const selectedTag = tagSelect.value;
    if (selectedTag) {
      addSelectedTag(selectedTag);
      tagSelect.value = '';
    }
  });
}

function saveCards(cards) {
  adminCards = cards.map(normalizeCard);
  localStorage.setItem('adminCards', JSON.stringify(adminCards));
}

async function reloadCardsFromSupabase() {
  adminCards = await fetchCardsFromSupabase();
  saveCards(adminCards);
  applyFilters();
}

function getFilterValues() {
  return {
    searchText: document.getElementById('adminSearchInput')?.value.trim().toLowerCase() || '',
    category: document.getElementById('filterCategory')?.value || '',
    series: document.getElementById('filterSeries')?.value || '',
    type: document.getElementById('filterType')?.value || ''
  };
}

function filterCards(cards) {
  const { searchText, category, series, type } = getFilterValues();
  return cards.filter(card => {
    if (category && (card.category || '').toLowerCase() !== category.toLowerCase()) {
      return false;
    }
    if (series && (card.series || '').toLowerCase() !== series.toLowerCase()) {
      return false;
    }
    if (type && (card.type || '').toLowerCase() !== type.toLowerCase()) {
      return false;
    }
    if (!searchText) {
      return true;
    }
    const combined = [
      card.id,
      card.name,
      card.text || card.effectFull || card.effectShort || card.effectName || '',
      card.category,
      card.series,
      card.type,
      Array.isArray(card.tags) ? card.tags.join(' ') : '',
      Array.isArray(card.keywords) ? card.keywords.join(' ') : ''
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return combined.includes(searchText);
  });
}

function applyFilters() {
  const filteredCards = filterCards(adminCards);
  renderCardList(filteredCards);
}

function scrollToCardForm() {
  document.getElementById('cardForm')?.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  });
}

async function addCard(card) {
  if (!card.id || !card.name) {
    alert('カードIDとカード名を入力してください。')
    return;
  }

  if (editingIndex >= 0) {
    await updateCard(editingIndex, card);
    return;
  }
  const existingIndex = adminCards.findIndex(existing => existing.id === card.id);
  if (existingIndex !== -1) {
    await updateCard(existingIndex, card);
    return;
  }
  const cardToSave = await attachSelectedImageToCard(card);
  if (!cardToSave) {
    return;
  }

  try {
    await syncCardToSupabase(cardToSave, 'カード追加');
    await reloadCardsFromSupabase();
  } catch (error) {
    upsertLocalCard(cardToSave);
  }
  clearForm();
}

async function updateCard(index, card) {
  if (index < 0 || index >= adminCards.length) {
    return;
  }
  if (!card.id || !card.name) {
    alert('カードIDとカード名を入力してください。')
    return;
  }
  const previousCardId = adminCards[index]?.id || '';
  const duplicateIndex = adminCards.findIndex((existing, i) => existing.id === card.id && i !== index);
  if (duplicateIndex !== -1) {
    alert('編集中のIDは既に他のカードで使われています。');
    return;
  }
  const cardToSave = await attachSelectedImageToCard(card, adminCards[index]);
  if (!cardToSave) {
    return;
  }

  try {
    await syncCardToSupabase(cardToSave, 'カード更新');
    if (previousCardId && previousCardId !== cardToSave.id) {
      await syncDeleteToSupabase(previousCardId);
    }
    await reloadCardsFromSupabase();
  } catch (error) {
    if (previousCardId && previousCardId !== cardToSave.id) {
      deleteLocalCard(previousCardId);
    }
    upsertLocalCard(cardToSave);
  }
  clearForm();
  editingIndex = -1;
  document.getElementById('addBtn').style.display = 'inline-block';
  document.getElementById('updateBtn').style.display = 'none';
}

async function deleteCard(index) {
  if (confirm('このカードを削除しますか？')) {
    const card = adminCards[index];
    if (card?.id) {
      try {
        await syncDeleteToSupabase(card.id);
        await reloadCardsFromSupabase();
      } catch (error) {
        deleteLocalCard(card.id);
      }
    }
  }
}

function renderCardList(cards) {
  const container = document.getElementById('cardsContainer');
  const count = document.getElementById('cardCount');
  const totalCount = document.getElementById('cardTotalCount');
  count.textContent = cards.length;
  totalCount.textContent = adminCards.length;
  container.innerHTML = '';
  cards.forEach(card => {
    const originalIndex = adminCards.findIndex(existing => existing.id === card.id);
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card-item';
    cardDiv.appendChild(createCardListParagraph('ID', card.id));
    cardDiv.appendChild(createCardListParagraph('名前', card.name));

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = '編集';
    editButton.addEventListener('click', () => editCard(originalIndex));
    cardDiv.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = '削除';
    deleteButton.addEventListener('click', () => deleteCard(originalIndex));
    cardDiv.appendChild(deleteButton);
    container.appendChild(cardDiv);
  });
}

function editCard(index) {
  const card = adminCards[index];
  if (!card) return;
  populateForm(card);
  editingIndex = index;
  document.getElementById('addBtn').style.display = 'none';
  document.getElementById('updateBtn').style.display = 'inline-block';
  scrollToCardForm();
}

function populateForm(card) {
  card = normalizeCard(card);
  document.getElementById('id').value = card.id;
  document.getElementById('name').value = card.name;
  document.getElementById('effectFull').value = card.text || card.effectFull || '';
  document.getElementById('series').value = card.series;
  document.getElementById('category').value = card.category;
  setSelectedTags(card.tags);
  setSelectedRelatedCards(card.keywords);
  document.getElementById('type').value = card.type;
  document.getElementById('image').value = card.image;
  document.getElementById('imageFile').value = '';
  updateImagePreviewFromPath();
}

function clearForm() {
  document.getElementById('cardForm').reset();
  setSelectedTags([]);
  setSelectedRelatedCards([]);
  const relatedSearchInput = document.getElementById('relatedCardSearch');
  const relatedSearchResults = document.getElementById('relatedCardSearchResults');
  if (relatedSearchInput) relatedSearchInput.value = '';
  if (relatedSearchResults) relatedSearchResults.textContent = '';
  setUploadImageStatus('');
  updateImagePreview('');
}

function resetFormState() {
  clearForm();
  editingIndex = -1;
  document.getElementById('addBtn').style.display = 'inline-block';
  document.getElementById('updateBtn').style.display = 'none';
  scrollToCardForm();
}

function wrapSelectedTextWithBold() {
  const textarea = document.getElementById('effectFull');
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  const selectedText = textarea.value.slice(selectionStart, selectionEnd);
  const before = textarea.value.slice(0, selectionStart);
  const after = textarea.value.slice(selectionEnd);

  textarea.value = `${before}**${selectedText}**${after}`;
  textarea.focus();

  if (selectedText) {
    textarea.setSelectionRange(selectionStart, selectionEnd + 4);
  } else {
    textarea.setSelectionRange(selectionStart + 2, selectionStart + 2);
  }
}

function setSaveButtonsDisabled(disabled) {
  document.getElementById('addBtn').disabled = disabled;
  document.getElementById('updateBtn').disabled = disabled;
  document.getElementById('cancelBtn').disabled = disabled;
}

function hideLegacyKeywordsField() {
  const keywordsInput = document.getElementById('keywords');
  const formRow = keywordsInput?.closest('.form-row');
  if (keywordsInput) {
    keywordsInput.type = 'hidden';
  }
  if (formRow) {
    formRow.style.display = 'none';
  }
}

document.getElementById('addBtn').addEventListener('click', async function() {
  setSaveButtonsDisabled(true);
  try {
    await addCard(buildCardFromForm());
  } finally {
    setSaveButtonsDisabled(false);
    scrollToCardForm();
  }
});

document.getElementById('updateBtn').addEventListener('click', async function() {
  setSaveButtonsDisabled(true);
  try {
    await updateCard(editingIndex, buildCardFromForm());
  } finally {
    setSaveButtonsDisabled(false);
    scrollToCardForm();
  }
});

document.getElementById('cancelBtn').addEventListener('click', resetFormState);

document.getElementById('boldTextBtn').addEventListener('click', wrapSelectedTextWithBold);

document.getElementById('adminSearchInput').addEventListener('input', applyFilters);

document.getElementById('filterCategory').addEventListener('change', applyFilters);

document.getElementById('filterSeries').addEventListener('change', applyFilters);

document.getElementById('filterType').addEventListener('change', applyFilters);

document.getElementById('imageFile').addEventListener('change', handleImageFileChange);

document.getElementById('image')?.addEventListener('input', updateImagePreviewFromPath);

document.getElementById('relatedCardSearch')?.addEventListener('input', renderRelatedSearchResults);

document.getElementById('id')?.addEventListener('input', renderRelatedSearchResults);

window.editCard = editCard;
window.deleteCard = deleteCard;

hideLegacyKeywordsField();

window.addEventListener('load', initializeAdminAuth);





