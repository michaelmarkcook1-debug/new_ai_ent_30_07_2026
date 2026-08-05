"use client";

import { useState } from "react";
import { PeerAdoptionExplorer } from "./peer-explorer";
import { IndustryWorkflowsPanel } from "./industry-workflows-panel";

// Holds the industry choice so one selector drives both panels.
//
// The explorer keeps ownership of the selection and reports it upward rather
// than being made fully controlled: its live-fetch effect belongs beside the
// chart it fills, and lifting the state would have dragged the fetch with it.
// This component only mirrors the choice into the panel below.

export function PeerInsightsView() {
  const [segment, setSegment] = useState("");
  return (
    <>
      <PeerAdoptionExplorer onSegmentChange={setSegment} />
      <IndustryWorkflowsPanel segment={segment} />
    </>
  );
}
