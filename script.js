const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const seriesFilter = document.getElementById("seriesFilter");
const tagFilter = document.getElementById("tagFilter");
const modeFilter = document.getElementById("modeFilter");
const cardList = document.getElementById("cardList");
const noResults = document.getElementById("noResults");
const dataStatus = document.getElementById("dataStatus");
const ADMIN_CARDS_STORAGE_KEY = "adminCards";
let catalogCards = [];

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.filter(Boolean);
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

function getCatalogSettings() {
  try {
    return JSON.parse(localStorage.getItem("settings") || "{}");
  } catch (error) {
    console.warn("設定データの読み込みに失敗しました。", error);
    return {};
  }
}

function getSettingValues(key) {
  const values = getCatalogSettings()[key];
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function getCardsFromLocalStorage() {
  const rawCards = localStorage.getItem(ADMIN_CARDS_STORAGE_KEY);
  if (!rawCards) {
    return [];
  }

  try {
    const parsedCards = JSON.parse(rawCards);
    return Array.isArray(parsedCards) ? normalizeCards(parsedCards) : [];
  } catch (error) {
    console.warn("管理カードデータの読み込みに失敗しました。cards.jsのデータを使用します。", error);
    return [];
  }
}

function getFallbackCards() {
  const localCards = getCardsFromLocalStorage();
  return localCards.length > 0 ? localCards : Array.isArray(window.cards) ? normalizeCards(window.cards) : [];
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

function getUniqueValues(key) {
  const values = catalogCards.flatMap(card => {
    if (key === "tags") {
      return normalizeTags(card.tags);
    }
    if (key === "modeFilter") {
      const type = getCardType(card);
      return [...(type ? [type] : []), ...getCardModes(card)];
    }
    if (key === "type") {
      const type = getCardType(card);
      return type ? [type] : [];
    }
    return card[key] ? [card[key]] : [];
  });
  return [...new Set(values)].sort();
}

function getFilterValues(cardKey, settingKey) {
  return [...new Set([...getUniqueValues(cardKey), ...getSettingValues(settingKey)])].sort();
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
  populateFilter(categoryFilter, getFilterValues("category", "categories"));
  populateFilter(seriesFilter, getFilterValues("series", "seasons"));
  populateTagFilter(tagFilter, getFilterValues("tags", "tags"));
  populateFilter(modeFilter, getFilterValues("modeFilter", "types"));
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
    catalogCards = await fetchCardsFromSupabase();
    setDataStatus("");
  } catch (error) {
    console.warn("Supabaseからカードデータを読み込めませんでした。", error);
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

window.addEventListener("storage", event => {
  if (event.key !== "settings") return;
  initFilters();
  filterCards();
});

loadCatalogCards();
