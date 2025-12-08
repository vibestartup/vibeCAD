/**
 * AudioViewer - displays audio files with playback controls and visualization
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { AudioDocument } from "../store/tabs-store";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f1a",
    padding: 32,
  },

  card: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#1a1a2e",
    borderRadius: 16,
    border: "1px solid #333",
    padding: 32,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 24,
  },

  artwork: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: "#252545",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 64,
    color: "#646cff",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
  },

  artworkPlaying: {
    animation: "pulse 2s ease-in-out infinite",
  },

  info: {
    textAlign: "center" as const,
    width: "100%",
  },

  title: {
    fontSize: 18,
    fontWeight: 600,
    color: "#fff",
    marginBottom: 4,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },

  subtitle: {
    fontSize: 13,
    color: "#666",
  },

  progressWrapper: {
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
  },

  progressBar: {
    width: "100%",
    height: 6,
    backgroundColor: "#333",
    borderRadius: 3,
    cursor: "pointer",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    backgroundColor: "#646cff",
    borderRadius: 3,
    transition: "width 0.1s linear",
  },

  timeDisplay: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 11,
    color: "#666",
  },

  controls: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  controlButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: "50%",
    backgroundColor: "transparent",
    border: "1px solid #444",
    color: "#888",
    fontSize: 18,
    cursor: "pointer",
    transition: "all 0.15s",
  },

  controlButtonHover: {
    backgroundColor: "#252545",
    borderColor: "#555",
    color: "#fff",
  },

  playButton: {
    width: 64,
    height: 64,
    fontSize: 24,
    backgroundColor: "#646cff",
    borderColor: "#646cff",
    color: "#fff",
  },

  playButtonHover: {
    backgroundColor: "#747bff",
    borderColor: "#747bff",
    transform: "scale(1.05)",
  },

  volumeWrapper: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },

  volumeIcon: {
    fontSize: 16,
    color: "#666",
    cursor: "pointer",
  },

  volumeSlider: {
    width: 120,
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    cursor: "pointer",
    appearance: "none" as const,
    outline: "none",
  },

  fileInfo: {
    display: "flex",
    gap: 16,
    fontSize: 11,
    color: "#555",
    marginTop: 8,
  },
};

// Animation keyframes
const keyframes = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.02); opacity: 0.9; }
  }
`;

// ============================================================================
// Helpers
// ============================================================================

function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toUpperCase() || "AUDIO";
}

// ============================================================================
// Component
// ============================================================================

interface AudioViewerProps {
  document: AudioDocument;
}

export function AudioViewer({ document }: AudioViewerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(document.duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  // Update time display
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  }, [isPlaying]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audio.currentTime = percentage * duration;
  }, [duration]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    const value = parseFloat(e.target.value);
    setVolume(value);
    if (audio) {
      audio.volume = value;
      setIsMuted(value === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume || 1;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const skipBackward = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = Math.max(0, audio.currentTime - 10);
    }
  }, []);

  const skipForward = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = Math.min(duration, audio.currentTime + 10);
    }
  }, [duration]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skipBackward();
          break;
        case "ArrowRight":
          e.preventDefault();
          skipForward();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, skipBackward, skipForward, toggleMute]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Get display name without extension
  const displayName = document.originalFilename.replace(/\.[^/.]+$/, "");

  return (
    <div style={styles.container}>
      <style>{keyframes}</style>
      <audio ref={audioRef} src={document.src} preload="metadata" />

      <div style={styles.card}>
        {/* Artwork / Icon */}
        <div
          style={{
            ...styles.artwork,
            ...(isPlaying ? styles.artworkPlaying : {}),
          }}
        >
          🎵
        </div>

        {/* Track Info */}
        <div style={styles.info}>
          <div style={styles.title} title={displayName}>
            {displayName}
          </div>
          <div style={styles.subtitle}>{getFileExtension(document.originalFilename)}</div>
        </div>

        {/* Progress Bar */}
        <div style={styles.progressWrapper}>
          <div style={styles.progressBar} onClick={handleProgressClick}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <div style={styles.timeDisplay}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div style={styles.controls}>
          <button
            style={{
              ...styles.controlButton,
              ...(hoveredButton === "back" ? styles.controlButtonHover : {}),
            }}
            onClick={skipBackward}
            onMouseEnter={() => setHoveredButton("back")}
            onMouseLeave={() => setHoveredButton(null)}
            title="Back 10s"
          >
            ⏪
          </button>

          <button
            style={{
              ...styles.controlButton,
              ...styles.playButton,
              ...(hoveredButton === "play" ? styles.playButtonHover : {}),
            }}
            onClick={togglePlay}
            onMouseEnter={() => setHoveredButton("play")}
            onMouseLeave={() => setHoveredButton(null)}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>

          <button
            style={{
              ...styles.controlButton,
              ...(hoveredButton === "forward" ? styles.controlButtonHover : {}),
            }}
            onClick={skipForward}
            onMouseEnter={() => setHoveredButton("forward")}
            onMouseLeave={() => setHoveredButton(null)}
            title="Forward 10s"
          >
            ⏩
          </button>
        </div>

        {/* Volume Control */}
        <div style={styles.volumeWrapper}>
          <span
            style={styles.volumeIcon}
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            style={styles.volumeSlider}
            title="Volume"
          />
        </div>

        {/* File Info */}
        <div style={styles.fileInfo}>
          <span>{formatFileSize(document.size)}</span>
          <span>{document.mimeType}</span>
        </div>
      </div>
    </div>
  );
}

export default AudioViewer;
