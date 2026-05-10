import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Vite emits the worker as a separate static asset; pdf.js spawns it as a Web Worker.
pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

interface PdfViewerProps {
  /** Raw PDF bytes. Pass `null` to show the empty state. */
  data: Uint8Array | null;
  /** Optional className applied to the outer container */
  className?: string;
  /** Inline styles applied to the outer container */
  style?: React.CSSProperties;
}

const MIN_SCALE = 0.4;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.15;
const SIDE_PADDING = 32;

export function PdfViewer({ data, className, style }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Memoize a fresh file object so react-pdf only re-parses when bytes change.
  // Wrapping in `{ data }` is the recommended way to pass an in-memory buffer.
  const file = useMemo(() => (data ? { data } : null), [data]);

  // Reset transient state when a new document loads.
  useEffect(() => {
    setNumPages(0);
    setLoadError(null);
  }, [file]);

  // Keep page width in sync with the container size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const renderedWidth = Math.max(
    120,
    Math.floor((containerWidth - SIDE_PADDING) * scale),
  );

  return (
    <div
      className={className}
      style={{
        background: "#525659",
        borderRadius: 8,
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <Toolbar
        scale={scale}
        numPages={numPages}
        onZoomIn={() => setScale((s) => Math.min(MAX_SCALE, +(s + ZOOM_STEP).toFixed(2)))}
        onZoomOut={() => setScale((s) => Math.max(MIN_SCALE, +(s - ZOOM_STEP).toFixed(2)))}
        onFit={() => setScale(1)}
        disabled={!file}
      />

      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: "auto",
          padding: SIDE_PADDING / 2,
          minHeight: 0,
        }}
      >
        {!file ? (
          <EmptyState />
        ) : loadError ? (
          <ErrorState message={loadError} />
        ) : (
          <Document
            file={file}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            onLoadError={(err) => setLoadError(err.message)}
            loading={<Centered>Rendering PDF…</Centered>}
            error={<ErrorState message="Failed to render the PDF." />}
            noData={<EmptyState />}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1rem",
              }}
            >
              {Array.from({ length: numPages }, (_, i) => (
                <Page
                  key={`page-${i + 1}`}
                  pageNumber={i + 1}
                  width={renderedWidth}
                  renderTextLayer
                  renderAnnotationLayer
                  loading={
                    <div
                      style={{
                        width: renderedWidth,
                        height: renderedWidth * 1.414,
                        background: "#fff",
                        boxShadow: "0 6px 24px rgba(0,0,0,.45)",
                      }}
                    />
                  }
                  className="pdf-page-shadow"
                />
              ))}
            </div>
          </Document>
        )}
      </div>
    </div>
  );
}

interface ToolbarProps {
  scale: number;
  numPages: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  disabled: boolean;
}

function Toolbar({ scale, numPages, onZoomIn, onZoomOut, onFit, disabled }: ToolbarProps) {
  const pct = Math.round(scale * 100);
  const btn: React.CSSProperties = {
    background: "rgba(255,255,255,0.08)",
    color: "#e2e8f0",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 4,
    padding: "0.25rem 0.55rem",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "0.85rem",
    lineHeight: 1,
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.5rem 0.75rem",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(0,0,0,0.25)",
        color: "#cbd5e1",
        fontSize: "0.8rem",
      }}
    >
      <button type="button" onClick={onZoomOut} disabled={disabled} style={btn} aria-label="Zoom out">
        −
      </button>
      <button type="button" onClick={onFit} disabled={disabled} style={btn} title="Fit to width">
        {pct}%
      </button>
      <button type="button" onClick={onZoomIn} disabled={disabled} style={btn} aria-label="Zoom in">
        +
      </button>
      <span style={{ marginLeft: "auto", opacity: numPages ? 1 : 0.6 }}>
        {numPages ? `${numPages} page${numPages === 1 ? "" : "s"}` : "no document"}
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <Centered>
      <p style={{ margin: 0 }}>
        Click <strong>Compile preview</strong> to render your LaTeX here.
      </p>
    </Centered>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Centered>
      <p style={{ margin: 0, color: "#fecaca" }}>Could not render PDF: {message}</p>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 200,
        color: "#cbd5e1",
        fontSize: "0.9rem",
        textAlign: "center",
        padding: "1rem",
      }}
    >
      {children}
    </div>
  );
}
