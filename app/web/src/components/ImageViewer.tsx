/**
 * ImageViewer - displays images with pan/zoom controls, image adjustments, and drawing tools
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { ImageDocument } from "../store/tabs-store";
import {
  useImageEditorStore,
  generateStrokeId,
  type DrawingTool,
  type DrawingStroke,
} from "../store/image-editor-store";

// ============================================================================
// Types
// ============================================================================

type ShapeTool = "line" | "arrow" | "rectangle" | "ellipse";

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
    flexShrink: 0,
    flexWrap: "wrap" as const,
  },

  toolbarButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 12px",
    borderRadius: 4,
    backgroundColor: "transparent",
    border: "1px solid #333",
    color: "#888",
    fontSize: 12,
    cursor: "pointer",
    transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
    gap: 6,
    minWidth: 32,
    height: 32,
  },

  toolbarButtonHover: {
    backgroundColor: "#252545",
    borderColor: "#444",
    color: "#fff",
  },

  toolbarButtonActive: {
    backgroundColor: "#646cff",
    borderColor: "#646cff",
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
    minWidth: 50,
    textAlign: "center" as const,
  },

  info: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  infoItem: {
    fontSize: 11,
    color: "#666",
  },

  formatBadge: {
    fontSize: 10,
    color: "#4dabf7",
    backgroundColor: "#252545",
    padding: "2px 8px",
    borderRadius: 4,
    textTransform: "uppercase" as const,
  },

  mainArea: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
    position: "relative" as const,
  },

  viewport: {
    flex: 1,
    overflow: "hidden",
    position: "relative" as const,
    cursor: "grab",
  },

  canvasContainer: {
    position: "absolute" as const,
    transformOrigin: "0 0",
  },

  image: {
    display: "block",
    maxWidth: "none",
    maxHeight: "none",
  },

  drawingCanvas: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    pointerEvents: "auto" as const,
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

  colorInfo: {
    position: "absolute" as const,
    bottom: 16,
    left: 16,
    backgroundColor: "rgba(26, 26, 46, 0.9)",
    border: "1px solid #333",
    borderRadius: 6,
    padding: "8px 12px",
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 11,
    color: "#888",
    zIndex: 10,
  },

  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    border: "1px solid #444",
  },

  // Dropdown styles
  dropdownContainer: {
    position: "relative" as const,
  },

  dropdownMenu: {
    position: "absolute" as const,
    top: "100%",
    left: 0,
    marginTop: 4,
    backgroundColor: "#1a1a2e",
    border: "1px solid #333",
    borderRadius: 4,
    padding: 4,
    zIndex: 100,
    minWidth: 120,
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
  },

  dropdownItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 3,
    backgroundColor: "transparent",
    border: "none",
    color: "#888",
    fontSize: 12,
    cursor: "pointer",
    width: "100%",
    textAlign: "left" as const,
  },

  dropdownItemHover: {
    backgroundColor: "#252545",
    color: "#fff",
  },

  dropdownItemActive: {
    backgroundColor: "#646cff",
    color: "#fff",
  },

  // Text input overlay
  textInputOverlay: {
    position: "absolute" as const,
    zIndex: 20,
    backgroundColor: "transparent",
    border: "1px dashed #646cff",
    padding: 4,
    outline: "none",
    resize: "none" as const,
    overflow: "hidden",
    minWidth: 100,
    minHeight: 30,
  },

};

// Shape tool definitions
const shapeTools: { id: ShapeTool; label: string; icon: string }[] = [
  { id: "line", label: "Line", icon: "╱" },
  { id: "arrow", label: "Arrow", icon: "→" },
  { id: "rectangle", label: "Rectangle", icon: "▢" },
  { id: "ellipse", label: "Ellipse", icon: "○" },
];

// ============================================================================
// Helpers
// ============================================================================

function getImageFormat(mimeType: string): string {
  const formats: Record<string, string> = {
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/gif": "GIF",
    "image/webp": "WebP",
    "image/svg+xml": "SVG",
    "image/bmp": "BMP",
  };
  return formats[mimeType] || mimeType.split("/")[1]?.toUpperCase() || "IMG";
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function getCursorForTool(tool: DrawingTool): string {
  switch (tool) {
    case "select": return "default";
    case "pen": return "crosshair";
    case "brush": return "crosshair";
    case "eraser": return "crosshair";
    case "line": return "crosshair";
    case "arrow": return "crosshair";
    case "rectangle": return "crosshair";
    case "ellipse": return "crosshair";
    case "text": return "text";
    case "eyedropper": return "crosshair";
    default: return "default";
  }
}

function isShapeTool(tool: DrawingTool): tool is ShapeTool {
  return ["line", "arrow", "rectangle", "ellipse"].includes(tool);
}

// ============================================================================
// Drawing Canvas Component
// ============================================================================

interface DrawingCanvasProps {
  width: number;
  height: number;
  strokes: DrawingStroke[];
  currentStroke: DrawingStroke | null;
  brushHardness: number;
}

function DrawingCanvas({ width, height, strokes, currentStroke, brushHardness }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;

    for (const stroke of allStrokes) {
      ctx.save();
      ctx.globalAlpha = stroke.opacity / 100;
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      switch (stroke.tool) {
        case "pen":
          if (stroke.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
              ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
          }
          break;

        case "brush":
          // Brush with hardness - use shadow blur for soft edges
          if (stroke.points.length > 0) {
            const hardnessValue = stroke.brushHardness ?? brushHardness;
            const softness = ((100 - hardnessValue) / 100) * stroke.size;

            if (softness > 0) {
              ctx.shadowColor = stroke.color;
              ctx.shadowBlur = softness;
            }

            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
              ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
            ctx.shadowBlur = 0;
          }
          break;

        case "eraser":
          ctx.globalCompositeOperation = "destination-out";
          if (stroke.points.length > 0) {
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
              ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            ctx.stroke();
          }
          break;

        case "line":
          if (stroke.startPoint && stroke.endPoint) {
            ctx.beginPath();
            ctx.moveTo(stroke.startPoint.x, stroke.startPoint.y);
            ctx.lineTo(stroke.endPoint.x, stroke.endPoint.y);
            ctx.stroke();
          }
          break;

        case "arrow":
          if (stroke.startPoint && stroke.endPoint) {
            const headSize = stroke.arrowHeadSize || 12;
            const dx = stroke.endPoint.x - stroke.startPoint.x;
            const dy = stroke.endPoint.y - stroke.startPoint.y;
            const angle = Math.atan2(dy, dx);

            ctx.beginPath();
            ctx.moveTo(stroke.startPoint.x, stroke.startPoint.y);
            ctx.lineTo(stroke.endPoint.x, stroke.endPoint.y);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(stroke.endPoint.x, stroke.endPoint.y);
            ctx.lineTo(
              stroke.endPoint.x - headSize * Math.cos(angle - Math.PI / 6),
              stroke.endPoint.y - headSize * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(stroke.endPoint.x, stroke.endPoint.y);
            ctx.lineTo(
              stroke.endPoint.x - headSize * Math.cos(angle + Math.PI / 6),
              stroke.endPoint.y - headSize * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();
          }
          break;

        case "rectangle":
          if (stroke.startPoint && stroke.endPoint) {
            const x = Math.min(stroke.startPoint.x, stroke.endPoint.x);
            const y = Math.min(stroke.startPoint.y, stroke.endPoint.y);
            const w = Math.abs(stroke.endPoint.x - stroke.startPoint.x);
            const h = Math.abs(stroke.endPoint.y - stroke.startPoint.y);
            ctx.strokeRect(x, y, w, h);
          }
          break;

        case "ellipse":
          if (stroke.startPoint && stroke.endPoint) {
            const cx = (stroke.startPoint.x + stroke.endPoint.x) / 2;
            const cy = (stroke.startPoint.y + stroke.endPoint.y) / 2;
            const rx = Math.abs(stroke.endPoint.x - stroke.startPoint.x) / 2;
            const ry = Math.abs(stroke.endPoint.y - stroke.startPoint.y) / 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          break;

        case "text":
          if (stroke.text && stroke.startPoint) {
            ctx.font = `${stroke.fontSize || 24}px ${stroke.fontFamily || "Arial"}`;
            ctx.fillText(stroke.text, stroke.startPoint.x, stroke.startPoint.y);
          }
          break;
      }

      ctx.restore();
    }
  }, [width, height, strokes, currentStroke, brushHardness]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={styles.drawingCanvas}
    />
  );
}

// ============================================================================
// Text Input Overlay Component
// ============================================================================

interface TextInputOverlayProps {
  position: { x: number; y: number };
  zoom: number;
  pan: { x: number; y: number };
  fontSize: number;
  fontFamily: string;
  color: string;
  opacity: number;
  onComplete: (text: string) => void;
  onCancel: () => void;
}

function TextInputOverlay({
  position,
  zoom,
  pan,
  fontSize,
  fontFamily,
  color,
  opacity,
  onComplete,
  onCancel,
}: TextInputOverlayProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) {
        onComplete(text);
      } else {
        onCancel();
      }
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const handleBlur = () => {
    if (text.trim()) {
      onComplete(text);
    } else {
      onCancel();
    }
  };

  const screenX = position.x * zoom + pan.x;
  const screenY = position.y * zoom + pan.y;
  const scaledFontSize = fontSize * zoom;

  return (
    <textarea
      ref={inputRef}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      style={{
        ...styles.textInputOverlay,
        left: screenX,
        top: screenY - scaledFontSize,
        fontSize: scaledFontSize,
        fontFamily,
        color,
        opacity: opacity / 100,
        lineHeight: 1.2,
      }}
      placeholder="Type here..."
    />
  );
}

// ============================================================================
// Shape Dropdown Component
// ============================================================================

interface ShapeDropdownProps {
  activeTool: DrawingTool;
  onSelectShape: (shape: ShapeTool) => void;
  hoveredButton: string | null;
  setHoveredButton: (id: string | null) => void;
}

function ShapeDropdown({ activeTool, onSelectShape, hoveredButton, setHoveredButton }: ShapeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const currentShape = isShapeTool(activeTool) ? activeTool : "rectangle";
  const currentShapeInfo = shapeTools.find((s) => s.id === currentShape) || shapeTools[2];
  const isActive = isShapeTool(activeTool);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div style={styles.dropdownContainer} ref={dropdownRef}>
      <button
        style={{
          ...styles.toolbarButton,
          ...(hoveredButton === "shapes" && !isActive ? styles.toolbarButtonHover : {}),
          ...(isActive ? styles.toolbarButtonActive : {}),
        }}
        onClick={() => {
          if (isActive) {
            setIsOpen(!isOpen);
          } else {
            onSelectShape(currentShape);
          }
        }}
        onMouseEnter={() => setHoveredButton("shapes")}
        onMouseLeave={() => setHoveredButton(null)}
        title="Shapes"
      >
        {currentShapeInfo.icon}
        <span style={{ fontSize: 8, marginLeft: 2 }}>▼</span>
      </button>

      {isOpen && (
        <div style={styles.dropdownMenu}>
          {shapeTools.map((shape) => (
            <button
              key={shape.id}
              style={{
                ...styles.dropdownItem,
                ...(hoveredItem === shape.id ? styles.dropdownItemHover : {}),
                ...(activeTool === shape.id ? styles.dropdownItemActive : {}),
              }}
              onClick={() => {
                onSelectShape(shape.id);
                setIsOpen(false);
              }}
              onMouseEnter={() => setHoveredItem(shape.id)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <span>{shape.icon}</span>
              <span>{shape.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface ImageViewerProps {
  document: ImageDocument;
}

export function ImageViewer({ document: imageDoc }: ImageViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Drawing store
  const {
    activeTool,
    setActiveTool,
    strokeColor,
    setStrokeColor,
    strokeSize,
    opacity,
    brushHardness,
    arrowHeadSize,
    strokes,
    addStroke,
    pushUndoState,
    isDrawing,
    setIsDrawing,
    currentStroke,
    setCurrentStroke,
    undo,
    redo,
    fontSize,
    fontFamily,
  } = useImageEditorStore();

  // View state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // Display options
  const [showCheckerboard, setShowCheckerboard] = useState(true);
  const [pickedColor, setPickedColor] = useState<{ r: number; g: number; b: number; x: number; y: number } | null>(null);

  // Transform state
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  // Space key for panning
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Text editing state
  const [textEditPosition, setTextEditPosition] = useState<{ x: number; y: number } | null>(null);

  // Adjustment state
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [hue, setHue] = useState(0);
  const [blur, setBlur] = useState(0);
  const [invert, setInvert] = useState(false);
  const [grayscale, setGrayscale] = useState(false);

  // Build CSS filter string
  const filterString = useMemo(() => {
    const filters: string[] = [];
    if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
    if (contrast !== 100) filters.push(`contrast(${contrast}%)`);
    if (saturation !== 100) filters.push(`saturate(${saturation}%)`);
    if (hue !== 0) filters.push(`hue-rotate(${hue}deg)`);
    if (blur > 0) filters.push(`blur(${blur}px)`);
    if (invert) filters.push("invert(1)");
    if (grayscale) filters.push("grayscale(1)");
    return filters.length > 0 ? filters.join(" ") : "none";
  }, [brightness, contrast, saturation, hue, blur, invert, grayscale]);

  // Build transform string
  const transformString = useMemo(() => {
    const transforms: string[] = [];
    transforms.push(`translate(${pan.x}px, ${pan.y}px)`);
    transforms.push(`scale(${zoom})`);
    if (rotation !== 0) transforms.push(`rotate(${rotation}deg)`);
    if (flipH) transforms.push("scaleX(-1)");
    if (flipV) transforms.push("scaleY(-1)");
    return transforms.join(" ");
  }, [pan, zoom, rotation, flipH, flipV]);

  // Reset all adjustments
  const resetAdjustments = useCallback(() => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setHue(0);
    setBlur(0);
    setInvert(false);
    setGrayscale(false);
  }, []);

  // Reset transforms
  const resetTransforms = useCallback(() => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
  }, []);

  // Center image
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
  }, [imageSize]);

  // Reset zoom
  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  // Handle image load
  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

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

  // Convert screen coordinates to image coordinates
  const screenToImage = useCallback((screenX: number, screenY: number) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };

    const rect = container.getBoundingClientRect();
    const x = (screenX - rect.left - pan.x) / zoom;
    const y = (screenY - rect.top - pan.y) / zoom;
    return { x, y };
  }, [pan, zoom]);

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(20, zoom * delta));

    const scale = newZoom / zoom;
    setPan({
      x: mouseX - (mouseX - pan.x) * scale,
      y: mouseY - (mouseY - pan.y) * scale,
    });
    setZoom(newZoom);
  }, [zoom, pan]);

  // Handle text completion
  const handleTextComplete = useCallback((text: string) => {
    if (textEditPosition && text.trim()) {
      pushUndoState();
      const newStroke: DrawingStroke = {
        id: generateStrokeId(),
        tool: "text",
        points: [],
        color: strokeColor,
        size: strokeSize,
        opacity: opacity,
        startPoint: textEditPosition,
        text,
        fontSize,
        fontFamily,
      };
      addStroke(newStroke);
    }
    setTextEditPosition(null);
  }, [textEditPosition, pushUndoState, strokeColor, strokeSize, opacity, fontSize, fontFamily, addStroke]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;

    const imgCoords = screenToImage(e.clientX, e.clientY);

    // Eyedropper tool
    if (activeTool === "eyedropper") {
      const img = imageRef.current;
      if (!img) return;

      if (imgCoords.x >= 0 && imgCoords.x < imageSize.width && imgCoords.y >= 0 && imgCoords.y < imageSize.height) {
        const canvas = window.document.createElement("canvas");
        canvas.width = imageSize.width;
        canvas.height = imageSize.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const pixel = ctx.getImageData(Math.floor(imgCoords.x), Math.floor(imgCoords.y), 1, 1).data;
          const hexColor = rgbToHex(pixel[0], pixel[1], pixel[2]);
          setPickedColor({ r: pixel[0], g: pixel[1], b: pixel[2], x: Math.floor(imgCoords.x), y: Math.floor(imgCoords.y) });
          setStrokeColor(hexColor);
        }
      }
      return;
    }

    // Select tool or space-drag for panning
    if (activeTool === "select" || isSpacePressed) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    // Text tool - open text input
    if (activeTool === "text") {
      setTextEditPosition(imgCoords);
      return;
    }

    // Start drawing
    if (["pen", "brush", "eraser", "line", "arrow", "rectangle", "ellipse"].includes(activeTool)) {
      pushUndoState();
      setIsDrawing(true);

      const newStroke: DrawingStroke = {
        id: generateStrokeId(),
        tool: activeTool,
        points: [imgCoords],
        color: strokeColor,
        size: strokeSize,
        opacity: opacity,
        startPoint: imgCoords,
        endPoint: imgCoords,
        brushHardness: activeTool === "brush" ? brushHardness : undefined,
        arrowHeadSize: activeTool === "arrow" ? arrowHeadSize : undefined,
      };

      setCurrentStroke(newStroke);
    }
  }, [activeTool, screenToImage, imageSize, pan, pushUndoState, strokeColor, strokeSize, opacity, brushHardness, arrowHeadSize, setCurrentStroke, setIsDrawing, setStrokeColor, isSpacePressed]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (isDrawing && currentStroke) {
      const imgCoords = screenToImage(e.clientX, e.clientY);

      if (["pen", "brush", "eraser"].includes(currentStroke.tool)) {
        setCurrentStroke({
          ...currentStroke,
          points: [...currentStroke.points, imgCoords],
        });
      } else if (["line", "arrow", "rectangle", "ellipse"].includes(currentStroke.tool)) {
        setCurrentStroke({
          ...currentStroke,
          endPoint: imgCoords,
        });
      }
    }
  }, [isPanning, panStart, isDrawing, currentStroke, screenToImage, setCurrentStroke]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);

    if (isDrawing && currentStroke) {
      addStroke(currentStroke);
      setCurrentStroke(null);
      setIsDrawing(false);
    }
  }, [isDrawing, currentStroke, addStroke, setCurrentStroke, setIsDrawing]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    if (isDrawing && currentStroke) {
      addStroke(currentStroke);
      setCurrentStroke(null);
      setIsDrawing(false);
    }
  }, [isDrawing, currentStroke, addStroke, setCurrentStroke, setIsDrawing]);

  // Rotate functions
  const rotateLeft = useCallback(() => {
    setRotation((r) => (r - 90 + 360) % 360);
  }, []);

  const rotateRight = useCallback(() => {
    setRotation((r) => (r + 90) % 360);
  }, []);

  // Download with adjustments and drawings
  const downloadImage = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;

    const canvas = window.document.createElement("canvas");
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.filter = filterString;
    ctx.drawImage(img, 0, 0);

    const link = window.document.createElement("a");
    link.download = imageDoc.name.replace(/\.[^/.]+$/, "") + "_edited.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [imageSize, filterString, imageDoc.name]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async () => {
    const img = imageRef.current;
    if (!img) return;

    const canvas = window.document.createElement("canvas");
    canvas.width = imageSize.width;
    canvas.height = imageSize.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.filter = filterString;
    ctx.drawImage(img, 0, 0);

    canvas.toBlob(async (blob: Blob | null) => {
      if (blob) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
        } catch (err) {
          console.error("Failed to copy image:", err);
        }
      }
    });
  }, [imageSize, filterString]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Space key for panning
      if (e.code === "Space") {
        e.preventDefault();
        setIsSpacePressed(true);
        return;
      }

      // Tool shortcuts
      const toolShortcuts: Record<string, DrawingTool> = {
        v: "select", p: "pen", b: "brush", e: "eraser",
        l: "line", a: "arrow", r: "rectangle", o: "ellipse",
        t: "text", i: "eyedropper",
      };

      if (toolShortcuts[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setActiveTool(toolShortcuts[e.key.toLowerCase()]);
        return;
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      // View shortcuts
      switch (e.key) {
        case "0":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            fitToView();
          }
          break;
        case "1":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            resetZoom();
          }
          break;
        case "+":
        case "=":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom((z) => Math.min(20, z * 1.25));
          }
          break;
        case "-":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom((z) => Math.max(0.1, z * 0.8));
          }
          break;
        case "h":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setFlipH((f) => !f);
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [fitToView, resetZoom, setActiveTool, undo, redo]);

  // Determine cursor
  const cursor = useMemo(() => {
    if (isPanning) return "grabbing";
    if (activeTool === "select" || isSpacePressed) return "grab";
    return getCursorForTool(activeTool);
  }, [isPanning, activeTool, isSpacePressed]);

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        {/* Select Tool */}
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "select" && activeTool !== "select" ? styles.toolbarButtonHover : {}),
            ...(activeTool === "select" ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setActiveTool("select")}
          onMouseEnter={() => setHoveredButton("select")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Select (V)"
        >
          ↖
        </button>

        <div style={styles.toolbarDivider} />

        {/* Pen Tool */}
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "pen" && activeTool !== "pen" ? styles.toolbarButtonHover : {}),
            ...(activeTool === "pen" ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setActiveTool("pen")}
          onMouseEnter={() => setHoveredButton("pen")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Pen (P)"
        >
          ✎
        </button>

        {/* Brush Tool */}
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "brush" && activeTool !== "brush" ? styles.toolbarButtonHover : {}),
            ...(activeTool === "brush" ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setActiveTool("brush")}
          onMouseEnter={() => setHoveredButton("brush")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Brush (B)"
        >
          B
        </button>

        {/* Eraser Tool */}
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "eraser" && activeTool !== "eraser" ? styles.toolbarButtonHover : {}),
            ...(activeTool === "eraser" ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setActiveTool("eraser")}
          onMouseEnter={() => setHoveredButton("eraser")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Eraser (E)"
        >
          ⌫
        </button>

        {/* Shapes Dropdown */}
        <ShapeDropdown
          activeTool={activeTool}
          onSelectShape={setActiveTool}
          hoveredButton={hoveredButton}
          setHoveredButton={setHoveredButton}
        />

        {/* Text Tool */}
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "text" && activeTool !== "text" ? styles.toolbarButtonHover : {}),
            ...(activeTool === "text" ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setActiveTool("text")}
          onMouseEnter={() => setHoveredButton("text")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Text (T)"
        >
          T
        </button>

        {/* Eyedropper Tool */}
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "eyedropper" && activeTool !== "eyedropper" ? styles.toolbarButtonHover : {}),
            ...(activeTool === "eyedropper" ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setActiveTool("eyedropper")}
          onMouseEnter={() => setHoveredButton("eyedropper")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Eyedropper (I)"
        >
          I
        </button>

        <div style={styles.toolbarDivider} />

        {/* Zoom Controls */}
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
          -
        </button>
        <div style={styles.zoomDisplay}>{Math.round(zoom * 100)}%</div>
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "zoomIn" ? styles.toolbarButtonHover : {}),
          }}
          onClick={() => setZoom(Math.min(20, zoom * 1.25))}
          onMouseEnter={() => setHoveredButton("zoomIn")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Zoom In"
        >
          +
        </button>
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
          Fit
        </button>

        <div style={styles.toolbarDivider} />

        {/* Transform Controls */}
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "rotateL" ? styles.toolbarButtonHover : {}),
          }}
          onClick={rotateLeft}
          onMouseEnter={() => setHoveredButton("rotateL")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Rotate Left"
        >
          ↺
        </button>
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "rotateR" ? styles.toolbarButtonHover : {}),
          }}
          onClick={rotateRight}
          onMouseEnter={() => setHoveredButton("rotateR")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Rotate Right"
        >
          ↻
        </button>
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "flipH" ? styles.toolbarButtonHover : {}),
            ...(flipH ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setFlipH(!flipH)}
          onMouseEnter={() => setHoveredButton("flipH")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Flip Horizontal"
        >
          ⇆
        </button>
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "flipV" ? styles.toolbarButtonHover : {}),
            ...(flipV ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setFlipV(!flipV)}
          onMouseEnter={() => setHoveredButton("flipV")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Flip Vertical"
        >
          ⇅
        </button>

        <div style={styles.toolbarDivider} />

        {/* View Options */}
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "checker" ? styles.toolbarButtonHover : {}),
            ...(showCheckerboard ? styles.toolbarButtonActive : {}),
          }}
          onClick={() => setShowCheckerboard(!showCheckerboard)}
          onMouseEnter={() => setHoveredButton("checker")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Toggle Transparency Grid"
        >
          ▦
        </button>

        <div style={styles.toolbarDivider} />

        {/* Export */}
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "copy" ? styles.toolbarButtonHover : {}),
          }}
          onClick={copyToClipboard}
          onMouseEnter={() => setHoveredButton("copy")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Copy to Clipboard"
        >
          Copy
        </button>
        <button
          style={{
            ...styles.toolbarButton,
            ...(hoveredButton === "download" ? styles.toolbarButtonHover : {}),
          }}
          onClick={downloadImage}
          onMouseEnter={() => setHoveredButton("download")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Download"
        >
          Save
        </button>

        {/* Info */}
        <div style={styles.info}>
          <span style={styles.formatBadge}>{getImageFormat(imageDoc.mimeType)}</span>
          <span style={styles.infoItem}>
            {imageSize.width} x {imageSize.height}
          </span>
        </div>
      </div>

      {/* Main Area */}
      <div style={styles.mainArea}>
        {/* Viewport */}
        <div
          ref={containerRef}
          style={{
            ...styles.viewport,
            ...(showCheckerboard ? styles.checkerboard : {}),
            cursor,
            flex: 1,
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <div
            style={{
              ...styles.canvasContainer,
              transform: transformString,
            }}
          >
            <img
              ref={imageRef}
              src={imageDoc.src}
              alt={imageDoc.name}
              style={{
                ...styles.image,
                filter: filterString,
              }}
              onLoad={handleImageLoad}
              draggable={false}
            />
            {/* Drawing Canvas Overlay */}
            {imageSize.width > 0 && (
              <DrawingCanvas
                width={imageSize.width}
                height={imageSize.height}
                strokes={strokes}
                currentStroke={currentStroke}
                brushHardness={brushHardness}
              />
            )}
          </div>

          {/* Text Input Overlay */}
          {textEditPosition && (
            <TextInputOverlay
              position={textEditPosition}
              zoom={zoom}
              pan={pan}
              fontSize={fontSize}
              fontFamily={fontFamily}
              color={strokeColor}
              opacity={opacity}
              onComplete={handleTextComplete}
              onCancel={() => setTextEditPosition(null)}
            />
          )}

          {/* Color Info (from eyedropper) */}
          {activeTool === "eyedropper" && pickedColor && (
            <div style={styles.colorInfo}>
              <div
                style={{
                  ...styles.colorSwatch,
                  backgroundColor: rgbToHex(pickedColor.r, pickedColor.g, pickedColor.b),
                }}
              />
              <div>
                <div>RGB: {pickedColor.r}, {pickedColor.g}, {pickedColor.b}</div>
                <div>HEX: {rgbToHex(pickedColor.r, pickedColor.g, pickedColor.b)}</div>
                <div>Pos: {pickedColor.x}, {pickedColor.y}</div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default ImageViewer;
