const ADMIN_PASSWORD = 'unoreiya';
const ADMIN_AUTH_STORAGE_KEY = 'unoreiyaAdminAuthenticated';
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
    const { data, error } = await supabaseClient
      .from('card_options')
      .select('kind, name, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) throw error;
    console.info(`card_optionsを${data?.length || 0}件読み込みました。`);
    const options = groupOptionRows(data || []);
    return Object.fromEntries(
      Object.keys(fallbackCardOptions).map(key => [key, options[key]?.length ? options[key] : []])
    );
  } catch (error) {
    console.warn('Supabaseから選択肢を読み込めませんでした。固定選択肢を使います。', error);
    return { ...fallbackCardOptions };
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

async function getSupabaseClient() {
  const { supabaseClient } = await import('./supabase.js');
  return supabaseClient;
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

async function saveCardToSupabase(card) {
  const supabaseClient = await getSupabaseClient();
  const { error } = await supabaseClient
    .from('cards')
    .upsert(toSupabaseCard(card), { onConflict: 'id' });
  if (error) {
    throw error;
  }
}

async function deleteCardFromSupabase(cardId) {
  const supabaseClient = await getSupabaseClient();
  const { error } = await supabaseClient
    .from('cards')
    .delete()
    .eq('id', cardId);
  if (error) {
    throw error;
  }
}

async function syncCardToSupabase(card, actionLabel) {
  try {
    await saveCardToSupabase(card);
  } catch (error) {
    alert(`${actionLabel}はlocalStorageに保存しましたが、Supabaseへの保存に失敗しました。\n${error.message}`);
  }
}

async function syncDeleteToSupabase(cardId) {
  try {
    await deleteCardFromSupabase(cardId);
  } catch (error) {
    alert(`localStorageから削除しましたが、Supabaseからの削除に失敗しました。\n${error.message}`);
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
    effectShort: card.effectShort || getShortText(text),
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
    keywords: document.getElementById('keywords').value.split(',').map(k => k.trim()).filter(k => k),
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

async function loadCards() {
  adminCards = JSON.parse(localStorage.getItem('adminCards') || '[]').map(normalizeCard);
  const options = await loadCardOptions();
  populateSelect('series', options.seasons);
  populateSelect('category', options.categories);
  populateSelect('type', options.types);
  populateFilterSelect('filterCategory', options.categories);
  populateFilterSelect('filterSeries', options.seasons);
  populateFilterSelect('filterType', [...new Set([...options.types, ...options.modes])]);
  renderTagSelect('tagSelect', options.tags);
  setSelectedTags([]);
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

  adminCards.push(cardToSave);
  saveCards(adminCards);
  applyFilters();
  clearForm();
  await syncCardToSupabase(cardToSave, 'カード追加');
}

async function updateCard(index, card) {
  if (index < 0 || index >= adminCards.length) {
    return;
  }
  const duplicateIndex = adminCards.findIndex((existing, i) => existing.id === card.id && i !== index);
  if (duplicateIndex !== -1) {
    alert('編集中のIDは既に他のカードで使われています。');
    return;
  }
  const cardToSave = await attachSelectedImageToCard(card, adminCards[index]);
  if (!cardToSave) {
    return;
  }

  adminCards[index] = cardToSave;
  saveCards(adminCards);
  applyFilters();
  clearForm();
  editingIndex = -1;
  document.getElementById('addBtn').style.display = 'inline-block';
  document.getElementById('updateBtn').style.display = 'none';
  await syncCardToSupabase(cardToSave, 'カード更新');
}

async function deleteCard(index) {
  if (confirm('このカードを削除しますか？')) {
    const card = adminCards[index];
    adminCards.splice(index, 1);
    saveCards(adminCards);
    applyFilters();
    if (card?.id) {
      await syncDeleteToSupabase(card.id);
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
  const cards = JSON.parse(localStorage.getItem('adminCards') || '[]').map(normalizeCard);
  const card = cards[index];
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
  document.getElementById('keywords').value = normalizeTags(card.keywords).join(', ');
  document.getElementById('type').value = card.type;
  document.getElementById('image').value = card.image;
  document.getElementById('imageFile').value = '';
  updateImagePreviewFromPath();
}

function clearForm() {
  document.getElementById('cardForm').reset();
  setSelectedTags([]);
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

window.editCard = editCard;
window.deleteCard = deleteCard;

window.addEventListener('load', initializeAdminAuth);
