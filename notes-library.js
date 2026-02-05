// YouTube Notes Library - JavaScript

let allNotes = [];
let filteredNotes = [];

// ==================== DARK MODE ====================
const darkModeToggle = document.getElementById('darkModeToggle');
const darkModeIcon = document.getElementById('darkModeIcon');

// Load dark mode preference from localStorage
const isDarkMode = localStorage.getItem('notesLibraryDarkMode') === 'true';
if (isDarkMode) {
  document.body.classList.add('dark-mode');
}

// Toggle dark mode
if (darkModeToggle) {
  darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('notesLibraryDarkMode', isDark);
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
    <div class="note-card" onclick="viewNote('${note.videoId}')">
      <div class="note-header">
        <div class="note-title">${escapeHtml(note.title)}</div>
        <div class="note-date">${formatDate(note.updatedAt)}</div>
      </div>
      <div class="note-preview">
        ${escapeHtml(getPreview(note.notes))}
      </div>
      <div class="note-actions" onclick="event.stopPropagation()">
        <button class="btn btn-primary" onclick="openVideo('${note.url}')">
          <svg viewBox="0 0 24 24">
            <path d="M10,16.5V7.5L16,12M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z"/>
          </svg>
          Watch Video
        </button>
        <button class="btn btn-secondary" onclick="copyNotes('${note.videoId}')">
          <svg viewBox="0 0 24 24">
            <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/>
          </svg>
          Copy
        </button>
        <button class="btn btn-secondary" onclick="downloadNotes('${note.videoId}')">
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
  const noteModal = document.getElementById('note-modal');

  if (modalTitle) modalTitle.textContent = note.title;
  if (modalBody) modalBody.innerHTML = renderMarkdown(note.notes);
  if (noteModal) noteModal.classList.add('active');
}

// Close modal
function closeModal() {
  const noteModal = document.getElementById('note-modal');
  if (noteModal) {
    noteModal.classList.remove('active');
  }
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
  // First, normalize asterisk bullets to hyphens for consistency
  // This handles cases where the model uses "* item" instead of "- item"
  let normalized = text.replace(/^\s*\*\s+/gm, "- ");

  let html = normalized
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/^[\*\-] (.*$)/gim, '<li>$1</li>')
    .replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  html = html.replace(/(<li>.*?<\/li>(?:\s*<br>\s*<li>.*?<\/li>)*)/gs, '<ul>$1</ul>');
  html = html.replace(/<\/li>\s*<br>\s*<li>/g, '</li><li>');

  if (!html.startsWith('<')) {
    html = `<p>${html}</p>`;
  }

  return html;
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
