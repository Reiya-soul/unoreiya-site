let editingIndex = -1;

function importFromCardsJs() {
  if (!window.cards || !Array.isArray(window.cards)) {
    alert('cards.jsが読み込まれていません。');
    return;
  }
  const existingCards = JSON.parse(localStorage.getItem('adminCards') || '[]');
  const existingIds = new Set(existingCards.map(c => c.id));
  const newCards = window.cards.filter(card => !existingIds.has(card.id));
  const updatedCards = existingCards.concat(newCards);
  saveCards(updatedCards);
  renderCardList(updatedCards);
  alert(`${newCards.length}枚のカードを取り込みました。`);
}

function loadCards() {
  const cards = JSON.parse(localStorage.getItem('adminCards') || '[]');
  renderCardList(cards);
}

function saveCards(cards) {
  localStorage.setItem('adminCards', JSON.stringify(cards));
}

function addCard(card) {
  const cards = JSON.parse(localStorage.getItem('adminCards') || '[]');
  cards.push(card);
  saveCards(cards);
  renderCardList(cards);
  clearForm();
}

function updateCard(index, card) {
  const cards = JSON.parse(localStorage.getItem('adminCards') || '[]');
  cards[index] = card;
  saveCards(cards);
  renderCardList(cards);
  clearForm();
  editingIndex = -1;
  document.getElementById('addBtn').style.display = 'inline-block';
  document.getElementById('updateBtn').style.display = 'none';
}

function deleteCard(index) {
  if (confirm('このカードを削除しますか？')) {
    const cards = JSON.parse(localStorage.getItem('adminCards') || '[]');
    cards.splice(index, 1);
    saveCards(cards);
    renderCardList(cards);
  }
}

function renderCardList(cards) {
  const container = document.getElementById('cardsContainer');
  const count = document.getElementById('cardCount');
  count.textContent = cards.length;
  container.innerHTML = '';
  cards.forEach((card, index) => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card-item';
    const categoryText = card.category || 'なし';
    const seriesText = card.series || 'なし';
    const typeText = card.type || 'なし';
    const tagsText = Array.isArray(card.tags) && card.tags.length > 0 ? card.tags.join(', ') : 'なし';
    cardDiv.innerHTML = `
      <p><strong>ID:</strong> ${card.id}</p>
      <p><strong>名前:</strong> ${card.name}</p>
      <p><strong>カテゴリ:</strong> ${categoryText}</p>
      <p><strong>シーズン:</strong> ${seriesText}</p>
      <p><strong>タイプ:</strong> ${typeText}</p>
      <p><strong>タグ:</strong> ${tagsText}</p>
      <button onclick="editCard(${index})">編集</button>
      <button onclick="deleteCard(${index})">削除</button>
    `;
    container.appendChild(cardDiv);
  });
}

function editCard(index) {
  const cards = JSON.parse(localStorage.getItem('adminCards') || '[]');
  const card = cards[index];
  populateForm(card);
  editingIndex = index;
  document.getElementById('addBtn').style.display = 'none';
  document.getElementById('updateBtn').style.display = 'inline-block';
}

function populateForm(card) {
  document.getElementById('id').value = card.id;
  document.getElementById('name').value = card.name;
  document.getElementById('effectName').value = card.effectName;
  document.getElementById('effectFull').value = card.effectFull;
  document.getElementById('series').value = card.series;
  document.getElementById('category').value = card.category;
  document.getElementById('tags').value = card.tags.join(', ');
  document.getElementById('keywords').value = card.keywords.join(', ');
  document.getElementById('type').value = card.type;
  document.getElementById('image').value = card.image;
}

function clearForm() {
  document.getElementById('cardForm').reset();
}

function exportCardsData() {
  const cards = JSON.parse(localStorage.getItem('adminCards') || '[]');
  const output = `window.cards = ${JSON.stringify(cards, null, 2)};`;
  document.getElementById('exportOutput').value = output;
}

document.getElementById('generateBtn').addEventListener('click', function() {
  const id = document.getElementById('id').value.trim();
  const name = document.getElementById('name').value.trim();
  const effectName = document.getElementById('effectName').value.trim();
  const effectFull = document.getElementById('effectFull').value.trim();
  const series = document.getElementById('series').value.trim();
  const category = document.getElementById('category').value.trim();
  const tags = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t);
  const keywords = document.getElementById('keywords').value.split(',').map(k => k.trim()).filter(k => k);
  const type = document.getElementById('type').value.trim();
  const image = document.getElementById('image').value.trim();
  const effectShort = effectFull.length > 40 ? effectFull.substring(0, 40) + '...' : effectFull;

  const card = {
    id: id,
    name: name,
    effectName: effectName,
    effectFull: effectFull,
    effectShort: effectShort,
    series: series,
    category: category,
    tags: tags,
    keywords: keywords,
    type: type,
    image: image
  };

  const output = JSON.stringify(card, null, 2);
  document.getElementById('output').value = output;
});

document.getElementById('copyBtn').addEventListener('click', function() {
  const output = document.getElementById('output');
  output.select();
  document.execCommand('copy');
  alert('コピーしました！');
});

document.getElementById('addBtn').addEventListener('click', function() {
  const id = document.getElementById('id').value.trim();
  const name = document.getElementById('name').value.trim();
  const effectName = document.getElementById('effectName').value.trim();
  const effectFull = document.getElementById('effectFull').value.trim();
  const series = document.getElementById('series').value.trim();
  const category = document.getElementById('category').value.trim();
  const tags = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t);
  const keywords = document.getElementById('keywords').value.split(',').map(k => k.trim()).filter(k => k);
  const type = document.getElementById('type').value.trim();
  const image = document.getElementById('image').value.trim();
  const effectShort = effectFull.length > 40 ? effectFull.substring(0, 40) + '...' : effectFull;

  const card = {
    id: id,
    name: name,
    effectName: effectName,
    effectFull: effectFull,
    effectShort: effectShort,
    series: series,
    category: category,
    tags: tags,
    keywords: keywords,
    type: type,
    image: image
  };

  addCard(card);
});

document.getElementById('updateBtn').addEventListener('click', function() {
  const id = document.getElementById('id').value.trim();
  const name = document.getElementById('name').value.trim();
  const effectName = document.getElementById('effectName').value.trim();
  const effectFull = document.getElementById('effectFull').value.trim();
  const series = document.getElementById('series').value.trim();
  const category = document.getElementById('category').value.trim();
  const tags = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t);
  const keywords = document.getElementById('keywords').value.split(',').map(k => k.trim()).filter(k => k);
  const type = document.getElementById('type').value.trim();
  const image = document.getElementById('image').value.trim();
  const effectShort = effectFull.length > 40 ? effectFull.substring(0, 40) + '...' : effectFull;

  const card = {
    id: id,
    name: name,
    effectName: effectName,
    effectFull: effectFull,
    effectShort: effectShort,
    series: series,
    category: category,
    tags: tags,
    keywords: keywords,
    type: type,
    image: image
  };

  updateCard(editingIndex, card);
});

document.getElementById('exportBtn').addEventListener('click', exportCardsData);

document.getElementById('copyExportBtn').addEventListener('click', function() {
  const output = document.getElementById('exportOutput');
  output.select();
  document.execCommand('copy');
  alert('コピーしました！');
});

document.getElementById('importBtn').addEventListener('click', importFromCardsJs);

window.addEventListener('load', loadCards);