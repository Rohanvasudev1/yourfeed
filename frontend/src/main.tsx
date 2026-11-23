import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { AppRoot } from "./AppRoot";
import { apiAccount } from "./api/account";
import { apiAssistant } from "./api/assistant";
import { fetchCatalog } from "./api/catalog";
import { apiSession } from "./api/session";
import { apiSharing } from "./api/sharing";
import { apiServerState } from "./api/state";
import { browserStorage } from "./state/browserStorage";

const storage = browserStorage();
const session = apiSession();
const account = apiAccount(session);
const serverState = apiServerState(session);
const sharing = apiSharing(session);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppRoot loadCatalog={fetchCatalog} storage={storage} serverState={serverState} assistant={apiAssistant} account={account} sharing={sharing} />
  </StrictMode>,
);
