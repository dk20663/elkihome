import { createRoot } from "react-dom/client";
import EmbedApp from "./EmbedApp";
import "../index.css";

const el = document.getElementById("root");
if (el) createRoot(el).render(<EmbedApp />);
