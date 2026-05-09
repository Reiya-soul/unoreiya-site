let editingIndex = -1;
let editingType = '';
let optionState = {};

const optionConfig = {
  seasons: { kind: 'series', inputId: 'seasonInput', buttonPrefix: 'Season', fallback: ['Original', 'Special', 'Stock制', 'UNO Flip', 'High Class', 'その他'] },
  categories: { kind: 'category', inputId: 'categoryInput', buttonPrefix: 'Category', fallback: ['キャラクターカード', 'SPカード', 'フィールドカード', 'ボスカード', 'High Class', 'その他'] },
  types: { kind: 'type', inputId: 'typeInput', buttonPrefix: 'Type', fallback: ['攻撃', '防御', '妨害', 'サポート', 'ドロー', '交換', '特殊', 'その他'] },
  modes: { kind: 'mode', inputId: 'modeInput', buttonPrefix: 'Mode', fallback: ['Original', 'Special', 'Stock制', 'UNO Flip', 'High Class', 'その他'] },
  tags: { kind: 'tag', inputId: 'tagInput', buttonPrefix: 'Tag', fallback: ['妨害', 'ドロー', '手札交換', '山札操作', '捨て札操作', 'ターンスキップ', 'ボス', 'フィールド', '状態異常', 'SP', '強カード', 'その他'] }
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

async function getSupabaseClient() {
  const { supabaseClient } = await import('./supabase.js');
  return supabaseClient;
}

function makeFallbackRows(type) {
  return optionConfig[type].fallback.map((name, index) => ({
    id: '',
    kind: optionConfig[type].kind,
    name,
    sort_order: index
  }));
}

function getInputId(type) {
  return optionConfig[type].inputId;
}

function getButtonPrefix(type) {
  return optionConfig[type].buttonPrefix;
}

async function loadOptions() {
  try {
    const supabaseClient = await getSupabaseClient();
    const { data, error } = await supabaseClient
      .from('card_options')
      .select('id, kind, name, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;
    console.info(`card_optionsを${data?.length || 0}件読み込みました。`);

    const normalizedData = (data || [])
      .map(option => ({
        id: option.id,
        kind: cardOptionKindAliases[String(option.kind || '').trim().toLowerCase()] || '',
        name: String(option.name || '').trim(),
        sort_order: option.sort_order ?? 0
      }))
      .filter(option => option.kind && option.name);

    optionState = Object.fromEntries(
      Object.keys(optionConfig).map(type => [
        type,
        normalizedData
          .filter(option => option.kind === optionConfig[type].kind)
      ])
    );
  } catch (error) {
    console.warn('Supabaseから選択肢を読み込めませんでした。固定選択肢を表示します。', error);
    optionState = Object.fromEntries(Object.keys(optionConfig).map(type => [type, makeFallbackRows(type)]));
  }
}

function renderSection(type, list) {
  const ul = document.getElementById(`${type}List`);
  ul.innerHTML = '';
  list.forEach((item, index) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = item.name;
    li.appendChild(name);

    const buttons = document.createElement('div');
    buttons.className = 'button-group';

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = '編集';
    editButton.addEventListener('click', () => editItem(type, index));
    buttons.appendChild(editButton);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = '削除';
    deleteButton.addEventListener('click', () => deleteItem(type, index));
    buttons.appendChild(deleteButton);

    li.appendChild(buttons);
    ul.appendChild(li);
  });
}

function renderAllSections() {
  Object.keys(optionConfig).forEach(type => renderSection(type, optionState[type] || []));
}

async function addItem(type) {
  if (editingIndex >= 0) {
    await updateItem(type);
    return;
  }
  const input = document.getElementById(getInputId(type));
  const value = input.value.trim();
  if (!value) return;
  if ((optionState[type] || []).some(option => option.name === value)) {
    alert('同じ項目が既に存在します。');
    return;
  }

  try {
    const supabaseClient = await getSupabaseClient();
    const sortOrder = optionState[type]?.length || 0;
    const { error } = await supabaseClient
      .from('card_options')
      .insert({
        kind: optionConfig[type].kind,
        name: value,
        sort_order: sortOrder
      });
    if (error) throw error;
    input.value = '';
    await loadOptions();
    renderAllSections();
  } catch (error) {
    alert(`選択肢の追加に失敗しました。\n${error.message}`);
  }
}

async function updateItem(type) {
  const input = document.getElementById(getInputId(type));
  const value = input.value.trim();
  if (!value) return;
  const current = optionState[type]?.[editingIndex];
  if (!current?.id) {
    alert('固定の予備選択肢は編集できません。Supabaseのcard_optionsを確認してください。');
    return;
  }
  if ((optionState[type] || []).some((option, index) => index !== editingIndex && option.name === value)) {
    alert('同じ項目が既に存在します。');
    return;
  }

  try {
    const supabaseClient = await getSupabaseClient();
    const { error } = await supabaseClient
      .from('card_options')
      .update({ name: value })
      .eq('id', current.id);
    if (error) throw error;
    clearForm(type);
    await loadOptions();
    renderAllSections();
  } catch (error) {
    alert(`選択肢の更新に失敗しました。\n${error.message}`);
  }
}

async function deleteItem(type, index) {
  if (!confirm('この項目を削除しますか？')) return;
  const current = optionState[type]?.[index];
  if (!current?.id) {
    alert('固定の予備選択肢は削除できません。Supabaseのcard_optionsを確認してください。');
    return;
  }

  try {
    const supabaseClient = await getSupabaseClient();
    const { error } = await supabaseClient
      .from('card_options')
      .delete()
      .eq('id', current.id);
    if (error) throw error;
    await loadOptions();
    renderAllSections();
  } catch (error) {
    alert(`選択肢の削除に失敗しました。\n${error.message}`);
  }
}

function editItem(type, index) {
  const item = optionState[type]?.[index];
  if (!item) return;
  const input = document.getElementById(getInputId(type));
  const addBtn = document.getElementById(`add${getButtonPrefix(type)}Btn`);
  const updateBtn = document.getElementById(`update${getButtonPrefix(type)}Btn`);
  input.value = item.name;
  editingIndex = index;
  editingType = type;
  addBtn.style.display = 'none';
  updateBtn.style.display = 'inline-block';
}

function clearForm(type) {
  const input = document.getElementById(getInputId(type));
  const addBtn = document.getElementById(`add${getButtonPrefix(type)}Btn`);
  const updateBtn = document.getElementById(`update${getButtonPrefix(type)}Btn`);
  input.value = '';
  editingIndex = -1;
  editingType = '';
  addBtn.style.display = 'inline-block';
  updateBtn.style.display = 'none';
}

window.addEventListener('load', async () => {
  await loadOptions();
  renderAllSections();
});

document.getElementById('addSeasonBtn').addEventListener('click', () => addItem('seasons'));
document.getElementById('updateSeasonBtn').addEventListener('click', () => updateItem('seasons'));

document.getElementById('addCategoryBtn').addEventListener('click', () => addItem('categories'));
document.getElementById('updateCategoryBtn').addEventListener('click', () => updateItem('categories'));

document.getElementById('addTypeBtn').addEventListener('click', () => addItem('types'));
document.getElementById('updateTypeBtn').addEventListener('click', () => updateItem('types'));

document.getElementById('addModeBtn').addEventListener('click', () => addItem('modes'));
document.getElementById('updateModeBtn').addEventListener('click', () => updateItem('modes'));

document.getElementById('addTagBtn').addEventListener('click', () => addItem('tags'));
document.getElementById('updateTagBtn').addEventListener('click', () => updateItem('tags'));
