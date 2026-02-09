# YouTube Video Notes Extension

A Chrome extension that generates McKinsey-style MECE (Mutually Exclusive, Collectively Exhaustive) reports from YouTube video transcripts using Google Gemini.

## Features

- **AI-Powered Reports**: Uses Gemini to generate high-signal, executive-level notes
- **Report Depth**: Brief and Detailed versions stored side-by-side
- **McKinsey-Style Format**: Executive Summary, Key Themes, Critical Insights, Notable Quotes, Recommendations
- **Transcript Extraction**: Automatically extracts video transcripts from YouTube
- **Notes Library**: Browse all notes in a separate tab with search/sort
- **Tags & Grouping**: Add tags to notes, group by tag with collapsible sections, and keep an unlisted section for untagged notes
- **Export & Import**: Export as ZIP (dated folders + metadata) and import from ZIP/JSON (includes tags)
- **Edit, Copy, Delete**: Edit generated notes, copy to clipboard, and delete notes with confirmation
- **Language Control**: Optionally match the transcript language or force English-only output
- **Privacy-First**: All data stored locally, API key stored securely
- **YouTube-Native UI**: Panel styling matches YouTube and respects dark mode
- **Error Feedback**: Clear feedback for transcript issues, rate limits, and in-progress generation
- **Watch-Page Only**: Extension runs only on standard watch pages (not Shorts)

## Installation

### Prerequisites

1. **Gemini API Key**: Get your API key from Google AI Studio
2. **Chrome Browser**: Extension requires Chrome or Chromium-based browser

### Manual Installation

1. Clone or download this repository
2. Generate extension icons:
   - Open `create-icons.html` in your browser
   - Click "Generate Icons"
   - Download all icon files to the `icons/` folder
3. Load extension in Chrome:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `youtube-video-notes` folder

### Building for Distribution

```bash
npm run build
```

This creates a zip file in `dist/` ready for Chrome Web Store upload.

## Usage

### First Time Setup

1. Navigate to any YouTube video (e.g., `https://www.youtube.com/watch?v=xxxxx`)
2. A "Video Notes" panel will appear on the right side
3. Click "Generate Notes"
4. You'll be prompted to enter your Gemini API key
5. The extension will securely store your API key for future use

### Generating Notes

1. Open any YouTube video
2. Click "Generate Notes" in the panel
3. The extension will:
   - Extract the video transcript
   - Send it to Gemini
   - Display the generated report
4. Notes are automatically saved for future reference

**Tip**: If "Detailed" is selected, the extension will generate Brief first (if missing) and then Detailed, so both are available.

**Note**: The panel is hidden by default on new videos. Click the toolbar icon to open it.

### Managing Notes

- **Copy**: Click "Copy" to copy notes to clipboard
- **Edit**: Click "Edit" to modify notes (changes are auto-saved)
- **View Later**: Notes persist across browser sessions
- **Re-generate**: Click "Regenerate" to refresh the currently selected depth
- **Tagging**: Add tags to notes and search by tag
- **Grouping**: Toggle Group/Ungroup to view notes by tag in collapsible sections
- **Language**: Use “Match transcript language” to generate notes in the same language as the video

### Export & Import

- **Export**: Creates a ZIP with dated folders and `metadata.json` for full restore
- **Import**: Supports ZIP exports and raw JSON dumps of `youtube_video_notes`

## Architecture

### Files

- `manifest.json` - Extension configuration and permissions
- `content.js` - Main logic (transcript extraction, API calls, UI management)
- `notes-library.html` - Notes library UI
- `notes-library.js` - Notes library logic
- `jszip.min.js` - ZIP export/import support (Notes Library)
- `icons/` - Extension icons (16, 32, 48, 128px)
- `create-icons.html` - Icon generator utility

### Key Components

#### Transcript Extraction
- Locates YouTube's transcript button
- Extracts transcript segments
- Handles dynamic content loading

#### API Integration
- Endpoint: Gemini `generateContent`
- Model: `gemini-2.0-flash`
- McKinsey-style prompt engineering for high-quality outputs

#### Storage
- Chrome Storage API for persistent data
- Stores: API key, notes with metadata
- Data structure:
  ```json
  {
    "videoId": {
      "notes": "brief notes (legacy default)",
      "notesBrief": "brief markdown content",
      "notesDetailed": "detailed markdown content",
      "activeDepth": "brief|detailed",
      "title": "video title",
      "url": "video url",
      "videoId": "id",
      "tags": ["tag1", "tag2"],
      "createdAt": "ISO date",
      "updatedAt": "ISO date"
    }
  }
  ```

## Configuration

### API Key Management

- API key is stored securely using Chrome's storage API
- Only one prompt required on first use
- Key can be reset by clearing extension data

### Customization

You can modify the McKinsey-style prompt by editing the `systemPrompt` variable in `content.js`:

```javascript
const systemPrompt = `You are an expert at creating McKinsey-style MECE notes...`;
```

## Privacy & Security

- **Local Storage**: All notes stored locally in your browser
- **No Tracking**: No analytics or telemetry
- **Minimal Permissions**: Only requires YouTube access and storage
- **Secure API Key**: Stored in Chrome storage
- **No External Calls**: Only calls Gemini API for note generation

## Troubleshooting

### API Errors

If you receive API errors, verify your Gemini API key and quotas. Check the browser console for `[YouTube Notes] API Error Details:` logs.

### Transcript Not Found

- Ensure the video has captions/transcript available
- Check if the transcript button exists in the video description
- Try refreshing the page

### Other API Errors

- Verify your Gemini API key is valid
- Ensure internet connectivity
- Check browser console (F12) for detailed error messages
- Look for `[YouTube Notes] API Error Details:` logs with full error info

### Panel Not Appearing

- Confirm you're on a YouTube watch page (`/watch?v=xxx`)
- Try refreshing the page
- Check if extension is enabled in `chrome://extensions/`
- Look for JavaScript errors in console

## Development

### Testing

1. Load unpacked extension in Chrome
2. Navigate to a test video
3. Open browser console for debugging logs
4. Test transcript extraction, API calls, and storage

### Building Icons

Use the provided icon generator:
1. Open `create-icons.html` in browser
2. Click "Generate Icons"
3. Download all sizes (16, 32, 48, 128px)
4. Place in `icons/` folder

### Debugging

Enable console logs:
- Open Chrome DevTools (F12)
- Filter by `[YouTube Notes]` to see extension logs
- Check for API errors, transcript issues, or storage problems

## Roadmap

- [ ] Export notes to Markdown/PDF
- [ ] Search/filter saved notes
- [ ] Batch process multiple videos
- [ ] Custom prompt templates
- [ ] Note organization (folders)
- [ ] Sync across devices
- [ ] Support for other video platforms

## License

MIT License - feel free to modify and use for your needs.
