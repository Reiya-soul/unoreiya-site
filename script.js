const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const seriesFilter = document.getElementById("seriesFilter");
const tagFilter = document.getElementById("tagFilter");
const modeFilter = document.getElementById("modeFilter");
const cardList = document.getElementById("cardList");
const noResults = document.getElementById("noResults");

function displayCards(cardData) {
  cardList.innerHTML = "";

  cardData.forEach(card => {
    const cardElement = document.createElement("div");
    cardElement.className = "card";
    cardElement.addEventListener("click", () => showCardDetail(card));

    const shortEffect = (card.effectShort || card.effect || "").length > 50 ? (card.effectShort || card.effect || "").substring(0, 50) + "..." : (card.effectShort || card.effect || "");
    const imageHtml = card.image
      ? `<img src="${card.image}" alt="${card.name}" class="card-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><div class="image-placeholder" style="display:none;">No Image</div>`
      : `<div class="image-placeholder">No Image</div>`;

    cardElement.innerHTML = `
      ${imageHtml}
      <h2>${card.name}</h2>
      <p><strong>カテゴリ：</strong>${card.category}</p>
      <p><strong>効果：</strong>${shortEffect}</p>
      <div class="tag-list">
        ${card.tags.map(tag => `<span class="tag">${tag}</span>`).join("")}
      </div>
    `;

    cardList.appendChild(cardElement);
  });
}

function getUniqueValues(key) {
  const values = window.cards.flatMap(card => {
    if (key === "tags" || key === "modes") {
      return card[key] || [];
    }
    return card[key] ? [card[key]] : [];
  });
  return [...new Set(values)].sort();
}

function populateFilter(selectElement, values) {
  values.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectElement.appendChild(option);
  });
}

function initFilters() {
  populateFilter(categoryFilter, getUniqueValues("category"));
  populateFilter(seriesFilter, getUniqueValues("series"));
  populateFilter(tagFilter, getUniqueValues("tags"));
  populateFilter(modeFilter, getUniqueValues("modes"));
}

function filterCards() {
  const keyword = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;
  const selectedSeries = seriesFilter.value;
  const selectedTag = tagFilter.value;
  const selectedMode = modeFilter.value;

  const filteredCards = window.cards.filter(card => {
      const text = [card.name, card.category, card.series, card.effectFull || card.effectShort || "", (card.modes || []).join(" "), card.tags.join(" ")]
        .join(" ")
        .toLowerCase();

    const matchesKeyword = !keyword || text.includes(keyword);
    const matchesCategory = !selectedCategory || card.category === selectedCategory;
    const matchesSeries = !selectedSeries || card.series === selectedSeries;
    const matchesTag = !selectedTag || card.tags.includes(selectedTag);
    const matchesMode = !selectedMode || (card.modes || []).includes(selectedMode);
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
  const modalName = document.getElementById("modalName");
  const modalCategory = document.getElementById("modalCategory");
  const modalSeries = document.getElementById("modalSeries");
  const modalMode = document.getElementById("modalMode");
  const modalEffect = document.getElementById("modalEffect");
  const modalTags = document.getElementById("modalTags");

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

  modalName.textContent = card.name;
  modalCategory.textContent = card.category;
  modalSeries.textContent = card.series;
  modalMode.textContent = Array.isArray(card.modes) ? card.modes.join(" / ") : (card.modes || "");
  modalEffect.textContent = card.effectFull || card.effectShort || "";
  modalTags.innerHTML = card.tags.map(tag => `<span class="tag">${tag}</span>`).join("");

  modal.style.display = "block";
}

function closeModal() {
  document.getElementById("cardModal").style.display = "none";
}

displayCards(window.cards);