const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const seriesFilter = document.getElementById("seriesFilter");
const tagFilter = document.getElementById("tagFilter");
const modeFilter = document.getElementById("modeFilter");
const cardList = document.getElementById("cardList");
const noResults = document.getElementById("noResults");

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

function displayCards(cardData) {
  cardList.innerHTML = "";

  cardData.forEach(card => {
    const cardElement = document.createElement("div");
    cardElement.className = "card";
    cardElement.addEventListener("click", () => showCardDetail(card));

    const shortEffect = getShortDescription(card);
    const imageHtml = card.image
      ? `<img src="${card.image}" alt="${card.name}" class="card-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="image-placeholder" style="display:none;">No Image</div>`
      : `<div class="image-placeholder">No Image</div>`;
    const cardTags = normalizeTags(card.tags);

    cardElement.innerHTML = `
      ${imageHtml}
      <h2>${card.name || ""}</h2>
      <p><strong>カテゴリ:</strong> ${card.category || ""}</p>
      <p><strong>説明:</strong> ${shortEffect}</p>
      <div class="tag-list">
        ${cardTags.map(tag => `<span class="tag">${tag}</span>`).join("")}
      </div>
    `;

    cardList.appendChild(cardElement);
  });

  noResults.hidden = cardData.length > 0;
}

function getUniqueValues(key) {
  const values = window.cards.flatMap(card => {
    if (key === "tags") {
      return normalizeTags(card.tags);
    }
    if (key === "modeFilter") {
      return [...(card.series ? [card.series] : []), ...getCardModes(card)];
    }
    if (key === "type") {
      const type = getCardType(card);
      return type ? [type] : [];
    }
    return card[key] ? [card[key]] : [];
  });
  return [...new Set(values)].sort();
}

function getAllTagValues() {
  const settings = JSON.parse(localStorage.getItem("settings") || "{}");
  const settingsTags = Array.isArray(settings.tags) ? settings.tags : [];
  return [...new Set([...getUniqueValues("tags"), ...settingsTags])].sort();
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
  populateFilter(categoryFilter, getUniqueValues("category"));
  populateFilter(seriesFilter, getUniqueValues("series"));
  populateTagFilter(tagFilter, getAllTagValues());
  populateFilter(modeFilter, getUniqueValues("modeFilter"));
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

  const filteredCards = window.cards.filter(card => {
    const cardTags = normalizeTags(card.tags);
    const cardModes = getCardModes(card);
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
    const matchesMode = !selectedMode || card.series === selectedMode || cardModes.includes(selectedMode);
    return matchesKeyword && matchesCategory && matchesSeries && matchesTag && matchesMode;
  });

  displayCards(filteredCards);
}

searchInput.addEventListener("input", filterCards);
categoryFilter.addEventListener("change", filterCards);
seriesFilter.addEventListener("change", filterCards);
tagFilter.addEventListener("change", filterCards);
modeFilter.addEventListener("change", filterCards);

initFilters();

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

  if (card.image) {
    modalImage.src = card.image;
    modalImage.alt = card.name;
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
  modalEffect.textContent = getCardText(card);
  modalTags.innerHTML = normalizeTags(card.tags).map(tag => `<span class="tag">${tag}</span>`).join("");
  modalKeywords.innerHTML = getCardKeywords(card).map(keyword => `<span class="tag">${keyword}</span>`).join("");

  modal.style.display = "block";
}

function closeModal() {
  document.getElementById("cardModal").style.display = "none";
}

displayCards(window.cards);
