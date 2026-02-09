// YouTube Notes Library - JavaScript

let allNotes = [];
let filteredNotes = [];
let activeNoteId = null;
let pendingDeleteId = null;

const groupModeKey = 'notesLibraryGroupMode';
let groupMode = localStorage.getItem(groupModeKey) === 'ungrouped' ? 'ungrouped' : 'grouped';

function getNoteDepth(note) {
  return note.activeDepth || note.reportDepth || (note.notesBrief ? 'brief' : 'detailed');
}

function getNoteContent(note, depth) {
  if (depth === 'detailed') {
    return note.notesDetailed || '';
  }
  return note.notesBrief || note.notes || '';
}

function getLocalISOString(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`;
}

function getNoteTags(note) {
  return Array.isArray(note.tags) ? note.tags : [];
}

function normalizeTags(input) {
  if (!input) return [];
  return Array.from(
    new Set(
      input
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
        .map(tag => tag.toLowerCase())
    )
  );
}

// ==================== DARK MODE ====================
const darkModeToggle = document.getElementById('darkModeToggle');
const themeKey = 'notesLibraryTheme';
const prefersDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
}

const storedTheme = localStorage.getItem(themeKey);
const hasStoredTheme = storedTheme === 'dark' || storedTheme === 'light';

if (hasStoredTheme) {
  applyTheme(storedTheme);
} else {
  applyTheme(prefersDarkQuery.matches ? 'dark' : 'light');
  prefersDarkQuery.addEventListener('change', (e) => {
    applyTheme(e.matches ? 'dark' : 'light');
  });
}

// Toggle dark mode
if (darkModeToggle) {
  darkModeToggle.addEventListener('click', () => {
    const nextTheme = document.body.classList.contains('dark-mode')
      ? 'light'
      : 'dark';
    localStorage.setItem(themeKey, nextTheme);
    applyTheme(nextTheme);
  });
}

// Load all notes from storage
async function loadNotes() {
  chrome.storage.local.get(['youtube_video_notes'], (result) => {
    const notesData = result.youtube_video_notes || {};

    console.log('[Notes Library] Loading notes:', notesData);
    console.log('[Notes Library] Number of notes:', Object.keys(notesData).length);

    allNotes = Object.values(notesData).sort((a, b) =>
      new Date(b.updatedAt) - new Date(a.updatedAt)
    );
    filteredNotes = [...allNotes];
    applySearchFilter();
    renderNotes();
    updateStats();
  });
}

// Render notes grid
function renderTagsHtml(tags) {
  if (!tags.length) return '';
  return `
    <div class="note-tags">
      ${tags.map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('')}
    </div>
  `;
}

function renderNoteCard(note) {
  const tags = getNoteTags(note);
  return `
    <div class="note-card" data-video-id="${note.videoId}">
      <div class="note-header">
      <div class="note-title">${escapeHtml(note.title || 'Untitled')}</div>
        <div class="note-date">${formatDate(note.updatedAt)}</div>
      </div>
      <div class="note-preview">
        ${escapeHtml(getPreview(getNoteContent(note, getNoteDepth(note))))}
      </div>
      ${renderTagsHtml(tags)}
      <div class="note-actions">
        <button class="btn btn-primary" data-action="open-video" data-url="${note.url}">
          <svg viewBox="0 0 24 24">
            <path d="M10,16.5V7.5L16,12M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
          </svg>
          Watch Video
        </button>
        <button class="btn btn-secondary" data-action="copy" data-video-id="${note.videoId}">
          <svg viewBox="0 0 24 24">
            <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/>
          </svg>
          Copy
        </button>
        <button class="btn btn-secondary" data-action="download" data-video-id="${note.videoId}">
          <svg viewBox="0 0 24 24">
            <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
          </svg>
          Download
        </button>
        <button class="btn btn-danger" data-action="delete" data-video-id="${note.videoId}">
          <svg viewBox="0 0 24 24">
            <path d="M9,3V4H4V6H5V19A2,2 0 0,0 7,21H17A2,2 0 0,0 19,19V6H20V4H15V3H9M7,6H17V19H7V6Z"/>
          </svg>
          Delete
        </button>
      </div>
    </div>
  `;
}

function renderGroupedNotes() {
  const grouped = new Map();
  const unlisted = [];

  filteredNotes.forEach((note) => {
    const tags = getNoteTags(note);
    if (!tags.length) {
      unlisted.push(note);
      return;
    }
    tags.forEach((tag) => {
      const key = tag.toLowerCase();
      if (!grouped.has(key)) {
        grouped.set(key, { label: tag, notes: [] });
      }
      grouped.get(key).notes.push(note);
    });
  });

  const sortedTags = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
  let html = '';

  sortedTags.forEach((tagKey) => {
    const group = grouped.get(tagKey);
    html += `
      <details class="tag-panel" data-tag="${escapeHtml(tagKey)}">
        <summary>
          <span class="tag-count">${group.notes.length}</span>
          <span class="tag-label">${escapeHtml(group.label)}</span>
          <span class="tag-toggle-icon" aria-hidden="true"></span>
        </summary>
        <div class="tag-panel-content">
          <div class="group-notes">
            ${group.notes.map(note => renderNoteCard(note)).join('')}
          </div>
        </div>
      </details>
    `;
  });

  if (unlisted.length) {
    html += `
      <hr class="unlisted-divider">
      <div class="unlisted-heading">Unlisted</div>
      <div class="unlisted-notes">
        ${unlisted.map(note => renderNoteCard(note)).join('')}
      </div>
    `;
  }

  return html;
}

function renderNotes() {
  const grid = document.getElementById('notes-grid');

  if (filteredNotes.length === 0) {
    grid.classList.remove('grouped');
    grid.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
        </svg>
        <div class="empty-title">No notes yet</div>
        <div class="empty-description">Start generating notes from YouTube videos</div>
      </div>
    `;
    return;
  }

  if (groupMode === 'grouped') {
    grid.classList.add('grouped');
    grid.innerHTML = renderGroupedNotes();
    initTagPanels();
  } else {
    grid.classList.remove('grouped');
    grid.innerHTML = filteredNotes.map(note => renderNoteCard(note)).join('');
  }
}

function initTagPanels() {
  const panels = document.querySelectorAll('.tag-panel');
  panels.forEach((panel) => {
    const content = panel.querySelector('.tag-panel-content');
    if (!content) return;
    if (panel.open) {
      content.style.maxHeight = `${content.scrollHeight}px`;
    } else {
      content.style.maxHeight = '0px';
    }
    panel.addEventListener('toggle', () => {
      if (panel.open) {
        content.style.maxHeight = `${content.scrollHeight}px`;
        return;
      }
      const currentHeight = content.scrollHeight;
      content.style.maxHeight = `${currentHeight}px`;
      requestAnimationFrame(() => {
        content.style.maxHeight = '0px';
      });
    });
  });
}

// Update statistics
function updateStats() {
  const totalNotesElement = document.getElementById('total-notes');
  if (totalNotesElement) {
    totalNotesElement.textContent = allNotes.length;
  }
}

// Search functionality
const searchInput = document.getElementById('search-input');

function applySearchFilter() {
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
  if (!query) {
    filteredNotes = [...allNotes];
    applyCurrentSort();
    return;
  }
  filteredNotes = allNotes.filter(note =>
    (note.title || '').toLowerCase().includes(query) ||
    (getNoteContent(note, getNoteDepth(note)) || '').toLowerCase().includes(query) ||
    getNoteTags(note).some(tag => tag.toLowerCase().includes(query))
  );
  applyCurrentSort();
}

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    applySearchFilter();
    renderNotes();
  });
}

// Card and button interactions
const notesGrid = document.getElementById('notes-grid');
if (notesGrid) {
  notesGrid.addEventListener('click', (e) => {
    const actionButton = e.target.closest('button[data-action]');
    if (actionButton) {
      e.stopPropagation();
      const action = actionButton.dataset.action;
      if (action === 'open-video') {
        openVideo(actionButton.dataset.url);
        return;
      }
      if (action === 'copy') {
        copyNotes(actionButton.dataset.videoId);
        return;
      }
      if (action === 'download') {
        downloadNotes(actionButton.dataset.videoId);
        return;
      }
      if (action === 'delete') {
        openDeleteModal(actionButton.dataset.videoId);
        return;
      }
    }

    const card = e.target.closest('.note-card');
    if (card && notesGrid.contains(card)) {
      viewNote(card.dataset.videoId);
    }
  });
}

// Sort functionality
const sortSelect = document.getElementById('sort-select');

function applySort(sortBy) {
  if (sortBy === 'newest') {
    filteredNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } else if (sortBy === 'oldest') {
    filteredNotes.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
  } else if (sortBy === 'title') {
    filteredNotes.sort((a, b) => a.title.localeCompare(b.title));
  }
}

function applyCurrentSort() {
  const sortBy = sortSelect ? sortSelect.value : 'newest';
  applySort(sortBy);
}

if (sortSelect) {
  sortSelect.addEventListener('change', (e) => {
    applySort(e.target.value);
    renderNotes();
  });
}

const groupToggleBtn = document.getElementById('group-toggle-btn');

function updateGroupToggle() {
  if (!groupToggleBtn) return;
  const isGrouped = groupMode === 'grouped';
  groupToggleBtn.textContent = isGrouped ? 'Ungroup' : 'Group';
  groupToggleBtn.setAttribute('aria-pressed', String(isGrouped));
}

if (groupToggleBtn) {
  updateGroupToggle();
  groupToggleBtn.addEventListener('click', () => {
    groupMode = groupMode === 'grouped' ? 'ungrouped' : 'grouped';
    localStorage.setItem(groupModeKey, groupMode);
    updateGroupToggle();
    renderNotes();
  });
}

// Export / Import
const exportBtn = document.getElementById('export-notes-btn');
const importBtn = document.getElementById('import-notes-btn');
const importFileInput = document.getElementById('import-file-input');

function sanitizeFilename(name) {
  return (name || 'untitled')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 80);
}

function formatDateFolder(dateString) {
  const date = new Date(dateString || Date.now());
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function exportNotesZip() {
  const zip = new JSZip();
  const metadata = {
    exportedAt: getLocalISOString(),
    totalNotes: allNotes.length,
    notes: allNotes
  };
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  allNotes.forEach((note) => {
    const folder = zip.folder(formatDateFolder(note.updatedAt));
    const title = sanitizeFilename(note.title || note.videoId);
    const briefContent = getNoteContent(note, 'brief');
    const detailedContent = getNoteContent(note, 'detailed');
    if (briefContent) {
      folder.file(`${title}-brief.md`, briefContent);
    }
    if (detailedContent) {
      folder.file(`${title}-detailed.md`, detailedContent);
    }
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  a.download = `youtube-notes-${yyyy}-${mm}-${dd}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export complete', 'success');
}

function mergeNotes(existing, incoming) {
  const merged = { ...existing };
  Object.keys(incoming).forEach((key) => {
    merged[key] = incoming[key];
  });
  return merged;
}

async function importNotesFile(file) {
  if (!file) return;
  if (file.name.endsWith('.json')) {
    const text = await file.text();
    const data = JSON.parse(text);
    const notesData = data.notes || data.youtube_video_notes || data;
    chrome.storage.local.get(['youtube_video_notes'], (result) => {
      const existing = result.youtube_video_notes || {};
      const merged = mergeNotes(existing, notesData);
      chrome.storage.local.set({ youtube_video_notes: merged }, () => {
        showToast('Import complete', 'success');
        loadNotes();
      });
    });
    return;
  }

  if (file.name.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(file);
    let notesData = null;
    if (zip.file('metadata.json')) {
      const metaText = await zip.file('metadata.json').async('string');
      const meta = JSON.parse(metaText);
      if (meta && Array.isArray(meta.notes)) {
        notesData = {};
        meta.notes.forEach((note) => {
          if (note.videoId) {
            notesData[note.videoId] = note;
          }
        });
      }
    }
    if (!notesData) {
      showToast('Invalid zip format', 'error');
      return;
    }
    chrome.storage.local.get(['youtube_video_notes'], (result) => {
      const existing = result.youtube_video_notes || {};
      const merged = mergeNotes(existing, notesData);
      chrome.storage.local.set({ youtube_video_notes: merged }, () => {
        showToast('Import complete', 'success');
        loadNotes();
      });
    });
  }
}

if (exportBtn) {
  exportBtn.addEventListener('click', exportNotesZip);
}

if (importBtn && importFileInput) {
  importBtn.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    importNotesFile(file);
    importFileInput.value = '';
  });
}

function renderModalTags(tags) {
  const modalTagsList = document.getElementById('modal-tags-list');
  if (!modalTagsList) return;
  if (!tags.length) {
    modalTagsList.innerHTML = '<span class="modal-tags-empty">No tags yet</span>';
    return;
  }
  modalTagsList.innerHTML = tags
    .map(tag => `<span class="tag-chip">${escapeHtml(tag)}</span>`)
    .join('');
}

// View note in modal
function viewNote(videoId) {
  const note = allNotes.find(n => n.videoId === videoId);
  if (!note) return;

  const modalTitle = document.getElementById('modal-title');
  const modalMeta = document.getElementById('modal-meta');
  const modalBody = document.getElementById('modal-body');
  const modalEditor = document.getElementById('modal-editor');
  const modalDepthSelect = document.getElementById('modal-depth-select');
  const modalTagsList = document.getElementById('modal-tags-list');
  const modalTagsInput = document.getElementById('modal-tags-input');
  const modalTagsEditor = document.getElementById('modal-tags-editor');
  const noteModal = document.getElementById('note-modal');
  const depth = getNoteDepth(note);
  const content = getNoteContent(note, depth);

  if (modalTitle) modalTitle.textContent = note.title;
  if (modalMeta) {
    const createdAt = note.createdAt || note.updatedAt;
    const updatedAt = note.updatedAt || note.createdAt;
    const createdText = formatFullDate(createdAt);
    const updatedText = formatFullDate(updatedAt);
    modalMeta.innerHTML = `
      <div>Created: ${escapeHtml(createdText)}</div>
      <div>Updated: ${escapeHtml(updatedText)}</div>
    `;
  }
  if (modalBody) modalBody.innerHTML = renderMarkdown(content);
  if (modalEditor) {
    modalEditor.value = content;
    modalEditor.style.display = 'none';
  }
  if (modalDepthSelect) {
    modalDepthSelect.value = depth;
  }
  if (modalTagsEditor) {
    modalTagsEditor.style.display = 'none';
  }
  if (modalTagsInput) {
    modalTagsInput.value = getNoteTags(note).join(', ');
  }
  if (modalTagsList) {
    renderModalTags(getNoteTags(note));
  }
  setModalTagsEditState(false);
  setModalEditState(false);
  if (noteModal) noteModal.classList.add('active');
  activeNoteId = videoId;
}

// Close modal
function closeModal() {
  const noteModal = document.getElementById('note-modal');
  if (noteModal) {
    noteModal.classList.remove('active');
  }
  activeNoteId = null;
  setModalEditState(false);
  setModalTagsEditState(false);
}

const modalCloseBtn = document.getElementById('modal-close-btn');
if (modalCloseBtn) {
  modalCloseBtn.addEventListener('click', closeModal);
}

const modalEditBtn = document.getElementById('modal-edit-btn');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalDepthSelect = document.getElementById('modal-depth-select');
const modalDeleteBtn = document.getElementById('modal-delete-btn');
const modalTagsEditBtn = document.getElementById('modal-tags-edit-btn');
const modalTagsSaveBtn = document.getElementById('modal-tags-save-btn');
const modalTagsCancelBtn = document.getElementById('modal-tags-cancel-btn');

function setModalEditState(isEditing) {
  const modalBody = document.getElementById('modal-body');
  const modalEditor = document.getElementById('modal-editor');
  if (modalBody) modalBody.style.display = isEditing ? 'none' : 'block';
  if (modalEditor) modalEditor.style.display = isEditing ? 'block' : 'none';
  if (modalEditBtn) modalEditBtn.style.display = isEditing ? 'none' : 'inline-flex';
  if (modalSaveBtn) modalSaveBtn.style.display = isEditing ? 'inline-flex' : 'none';
  if (modalCancelBtn) modalCancelBtn.style.display = isEditing ? 'inline-flex' : 'none';
}

function setModalTagsEditState(isEditing) {
  const modalTagsEditor = document.getElementById('modal-tags-editor');
  if (modalTagsEditor) modalTagsEditor.style.display = isEditing ? 'grid' : 'none';
  if (modalTagsEditBtn) modalTagsEditBtn.style.display = isEditing ? 'none' : 'inline-flex';
}

if (modalEditBtn) {
  modalEditBtn.addEventListener('click', () => {
    if (!activeNoteId) return;
    setModalEditState(true);
  });
}

if (modalCancelBtn) {
  modalCancelBtn.addEventListener('click', () => {
    setModalEditState(false);
  });
}

if (modalDeleteBtn) {
  modalDeleteBtn.addEventListener('click', () => {
    if (!activeNoteId) return;
    openDeleteModal(activeNoteId);
  });
}

if (modalTagsEditBtn) {
  modalTagsEditBtn.addEventListener('click', () => {
    if (!activeNoteId) return;
    setModalTagsEditState(true);
  });
}

if (modalTagsCancelBtn) {
  modalTagsCancelBtn.addEventListener('click', () => {
    if (!activeNoteId) return;
    const note = allNotes.find(n => n.videoId === activeNoteId);
    const modalTagsInput = document.getElementById('modal-tags-input');
    if (modalTagsInput && note) {
      modalTagsInput.value = getNoteTags(note).join(', ');
    }
    setModalTagsEditState(false);
  });
}

if (modalTagsSaveBtn) {
  modalTagsSaveBtn.addEventListener('click', () => {
    if (!activeNoteId) return;
    const modalTagsInput = document.getElementById('modal-tags-input');
    const inputValue = modalTagsInput ? modalTagsInput.value : '';
    const tags = normalizeTags(inputValue);
    const note = allNotes.find(n => n.videoId === activeNoteId);
    if (!note) return;

    chrome.storage.local.get(['youtube_video_notes'], (result) => {
      const notesData = result.youtube_video_notes || {};
      if (!notesData[activeNoteId]) return;
      notesData[activeNoteId].tags = tags;
      chrome.storage.local.set({ youtube_video_notes: notesData }, () => {
        note.tags = tags;
        renderModalTags(tags);
        setModalTagsEditState(false);
        applySearchFilter();
        renderNotes();
        showToast('Tags updated', 'success');
      });
    });
  });
}

if (modalSaveBtn) {
  modalSaveBtn.addEventListener('click', () => {
    if (!activeNoteId) return;
    const modalEditor = document.getElementById('modal-editor');
    const updatedNotes = modalEditor ? modalEditor.value : '';
    const note = allNotes.find(n => n.videoId === activeNoteId);
    if (!note) return;
    const depth = getNoteDepth(note);

    chrome.storage.local.get(['youtube_video_notes'], (result) => {
      const notesData = result.youtube_video_notes || {};
      if (!notesData[activeNoteId]) return;
      if (depth === 'detailed') {
        notesData[activeNoteId].notesDetailed = updatedNotes;
        note.notesDetailed = updatedNotes;
      } else {
        notesData[activeNoteId].notesBrief = updatedNotes;
        notesData[activeNoteId].notes = updatedNotes;
        note.notesBrief = updatedNotes;
      }
      notesData[activeNoteId].activeDepth = depth;
      note.activeDepth = depth;
      notesData[activeNoteId].updatedAt = getLocalISOString();
      chrome.storage.local.set({ youtube_video_notes: notesData }, () => {
        note.updatedAt = notesData[activeNoteId].updatedAt;
        applySearchFilter();
        renderNotes();
        updateStats();
        const modalBody = document.getElementById('modal-body');
        if (modalBody) modalBody.innerHTML = renderMarkdown(updatedNotes);
        setModalEditState(false);
        showToast('Notes updated!', 'success');
      });
    });
  });
}

if (modalDepthSelect) {
  modalDepthSelect.addEventListener('change', (event) => {
    if (!activeNoteId) return;
    const depth = event.target.value;
    const note = allNotes.find(n => n.videoId === activeNoteId);
    if (!note) return;
    note.activeDepth = depth;
    const content = getNoteContent(note, depth);
    const modalBody = document.getElementById('modal-body');
    const modalEditor = document.getElementById('modal-editor');
    if (modalBody) modalBody.innerHTML = renderMarkdown(content);
    if (modalEditor) modalEditor.value = content;
    chrome.storage.local.get(['youtube_video_notes'], (result) => {
      const notesData = result.youtube_video_notes || {};
      if (!notesData[activeNoteId]) return;
      notesData[activeNoteId].activeDepth = depth;
      chrome.storage.local.set({ youtube_video_notes: notesData }, () => {
        showToast('Depth updated', 'success');
      });
    });
  });
}

function openDeleteModal(videoId) {
  const deleteModal = document.getElementById('delete-modal');
  const deleteModalBody = document.getElementById('delete-modal-body');
  const note = allNotes.find(n => n.videoId === videoId);
  if (!deleteModal || !note) return;
  pendingDeleteId = videoId;
  if (deleteModalBody) {
    deleteModalBody.textContent = `Are you sure you want to delete "${note.title}"? This action cannot be undone.`;
  }
  deleteModal.classList.add('active');
}

function closeDeleteModal() {
  const deleteModal = document.getElementById('delete-modal');
  if (deleteModal) {
    deleteModal.classList.remove('active');
  }
  pendingDeleteId = null;
}

function deleteNote(videoId) {
  chrome.storage.local.get(['youtube_video_notes'], (result) => {
    const notesData = result.youtube_video_notes || {};
    if (!notesData[videoId]) return;
    delete notesData[videoId];
    chrome.storage.local.set({ youtube_video_notes: notesData }, () => {
      allNotes = allNotes.filter(note => note.videoId !== videoId);
      filteredNotes = filteredNotes.filter(note => note.videoId !== videoId);
      applySearchFilter();
      renderNotes();
      updateStats();
      if (activeNoteId === videoId) {
        closeModal();
      }
      showToast('Note deleted', 'success');
    });
  });
}

const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');
const deleteModalCloseBtn = document.getElementById('delete-modal-close-btn');
const deleteModal = document.getElementById('delete-modal');

if (deleteConfirmBtn) {
  deleteConfirmBtn.addEventListener('click', () => {
    if (!pendingDeleteId) return;
    const targetId = pendingDeleteId;
    closeDeleteModal();
    deleteNote(targetId);
  });
}

if (deleteCancelBtn) {
  deleteCancelBtn.addEventListener('click', closeDeleteModal);
}

if (deleteModalCloseBtn) {
  deleteModalCloseBtn.addEventListener('click', closeDeleteModal);
}

if (deleteModal) {
  deleteModal.addEventListener('click', (e) => {
    if (e.target.id === 'delete-modal') {
      closeDeleteModal();
    }
  });
}

// Open video in new tab
function openVideo(url) {
  window.open(url, '_blank');
}

// Copy notes to clipboard
function copyNotes(videoId) {
  const note = allNotes.find(n => n.videoId === videoId);
  if (!note) return;

  const depth = getNoteDepth(note);
  const content = getNoteContent(note, depth);

  navigator.clipboard.writeText(content).then(() => {
    showToast('Notes copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy notes', 'error');
  });
}

// Download notes as markdown
function downloadNotes(videoId) {
  const note = allNotes.find(n => n.videoId === videoId);
  if (!note) return;

  const depth = getNoteDepth(note);
  const content = getNoteContent(note, depth);
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${note.title}-${depth}.md`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Notes downloaded!', 'success');
}

// Show toast notification
function showToast(message, type = 'info') {
  const existingToast = document.querySelector('.toast-notification');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === 'success' ? '#00D924' : type === 'error' ? '#F44336' : '#065fd4'};
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    animation: slideIn 0.3s ease;
    z-index: 10000;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getPreview(text) {
  const safeText = text || '';
  if (!safeText) return 'No notes yet...';
  return safeText.substring(0, 200) + '...';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = startOfNow - startOfDate;
  const days = Math.round(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function formatFullDate(dateString) {
  if (!dateString) return 'Unknown date';
  const date = new Date(dateString);
  const datePart = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
  return `${datePart} at ${timePart}`;
}

function renderMarkdown(text) {
  const normalized = text
    .replace(
      /^\s*-\s+\*\*(Executive Summary|Key Themes|Critical Insights|Notable Quotes|Recommendations)\*\*\s*:?/gim,
      "## $1"
    )
    .replace(/^\s*-\s+(#{2,3})\s+/gm, "$1 ")
    .replace(/^\s*\*\s+/gm, "- ");

  const escapeHtml = (input) =>
    input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const formatInline = (input) => {
    const escaped = escapeHtml(input);
    const parts = escaped.split(/`/);
    return parts
      .map((part, index) => {
        if (index % 2 === 1) {
          return `<code>${part}</code>`;
        }
        return part
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>");
      })
      .join("");
  };

  const lines = normalized.split(/\r?\n/);
  const html = [];
  const listStack = [];
  let paragraphBuffer = [];

  const closeParagraph = () => {
    if (paragraphBuffer.length) {
      html.push(`<p>${formatInline(paragraphBuffer.join(" "))}</p>`);
      paragraphBuffer = [];
    }
  };

  const closeLists = (targetLevel = 0) => {
    while (listStack.length > targetLevel) {
      const list = listStack.pop();
      html.push(`</${list.type}>`);
    }
  };

  const openList = (type) => {
    html.push(`<${type}>`);
    listStack.push({ type });
  };

  const parseTable = (startIndex) => {
    const headerLine = lines[startIndex];
    const separatorLine = lines[startIndex + 1];
    if (!separatorLine) return null;
    const separatorPattern = /^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/;
    if (!separatorPattern.test(separatorLine)) return null;

    const parseRow = (row) =>
      row
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => formatInline(cell.trim()));

    const headerCells = parseRow(headerLine);
    let i = startIndex + 2;
    const bodyRows = [];
    while (i < lines.length && /\|/.test(lines[i])) {
      bodyRows.push(parseRow(lines[i]));
      i += 1;
    }

    let tableHtml = "<table><thead><tr>";
    tableHtml += headerCells.map((cell) => `<th>${cell}</th>`).join("");
    tableHtml += "</tr></thead><tbody>";
    tableHtml += bodyRows
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`
      )
      .join("");
    tableHtml += "</tbody></table>";
    return { html: tableHtml, nextIndex: i };
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      closeParagraph();
      closeLists(0);
      i += 1;
      continue;
    }

    const tableResult = parseTable(i);
    if (tableResult) {
      closeParagraph();
      closeLists(0);
      html.push(tableResult.html);
      i = tableResult.nextIndex;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      closeParagraph();
      closeLists(0);
      const level = headingMatch[1].length;
      html.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      closeParagraph();
      closeLists(0);
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      const quoteContent = quoteLines.map((q) => formatInline(q)).join("<br>");
      html.push(`<blockquote>${quoteContent}</blockquote>`);
      continue;
    }

    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      closeParagraph();
      const indent = listMatch[1].replace(/\t/g, "  ").length;
      const level = Math.floor(indent / 2);
      const isOrdered = /^\d+\./.test(listMatch[2]);
      const listType = isOrdered ? "ol" : "ul";

      if (listStack.length < level + 1) {
        while (listStack.length < level) {
          openList("ul");
        }
        openList(listType);
      } else if (listStack.length > level + 1) {
        closeLists(level + 1);
      }

      const current = listStack[listStack.length - 1];
      if (current && current.type !== listType) {
        closeLists(level);
        openList(listType);
      }

      html.push(`<li>${formatInline(listMatch[3])}</li>`);
      i += 1;
      continue;
    }

    paragraphBuffer.push(trimmed);
    i += 1;
  }

  closeParagraph();
  closeLists(0);
  return html.join("\n");
}

// Close modal on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const deleteModal = document.getElementById('delete-modal');
    if (deleteModal && deleteModal.classList.contains('active')) {
      closeDeleteModal();
      return;
    }
    closeModal();
  }
});

// Close modal on background click
const noteModal = document.getElementById('note-modal');
if (noteModal) {
  noteModal.addEventListener('click', (e) => {
    if (e.target.id === 'note-modal') {
      closeModal();
    }
  });
}

// Add toast animation styles
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize
loadNotes();
