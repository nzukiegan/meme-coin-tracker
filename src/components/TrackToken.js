import React, { useState } from "react";

const TrackToken = ({ onTrackToken }) => {
  const [trackInput, setTrackInput] = useState("");

  const handleTrack = () => {
    if (trackInput.trim()) {
      onTrackToken(trackInput.trim());
      setTrackInput("");
    }
  };

  return (
    <div className="track-card">
      <h3>Track a Token</h3>
      <div className="control-group">
        <input
          type="text"
          placeholder="Enter token address"
          value={trackInput}
          onChange={(e) => setTrackInput(e.target.value)}
          className="track-input"
        />
        <button
          onClick={handleTrack}
          className="plus-button"
          title="Track Token"
        >
          Track
        </button>
      </div>
    </div>
  );
};

export default TrackToken;
