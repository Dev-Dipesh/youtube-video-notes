# YouTube Video Notes Extension

A Chrome extension that generates McKinsey-style MECE (Mutually Exclusive, Collectively Exhaustive) notes from YouTube video transcripts using Z.AI's GLM-4.7 model.

## Features

- **AI-Powered Summaries**: Uses Z.AI's GLM-4.7 model to generate high-quality, executive-level notes
- **McKinsey-Style Format**: Produces MECE notes with:
  - Executive Summary
  - Key Themes
  - Critical Insights
  - Notable Quotes
  - Recommendations
- **Transcript Extraction**: Automatically extracts video transcripts from YouTube
- **Persistent Storage**: Notes are saved locally with video metadata (title, URL, date)
- **Edit & Copy**: Edit generated notes and copy to clipboard
- **Privacy-First**: All data stored locally, API key stored securely
- **YouTube-Native UI**: Dark theme panel that matches YouTube's design

## Installation

### Prerequisites

1. **Z.AI API Key**: Get your API key from [Z.AI](https://z.ai)
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
4. You'll be prompted to enter your Z.AI API key
5. The extension will securely store your API key for future use

### Generating Notes

1. Open any YouTube video
2. Click "Generate Notes" in the panel
3. The extension will:
   - Extract the video transcript
   - Send it to Z.AI's GLM-4.7 model
   - Display the generated McKinsey-style notes
4. Notes are automatically saved for future reference

### Managing Notes

- **Copy**: Click "Copy" to copy notes to clipboard
- **Edit**: Click "Edit" to modify notes (changes are auto-saved)
- **View Later**: Notes persist across browser sessions
- **Re-generate**: Click "Generate Notes" again to create new notes

## Architecture

### Files

- `manifest.json` - Extension configuration and permissions
- `content.js` - Main logic (transcript extraction, API calls, UI management)
- `styles.css` - YouTube-matched dark theme styling
- `icons/` - Extension icons (16, 32, 48, 128px)
- `create-icons.html` - Icon generator utility

### Key Components

#### Transcript Extraction
- Locates YouTube's transcript button
- Extracts transcript segments
- Handles dynamic content loading

#### API Integration
- Endpoint: `https://api.z.ai/api/paas/v4/chat/completions`
- Model: `glm-4.7`
- McKinsey-style prompt engineering for high-quality outputs

#### Storage
- Chrome Storage API for persistent data
- Stores: API key, notes with metadata
- Data structure:
  ```json
  {
    "videoId": {
      "notes": "markdown content",
      "title": "video title",
      "url": "video url",
      "videoId": "id",
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
- **Secure API Key**: Stored encrypted in Chrome storage
- **No External Calls**: Only calls Z.AI API for note generation

## Troubleshooting

### API Errors - "Insufficient Balance or No Resource Package"

**Issue**: You get this error even though you have a paid Z.AI subscription.

**Solution**: Different subscription plans support different models. The extension defaults to `glm-4.7`, but your plan might support different models.

**Quick Fix**:
1. Open `test-zai-models.html` in your browser
2. Enter your Z.AI API key
3. Test different models (try: `glm-4-flash`, `glm-4`, `glm-4-plus`, `glm-4-air`, `glm-3-turbo`)
4. When you find a working model, update `content.js` line 11:
   ```javascript
   MODEL: 'working-model-name',  // Change glm-4.7 to the working model
   ```
5. Reload the extension in Chrome

**Common Model Options**:
- `glm-4-flash` - Fast, often available in most plans
- `glm-4` - Standard model
- `glm-4-plus` - Enhanced capabilities
- `glm-4-air` - Lightweight version
- `glm-3-turbo` - Older but reliable model

### Transcript Not Found

- Ensure the video has captions/transcript available
- Check if the transcript button exists in the video description
- Try refreshing the page

### Other API Errors

- Verify your Z.AI API key is valid
- Check your API quota/credits in Z.AI dashboard
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
- [ ] Note organization (tags, folders)
- [ ] Sync across devices
- [ ] Support for other video platforms

## License

MIT License - feel free to modify and use for your needs.

## Credits

Built with Z.AI's GLM-4.7 model for high-quality AI-generated summaries.
