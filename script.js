const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const seriesFilter = document.getElementById("seriesFilter");
const tagFilter = document.getElementById("tagFilter");
const modeFilter = document.getElementById("modeFilter");
const cardList = document.getElementById("cardList");
const noResults = document.getElementById("noResults");
const dataStatus = document.getElementById("dataStatus");
const CARD_OPTIONS_CACHE_KEY = 'unoreiyaCardOptionsCache';
const DELETED_CARD_IDS_STORAGE_KEY = 'unoreiyaDeletedCardIds';
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
    throw new Error("Supabase設定を読み込めませんでした。");
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

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes(columnName.toLowerCase()) && message.includes("column");
}

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

function getRelatedCards(card) {
  const relatedIds = getCardKeywords(card).map(value => String(value).trim()).filter(Boolean);
  if (!relatedIds.length) {
    return [];
  }

  const currentId = String(card.id || "");
  return relatedIds
    .map(relatedId => catalogCards.find(item => String(item.id) === relatedId || item.name === relatedId))
    .filter(relatedCard => relatedCard && String(relatedCard.id) !== currentId);
}

function renderRelatedCards(parent, card) {
  parent.textContent = "";
  const relatedCards = getRelatedCards(card);

  relatedCards.forEach(relatedCard => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "related-card-mini";
    item.addEventListener("click", event => {
      event.stopPropagation();
      showCardDetail(relatedCard);
    });

    item.appendChild(createCardImage(relatedCard));
    const name = document.createElement("span");
    name.textContent = relatedCard.name || relatedCard.id || "";
    item.appendChild(name);
    parent.appendChild(item);
  });
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
    effectShort: card.effectShort || card.effect_short || card.effectshort || "",
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

function readDeletedCardIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(DELETED_CARD_IDS_STORAGE_KEY) || "[]");
    return Array.isArray(ids) ? ids.map(id => String(id)) : [];
  } catch (error) {
    console.warn("削除済みカードIDを読み込めませんでした。", error);
    return [];
  }
}

function readCachedCards() {
  try {
    const cards = JSON.parse(localStorage.getItem("adminCards") || "[]");
    return Array.isArray(cards) ? normalizeCards(cards) : [];
  } catch (error) {
    console.warn("管理画面のカードキャッシュを読み込めませんでした。", error);
    return [];
  }
}

function mergeCards(supabaseCards, cachedCards) {
  const deletedIds = new Set(readDeletedCardIds());
  const cardsById = new Map();
  supabaseCards.forEach(card => {
    if (!deletedIds.has(card.id)) cardsById.set(card.id, card);
  });
  cachedCards.forEach(card => {
    if (!deletedIds.has(card.id)) cardsById.set(card.id, card);
  });
  return [...cardsById.values()];
}

function getFallbackCards() {
  const cachedCards = readCachedCards();
  if (cachedCards.length) return mergeCards([], cachedCards);
  return Array.isArray(window.cards) ? normalizeCards(window.cards) : [];
}

function readCachedOptionRows() {
  try {
    const rows = JSON.parse(localStorage.getItem(CARD_OPTIONS_CACHE_KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.warn("選択肢キャッシュを読み込めませんでした。", error);
    return [];
  }
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
  const buildOptionsQuery = supabaseClient => supabaseClient
    .from("card_options")
    .select("id, kind, name, sort_order, created_at");

  try {
    const supabaseClient = getSupabaseClient();
    let { data, error } = await buildOptionsQuery(supabaseClient).order("created_at", { ascending: true });

    if (isMissingColumnError(error, "created_at")) {
      ({ data, error } = await supabaseClient
        .from("card_options")
        .select("id, kind, name, sort_order")
        .order("id", { ascending: true }));
    }

    if (error) throw error;
    console.info(`card_optionsを${data?.length || 0}件読み込みました。`);
    return groupOptionRows(data || []);
  } catch (error) {
    console.warn("Supabase JS clientで選択肢を読めませんでした。RESTで再試行します。", error);
    try {
      const data = await fetchSupabaseRows("card_options?select=id,kind,name,sort_order,created_at&order=created_at.asc");
      console.info(`card_optionsを${data?.length || 0}件読み込みました。`);
      return groupOptionRows(data || []);
    } catch (restError) {
      if (!isMissingColumnError(restError, "created_at")) throw restError;
      const data = await fetchSupabaseRows("card_options?select=id,kind,name,sort_order&order=id.asc");
      console.info(`card_optionsを${data?.length || 0}件読み込みました。`);
      return groupOptionRows(data || []);
    }
  }
}

async function loadCatalogOptions() {
  try {
    const options = await fetchCardOptionsFromSupabase();
    const cachedOptions = groupOptionRows(readCachedOptionRows());
    catalogOptions = Object.fromEntries(
      Object.keys(fallbackCardOptions).map(key => [
        key,
        [...new Set([...(options[key] || []), ...(cachedOptions[key] || [])])]
      ])
    );
  } catch (error) {
    console.warn("Could not load card options from Supabase. Using fallback options.", error);
    const cachedOptions = groupOptionRows(readCachedOptionRows());
    catalogOptions = Object.fromEntries(
      Object.keys(fallbackCardOptions).map(key => [
        key,
        cachedOptions[key]?.length ? cachedOptions[key] : fallbackCardOptions[key]
      ])
    );
  }
}

async function fetchCardsFromSupabase() {
  const buildCardsQuery = supabaseClient => supabaseClient
    .from("cards")
    .select("*")
    .not("id", "is", null)
    .neq("id", "")
    .not("name", "is", null)
    .neq("name", "");

  try {
    const supabaseClient = getSupabaseClient();
    let { data, error } = await buildCardsQuery(supabaseClient).order("created_at", { ascending: true });

    if (isMissingColumnError(error, "created_at")) {
      ({ data, error } = await buildCardsQuery(supabaseClient));
    }

    if (error) throw error;
    return Array.isArray(data) ? normalizeCards(data) : [];
  } catch (error) {
    console.warn("Supabase JS clientでカードを読めませんでした。RESTで再試行します。", error);
    try {
      const data = await fetchSupabaseRows("cards?select=*&id=not.is.null&id=neq.&name=not.is.null&name=neq.&order=created_at.asc");
      return Array.isArray(data) ? normalizeCards(data) : [];
    } catch (restError) {
      if (!isMissingColumnError(restError, "created_at")) throw restError;
      const data = await fetchSupabaseRows("cards?select=*&id=not.is.null&id=neq.&name=not.is.null&name=neq.");
      return Array.isArray(data) ? normalizeCards(data) : [];
    }
  }
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
    cardElement.className = "card catalog-card-compact";
    cardElement.addEventListener("click", () => showCardDetail(card));

    cardElement.appendChild(createCardImage(card));
    const name = document.createElement("h2");
    name.textContent = card.name || "";
    cardElement.appendChild(name);

    cardList.appendChild(cardElement);
  });

  noResults.hidden = cardData.length > 0;
}

function getOptionValues(key) {
  return [...new Set(catalogOptions[key] || [])];
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
  const modalBody = modal?.querySelector(".modal-body");
  const modalImage = document.getElementById("modalImage");
  const modalImagePlaceholder = document.getElementById("modalImagePlaceholder");
  const modalId = document.getElementById("modalId");
  const modalName = document.getElementById("modalName");
  const modalCategory = document.getElementById("modalCategory");
  const modalSeries = document.getElementById("modalSeries");
  const modalType = document.getElementById("modalType");
  const modalEffect = document.getElementById("modalEffect");
  const modalTags = document.getElementById("modalTags");
  const modalRelatedCards = document.getElementById("modalRelatedCards");
  const modalDetails = modal?.querySelector(".modal-details");

  if (window.matchMedia("(max-width: 900px)").matches) {
    modal.style.padding = "12px";
    modal.querySelector(".modal-content").style.width = "100%";
    modal.querySelector(".modal-content").style.maxWidth = "100%";
    modalBody.style.gridTemplateColumns = "1fr";
    modalBody.style.gap = "18px";
    modalImage.style.width = "min(100%, 320px)";
    modalImage.style.maxWidth = "320px";
    modalImage.style.justifySelf = "center";
    modalImagePlaceholder.style.width = "min(100%, 320px)";
    modalImagePlaceholder.style.maxWidth = "320px";
    modalImagePlaceholder.style.justifySelf = "center";
    modalDetails.style.width = "100%";
    modalDetails.style.maxWidth = "100%";
    modalDetails.style.gridColumn = "1 / -1";
  } else {
    modal.style.padding = "";
    modal.querySelector(".modal-content").style.width = "";
    modal.querySelector(".modal-content").style.maxWidth = "";
    modalBody.style.gridTemplateColumns = "";
    modalBody.style.gap = "";
    modalImage.style.width = "";
    modalImage.style.maxWidth = "";
    modalImage.style.justifySelf = "";
    modalImagePlaceholder.style.width = "";
    modalImagePlaceholder.style.maxWidth = "";
    modalImagePlaceholder.style.justifySelf = "";
    modalDetails.style.width = "";
    modalDetails.style.maxWidth = "";
    modalDetails.style.gridColumn = "";
  }

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
  if (modalRelatedCards) {
    const label = modalRelatedCards.previousElementSibling;
    if (label) {
      label.innerHTML = "<strong>関連：</strong>";
    }
    renderRelatedCards(modalRelatedCards, card);
  }

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
    catalogCards = mergeCards(await fetchCardsFromSupabase(), readCachedCards());
    setDataStatus("");
  } catch (error) {
    console.warn("Could not load cards from Supabase.", error);
    await loadCatalogOptions();
    catalogCards = getFallbackCards();
    setDataStatus("Supabaseから読み込めなかったため、予備データを表示しています。", true);
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

