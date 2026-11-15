import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { fetchCatalog } from "./api/catalog";
import { browserStorage } from "./state/browserStorage";

const loadCatalog = () => fetchCatalog("demo");
const storage = browserStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App loadCatalog={loadCatalog} storage={storage} />
  </StrictMode>,
);
