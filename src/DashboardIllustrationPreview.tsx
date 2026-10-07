import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DashboardOverview } from "./DashboardOverview";
import { t } from "./i18n";
import type { AppData, ProfileIllustration } from "./types";

const previewDocument =
  "<!doctype html><html><head></head><body></body></html>";

// Render the real card at its real viewport size. Scale the entire preview to
// fit Settings, rather than changing its image size, text wrapping or cropping.
export function DashboardIllustrationPreview({
  data,
  message,
  illustration,
  mode,
}: {
  data: AppData;
  message: string;
  illustration: ProfileIllustration;
  mode: "desktop" | "phone";
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<Document | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    contentWidth: document.documentElement.clientWidth,
  }));
  const [available, setAvailable] = useState(0);
  const [card, setCard] = useState({ width: 0, height: 0, left: 0 });
  const frameWidth =
    mode === "phone"
      ? viewport.width <= 640
        ? viewport.width
        : 390
      : viewport.width > 640
        ? viewport.width
        : 1280;
  // The live page may reserve a scrollbar gutter; the isolated frame does not.
  const contentWidth =
    frameWidth === viewport.width ? viewport.contentWidth : frameWidth;

  useEffect(() => {
    const resize = () =>
      setViewport((old) => {
        const width = window.innerWidth;
        const contentWidth = document.documentElement.clientWidth;
        return old.width === width && old.contentWidth === contentWidth
          ? old
          : { width, contentWidth };
      });
    window.addEventListener("resize", resize);
    const observer = new ResizeObserver(([entry]) => {
      setAvailable(entry.contentRect.width);
      resize();
    });
    if (wrap.current) observer.observe(wrap.current);
    return () => {
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const hero = doc?.querySelector(".dashboard-welcome");
    if (!hero) return;
    const measure = () => {
      const { width, height, left } = hero.getBoundingClientRect();
      setCard((old) =>
        old.width === width && old.height === height && old.left === left
          ? old
          : { width, height, left },
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(hero);
    measure();
    return () => observer.disconnect();
  }, [doc, frameWidth, contentWidth]);

  const scale =
    card.width && available ? Math.min(1, available / card.width) : 1;
  return (
    <div
      ref={wrap}
      className="dashboard-illustration-preview"
      aria-hidden="true"
      style={{ height: card.height ? card.height * scale : 200 }}
    >
      <iframe
        title={t("Dashboard")}
        tabIndex={-1}
        sandbox="allow-same-origin"
        srcDoc={previewDocument}
        style={{
          width: frameWidth,
          height: card.height || 200,
          left: -card.left * scale,
          transform: `scale(${scale})`,
        }}
        onLoad={(event) => {
          const document = event.currentTarget.contentDocument;
          if (!document) return;
          document.documentElement.lang = window.document.documentElement.lang;
          // Both production stylesheet links and Vite development style tags.
          window.document.head
            .querySelectorAll('link[rel="stylesheet"], style')
            .forEach((node) => document.head.appendChild(node.cloneNode(true)));
          const style = document.createElement("style");
          style.textContent =
            "html,body{background:transparent;overflow:hidden}main{padding-block:0!important}.dashboard-welcome{margin-bottom:0}";
          document.head.appendChild(style);
          setDoc(document);
        }}
      />
      {doc &&
        createPortal(
          <div style={{ width: contentWidth }} inert>
            <div className="main-shell">
              <main>
                <DashboardOverview
                  data={data}
                  message={message}
                  illustration={illustration}
                  onSession={() => {}}
                />
              </main>
            </div>
          </div>,
          doc.body,
        )}
    </div>
  );
}
