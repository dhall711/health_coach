// API base URL -- points to the Vercel-deployed Next.js backend
// In development, you can switch this to your local dev server
const DEV_URL = "http://localhost:3000";
const PROD_URL = "https://health-coach-doug.vercel.app";

// Toggle this for development vs production
const USE_PROD = true;

export const API_BASE = USE_PROD ? PROD_URL : DEV_URL;
