"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type PrintDocument = {
  title: string;
  subtitle?: string;
  meta?: string;
  body: ReactNode;
};

type PrintContextValue = {
  print: (document: PrintDocument) => void;
  printing: boolean;
};

const PrintContext = createContext<PrintContextValue | null>(null);

/**
 * A single persistent provider in AppProviders owns the print document.
 * The portal is a direct body child; only that child is visible in print media.
 *
 * Important: window.print() can return before the print sheet closes on mobile.
 * Do not erase the document in a finally block after that call. Keep it mounted
 * until afterprint / exit from print media, or explicit cancellation by the user.
 */
export function PrintProvider({ children }: { children: ReactNode }) {
  const [printDoc, setPrintDoc] = useState<PrintDocument | null>(null);
  const busyRef = useRef(false);

  const finish = useCallback(() => {
    busyRef.current = false;
    setPrintDoc(null);
  }, []);

  const print = useCallback((next: PrintDocument) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPrintDoc(next);
  }, []);

  useEffect(() => {
    if (!printDoc) return;

    const body = globalThis.document.body;
    const originalTitle = globalThis.document.title;
    const printMedia = window.matchMedia("print");
    let enteredPrintMedia = false;
    let frameOne = 0;
    let frameTwo = 0;
    let disposed = false;

    const onAfterPrint = () => {
      if (!disposed) finish();
    };
    const onPrintMediaChange = (event: MediaQueryListEvent) => {
      if (event.matches) enteredPrintMedia = true;
      else if (enteredPrintMedia) onAfterPrint();
    };

    body.setAttribute("data-atelier-printing", "true");
    if (printDoc.title) globalThis.document.title = printDoc.title;
    window.addEventListener("afterprint", onAfterPrint);
    if (printMedia.addEventListener) printMedia.addEventListener("change", onPrintMediaChange);
    else printMedia.addListener(onPrintMediaChange);

    // The portal must be committed and painted before invoking the OS dialog.
    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        if (disposed) return;
        try {
          window.print();
        } catch {
          // Some embedded browsers forbid print dialogs. The screen notice lets
          // the user release this job and use the PDF download instead.
        }
      });
    });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
      window.removeEventListener("afterprint", onAfterPrint);
      if (printMedia.removeEventListener) printMedia.removeEventListener("change", onPrintMediaChange);
      else printMedia.removeListener(onPrintMediaChange);
      body.removeAttribute("data-atelier-printing");
      globalThis.document.title = originalTitle;
    };
  }, [printDoc, finish]);

  const value = useMemo(() => ({ print, printing: printDoc !== null }), [print, printDoc]);

  return (
    <PrintContext.Provider value={value}>
      {children}
      {printDoc && typeof window !== "undefined" ? (
        <>
          <aside className="print-session-notice" role="status">
            <div>
              <strong>Document prêt pour l’impression</strong>
              <p>Si la fenêtre ne s’ouvre pas, fermez cet aperçu puis utilisez « Télécharger le PDF » pour un reçu.</p>
            </div>
            <button type="button" className="button button-light" onClick={finish}>Fermer l’aperçu</button>
          </aside>
          {createPortal(
            <article className="print-area" id="print-area" aria-label={printDoc.title}>
              <header className="print-area-head">
                {printDoc.title && <h1>{printDoc.title}</h1>}
                {printDoc.subtitle && <p className="print-area-subtitle">{printDoc.subtitle}</p>}
                {printDoc.meta && <p className="print-area-meta">{printDoc.meta}</p>}
              </header>
              <div className="print-area-body">{printDoc.body}</div>
            </article>,
            globalThis.document.body,
          )}
        </>
      ) : null}
    </PrintContext.Provider>
  );
}

export function usePrint(): PrintContextValue {
  const context = useContext(PrintContext);
  // Keep this assertion: an architecture regression must be caught by tests,
  // not silently replaced by window.print() of the entire application.
  if (!context) throw new Error("usePrint must be used inside <PrintProvider>.");
  return context;
}
