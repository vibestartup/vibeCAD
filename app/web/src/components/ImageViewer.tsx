/**
 * ImageViewer - displays images with pan/zoom controls
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { ImageDocument } from "../store/tabs-store";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    backgroundColor: "#0f0f1a",
    overflow: "hidden",
  },

  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 16px",
    backgroundColor: "#1a1a2e",
    borderBottom: "1px solid #333",
  },

  toolbarButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 4,
    backgroundColor: "transparent",
    border: "1px solid #333",
    color: "#888",
    fontSize: 14,
    cursor: "pointer",
    transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
  },

  toolbarButtonHover: {
    backgroundColor: "#252545",
    borderColor: "#444",
    color: "#fff",
  },

  toolbarDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#333",
  },

  zoomDisplay: {
    fontSize: 12,
    color: "#888",
    minWidth: 60,
    textAlign: "center" as const,
  },

  info: {
    marginLeft: "auto",
    fontSize: 11,
    color: "#666",
  },

  viewport: {
    flex: 1,
    overflow: "hidden",
    position: "relative" as const,
    cursor: "grab",
  },

  viewportDragging: {
    cursor: "grabbing",
  },

  canvas: {
    position: "absolute" as const,
    transformOrigin: "0 0",
  },

  image: {
    display: "block",
    maxWidth: "none",
    maxHeight: "none",
  },

  checkerboard: {
    backgroundImage: `
      linear-gradient(45deg, #222 25%, transparent 25%),
      linear-gradient(-45deg, #222 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #222 75%),
      linear-gradient(-45deg, transparent 75%, #222 75%)
    `,
    backgroundSize: "20px 20px",
    backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
  },
};

// ============================================================================
// Component
// ============================================================================

interface ImageViewerProps {
  document: ImageDocument;
}

export function ImageViewer({ document }: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [showCheckerboard, setShowCheckerboard] = useState(true);

  // Center image when loaded or container resizes
  const centerImage = useCallback(() => {
    const container = containerRef.current;
    if (!container || !imageSize.width) return;

    const containerRect = container.getBoundingClientRect();
    const scaledWidth = imageSize.width * zoom;
    const scaledHeight = imageSize.height * zoom;

    setPan({
      x: (containerRect.width - scaledWidth) / 2,
      y: (containerRect.height - scaledHeight) / 2,
    });
  }, [imageSize, zoom]);

  // Fit to view
  const fitToView = useCallback(() => {
    const container = containerRef.current;
    if (!container || !imageSize.width) return;

    const containerRect = container.getBoundingClientRect();
    const padding = 40;

    const scaleX = (containerRect.width - padding * 2) / imageSize.width;
    const scaleY = (containerRect.height - padding * 2) / imageSize.height;
    const newZoom = Math.min(scaleX, scaleY, 1);

    setZoom(newZoom);
    // Center will be updated by effect
  }, [imageSize]);

  // Reset zoom
  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  // Handle image load
  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    },
    []
  );

  // Center when zoom changes
  useEffect(() => {
    centerImage();
  }, [zoom, centerImage]);

  // Fit on initial load
  useEffect(() => {
    if (imageSize.width > 0) {
      fitToView();
    }
  }, [imageSize, fitToView]);

  // Handle wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(10, zoom * delta));

      // Zoom toward mouse position
      const scale = newZoom / zoom;
      setPan({
        x: mouseX - (mouseX - pan.x) * scale,
        y: mouseY - (mouseY - pan.y) * scale,
      });
      setZoom(newZoom);
    },
    [zoom, pan]
  );

  // Handle drag start
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    },
    [pan]
  );

  // Handle drag
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart]
  );

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "zoomIn" ? styles.toolbarButtonHover : {}),
          }}
          onClick={() => setZoom(Math.min(10, zoom * 1.25))}
          onMouseEnter={() => setHoveredButton("zoomIn")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Zoom In"
        >
          +
        </button>
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "zoomOut" ? styles.toolbarButtonHover : {}),
          }}
          onClick={() => setZoom(Math.max(0.1, zoom * 0.8))}
          onMouseEnter={() => setHoveredButton("zoomOut")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Zoom Out"
        >
          −
        </button>
        <div style={styles.zoomDisplay}>{Math.round(zoom * 100)}%</div>
        <div style={styles.toolbarDivider} />
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "fit" ? styles.toolbarButtonHover : {}),
          }}
          onClick={fitToView}
          onMouseEnter={() => setHoveredButton("fit")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Fit to View"
        >
          ⊡
        </button>
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "reset" ? styles.toolbarButtonHover : {}),
          }}
          onClick={resetZoom}
          onMouseEnter={() => setHoveredButton("reset")}
          onMouseLeave={() => setHoveredButton(null)}
          title="100%"
        >
          1:1
        </button>
        <div style={styles.toolbarDivider} />
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "checker" ? styles.toolbarButtonHover : {}),
            ...(showCheckerboard ? { borderColor: "#646cff", color: "#646cff" } : {}),
          }}
          onClick={() => setShowCheckerboard(!showCheckerboard)}
          onMouseEnter={() => setHoveredButton("checker")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Toggle Transparency Grid"
        >
          ▦
        </button>
        <div style={styles.info}>
          {document.width && document.height
            ? `${document.width} × ${document.height}`
            : imageSize.width
            ? `${imageSize.width} × ${imageSize.height}`
            : ""}
        </div>
      </div>

      {/* Viewport */}
      <div
        ref={containerRef}
        style={{
          ...styles.viewport,
          ...(isDragging ? styles.viewportDragging : {}),
          ...(showCheckerboard ? styles.checkerboard : {}),
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        <div
          style={{
            ...styles.canvas,
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          <img
            src={document.src}
            alt={document.name}
            style={styles.image}
            onLoad={handleImageLoad}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}

export default ImageViewer;
