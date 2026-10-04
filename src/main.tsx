import { t } from "./i18n";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="auth-card">
        <h1>{t("LiftLog hit a snag")}</h1>
        <p>{t("Your saved data is still available. Reload to try again.")}</p>
        <button className="button primary" onClick={() => location.reload()}>
          {t("Reload")}
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
