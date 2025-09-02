// Simple config shim to allow overriding API base URL without rebuild
// Set window.REACT_APP_API_URL to point to FastAPI backend
// Example: window.REACT_APP_API_URL = 'http://localhost:8000';
window.REACT_APP_API_URL = window.REACT_APP_API_URL || 'http://localhost:8000';
