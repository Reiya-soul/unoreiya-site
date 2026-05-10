import { supabaseClient } from "./supabase.js";

let editingItem = null;
let optionState = {};

const optionConfig = {
  seasons: {
    label: "Series",
    kind: "series",
    inputId: "seasonInput",
    listId: "seasonsList",
    addButtonId: "addSeasonBtn",
    updateButtonId: "updateSeasonBtn"
  },
  categories: {
    label: "Category",
    kind: "category",
    inputId: "categoryInput",
    listId: "categoriesList",
    addButtonId: "addCategoryBtn",
    updateButtonId: "updateCategoryBtn"
  },
  types: {
    label: "Type",
    kind: "type",
    inputId: "typeInput",
    listId: "typesList",
    addButtonId: "addTypeBtn",
    updateButtonId: "updateTypeBtn"
  },
  tags: {
    label: "Tag",
    kind: "tag",
    inputId: "tagInput",
    listId: "tagsList",
    addButtonId: "addTagBtn",
    updateButtonId: "updateTagBtn"
  },
  modes: {
    label: "Mode",
    kind: "mode",
    inputId: "modeInput",
    listId: "modesList",
    addButtonId: "addModeBtn",
    updateButtonId: "updateModeBtn"
  }
};

const allowedKinds = new Set(Object.values(optionConfig).map(config => config.kind));

function setStatus(message, isError = false) {
  const status = document.getElementById("settingsStatus");
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? "#dc3545" : "#0f172a";
}

function getInput(type) {
  return document.getElementById(optionConfig[type].inputId);
}

function getAddButton(type) {
  return document.getElementById(optionConfig[type].addButtonId);
}

function getUpdateButton(type) {
  return document.getElementById(optionConfig[type].updateButtonId);
}

function normalizeOptionRow(row) {
  const kind = String(row.kind || "").trim();
  const name = String(row.name || "").trim();
  if (!allowedKinds.has(kind) || !name) return null;

  return {
    id: row.id,
    kind,
    name,
    sort_order: row.sort_order ?? 0
  };
}

function resetOptionState() {
  optionState = Object.fromEntries(Object.keys(optionConfig).map(type => [type, []]));
}

function groupOptions(rows) {
  resetOptionState();

  rows
    .map(normalizeOptionRow)
    .filter(Boolean)
    .forEach(option => {
      const type = Object.keys(optionConfig).find(key => optionConfig[key].kind === option.kind);
      if (type) optionState[type].push(option);
    });
}

async function loadOptions() {
  setStatus("Loading...");

  const { data, error } = await supabaseClient
    .from("card_options")
    .select("id, kind, name, sort_order")
    .in("kind", Array.from(allowedKinds))
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;

  groupOptions(data || []);
  setStatus(`Loaded ${data?.length || 0} card_options rows.`);
}

function renderEmptyMessage(list, label) {
  const li = document.createElement("li");
  const span = document.createElement("span");
  span.textContent = `No ${label} values yet.`;
  li.appendChild(span);
  list.appendChild(li);
}

function renderSection(type) {
  const config = optionConfig[type];
  const list = document.getElementById(config.listId);
  const items = optionState[type] || [];

  list.innerHTML = "";

  if (!items.length) {
    renderEmptyMessage(list, config.label);
    return;
  }

  items.forEach(item => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    const buttons = document.createElement("div");
    const editButton = document.createElement("button");
    const deleteButton = document.createElement("button");

    name.textContent = item.name;
    buttons.className = "button-group";

    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => startEditing(type, item));

    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteItem(type, item));

    buttons.appendChild(editButton);
    buttons.appendChild(deleteButton);
    li.appendChild(name);
    li.appendChild(buttons);
    list.appendChild(li);
  });
}

function renderAllSections() {
  Object.keys(optionConfig).forEach(renderSection);
}

function clearForm(type) {
  getInput(type).value = "";
  getAddButton(type).style.display = "inline-block";
  getUpdateButton(type).style.display = "none";

  if (editingItem?.type === type) {
    editingItem = null;
  }
}

function clearOtherEditState(activeType) {
  Object.keys(optionConfig)
    .filter(type => type !== activeType)
    .forEach(clearForm);
}

function getTrimmedInputValue(type) {
  return getInput(type).value.trim();
}

function hasDuplicateName(type, name, currentId = null) {
  return (optionState[type] || []).some(item => {
    return item.name === name && String(item.id) !== String(currentId);
  });
}

function getNextSortOrder(type) {
  const orders = (optionState[type] || []).map(item => Number(item.sort_order) || 0);
  return orders.length ? Math.max(...orders) + 1 : 0;
}

async function reloadAndRender() {
  await loadOptions();
  renderAllSections();
}

async function addItem(type) {
  const config = optionConfig[type];
  const name = getTrimmedInputValue(type);

  if (!name) {
    alert(`Enter a ${config.label} value.`);
    return;
  }

  if (hasDuplicateName(type, name)) {
    alert(`That ${config.label} already exists.`);
    return;
  }

  const { error } = await supabaseClient
    .from("card_options")
    .insert({
      kind: config.kind,
      name,
      sort_order: getNextSortOrder(type)
    });

  if (error) throw error;

  clearForm(type);
  await reloadAndRender();
  setStatus(`${config.label} added.`);
}

function startEditing(type, item) {
  clearOtherEditState(type);

  const input = getInput(type);
  input.value = item.name;
  input.focus();
  input.select();

  editingItem = { type, id: item.id };
  getAddButton(type).style.display = "none";
  getUpdateButton(type).style.display = "inline-block";
}

async function updateItem(type) {
  const config = optionConfig[type];
  const name = getTrimmedInputValue(type);

  if (!editingItem || editingItem.type !== type) {
    alert("Choose an item to edit.");
    return;
  }

  if (!name) {
    alert(`Enter a ${config.label} value.`);
    return;
  }

  if (hasDuplicateName(type, name, editingItem.id)) {
    alert(`That ${config.label} already exists.`);
    return;
  }

  const { error } = await supabaseClient
    .from("card_options")
    .update({ name })
    .eq("id", editingItem.id);

  if (error) throw error;

  clearForm(type);
  await reloadAndRender();
  setStatus(`${config.label} updated.`);
}

async function deleteItem(type, item) {
  const config = optionConfig[type];
  if (!confirm(`Delete "${item.name}"?`)) return;

  const { error } = await supabaseClient
    .from("card_options")
    .delete()
    .eq("id", item.id);

  if (error) throw error;

  if (editingItem?.id === item.id) {
    clearForm(type);
  }

  await reloadAndRender();
  setStatus(`${config.label} deleted.`);
}

async function runAction(action) {
  try {
    await action();
  } catch (error) {
    console.error(error);
    setStatus(`Supabase update failed: ${error.message}`, true);
    alert(`Supabase update failed.\n${error.message}`);
  }
}

function bindSection(type) {
  getAddButton(type).addEventListener("click", () => runAction(() => addItem(type)));
  getUpdateButton(type).addEventListener("click", () => runAction(() => updateItem(type)));
  getInput(type).addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    runAction(() => (editingItem?.type === type ? updateItem(type) : addItem(type)));
  });
}

async function initializeSettings() {
  resetOptionState();
  Object.keys(optionConfig).forEach(bindSection);

  try {
    await reloadAndRender();
  } catch (error) {
    console.error(error);
    resetOptionState();
    renderAllSections();
    setStatus(`Could not load card_options from Supabase: ${error.message}`, true);
  }
}

document.addEventListener("DOMContentLoaded", initializeSettings);
