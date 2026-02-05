// YouTube Notes Library - JavaScript

let allNotes = [];
let filteredNotes = [];
let activeNoteId = null;

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
    renderNotes();
    updateStats();
  });
}

// Render notes grid
function renderNotes() {
  const grid = document.getElementById('notes-grid');

  if (filteredNotes.length === 0) {
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

  grid.innerHTML = filteredNotes.map(note => `
    <div class="note-card" data-video-id="${note.videoId}">
      <div class="note-header">
        <div class="note-title">${escapeHtml(note.title)}</div>
        <div class="note-date">${formatDate(note.updatedAt)}</div>
      </div>
      <div class="note-preview">
        ${escapeHtml(getPreview(note.notes))}
      </div>
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
      </div>
    </div>
  `).join('');
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
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    filteredNotes = allNotes.filter(note =>
      note.title.toLowerCase().includes(query) ||
      note.notes.toLowerCase().includes(query)
    );
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
    }

    const card = e.target.closest('.note-card');
    if (card && notesGrid.contains(card)) {
      viewNote(card.dataset.videoId);
    }
  });
}

// Sort functionality
const sortSelect = document.getElementById('sort-select');
if (sortSelect) {
  sortSelect.addEventListener('change', (e) => {
    const sortBy = e.target.value;

    if (sortBy === 'newest') {
      filteredNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    } else if (sortBy === 'oldest') {
      filteredNotes.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
    } else if (sortBy === 'title') {
      filteredNotes.sort((a, b) => a.title.localeCompare(b.title));
    }

    renderNotes();
  });
}

// View note in modal
function viewNote(videoId) {
  const note = allNotes.find(n => n.videoId === videoId);
  if (!note) return;

  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalEditor = document.getElementById('modal-editor');
  const modalDepthSelect = document.getElementById('modal-depth-select');
  const noteModal = document.getElementById('note-modal');

  if (modalTitle) modalTitle.textContent = note.title;
  if (modalBody) modalBody.innerHTML = renderMarkdown(note.notes);
  if (modalEditor) {
    modalEditor.value = note.notes;
    modalEditor.style.display = 'none';
  }
  if (modalDepthSelect) {
    modalDepthSelect.value = note.reportDepth || 'brief';
  }
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
}

const modalCloseBtn = document.getElementById('modal-close-btn');
if (modalCloseBtn) {
  modalCloseBtn.addEventListener('click', closeModal);
}

const modalEditBtn = document.getElementById('modal-edit-btn');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalDepthSelect = document.getElementById('modal-depth-select');

function setModalEditState(isEditing) {
  const modalBody = document.getElementById('modal-body');
  const modalEditor = document.getElementById('modal-editor');
  if (modalBody) modalBody.style.display = isEditing ? 'none' : 'block';
  if (modalEditor) modalEditor.style.display = isEditing ? 'block' : 'none';
  if (modalEditBtn) modalEditBtn.style.display = isEditing ? 'none' : 'inline-flex';
  if (modalSaveBtn) modalSaveBtn.style.display = isEditing ? 'inline-flex' : 'none';
  if (modalCancelBtn) modalCancelBtn.style.display = isEditing ? 'inline-flex' : 'none';
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

if (modalSaveBtn) {
  modalSaveBtn.addEventListener('click', () => {
    if (!activeNoteId) return;
    const modalEditor = document.getElementById('modal-editor');
    const updatedNotes = modalEditor ? modalEditor.value : '';
    const note = allNotes.find(n => n.videoId === activeNoteId);
    if (!note) return;

    chrome.storage.local.get(['youtube_video_notes'], (result) => {
      const notesData = result.youtube_video_notes || {};
      if (!notesData[activeNoteId]) return;
      notesData[activeNoteId].notes = updatedNotes;
      notesData[activeNoteId].reportDepth = note.reportDepth || 'brief';
      notesData[activeNoteId].updatedAt = new Date().toISOString();
      chrome.storage.local.set({ youtube_video_notes: notesData }, () => {
        note.notes = updatedNotes;
        note.updatedAt = notesData[activeNoteId].updatedAt;
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
    note.reportDepth = depth;
    chrome.storage.local.get(['youtube_video_notes'], (result) => {
      const notesData = result.youtube_video_notes || {};
      if (!notesData[activeNoteId]) return;
      notesData[activeNoteId].reportDepth = depth;
      chrome.storage.local.set({ youtube_video_notes: notesData }, () => {
        showToast('Depth updated', 'success');
      });
    });
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

  navigator.clipboard.writeText(note.notes).then(() => {
    showToast('Notes copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy notes', 'error');
  });
}

// Download notes as markdown
function downloadNotes(videoId) {
  const note = allNotes.find(n => n.videoId === videoId);
  if (!note) return;

  const blob = new Blob([note.notes], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${note.title}.md`;
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
  return text.substring(0, 200) + '...';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
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
