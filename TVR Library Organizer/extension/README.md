# TVR YouTube Helper (prototype)

YouTube blocks the download server's IP ("Sign in to confirm you're not a bot"). This extension lets the **web app**
read YouTube from the user's own browser instead: their IP, their normal YouTube session.

```
web page ──postMessage──▶ content.js ──port──▶ background.js (youtubei.js, standard web client)
   ▲                                              │ decipher: offscreen.html ▶ sandbox.html (MV3 allows eval only there)
   └──────── base64 audio chunks ◀────────────────┘
page converts the audio to MP3 with ffmpeg.wasm (core loaded from jsDelivr on first use)
```

## Try it
```
cd extension && npm install && npm run build
```
Chrome/Edge: `chrome://extensions` → Developer mode → **Load unpacked** → pick `extension/dist`.
Then run the web app (`npm run dev` in the project root, http://localhost) or open the deployed site and paste a
YouTube link. With the extension present the app uses it automatically; without it, YouTube goes to the server.

## Status: untested end to end
Built and bundled, but not yet run in a browser. Things to check first:
- **Stream URLs**: YouTube hands the plain web client no download URLs unless the request looks like a real
  browser session (it is the same wall yt-dlp hits). Signed in to YouTube in the same browser may be required.
  If `getBasicInfo` works but downloads fail with "No valid URL to decipher", that is this.
- Origin/Referer rewriting (`declarativeNetRequest` session rules) and cookies on service-worker fetches.
- Audio crosses the extension boundary as base64 (Chrome ports are JSON), roughly +33% size.
- Allowed pages are listed in `static/manifest.json` (`content_scripts.matches`): add any other host you serve from.
