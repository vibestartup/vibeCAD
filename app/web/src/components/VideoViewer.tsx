/**
 * VideoViewer - displays video files with playback controls
 */

import React, { useState, useRef, useCallback, useEffect } from "react";
import type { VideoDocument } from "../store/tabs-store";

// ============================================================================
// Styles
// ============================================================================

const styles = {
  container: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    backgroundColor: "#000",
    overflow: "hidden",
  },

  videoWrapper: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative" as const,
  },

  video: {
    maxWidth: "100%",
    maxHeight: "100%",
    outline: "none",
  },

  controls: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    backgroundColor: "#1a1a2e",
    borderTop: "1px solid #333",
    flexShrink: 0,
  },

  controlButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "transparent",
    border: "1px solid #333",
    color: "#888",
    fontSize: 16,
    cursor: "pointer",
    transition: "background-color 0.15s, color 0.15s, border-color 0.15s",
  },

  controlButtonHover: {
    backgroundColor: "#252545",
    borderColor: "#444",
    color: "#fff",
  },

  controlButtonActive: {
    backgroundColor: "#646cff",
    borderColor: "#646cff",
    color: "#fff",
  },

  progressWrapper: {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
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

  volumeWrapper: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  volumeSlider: {
    width: 80,
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    cursor: "pointer",
    appearance: "none" as const,
    outline: "none",
  },

  info: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    fontSize: 11,
    color: "#666",
  },

  fullscreenOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    opacity: 0,
    transition: "opacity 0.2s",
    cursor: "pointer",
  },

  playOverlay: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    backgroundColor: "rgba(100, 108, 255, 0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 32,
    color: "#fff",
  },
};

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

// ============================================================================
// Component
// ============================================================================

interface VideoViewerProps {
  document: VideoDocument;
}

export function VideoViewer({ document }: VideoViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);

  // Update time display
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handlePlay = () => {
      setIsPlaying(true);
      setShowOverlay(false);
    };
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setShowOverlay(true);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
  }, [isPlaying]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    video.currentTime = percentage * duration;
  }, [duration]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    const value = parseFloat(e.target.value);
    setVolume(value);
    if (video) {
      video.volume = value;
      setIsMuted(value === 0);
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isMuted) {
      video.volume = volume || 1;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (window.document.fullscreenElement) {
      window.document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const video = videoRef.current;
    if (!video) return;

    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlay();
        break;
      case "ArrowLeft":
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
        break;
      case "ArrowRight":
        e.preventDefault();
        video.currentTime = Math.min(duration, video.currentTime + 5);
        break;
      case "ArrowUp":
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.1);
        setVolume(video.volume);
        break;
      case "ArrowDown":
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.1);
        setVolume(video.volume);
        break;
      case "m":
        e.preventDefault();
        toggleMute();
        break;
      case "f":
        e.preventDefault();
        toggleFullscreen();
        break;
    }
  }, [togglePlay, duration, toggleMute, toggleFullscreen]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div style={styles.container} onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Video */}
      <div style={styles.videoWrapper} onClick={togglePlay}>
        <video
          ref={videoRef}
          src={document.src}
          style={styles.video}
          playsInline
        />
        {showOverlay && !isPlaying && (
          <div style={{ ...styles.fullscreenOverlay, opacity: 1 }}>
            <div style={styles.playOverlay}>▶</div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <button
          style={{
            ...styles.controlButton,
            ...(hoveredButton === "play" ? styles.controlButtonHover : {}),
          }}
          onClick={togglePlay}
          onMouseEnter={() => setHoveredButton("play")}
          onMouseLeave={() => setHoveredButton(null)}
          title={isPlaying ? "Pause (Space)" : "Play (Space)"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        <div style={styles.progressWrapper}>
          <div style={styles.progressBar} onClick={handleProgressClick}>
            <div style={{ ...styles.progressFill, width: `${progress}%` }} />
          </div>
          <div style={styles.timeDisplay}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div style={styles.volumeWrapper}>
          <button
            style={{
              ...styles.controlButton,
              width: 32,
              height: 32,
              fontSize: 14,
              ...(hoveredButton === "mute" ? styles.controlButtonHover : {}),
            }}
            onClick={toggleMute}
            onMouseEnter={() => setHoveredButton("mute")}
            onMouseLeave={() => setHoveredButton(null)}
            title={isMuted ? "Unmute (M)" : "Mute (M)"}
          >
            {isMuted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
          </button>
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

        <button
          style={{
            ...styles.controlButton,
            width: 32,
            height: 32,
            fontSize: 14,
            ...(hoveredButton === "fullscreen" ? styles.controlButtonHover : {}),
          }}
          onClick={toggleFullscreen}
          onMouseEnter={() => setHoveredButton("fullscreen")}
          onMouseLeave={() => setHoveredButton(null)}
          title="Fullscreen (F)"
        >
          ⛶
        </button>

        <div style={styles.info}>
          <span>{formatFileSize(document.size)}</span>
        </div>
      </div>
    </div>
  );
}

export default VideoViewer;
