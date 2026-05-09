const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const seriesFilter = document.getElementById("seriesFilter");
const tagFilter = document.getElementById("tagFilter");
const modeFilter = document.getElementById("modeFilter");
const cardList = document.getElementById("cardList");
const noResults = document.getElementById("noResults");
const dataStatus = document.getElementById("dataStatus");
let catalogCards = [];
let catalogOptions = {
  categories: [],
  seasons: [],
  types: [],
  modes: [],
  tags: []
};
const fallbackCardOptions = {
  categories: ['キャラクターカード', 'SPカード', 'フィールドカード', 'ボスカード', 'High Class', 'その他'],
  seasons: ['Original', 'Special', 'Stock制', 'UNO Flip', 'High Class', 'その他'],
  types: ['攻撃', '防御', '妨害', 'サポート', 'ドロー', '交換', '特殊', 'その他'],
  modes: ['Original', 'Special', 'Stock制', 'UNO Flip', 'High Class', 'その他'],
  tags: ['妨害', 'ドロー', '手札交換', '山札操作', '捨て札操作', 'ターンスキップ', 'ボス', 'フィールド', '状態異常', 'SP', '強カード', 'その他']
};
const cardOptionKinds = {
  categories: 'category',
  seasons: 'series',
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

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map(tag => String(tag).trim()).filter(Boolean);
  }
  if (typeof tags === "string") {
    return tags.split(",").map(tag => tag.trim()).filter(Boolean);
  }
  return [];
}

function getCardText(card) {
  return card.text || card.effectFull || card.effectShort || card.effect || "";
}

function getShortDescription(card) {
  const shortBase = card.effectShort || getCardText(card);
  return shortBase.length > 50 ? shortBase.substring(0, 50) + "..." : shortBase;
}

function appendTextWithBreaks(parent, text) {
  const lines = String(text || "").split("\n");
  lines.forEach((line, index) => {
    if (index > 0) {
      parent.appendChild(document.createElement("br"));
    }
    if (!line) return;
    parent.appendChild(document.createTextNode(line));
  });
}

function appendFormattedText(parent, text) {
  const parts = String(text || "").split("**");
  parts.forEach((part, index) => {
    if (!part) return;
    const isClosedBold = index % 2 === 1 && index < parts.length - 1;
    if (isClosedBold) {
      const target = document.createElement("strong");
      appendTextWithBreaks(target, part);
      parent.appendChild(target);
    } else if (index % 2 === 1) {
      parent.appendChild(document.createTextNode(`**${part}`));
    } else {
      appendTextWithBreaks(parent, part);
    }
  });
}

function appendTagPills(parent, values) {
  parent.textContent = "";
  values.forEach(value => {
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = value;
    parent.appendChild(tag);
  });
}

function getCardType(card) {
  return card.type || (Array.isArray(card.modes) ? card.modes.join(" / ") : card.modes || "");
}

function getCardKeywords(card) {
  return normalizeTags(card.keywords);
}

function getCardModes(card) {
  if (Array.isArray(card.modes)) {
    return card.modes.filter(Boolean);
  }
  return card.modes ? [card.modes] : [];
}

function getCardImage(card) {
  return typeof card.image === "string" ? card.image.trim() : "";
}

function createImagePlaceholder() {
  const placeholder = document.createElement("div");
  placeholder.className = "image-placeholder";
  placeholder.textContent = "No Image";
  return placeholder;
}

function createCardImage(card) {
  const imageSrc = getCardImage(card);
  if (!imageSrc) {
    return createImagePlaceholder();
  }

  const fragment = document.createDocumentFragment();
  const image = document.createElement("img");
  image.className = "card-image";
  image.src = imageSrc;
  image.alt = card.name || "";
  image.loading = "lazy";
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";

  const placeholder = createImagePlaceholder();
  placeholder.style.display = "none";
  image.addEventListener("error", () => {
    image.style.display = "none";
    placeholder.style.display = "flex";
  });

  fragment.appendChild(image);
  fragment.appendChild(placeholder);
  return fragment;
}

function normalizeCard(card) {
  const text = card.text || card.effectFull || card.effect || "";
  const modes = getCardModes(card);
  return {
    id: card.id || "",
    name: card.name || "",
    text: text,
    effectShort: card.effectShort || "",
    series: card.series || "",
    category: card.category || "",
    tags: normalizeTags(card.tags),
    keywords: normalizeTags(card.keywords),
    type: card.type || modes.join(" / "),
    image: getCardImage(card),
    modes: modes
  };
}

function isDisplayableCard(card) {
  return Boolean(card.id && card.name);
}

function normalizeCards(cards) {
  return cards.map(normalizeCard).filter(isDisplayableCard);
}

function getFallbackCards() {
  return Array.isArray(window.cards) ? normalizeCards(window.cards) : [];
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

async function fetchCardOptionsFromSupabase() {
  const { supabaseClient } = await import("./supabase.js");
  const { data, error } = await supabaseClient
    .from("card_options")
    .select("kind, name, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw error;
  }
  console.info(`card_optionsを${data?.length || 0}件読み込みました。`);
  return groupOptionRows(data || []);
}

async function loadCatalogOptions() {
  try {
    const options = await fetchCardOptionsFromSupabase();
    catalogOptions = Object.fromEntries(
      Object.keys(fallbackCardOptions).map(key => [key, options[key]?.length ? options[key] : []])
    );
  } catch (error) {
    console.warn("Supabaseから選択肢を読み込めませんでした。固定選択肢を使用します。", error);
    catalogOptions = { ...fallbackCardOptions };
  }
}

async function fetchCardsFromSupabase() {
  const { supabaseClient } = await import("./supabase.js");
  const { data, error } = await supabaseClient
    .from("cards")
    .select("*")
    .not("id", "is", null)
    .neq("id", "")
    .not("name", "is", null)
    .neq("name", "")
    .order("id", { ascending: true });

  if (error) {
    throw error;
  }
  return Array.isArray(data) ? normalizeCards(data) : [];
}

function setDataStatus(message, isError = false) {
  if (!dataStatus) return;
  dataStatus.textContent = message;
  dataStatus.classList.toggle("is-error", isError);
}

function resetSelectOptions(selectElement) {
  const firstOption = selectElement.querySelector("option");
  selectElement.innerHTML = "";
  if (firstOption) {
    selectElement.appendChild(firstOption);
  }
}

function resetFilters() {
  resetSelectOptions(categoryFilter);
  resetSelectOptions(seriesFilter);
  resetSelectOptions(modeFilter);
  tagFilter.innerHTML = "";
}

function displayCards(cardData) {
  cardList.innerHTML = "";

  cardData.forEach(card => {
    const cardElement = document.createElement("div");
    cardElement.className = "card";
    cardElement.addEventListener("click", () => showCardDetail(card));

    const shortEffect = getShortDescription(card);
    const cardTags = normalizeTags(card.tags);

    cardElement.appendChild(createCardImage(card));
    const name = document.createElement("h2");
    name.textContent = card.name || "";
    cardElement.appendChild(name);

    const description = document.createElement("p");
    const descriptionLabel = document.createElement("strong");
    descriptionLabel.textContent = "説明:";
    description.appendChild(descriptionLabel);
    description.appendChild(document.createTextNode(" "));
    appendFormattedText(description, shortEffect);
    cardElement.appendChild(description);

    const tagList = document.createElement("div");
    tagList.className = "tag-list";
    appendTagPills(tagList, cardTags);
    cardElement.appendChild(tagList);

    cardList.appendChild(cardElement);
  });

  noResults.hidden = cardData.length > 0;
}

function getOptionValues(key) {
  return [...new Set(catalogOptions[key] || [])].sort();
}

function populateFilter(selectElement, values) {
  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  });
}

function populateTagFilter(container, values) {
  container.innerHTML = "";
  values.forEach(value => {
    const label = document.createElement("label");
    label.className = "tag-filter-item";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = value;
    input.name = "tagFilter";
    label.appendChild(input);
    label.appendChild(document.createTextNode(value));
    container.appendChild(label);
  });
}

function initFilters() {
  resetFilters();
  populateFilter(categoryFilter, getOptionValues("categories"));
  populateFilter(seriesFilter, getOptionValues("seasons"));
  populateTagFilter(tagFilter, getOptionValues("tags"));
  populateFilter(modeFilter, getOptionValues("modes"));
}

function getSelectedFilterTags() {
  return Array.from(tagFilter.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.value);
}

function filterCards() {
  const keyword = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const selectedSeries = seriesFilter.value;
  const selectedTags = getSelectedFilterTags();
  const selectedMode = modeFilter.value;

  const filteredCards = catalogCards.filter(card => {
    const cardTags = normalizeTags(card.tags);
    const cardModes = getCardModes(card);
    const cardMode = getCardType(card);
    const searchableText = [
      card.id,
      card.name,
      getCardText(card),
      card.effectShort,
      card.series,
      card.category,
      getCardType(card),
      cardTags.join(" "),
      getCardKeywords(card).join(" ")
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesKeyword = !keyword || searchableText.includes(keyword);
    const matchesCategory = !selectedCategory || card.category === selectedCategory;
    const matchesSeries = !selectedSeries || card.series === selectedSeries;
    const matchesTag = selectedTags.length === 0 || selectedTags.every(tag => cardTags.includes(tag));
    const matchesMode = !selectedMode || cardMode === selectedMode || cardModes.includes(selectedMode);
    return matchesKeyword && matchesCategory && matchesSeries && matchesTag && matchesMode;
  });

  displayCards(filteredCards);
}

function showCardDetail(card) {
  const modal = document.getElementById("cardModal");
  const modalImage = document.getElementById("modalImage");
  const modalImagePlaceholder = document.getElementById("modalImagePlaceholder");
  const modalId = document.getElementById("modalId");
  const modalName = document.getElementById("modalName");
  const modalCategory = document.getElementById("modalCategory");
  const modalSeries = document.getElementById("modalSeries");
  const modalType = document.getElementById("modalType");
  const modalEffect = document.getElementById("modalEffect");
  const modalTags = document.getElementById("modalTags");
  const modalKeywords = document.getElementById("modalKeywords");

  const imageSrc = getCardImage(card);
  modalImage.onerror = null;
  if (imageSrc) {
    modalImage.src = imageSrc;
    modalImage.alt = card.name;
    modalImage.referrerPolicy = "no-referrer";
    modalImage.style.display = "block";
    modalImagePlaceholder.style.display = "none";
    modalImage.onerror = () => {
      modalImage.style.display = "none";
      modalImagePlaceholder.style.display = "flex";
    };
  } else {
    modalImage.src = "";
    modalImage.alt = card.name;
    modalImage.style.display = "none";
    modalImagePlaceholder.style.display = "flex";
  }

  modalId.textContent = card.id || "";
  modalName.textContent = card.name || "";
  modalCategory.textContent = card.category || "";
  modalSeries.textContent = card.series || "";
  modalType.textContent = getCardType(card);
  modalEffect.textContent = "";
  appendFormattedText(modalEffect, getCardText(card));
  appendTagPills(modalTags, normalizeTags(card.tags));
  appendTagPills(modalKeywords, getCardKeywords(card));

  modal.style.display = "block";
}

function closeModal() {
  document.getElementById("cardModal").style.display = "none";
}

async function loadCatalogCards() {
  setDataStatus("カードデータを読み込み中...");
  noResults.hidden = true;
  cardList.innerHTML = "";

  try {
    await loadCatalogOptions();
    catalogCards = await fetchCardsFromSupabase();
    setDataStatus("");
  } catch (error) {
    console.warn("Supabaseからカードデータを読み込めませんでした。", error);
    await loadCatalogOptions();
    catalogCards = getFallbackCards();
    setDataStatus("Supabaseから読み込めなかったため、予備データを表示しています", true);
  }

  initFilters();
  displayCards(catalogCards);
}

searchInput.addEventListener("input", filterCards);
categoryFilter.addEventListener("change", filterCards);
seriesFilter.addEventListener("change", filterCards);
tagFilter.addEventListener("change", filterCards);
modeFilter.addEventListener("change", filterCards);

loadCatalogCards();
