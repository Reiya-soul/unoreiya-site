let editingIndex = -1;
let editingType = '';

const defaultSettings = {
  seasons: ['Original', 'Special', 'Stock制', 'UNO Flip', 'High Class', 'その他'],
  categories: ['キャラクターカード', 'SPカード', 'フィールドカード', 'ボスカード', 'High Class', 'その他'],
  types: ['攻撃', '防御', '妨害', 'サポート', 'ドロー', '交換', '特殊', 'その他'],
  tags: ['妨害', 'ドロー', '手札交換', '山札操作', '捨て札操作', 'ターンスキップ', 'ボス', 'フィールド', '状態異常', 'SP', '強カード', 'その他']
};

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('settings') || '{}');
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
  saveSettings(settings);
  return settings;
}

function saveSettings(settings) {
  localStorage.setItem('settings', JSON.stringify(settings));
}

function renderSection(type, list) {
  const ul = document.getElementById(`${type}List`);
  ul.innerHTML = '';
  list.forEach((item, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${item}</span>
      <div class="button-group">
        <button onclick="editItem('${type}', ${index})">編集</button>
        <button onclick="deleteItem('${type}', ${index})">削除</button>
      </div>
    `;
    ul.appendChild(li);
  });
}

function addItem(type) {
  if (editingIndex >= 0) {
    updateItem(type);
    return;
  }
  const input = document.getElementById(`${type.slice(0, -1)}Input`);
  const value = input.value.trim();
  if (!value) return;
  const settings = loadSettings();
  if (settings[type].includes(value)) {
    alert('同じ項目が既に存在します。');
    return;
  }
  settings[type].push(value);
  saveSettings(settings);
  renderSection(type, settings[type]);
  input.value = '';
}

function updateItem(type) {
  const input = document.getElementById(`${type.slice(0, -1)}Input`);
  const value = input.value.trim();
  if (!value) return;
  const settings = loadSettings();
  if (settings[type][editingIndex] !== value && settings[type].includes(value)) {
    alert('同じ項目が既に存在します。');
    return;
  }
  settings[type][editingIndex] = value;
  saveSettings(settings);
  renderSection(type, settings[type]);
  clearForm(type);
}

function deleteItem(type, index) {
  if (!confirm('この項目を削除しますか？')) return;
  const settings = loadSettings();
  settings[type].splice(index, 1);
  saveSettings(settings);
  renderSection(type, settings[type]);
}

function editItem(type, index) {
  const settings = loadSettings();
  const item = settings[type][index];
  const input = document.getElementById(`${type.slice(0, -1)}Input`);
  const addBtn = document.getElementById(`add${type.charAt(0).toUpperCase() + type.slice(1, -1)}Btn`);
  const updateBtn = document.getElementById(`update${type.charAt(0).toUpperCase() + type.slice(1, -1)}Btn`);
  input.value = item;
  editingIndex = index;
  editingType = type;
  addBtn.style.display = 'none';
  updateBtn.style.display = 'inline-block';
}

function clearForm(type) {
  const input = document.getElementById(`${type.slice(0, -1)}Input`);
  const addBtn = document.getElementById(`add${type.charAt(0).toUpperCase() + type.slice(1, -1)}Btn`);
  const updateBtn = document.getElementById(`update${type.charAt(0).toUpperCase() + type.slice(1, -1)}Btn`);
  input.value = '';
  editingIndex = -1;
  editingType = '';
  addBtn.style.display = 'inline-block';
  updateBtn.style.display = 'none';
}

window.addEventListener('load', () => {
  const settings = loadSettings();
  renderSection('seasons', settings.seasons);
  renderSection('categories', settings.categories);
  renderSection('types', settings.types);
  renderSection('tags', settings.tags);
});

document.getElementById('addSeasonBtn').addEventListener('click', () => addItem('seasons'));
document.getElementById('updateSeasonBtn').addEventListener('click', () => updateItem('seasons'));

document.getElementById('addCategoryBtn').addEventListener('click', () => addItem('categories'));
document.getElementById('updateCategoryBtn').addEventListener('click', () => updateItem('categories'));

document.getElementById('addTypeBtn').addEventListener('click', () => addItem('types'));
document.getElementById('updateTypeBtn').addEventListener('click', () => updateItem('types'));

document.getElementById('addTagBtn').addEventListener('click', () => addItem('tags'));
document.getElementById('updateTagBtn').addEventListener('click', () => updateItem('tags'));