# Medical Device Risk Assessment – Frontend (CDN SPA)

A single-page application for assessing medical device risks for hospitals (Medical users) and manufacturers. Built with React (UMD via CDN), Tailwind CSS, Chart.js, React Router, and Axios. Integrates with a FastAPI backend (JWT auth) at `http://localhost:8000` by default, with an automatic mock-backend fallback when the API is unavailable.

## Quick Start

No build step required. Serve the `qwertymed/` folder statically and open the app.

1) Configure API base URL (optional)

- Edit `config.js` (already present):

```html
// config.js
window.REACT_APP_API_URL = "http://localhost:8000"; // change if needed
```

If you don’t set it, the app defaults to `http://localhost:8000`.

2) Start a static server (examples)

- Python 3 (recommended for zero-deps):

```bash
cd qwertymed
python3 -m http.server 12000 --bind 0.0.0.0
```

- Node (if you prefer):

```bash
npx http-server -p 12000 -a 0.0.0.0 .
```

3) Open the app

- Local: http://localhost:12000/#/
- In sandboxed environments, use the provided host/port URL.

That’s it. The app uses HashRouter so no server-side routing config is needed.

## Authentication & Backend

- JWT is stored in `localStorage`.
- Axios attaches `Authorization: Bearer <token>` automatically.
- 401 responses clear the token and redirect to `/login`.
- If `GET /health` fails, the app transparently switches to a mock backend so you can demo flows without the API.
- To use the real FastAPI backend, ensure CORS allows your frontend origin and the API is reachable at `window.REACT_APP_API_URL`.

## Core Flows

- Landing → Login/Register
- Login:
  - Role selector: Medical or Manufacturer
  - On success: redirects to `/medical-dashboard` (Medical) or `/manufacturer-dashboard` (Manufacturer)
- Medical Dashboard: Welcome card + Recent Activity table
- Device Risk Checker: Enter Manufacturer + Device Name → Predict → `/risk-result`
- Risk Result: Shows risk class, percent, pie chart, and alternatives
- Manufacturer Dashboard: Shows risk distribution bar chart and device list (filtered)

## Project Structure

```
qwertymed/
  index.html         # CDN UMD entry (Tailwind, React, Router, Chart.js, Axios)
  app.js             # No-JSX UMD bundle (runs by default; reliable in sandbox)
  config.js          # Sets window.REACT_APP_API_URL
  src/
    components/
      Header.js
      Footer.js
      RiskChart.js
      DeviceTable.js
      FeedbackForm.js
    pages/
      Landing.js
      Login.js
      Register.js
      MedicalDashboard.js
      DeviceRiskChecker.js
      RiskAssessmentResult.js
      ManufacturerDashboard.js
    services/
      api.js         # Axios setup (exported factory)
    App.js
    index.js
```

Notes:
- The running deployment uses `app.js` (UMD) to avoid inline Babel in restricted environments. The `src/` ESM modules mirror the same functionality and are ready for a bundler (e.g., Vite) if you later want HMR/build.

## Configuration

- API base URL: set in `config.js` via `window.REACT_APP_API_URL`.
- Security: inputs sanitized with DOMPurify; avoid storing secrets in code; ensure HTTPS and proper CORS in production.

## Troubleshooting

- Blank page or errors about React not loading: check network to CDN scripts; ensure you are online or host the UMD files locally.
- CORS errors calling the API: enable CORS on FastAPI to allow your frontend origin (e.g., `http://localhost:12000`).
- Stuck on login or 401 loops: clear browser storage (localStorage) and try again.

## License

Proprietary or per-repo license (update as appropriate).
