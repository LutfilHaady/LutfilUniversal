# VOX Co-pilot Chrome Extension

A Chrome Extension that assists youth workers at VOX Youth Centre with Digital Drifting on Instagram.

## Development

1. Install dependencies:
```bash
npm install
```

2. Build the extension:
```bash
npm run build
```

3. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder

## Features

- Injects a sidebar on Instagram pages
- "Check Sentiment" button for analyzing stories
- Displays Risk Score and Sentiment Tags
- Privacy-focused: processes images in volatile memory only
