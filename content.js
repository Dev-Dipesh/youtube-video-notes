// YouTube Video Notes Extension - MECE Notes Generator
// Redesigned with modern UX/UI patterns, draggable panel, dark mode, and accessibility

(function () {
  "use strict";

  // ==================== CONFIGURATION ====================
  const CONFIG = {
    API_ENDPOINT:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    MODEL: "gemini-2.0-flash",
    STORAGE_KEYS: {
      API_KEY: "gemini_api_key",
      NOTES: "youtube_video_notes",
      PANEL_STATE: "panel_state",
      PANEL_POSITION: "panel_position",
      PANEL_SIZE: "panel_size",
    },
    PANEL_ID: "ytn-notes-panel",
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 2000,
    DEFAULT_WIDTH: 420,
    MIN_WIDTH: 320,
    MAX_WIDTH: 700,
  };

  // ==================== STATE MANAGEMENT ====================
  let state = {
    currentVideoId: null,
    currentVideoTitle: null,
    currentVideoUrl: null,
    transcript: null,
    transcriptPreview: null,
    generatedNotes: null,
    isGenerating: false,
    isEditing: false,
    isPanelCollapsed: false,
    isDarkMode: false,
    panelPosition: { x: null, y: null },
    panelSize: { width: CONFIG.DEFAULT_WIDTH },
    isDragging: false,
    dragOffset: { x: 0, y: 0 },
  };

  // ==================== DOM ELEMENTS ====================
  let panelElements = {};

  // ==================== UTILITY FUNCTIONS ====================

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  function estimateTokens(text) {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  function estimateCost(inputTokens, outputTokens = 1500) {
    // Gemini 2.0 Flash: $0.10 per 1M input, $0.40 per 1M output
    const inputCost = (inputTokens / 1000000) * 0.1;
    const outputCost = (outputTokens / 1000000) * 0.4;
    return (inputCost + outputCost).toFixed(4);
  }

  function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  // ==================== THEME DETECTION ====================

  function detectDarkMode() {
    const htmlElement = document.documentElement;
    const isDark =
      htmlElement.getAttribute("dark") === "true" ||
      htmlElement.hasAttribute("dark");
    state.isDarkMode = isDark;
    return isDark;
  }

  function updateTheme() {
    const isDark = detectDarkMode();
    const panel = document.getElementById(CONFIG.PANEL_ID);
    if (panel) {
      panel.classList.toggle("ytn-dark-mode", isDark);
    }
  }

  // Observe theme changes
  const themeObserver = new MutationObserver(() => {
    updateTheme();
  });

  // ==================== KEYBOARD SHORTCUTS ====================

  function initKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Ignore if typing in input/textarea
      if (e.target.matches("input, textarea")) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + K - Toggle panel
      if (modKey && e.key === "k") {
        e.preventDefault();
        togglePanel();
      }

      // Ctrl/Cmd + G - Generate notes
      if (modKey && e.key === "g") {
        e.preventDefault();
        if (!state.isGenerating) {
          handleGenerate();
        }
      }

      // Ctrl/Cmd + E - Edit mode
      if (modKey && e.key === "e") {
        e.preventDefault();
        if (state.generatedNotes && !state.isEditing) {
          handleEdit();
        }
      }

      // ESC - Close panel or cancel edit
      if (e.key === "Escape") {
        if (state.isEditing) {
          cancelEdit();
        } else {
          togglePanel(false);
        }
      }
    });
  }

  // ==================== TOAST NOTIFICATIONS ====================

  function showToast(message, type = "info", duration = 3000) {
    const existingToast = document.querySelector(".ytn-toast");
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement("div");
    toast.className = `ytn-toast ytn-toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add("ytn-toast-show"), 10);

    // Auto-remove
    setTimeout(() => {
      toast.classList.remove("ytn-toast-show");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ==================== TRANSCRIPT EXTRACTION ====================

  async function extractTranscript() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const videoId = urlParams.get("v");

      if (!videoId) {
        throw new Error("Could not extract video ID from URL");
      }

      state.currentVideoId = videoId;
      state.currentVideoUrl = window.location.href;
      state.currentVideoTitle = document.title.replace(" - YouTube", "");

      const transcriptData = await getTranscriptFromYouTube();

      if (!transcriptData || transcriptData.length === 0) {
        throw new Error("No transcript available for this video");
      }

      const fullTranscript = transcriptData
        .map((segment) => segment.text)
        .join(" ");

      state.transcript = fullTranscript;
      state.transcriptPreview = fullTranscript.substring(0, 500) + "...";

      console.log(
        `[YouTube Notes] Extracted ${fullTranscript.length} characters of transcript`
      );
      return fullTranscript;
    } catch (error) {
      console.error("[YouTube Notes] Transcript extraction error:", error);
      throw error;
    }
  }

  async function getTranscriptFromYouTube() {
    return new Promise((resolve, reject) => {
      const transcriptButton = Array.from(
        document.querySelectorAll("button")
      ).find(
        (btn) =>
          btn.textContent.includes("Show transcript") ||
          btn.textContent.includes("Open transcript")
      );

      if (!transcriptButton) {
        reject(new Error("Transcript button not found"));
        return;
      }

      transcriptButton.click();

      setTimeout(() => {
        try {
          const transcriptSegments = document.querySelectorAll(
            "#segments-container ytd-transcript-segment-renderer"
          );
          const transcriptData = [];

          transcriptSegments.forEach((segment) => {
            const textElement = segment.querySelector(".segment-text");
            if (textElement) {
              transcriptData.push({
                text: textElement.textContent.trim(),
              });
            }
          });

          const closeButton = document.querySelector(
            "#top-level-buttons-computed ytd-button-renderer"
          );
          if (closeButton) {
            closeButton.click();
          }

          if (transcriptData.length > 0) {
            resolve(transcriptData);
          } else {
            reject(new Error("No transcript segments found"));
          }
        } catch (error) {
          reject(error);
        }
      }, 2000);
    });
  }

  // ==================== API INTEGRATION ====================

  async function generateNotes(transcript, regenerate = false) {
    const apiKey = await getApiKey();

    if (!apiKey) {
      throw new Error("API key not configured");
    }

    const systemPrompt = `You are an expert at creating McKinsey-style MECE (Mutually Exclusive, Collectively Exhaustive) notes from video transcripts.

Your task is to transform video transcripts into highly structured, executive-level notes that:

1. **Structure**: Use clear hierarchical organization with main themes and supporting points
2. **MECE Framework**: Ensure all key points are covered without overlap or redundancy
3. **High Signal**: Remove all fluff, filler words, and non-essential content
4. **Actionability**: Highlight key insights, frameworks, and takeaways
5. **Clarity**: Use precise, professional language with concrete examples

**CRITICAL MARKDOWN FORMATTING RULES:**
- Use hyphens (-) for ALL bullet points, NEVER asterisks (*)
- Use ## for main sections, ### for subsections
- Use **text** for bold, NEVER for emphasis
- Keep formatting clean and consistent

Format your response in Markdown with:
- **Executive Summary** (3-4 bullet points capturing the essence)
- **Key Themes** (2-4 main themes with sub-points)
- **Critical Insights** (actionable takeaways and frameworks)
- **Notable Quotes** (1-2 impactful direct quotes if relevant)
- **Recommendations** (if applicable, practical next steps)

Focus on signal over noise. Every word should add value. Be ruthless in removing redundancy.`;

    const userPrompt = `Please generate McKinsey-style MECE notes from the following YouTube video transcript:\n\n${transcript}\n\nVideo Title: ${state.currentVideoTitle}\nVideo URL: ${state.currentVideoUrl}`;

    try {
      const response = await fetch(`${CONFIG.API_ENDPOINT}?key=${apiKey}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${systemPrompt}\n\n${userPrompt}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error("[YouTube Notes] API Error Details:", {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          modelUsed: CONFIG.MODEL,
        });
        throw new Error(
          `API error: ${response.status} - ${
            errorData?.error?.message || response.statusText
          }`
        );
      }

      const data = await response.json();
      const notes = data.candidates[0].content.parts[0].text;

      await saveNotes(state.currentVideoId, notes);

      return notes;
    } catch (error) {
      console.error("[YouTube Notes] API error:", error);
      throw error;
    }
  }

  // ==================== STORAGE MANAGEMENT ====================

  async function getApiKey() {
    return new Promise((resolve) => {
      chrome.storage.local.get([CONFIG.STORAGE_KEYS.API_KEY], (result) => {
        resolve(result[CONFIG.STORAGE_KEYS.API_KEY] || null);
      });
    });
  }

  async function saveApiKey(apiKey) {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        {
          [CONFIG.STORAGE_KEYS.API_KEY]: apiKey,
        },
        resolve
      );
    });
  }

  async function saveNotes(videoId, notes) {
    return new Promise((resolve) => {
      chrome.storage.local.get([CONFIG.STORAGE_KEYS.NOTES], (result) => {
        const allNotes = result[CONFIG.STORAGE_KEYS.NOTES] || {};

        allNotes[videoId] = {
          notes: notes,
          title: state.currentVideoTitle,
          url: state.currentVideoUrl,
          videoId: videoId,
          createdAt: allNotes[videoId]?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        chrome.storage.local.set(
          {
            [CONFIG.STORAGE_KEYS.NOTES]: allNotes,
          },
          resolve
        );
      });
    });
  }

  async function loadNotes(videoId) {
    return new Promise((resolve) => {
      chrome.storage.local.get([CONFIG.STORAGE_KEYS.NOTES], (result) => {
        const allNotes = result[CONFIG.STORAGE_KEYS.NOTES] || {};
        resolve(allNotes[videoId] || null);
      });
    });
  }

  async function savePanelState() {
    return new Promise((resolve) => {
      chrome.storage.local.set(
        {
          [CONFIG.STORAGE_KEYS.PANEL_STATE]: {
            collapsed: state.isPanelCollapsed,
            position: state.panelPosition,
            size: state.panelSize,
          },
        },
        resolve
      );
    });
  }

  async function loadPanelState() {
    return new Promise((resolve) => {
      chrome.storage.local.get([CONFIG.STORAGE_KEYS.PANEL_STATE], (result) => {
        const panelState = result[CONFIG.STORAGE_KEYS.PANEL_STATE] || {};
        if (panelState.position) {
          state.panelPosition = panelState.position;
        }
        if (panelState.size) {
          state.panelSize = panelState.size;
        }
        state.isPanelCollapsed = panelState.collapsed || false;
        resolve(panelState);
      });
    });
  }

  // ==================== TOOLBAR BUTTON ====================

  function createToolbarButton() {
    // Remove existing button
    const existingBtn = document.getElementById("ytn-toolbar-btn");
    if (existingBtn) {
      existingBtn.remove();
    }

    // Find YouTube's top bar (right side controls)
    const topBar = document.querySelector("#end");
    if (!topBar) {
      console.warn("[YouTube Notes] Could not find YouTube toolbar");
      return;
    }

    const toolbarBtn = document.createElement("button");
    toolbarBtn.id = "ytn-toolbar-btn";
    toolbarBtn.className = "ytn-toolbar-button";
    toolbarBtn.title = "Notes (Ctrl+K)";
    toolbarBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
      </svg>
    `;

    toolbarBtn.addEventListener("click", () => togglePanel());

    // Insert before the first child of the top bar
    topBar.insertBefore(toolbarBtn, topBar.firstChild);
  }

  // ==================== UI CREATION ====================

  function createPanel() {
    const existingPanel = document.getElementById(CONFIG.PANEL_ID);
    if (existingPanel) {
      existingPanel.remove();
    }

    detectDarkMode();

    const panel = document.createElement("div");
    panel.id = CONFIG.PANEL_ID;
    panel.className = state.isDarkMode ? "ytn-dark-mode" : "";

    // Apply saved size
    if (state.panelSize.width) {
      panel.style.width = state.panelSize.width + "px";
    }

    panel.innerHTML = `
      <style>
        /* ==================== VARIABLES ==================== */
        #${CONFIG.PANEL_ID} {
          /* Light mode colors */
          --ytn-bg-primary: #FFFFFF;
          --ytn-bg-secondary: #F9F9F9;
          --ytn-bg-tertiary: #F1F1F1;
          --ytn-text-primary: #0F0F0F;
          --ytn-text-secondary: #606060;
          --ytn-text-tertiary: #909090;
          --ytn-border: #E5E5E5;
          --ytn-border-hover: #CCCCCC;
          --ytn-accent: #FF0000;
          --ytn-accent-hover: #CC0000;
          --ytn-success: #00D924;
          --ytn-warning: #FF9800;
          --ytn-error: #F44336;
          --ytn-shadow: rgba(0, 0, 0, 0.1);
          --ytn-shadow-lg: rgba(0, 0, 0, 0.15);
          
          /* Spacing */
          --space-1: 4px;
          --space-2: 8px;
          --space-3: 12px;
          --space-4: 16px;
          --space-6: 24px;
          --space-8: 32px;
          
          /* Typography */
          --text-xs: 11px;
          --text-sm: 13px;
          --text-base: 14px;
          --text-lg: 16px;
          --text-xl: 20px;
          
          /* Transitions */
          --transition-fast: 150ms ease;
          --transition-base: 250ms ease;
          --transition-slow: 350ms ease;
        }

        #${CONFIG.PANEL_ID}.ytn-dark-mode {
          --ytn-bg-primary: #0F0F0F;
          --ytn-bg-secondary: #1F1F1F;
          --ytn-bg-tertiary: #272727;
          --ytn-text-primary: #FFFFFF;
          --ytn-text-secondary: #AAAAAA;
          --ytn-text-tertiary: #717171;
          --ytn-border: #303030;
          --ytn-border-hover: #404040;
          --ytn-shadow: rgba(0, 0, 0, 0.3);
          --ytn-shadow-lg: rgba(0, 0, 0, 0.5);
        }

        /* ==================== TOOLBAR BUTTON ==================== */
        .ytn-toolbar-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          padding: 0;
          margin-right: 8px;
          background: transparent;
          border: none;
          border-radius: 50%;
          cursor: pointer;
          color: var(--ytn-text-primary);
          transition: background var(--transition-fast);
        }

        .ytn-toolbar-button:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .ytn-dark-mode .ytn-toolbar-button:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .ytn-toolbar-button svg {
          fill: currentColor;
        }

        /* ==================== PANEL BASE ==================== */
        #${CONFIG.PANEL_ID} {
          position: fixed;
          top: 56px;
          right: 0;
          width: ${CONFIG.DEFAULT_WIDTH}px;
          height: calc(100vh - 56px);
          background: var(--ytn-bg-primary);
          border-left: 1px solid var(--ytn-border);
          box-shadow: -4px 0 24px var(--ytn-shadow-lg);
          font-family: Roboto, Arial, sans-serif;
          font-size: var(--text-base);
          color: var(--ytn-text-primary);
          z-index: 999999;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: transform var(--transition-base),
                      opacity var(--transition-base);
        }

        #${CONFIG.PANEL_ID}.ytn-hidden {
          transform: translateX(100%);
          pointer-events: none;
        }

        /* ==================== HEADER ==================== */
        .ytn-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-4);
          border-bottom: 1px solid var(--ytn-border);
          cursor: move;
          user-select: none;
          background: var(--ytn-bg-primary);
        }

        .ytn-panel-title {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          font-size: var(--text-lg);
          font-weight: 500;
          color: var(--ytn-text-primary);
        }

        .ytn-icon-notes {
          width: 20px;
          height: 20px;
          fill: var(--ytn-accent);
        }

        .ytn-video-title {
          font-size: var(--text-xs);
          color: var(--ytn-text-secondary);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 250px;
        }

        .ytn-header-controls {
          display: flex;
          gap: var(--space-1);
        }

        .ytn-header-btn {
          width: 32px;
          height: 32px;
          padding: 0;
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--ytn-text-secondary);
          transition: all var(--transition-fast);
        }

        .ytn-header-btn:hover {
          background: var(--ytn-bg-secondary);
          color: var(--ytn-text-primary);
        }

        .ytn-header-btn svg {
          width: 18px;
          height: 18px;
        }

        /* ==================== BODY ==================== */
        .ytn-panel-body {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-4);
        }

        .ytn-panel-body::-webkit-scrollbar {
          width: 8px;
        }

        .ytn-panel-body::-webkit-scrollbar-track {
          background: var(--ytn-bg-secondary);
        }

        .ytn-panel-body::-webkit-scrollbar-thumb {
          background: var(--ytn-border);
          border-radius: 4px;
        }

        .ytn-panel-body::-webkit-scrollbar-thumb:hover {
          background: var(--ytn-border-hover);
        }

        /* ==================== EMPTY STATE ==================== */
        .ytn-empty-state {
          text-align: center;
          padding: var(--space-8) var(--space-4);
        }

        .ytn-empty-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto var(--space-4);
          opacity: 0.3;
        }

        .ytn-empty-title {
          font-size: var(--text-xl);
          font-weight: 500;
          margin-bottom: var(--space-2);
          color: var(--ytn-text-primary);
        }

        .ytn-empty-description {
          font-size: var(--text-sm);
          color: var(--ytn-text-secondary);
          margin-bottom: var(--space-6);
          line-height: 1.5;
        }

        /* ==================== TRANSCRIPT PREVIEW ==================== */
        .ytn-transcript-preview {
          background: var(--ytn-bg-secondary);
          border: 1px solid var(--ytn-border);
          border-radius: 8px;
          padding: var(--space-3);
          margin-bottom: var(--space-4);
        }

        .ytn-transcript-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-2);
        }

        .ytn-transcript-label {
          font-size: var(--text-xs);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--ytn-text-secondary);
        }

        .ytn-transcript-stats {
          font-size: var(--text-xs);
          color: var(--ytn-text-tertiary);
        }

        .ytn-transcript-content {
          font-size: var(--text-sm);
          line-height: 1.6;
          color: var(--ytn-text-secondary);
          max-height: 100px;
          overflow: hidden;
          position: relative;
        }

        .ytn-transcript-content::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 30px;
          background: linear-gradient(transparent, var(--ytn-bg-secondary));
        }

        /* ==================== PROGRESS ==================== */
        .ytn-progress-container {
          margin-bottom: var(--space-4);
        }

        .ytn-progress-steps {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
        }

        .ytn-progress-step {
          flex: 1;
          height: 4px;
          background: var(--ytn-bg-tertiary);
          border-radius: 2px;
          overflow: hidden;
          position: relative;
        }

        .ytn-progress-step.active {
          background: var(--ytn-accent);
        }

        .ytn-progress-step.active::after {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3));
          animation: ytn-progress-shimmer 1.5s infinite;
        }

        @keyframes ytn-progress-shimmer {
          0% { width: 0; }
          100% { width: 100%; }
        }

        .ytn-progress-text {
          font-size: var(--text-sm);
          color: var(--ytn-text-secondary);
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .ytn-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid var(--ytn-border);
          border-top-color: var(--ytn-accent);
          border-radius: 50%;
          animation: ytn-spin 0.8s linear infinite;
        }

        @keyframes ytn-spin {
          to { transform: rotate(360deg); }
        }

        /* ==================== NOTES DISPLAY ==================== */
        .ytn-notes-content {
          line-height: 1.6;
        }

        .ytn-notes-content h1,
        .ytn-notes-content h2,
        .ytn-notes-content h3 {
          color: var(--ytn-text-primary);
          margin-top: var(--space-4);
          margin-bottom: var(--space-3);
          font-weight: 600;
        }

        .ytn-notes-content h1 {
          font-size: var(--text-xl);
          padding-bottom: var(--space-2);
          border-bottom: 2px solid var(--ytn-border);
        }

        .ytn-notes-content h2 {
          font-size: var(--text-lg);
        }

        .ytn-notes-content h3 {
          font-size: var(--text-base);
        }

        .ytn-notes-content p {
          margin-bottom: var(--space-3);
          color: var(--ytn-text-primary);
        }

        .ytn-notes-content ul,
        .ytn-notes-content ol {
          margin: var(--space-3) 0;
          padding-left: var(--space-6);
        }

        .ytn-notes-content li {
          margin-bottom: var(--space-2);
          color: var(--ytn-text-primary);
        }

        .ytn-notes-content strong {
          color: var(--ytn-text-primary);
          font-weight: 600;
        }

        .ytn-notes-content em {
          font-style: italic;
          color: var(--ytn-text-secondary);
        }

        .ytn-notes-content blockquote {
          border-left: 3px solid var(--ytn-accent);
          padding-left: var(--space-4);
          margin: var(--space-4) 0;
          color: var(--ytn-text-secondary);
          font-style: italic;
        }

        .ytn-notes-content code {
          background: var(--ytn-bg-secondary);
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          font-size: var(--text-sm);
        }

        /* ==================== NOTES EDITOR ==================== */
        .ytn-notes-editor {
          width: 100%;
          min-height: 300px;
          padding: var(--space-4);
          border: 1px solid var(--ytn-border);
          border-radius: 8px;
          background: var(--ytn-bg-secondary);
          color: var(--ytn-text-primary);
          font-family: 'Courier New', monospace;
          font-size: var(--text-sm);
          line-height: 1.6;
          resize: vertical;
          display: none;
        }

        .ytn-notes-editor:focus {
          outline: none;
          border-color: var(--ytn-accent);
          box-shadow: 0 0 0 3px rgba(255, 0, 0, 0.1);
        }

        /* ==================== FOOTER ==================== */
        .ytn-panel-footer {
          padding: var(--space-4);
          border-top: 1px solid var(--ytn-border);
          background: var(--ytn-bg-primary);
        }

        .ytn-actions {
          display: flex;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
          padding-top: var(--space-3);
        }

        .ytn-actions-secondary {
          display: flex;
          gap: var(--space-2);
          justify-content: flex-end;
        }

        .ytn-view-all-btn {
          margin-top: var(--space-3);
          padding: var(--space-2) var(--space-3);
          background: transparent;
          border: 1px solid var(--ytn-border);
          color: var(--ytn-text-secondary);
          font-size: var(--text-sm);
          text-align: center;
          cursor: pointer;
          transition: all var(--transition-fast);
          border-radius: 6px;
        }

        .ytn-view-all-btn:hover {
          background: var(--ytn-bg-secondary);
          border-color: var(--ytn-border-hover);
          color: var(--ytn-text-primary);
        }

        /* ==================== BUTTONS ==================== */
        .ytn-btn {
          padding: var(--space-2) var(--space-4);
          border: none;
          border-radius: 6px;
          font-size: var(--text-sm);
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-2);
          white-space: nowrap;
        }

        .ytn-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ytn-btn-primary {
          flex: 1;
          background: var(--ytn-accent);
          color: white;
          font-weight: 600;
          padding: var(--space-3) var(--space-4);
        }

        .ytn-btn-primary:hover:not(:disabled) {
          background: var(--ytn-accent-hover);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255, 0, 0, 0.2);
        }

        .ytn-btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }

        .ytn-btn-secondary {
          background: var(--ytn-bg-secondary);
          color: var(--ytn-text-primary);
          border: 1px solid var(--ytn-border);
        }

        .ytn-btn-secondary:hover:not(:disabled) {
          background: var(--ytn-bg-tertiary);
          border-color: var(--ytn-border-hover);
        }

        .ytn-btn-ghost {
          background: transparent;
          color: var(--ytn-text-secondary);
          padding: var(--space-2);
        }

        .ytn-btn-ghost:hover:not(:disabled) {
          background: var(--ytn-bg-secondary);
          color: var(--ytn-text-primary);
        }

        .ytn-btn svg {
          width: 16px;
          height: 16px;
        }

        /* ==================== COST ESTIMATE ==================== */
        .ytn-cost-estimate {
          font-size: var(--text-xs);
          color: var(--ytn-text-tertiary);
          text-align: center;
          margin-top: var(--space-2);
        }

        .ytn-cost-estimate strong {
          color: var(--ytn-success);
          font-weight: 600;
        }

        /* ==================== TOAST NOTIFICATIONS ==================== */
        .ytn-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          background: var(--ytn-bg-primary);
          border: 1px solid var(--ytn-border);
          border-left: 4px solid var(--ytn-accent);
          padding: var(--space-4);
          border-radius: 8px;
          box-shadow: 0 8px 24px var(--ytn-shadow-lg);
          font-size: var(--text-sm);
          max-width: 300px;
          z-index: 9999999;
          transform: translateX(400px);
          opacity: 0;
          transition: all var(--transition-base);
        }

        .ytn-toast.ytn-toast-show {
          transform: translateX(0);
          opacity: 1;
        }

        .ytn-toast.ytn-toast-success {
          border-left-color: var(--ytn-success);
        }

        .ytn-toast.ytn-toast-error {
          border-left-color: var(--ytn-error);
        }

        .ytn-toast.ytn-toast-warning {
          border-left-color: var(--ytn-warning);
        }

        /* ==================== KEYBOARD SHORTCUTS HINT ==================== */
        .ytn-keyboard-hint {
          font-size: var(--text-xs);
          color: var(--ytn-text-tertiary);
          text-align: center;
          padding: var(--space-2);
          border-top: 1px solid var(--ytn-border);
        }

        .ytn-kbd {
          display: inline-block;
          padding: 2px 6px;
          background: var(--ytn-bg-secondary);
          border: 1px solid var(--ytn-border);
          border-radius: 4px;
          font-family: monospace;
          font-size: var(--text-xs);
        }

        /* ==================== ANIMATIONS ==================== */
        @keyframes ytn-fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .ytn-fade-in {
          animation: ytn-fade-in var(--transition-base);
        }
      </style>

      <div class="ytn-panel-header">
        <div>
          <div class="ytn-panel-title">
            <svg class="ytn-icon-notes" viewBox="0 0 24 24">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
            Notes
          </div>
          <div class="ytn-video-title" title="${
            state.currentVideoTitle || "YouTube Video"
          }">${state.currentVideoTitle || "YouTube Video"}</div>
        </div>
        <div class="ytn-header-controls">
          <button class="ytn-header-btn ytn-minimize-btn" title="Minimize to toolbar (Ctrl+K)" aria-label="Minimize panel">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,13H5V11H19V13Z"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="ytn-panel-body">
        <div id="ytn-content-area">
          <div class="ytn-empty-state">
            <svg class="ytn-empty-icon" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
            <div class="ytn-empty-title">Generate MECE Notes</div>
            <div class="ytn-empty-description">
              Professional McKinsey-style summaries in seconds
            </div>
          </div>
        </div>

        <div id="ytn-transcript-preview" style="display: none;"></div>
        <div id="ytn-progress-area" style="display: none;"></div>
        <div id="ytn-notes-content" class="ytn-notes-content" style="display: none;"></div>
        <textarea id="ytn-notes-editor" class="ytn-notes-editor" aria-label="Notes editor"></textarea>
      </div>

      <div class="ytn-panel-footer">
        <div class="ytn-actions">
          <button id="ytn-generate-btn" class="ytn-btn ytn-btn-primary">
            Generate Notes
          </button>
          <button id="ytn-regenerate-btn" class="ytn-btn ytn-btn-secondary" style="display: none;" title="Regenerate notes">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/>
            </svg>
            Regenerate
          </button>
        </div>

        <div id="ytn-cost-estimate" class="ytn-cost-estimate" style="display: none;"></div>

        <div id="ytn-actions-secondary" class="ytn-actions-secondary" style="display: none;">
          <button id="ytn-copy-btn" class="ytn-btn ytn-btn-secondary" title="Copy notes (Ctrl+C)">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/>
            </svg>
            Copy
          </button>
          <button id="ytn-download-btn" class="ytn-btn ytn-btn-secondary" title="Download as Markdown">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/>
            </svg>
            Download
          </button>
          <button id="ytn-edit-btn" class="ytn-btn ytn-btn-secondary" title="Edit notes (Ctrl+E)">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
            </svg>
            Edit
          </button>
        </div>

        <div class="ytn-keyboard-hint">
          <span class="ytn-kbd">Ctrl+K</span> Toggle •
          <span class="ytn-kbd">Ctrl+G</span> Generate •
          <span class="ytn-kbd">ESC</span> Close
        </div>

        <button id="ytn-view-all-btn" class="ytn-view-all-btn">
          View All Notes
        </button>
      </div>
    `;

    document.body.appendChild(panel);

    // Panel is now fixed to right side, no need to apply saved position

    // Cache panel elements
    panelElements = {
      panel: panel,
      contentArea: document.getElementById("ytn-content-area"),
      transcriptPreview: document.getElementById("ytn-transcript-preview"),
      progressArea: document.getElementById("ytn-progress-area"),
      notesContent: document.getElementById("ytn-notes-content"),
      notesEditor: document.getElementById("ytn-notes-editor"),
      generateBtn: document.getElementById("ytn-generate-btn"),
      regenerateBtn: document.getElementById("ytn-regenerate-btn"),
      copyBtn: document.getElementById("ytn-copy-btn"),
      downloadBtn: document.getElementById("ytn-download-btn"),
      editBtn: document.getElementById("ytn-edit-btn"),
      costEstimate: document.getElementById("ytn-cost-estimate"),
      actionsSecondary: document.getElementById("ytn-actions-secondary"),
      minimizeBtn: panel.querySelector(".ytn-minimize-btn"),
      viewAllBtn: document.getElementById("ytn-view-all-btn"),
    };

    // Attach event listeners
    panelElements.generateBtn.addEventListener("click", handleGenerate);
    panelElements.regenerateBtn.addEventListener("click", () =>
      handleGenerate(true)
    );
    panelElements.copyBtn.addEventListener("click", handleCopy);
    panelElements.downloadBtn.addEventListener("click", handleDownload);
    panelElements.editBtn.addEventListener("click", handleEdit);
    panelElements.minimizeBtn.addEventListener("click", () =>
      togglePanel(false)
    );
    panelElements.viewAllBtn.addEventListener("click", openNotesLibrary);

    // Make panel draggable (header only, not full drag since it's fixed now)
    // Remove resize functionality since panel is now full height
    // makeDraggable(panel); // Commented out - no longer needed
    // makeResizable(panel); // Commented out - no longer needed

    // Observe theme changes
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["dark"],
    });

    // Load saved notes if available
    loadSavedNotes();

    return panel;
  }

  async function loadSavedNotes() {
    const videoId = state.currentVideoId;
    if (!videoId) return;

    const savedData = await loadNotes(videoId);
    if (savedData && savedData.notes) {
      state.generatedNotes = savedData.notes;
      displayNotes(savedData.notes);
      showToast("Notes loaded from storage", "info", 2000);
    }
  }

  // ==================== UI HANDLERS ====================

  async function handleGenerate(regenerate = false) {
    if (state.isGenerating) return;

    try {
      state.isGenerating = true;

      // Check API key
      let apiKey = await getApiKey();
      if (!apiKey) {
        apiKey = await promptForApiKey();
        if (!apiKey) {
          showToast("API key required to generate notes", "error");
          state.isGenerating = false;
          return;
        }
        await saveApiKey(apiKey);
        showToast("API key saved successfully", "success");
      }

      // Hide empty state
      panelElements.contentArea.style.display = "none";

      // Step 1: Extract transcript
      showProgress(1, "Extracting transcript...");
      const transcript = await extractTranscript();

      // Show transcript preview
      showTranscriptPreview(transcript);

      // Step 2: Generate notes
      showProgress(2, "Analyzing video content...");

      const notes = await generateNotes(transcript, regenerate);
      state.generatedNotes = notes;

      // Hide progress
      panelElements.progressArea.style.display = "none";

      // Display notes
      displayNotes(notes);

      if (regenerate) {
        showToast("Notes regenerated successfully!", "success");
      } else {
        showToast("Notes generated successfully!", "success");
      }
    } catch (error) {
      console.error("[YouTube Notes] Generation error:", error);
      showToast(error.message || "Failed to generate notes", "error");

      // Show empty state again
      panelElements.contentArea.style.display = "block";
      panelElements.progressArea.style.display = "none";
      panelElements.transcriptPreview.style.display = "none";
    } finally {
      state.isGenerating = false;
      updateGenerateButton(false);
    }
  }

  function showProgress(step, message) {
    panelElements.progressArea.style.display = "block";
    panelElements.progressArea.innerHTML = `
      <div class="ytn-progress-container ytn-fade-in">
        <div class="ytn-progress-steps">
          <div class="ytn-progress-step ${step >= 1 ? "active" : ""}"></div>
          <div class="ytn-progress-step ${step >= 2 ? "active" : ""}"></div>
        </div>
        <div class="ytn-progress-text">
          <div class="ytn-spinner"></div>
          ${message}
        </div>
      </div>
    `;
    updateGenerateButton(true);
  }

  function showTranscriptPreview(transcript) {
    const tokens = estimateTokens(transcript);
    const cost = estimateCost(tokens);

    panelElements.transcriptPreview.style.display = "block";
    panelElements.transcriptPreview.innerHTML = `
      <div class="ytn-transcript-preview ytn-fade-in">
        <div class="ytn-transcript-header">
          <div class="ytn-transcript-label">Transcript Detected</div>
          <div class="ytn-transcript-stats">${tokens.toLocaleString()} tokens</div>
        </div>
        <div class="ytn-transcript-content">
          ${transcript.substring(0, 200)}...
        </div>
      </div>
    `;

    // Show cost estimate
    panelElements.costEstimate.style.display = "block";
    panelElements.costEstimate.innerHTML = `Estimated cost: <strong>$${cost}</strong> • ~10-15 seconds`;
  }

  async function promptForApiKey() {
    return new Promise((resolve) => {
      const apiKey = prompt(
        "Enter your Google Gemini API Key:\n\nGet your free API key at: https://aistudio.google.com/app/apikey"
      );
      resolve(apiKey?.trim() || null);
    });
  }

  function handleCopy() {
    if (!state.generatedNotes) return;

    navigator.clipboard
      .writeText(state.generatedNotes)
      .then(() => {
        showToast("Notes copied to clipboard!", "success");
      })
      .catch(() => {
        showToast("Failed to copy notes", "error");
      });
  }

  function handleDownload() {
    if (!state.generatedNotes) return;

    const blob = new Blob([state.generatedNotes], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.currentVideoTitle || "youtube-notes"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("Notes downloaded!", "success");
  }

  function handleEdit() {
    if (!state.generatedNotes) return;

    if (state.isEditing) {
      // Save edit
      saveEdit();
    } else {
      // Enter edit mode
      state.isEditing = true;
      panelElements.notesEditor.value = state.generatedNotes;
      panelElements.notesContent.style.display = "none";
      panelElements.notesEditor.style.display = "block";
      panelElements.editBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/>
        </svg>
        Save
      `;
      panelElements.editBtn.classList.add("ytn-btn-primary");
      panelElements.editBtn.classList.remove("ytn-btn-secondary");
      panelElements.notesEditor.focus();
    }
  }

  async function saveEdit() {
    const editedNotes = panelElements.notesEditor.value;
    state.generatedNotes = editedNotes;

    // Save to storage
    await saveNotes(state.currentVideoId, editedNotes);

    // Exit edit mode
    state.isEditing = false;
    panelElements.notesContent.style.display = "block";
    panelElements.notesEditor.style.display = "none";
    panelElements.editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
      </svg>
      Edit
    `;
    panelElements.editBtn.classList.remove("ytn-btn-primary");
    panelElements.editBtn.classList.add("ytn-btn-secondary");

    // Update display
    displayNotes(editedNotes);
    showToast("Notes saved!", "success");
  }

  function cancelEdit() {
    state.isEditing = false;
    panelElements.notesContent.style.display = "block";
    panelElements.notesEditor.style.display = "none";
    panelElements.editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
      </svg>
      Edit
    `;
    panelElements.editBtn.classList.remove("ytn-btn-primary");
    panelElements.editBtn.classList.add("ytn-btn-secondary");
    showToast("Edit cancelled", "info", 2000);
  }

  // ==================== UI DISPLAY ====================

  function displayNotes(notes) {
    // Render markdown to HTML
    const html = renderMarkdown(notes);
    panelElements.notesContent.innerHTML = html;
    panelElements.notesContent.style.display = "block";

    // Hide empty state and progress
    panelElements.contentArea.style.display = "none";
    panelElements.progressArea.style.display = "none";
    panelElements.costEstimate.style.display = "none";

    // Show action buttons
    panelElements.actionsSecondary.style.display = "flex";
    panelElements.regenerateBtn.style.display = "inline-flex";
  }

  function renderMarkdown(text) {
    // First, normalize asterisk bullets to hyphens for consistency
    // This handles cases where the model uses "* item" instead of "- item"
    let normalized = text.replace(/^\s*\*\s+/gm, "- ");

    // Basic markdown rendering
    let html = normalized
      // Headers
      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")
      // Bold
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      // Italic (but not list markers)
      .replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, "<em>$1</em>")
      // Code
      .replace(/`(.*?)`/g, "<code>$1</code>")
      // Blockquote
      .replace(/^> (.*$)/gim, "<blockquote>$1</blockquote>")
      // Lists - handle both * and -
      .replace(/^[\*\-] (.*$)/gim, "<li>$1</li>")
      .replace(/^(\d+)\. (.*$)/gim, "<li>$2</li>")
      // Paragraphs
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");

    // Wrap consecutive list items in ul tags
    html = html.replace(
      /(<li>.*?<\/li>(?:\s*<br>\s*<li>.*?<\/li>)*)/gs,
      "<ul>$1</ul>"
    );

    // Clean up extra br tags inside lists
    html = html.replace(/<\/li>\s*<br>\s*<li>/g, "</li><li>");

    // Wrap in paragraph if not already wrapped
    if (!html.startsWith("<")) {
      html = `<p>${html}</p>`;
    }

    return html;
  }

  function updateGenerateButton(isLoading) {
    const btn = panelElements.generateBtn;
    if (isLoading) {
      btn.disabled = true;
      btn.innerHTML = `
        <div class="ytn-spinner"></div>
        Generating...
      `;
    } else {
      btn.disabled = false;
      btn.innerHTML = "Generate Notes";
    }
  }

  function togglePanel(show = null) {
    const panel = document.getElementById(CONFIG.PANEL_ID);
    if (!panel) return;

    if (show === null) {
      // Toggle
      const isVisible = !panel.classList.contains("ytn-hidden");
      panel.classList.toggle("ytn-hidden", isVisible);
    } else {
      panel.classList.toggle("ytn-hidden", !show);
    }
  }

  async function openNotesLibrary() {
    // Ensure storage is synced before opening library
    // Small delay to ensure Chrome storage has fully persisted
    await new Promise(resolve => setTimeout(resolve, 100));

    // Open notes library in new tab
    const libraryUrl = chrome.runtime.getURL("notes-library.html");
    window.open(libraryUrl, "_blank");
  }

  // ==================== INITIALIZATION ====================

  async function init() {
    console.log("[YouTube Notes] Initializing extension");

    // Wait for page to load
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
      return;
    }

    // Check if we're on a watch page
    if (!window.location.pathname.includes("/watch")) {
      return;
    }

    // Extract video ID
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get("v");

    if (!videoId) {
      return;
    }

    state.currentVideoId = videoId;
    state.currentVideoUrl = window.location.href;
    state.currentVideoTitle = document.title.replace(" - YouTube", "");

    // Load panel state
    await loadPanelState();

    // Create panel
    createPanel();

    // Create toolbar button
    createToolbarButton();

    // Start with panel visible
    togglePanel(true);

    // Initialize keyboard shortcuts
    initKeyboardShortcuts();

    console.log("[YouTube Notes] Extension initialized for video:", videoId);
  }

  // Start initialization
  init();
})();
