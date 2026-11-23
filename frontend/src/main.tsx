import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { apiAccount } from "./api/account";
import { apiAssistant } from "./api/assistant";
import { fetchCatalog } from "./api/catalog";
import { browserStorage } from "./state/browserStorage";

const loadCatalog = () => fetchCatalog("demo");
const storage = browserStorage();
const account = apiAccount();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App loadCatalog={loadCatalog} storage={storage} assistant={apiAssistant} account={account} />
  </StrictMode>,
);
