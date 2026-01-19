import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { ClerkProvider } from "@clerk/clerk-react";
import { BrowserRouter } from "react-router-dom"; // <-- fixed
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Import your Publishable Key
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const CLERK_FRONTEND_API = import.meta.env.VITE_CLERK_FRONTEND_API;

console.log("Debug: PUBLISHABLE_KEY =", PUBLISHABLE_KEY);
console.log("Debug: CLERK_FRONTEND_API =", CLERK_FRONTEND_API);

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

// For local development, override custom domain to use Clerk's default CDN
// The publishable key contains a custom domain (clerk.interviewapp.pages.dev)
// which doesn't work for localhost. We need to use Clerk's default frontend API.
const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

// If running on localhost and no frontendApi is provided, show a helpful message
if (isLocalhost && !CLERK_FRONTEND_API) {
  console.warn(
    "⚠️ Clerk Custom Domain Detected: Your publishable key uses a custom domain.\n" +
    "For local development, you need to either:\n" +
    "1. Get a development publishable key without custom domain from Clerk Dashboard\n" +
    "2. Add VITE_CLERK_FRONTEND_API to your .env file with your Clerk instance's default frontend API URL\n" +
    "   (e.g., clerk.your-instance.clerk.accounts.dev)\n" +
    "You can find this in your Clerk Dashboard under Settings > Domains"
  );
}

const clerkConfig = {
  publishableKey: PUBLISHABLE_KEY,
  // For local development, use Clerk's default frontend API instead of custom domain
  ...(isLocalhost && CLERK_FRONTEND_API ? { frontendApi: CLERK_FRONTEND_API } : {}),
};

console.log("Debug: isLocalhost =", isLocalhost);
console.log("Debug: clerkConfig =", clerkConfig);

const queryClient = new QueryClient();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ClerkProvider {...clerkConfig}>
          <App />
        </ClerkProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);
