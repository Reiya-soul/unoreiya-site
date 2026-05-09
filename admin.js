let editingIndex = -1;
let adminCards = [];
let imagePreviewObjectUrl = '';
const supportedImageExtensions = ['png', 'jpg', 'jpeg', 'webp'];
const CARD_IMAGE_BUCKET = 'card-images';

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('settings') || '{}');
  const defaultSettings = {
    seasons: ['Original', 'Special', 'Stock制', 'UNO Flip', 'High Class', 'その他'],
    categories: ['キャラクターカード', 'SPカード', 'フィールドカード', 'ボスカード', 'High Class', 'その他'],
    types: ['攻撃', '防御', '妨害', 'サポート', 'ドロー', '交換', '特殊', 'その他'],
    tags: ['妨害', 'ドロー', '手札交換', '山札操作', '捨て札操作', 'ターンスキップ', 'ボス', 'フィールド', '状態異常', 'SP', '強カード', 'その他']
  };
  if (!settings.seasons || settings.seasons.length === 0) {
    settings.seasons = [...defaultSettings.seasons];
  }
  if (!settings.categories || settings.categories.length === 0) {
    settings.categories = [...defaultSettings.categories];
  }
  if (!settings.types || settings.types.length === 0) {
    settings.types = [...defaultSettings.types];
  }
  if (!settings.tags || settings.tags.length === 0) {
    settings.tags = [...defaultSettings.tags];
  }
  localStorage.setItem('settings', JSON.stringify(settings));
  return settings;
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
    return tags.filter(Boolean);
  }
  if (typeof tags === 'string') {
    return tags.split(',').map(t => t.trim()).filter(t => t);
  }
  return [];
}

function buildImagePathFromFileName(fileName) {
  return fileName ? `images/${fileName}` : '';
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
  return safeId && extension ? `${safeId}.${extension}` : '';
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

  const imageInput = document.getElementById('image');
  imageInput.value = buildImagePathFromFileName(file.name);

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

async function uploadSelectedImageToSupabase() {
  const file = getSelectedImageFile();
  const cardId = document.getElementById('id').value.trim();

  if (!cardId) {
    alert('画像をアップロードする前にカードIDを入力してください。');
    return;
  }
  if (!file) {
    alert('アップロードする画像ファイルを選択してください。');
    return;
  }
  if (!isSupportedImageFileName(file.name)) {
    alert('画像は png / jpg / jpeg / webp のいずれかを選択してください。');
    return;
  }

  const storageFileName = getSupabaseImageFileName(cardId, file.name);
  if (!storageFileName) {
    alert('カードIDまたは画像ファイル名を確認してください。');
    return;
  }

  const uploadButton = document.getElementById('uploadImageBtn');
  uploadButton.disabled = true;
  setUploadImageStatus('アップロード中...');

  let supabaseClient;
  try {
    supabaseClient = await getSupabaseClient();
  } catch (error) {
    uploadButton.disabled = false;
    setUploadImageStatus('Supabaseを読み込めませんでした。', true);
    alert(`Supabaseを読み込めませんでした: ${error.message}`);
    return;
  }

  let uploadResult;
  try {
    uploadResult = await supabaseClient.storage
      .from(CARD_IMAGE_BUCKET)
      .upload(storageFileName, file, {
        cacheControl: '3600',
        contentType: file.type || undefined
      });
  } catch (error) {
    uploadButton.disabled = false;
    const message = isDuplicateStorageError(error) ? '同じファイル名が存在します。' : 'アップロードに失敗しました。';
    setUploadImageStatus(message, true);
    alert(`${message}${error.message ? `\n${error.message}` : ''}`);
    return;
  }

  const uploadError = uploadResult.error;
  if (uploadError) {
    uploadButton.disabled = false;
    const message = isDuplicateStorageError(uploadError) ? '同じファイル名が存在します。' : 'アップロードに失敗しました。';
    setUploadImageStatus(message, true);
    alert(`${message}${uploadError.message ? `\n${uploadError.message}` : ''}`);
    return;
  }

  const { data } = supabaseClient.storage
    .from(CARD_IMAGE_BUCKET)
    .getPublicUrl(storageFileName);
  const publicUrl = data?.publicUrl || '';

  if (!publicUrl) {
    uploadButton.disabled = false;
    setUploadImageStatus('公開URLを取得できませんでした。', true);
    alert('公開URLを取得できませんでした。');
    return;
  }

  document.getElementById('image').value = publicUrl;
  updateImagePreview(publicUrl);
  setUploadImageStatus('アップロード完了');
  uploadButton.disabled = false;
}

function getShortText(text) {
  return text.length > 40 ? text.substring(0, 40) + '...' : text;
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
    image: card.image || ''
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

function importFromCardsJs() {
  if (!window.cards || !Array.isArray(window.cards)) {
    alert('cards.jsが読み込まれていません。');
    return;
  }
  const existingIds = new Set(adminCards.map(c => c.id));
  const newCards = window.cards.map(normalizeCard).filter(card => !existingIds.has(card.id));
  adminCards = adminCards.concat(newCards);
  saveCards(adminCards);
  applyFilters();
  alert(`${newCards.length}枚のカードを取り込みました。`);
}

function loadCards() {
  adminCards = JSON.parse(localStorage.getItem('adminCards') || '[]').map(normalizeCard);
  const settings = loadSettings();
  populateSelect('series', settings.seasons);
  populateSelect('category', settings.categories);
  populateSelect('type', settings.types);
  renderTagSelect('tagSelect', settings.tags);
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

function addCard(card) {
  if (editingIndex >= 0) {
    updateCard(editingIndex, card);
    return;
  }
  if (adminCards.some(existing => existing.id === card.id)) {
    alert('同じIDのカードが既に存在します。');
    return;
  }
  adminCards.push(card);
  saveCards(adminCards);
  applyFilters();
  clearForm();
}

function updateCard(index, card) {
  if (index < 0 || index >= adminCards.length) {
    return;
  }
  const duplicateIndex = adminCards.findIndex((existing, i) => existing.id === card.id && i !== index);
  if (duplicateIndex !== -1) {
    alert('編集中のIDは既に他のカードで使われています。');
    return;
  }
  adminCards[index] = card;
  saveCards(adminCards);
  applyFilters();
  clearForm();
  editingIndex = -1;
  document.getElementById('addBtn').style.display = 'inline-block';
  document.getElementById('updateBtn').style.display = 'none';
}

function deleteCard(index) {
  if (confirm('このカードを削除しますか？')) {
    adminCards.splice(index, 1);
    saveCards(adminCards);
    applyFilters();
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
    const categoryText = card.category || 'なし';
    const seriesText = card.series || 'なし';
    const typeText = card.type || 'なし';
    const cardTags = Array.isArray(card.tags) ? card.tags : typeof card.tags === 'string' ? card.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const tagsText = cardTags.length > 0 ? cardTags.join(', ') : 'なし';
    cardDiv.innerHTML = `
      <p><strong>ID:</strong> ${card.id}</p>
      <p><strong>名前:</strong> ${card.name}</p>
      <p><strong>カテゴリ:</strong> ${categoryText}</p>
      <p><strong>シーズン:</strong> ${seriesText}</p>
      <p><strong>タイプ:</strong> ${typeText}</p>
      <p><strong>タグ:</strong> ${tagsText}</p>
      <button onclick="editCard(${originalIndex})">編集</button>
      <button onclick="deleteCard(${originalIndex})">削除</button>
    `;
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
  updateImagePreview('');
}

function exportCardsData() {
  const cards = JSON.parse(localStorage.getItem('adminCards') || '[]').map(normalizeCard);
  const output = `window.cards = ${JSON.stringify(cards, null, 2)};`;
  document.getElementById('exportOutput').value = output;
}

function backupExportData() {
  const cards = JSON.parse(localStorage.getItem('adminCards') || '[]').map(normalizeCard);
  document.getElementById('backupOutput').value = JSON.stringify(cards, null, 2);
}

function backupImportData() {
  const input = document.getElementById('backupInput').value.trim();
  if (!input) {
    alert('バックアップJSONを入力してください。');
    return;
  }
  let cards;
  try {
    cards = JSON.parse(input);
  } catch (error) {
    alert('JSON形式が正しくありません。');
    return;
  }
  if (!Array.isArray(cards)) {
    alert('バックアップはカード配列の形式である必要があります。');
    return;
  }
  saveCards(cards);
  applyFilters();
  clearForm();
  editingIndex = -1;
  document.getElementById('addBtn').style.display = 'inline-block';
  document.getElementById('updateBtn').style.display = 'none';
  alert('バックアップを復元しました。');
}

function clearAllData() {
  if (!confirm('管理データを全削除しますか？')) {
    return;
  }
  adminCards = [];
  saveCards(adminCards);
  applyFilters();
  clearForm();
  editingIndex = -1;
  document.getElementById('addBtn').style.display = 'inline-block';
  document.getElementById('updateBtn').style.display = 'none';
}

document.getElementById('generateBtn').addEventListener('click', function() {
  const output = JSON.stringify(buildCardFromForm(), null, 2);
  document.getElementById('output').value = output;
});

document.getElementById('copyBtn').addEventListener('click', function() {
  const output = document.getElementById('output');
  output.select();
  document.execCommand('copy');
  alert('コピーしました！');
});

document.getElementById('addBtn').addEventListener('click', function() {
  addCard(buildCardFromForm());
});

document.getElementById('updateBtn').addEventListener('click', function() {
  updateCard(editingIndex, buildCardFromForm());
});

document.getElementById('exportBtn').addEventListener('click', exportCardsData);

document.getElementById('copyExportBtn').addEventListener('click', function() {
  const output = document.getElementById('exportOutput');
  output.select();
  document.execCommand('copy');
  alert('コピーしました！');
});

document.getElementById('backupExportBtn').addEventListener('click', backupExportData);

document.getElementById('copyBackupBtn').addEventListener('click', function() {
  const output = document.getElementById('backupOutput');
  output.select();
  document.execCommand('copy');
  alert('コピーしました！');
});

document.getElementById('backupImportBtn').addEventListener('click', backupImportData);

document.getElementById('clearAllBtn').addEventListener('click', clearAllData);

document.getElementById('importBtn').addEventListener('click', importFromCardsJs);

document.getElementById('adminSearchInput').addEventListener('input', applyFilters);

document.getElementById('filterCategory').addEventListener('change', applyFilters);

document.getElementById('filterSeries').addEventListener('change', applyFilters);

document.getElementById('filterType').addEventListener('change', applyFilters);

document.getElementById('imageFile').addEventListener('change', handleImageFileChange);

document.getElementById('image').addEventListener('input', updateImagePreviewFromPath);

document.getElementById('uploadImageBtn').addEventListener('click', uploadSelectedImageToSupabase);

window.editCard = editCard;
window.deleteCard = deleteCard;

window.addEventListener('load', loadCards);
