/**
 * AboutModal - displays application information.
 */

import React, { useEffect } from "react";

const styles = {
  overlay: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },

  modal: {
    backgroundColor: "#1a1a2e",
    borderRadius: 8,
    border: "1px solid #333",
    width: "100%",
    maxWidth: 400,
    overflow: "hidden",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid #333",
  },

  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: "#fff",
  },

  closeButton: {
    background: "none",
    border: "none",
    color: "#888",
    fontSize: 20,
    cursor: "pointer",
    padding: 4,
    lineHeight: 1,
  },

  content: {
    padding: "24px 20px",
    textAlign: "center" as const,
  },

  logo: {
    fontSize: 32,
    fontWeight: 700,
    color: "#646cff",
    marginBottom: 8,
  },

  version: {
    fontSize: 14,
    color: "#888",
    marginBottom: 20,
  },

  description: {
    fontSize: 14,
    color: "#ccc",
    lineHeight: 1.6,
    marginBottom: 20,
  },

  techStack: {
    fontSize: 12,
    color: "#666",
    marginBottom: 16,
  },

  link: {
    color: "#646cff",
    textDecoration: "none",
  },

  footer: {
    padding: "16px 20px",
    borderTop: "1px solid #333",
    textAlign: "center" as const,
  },

  copyright: {
    fontSize: 12,
    color: "#666",
  },
};

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>About</h2>
          <button style={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          <div style={styles.logo}>vibeCAD</div>
          <div style={styles.version}>Version 0.1.0</div>
          <p style={styles.description}>
            A browser-native parametric CAD system with sketch-plane constraints,
            feature-based modeling, and assembly support.
          </p>
          <div style={styles.techStack}>
            Built with React, Three.js, OpenCascade.js, and PlaneGCS
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <div style={styles.copyright}>
            © {new Date().getFullYear()} vibeCAD
          </div>
        </div>
      </div>
    </div>
  );
}

export default AboutModal;
