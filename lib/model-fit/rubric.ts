// The requirement rubric, transcribed from the integration package's
// 04_spec/capability_rubric.md (v1). THE STANDARD: a score states how much of
// one requirement the work involves. It is not a difficulty rating, not a
// judgement of the worker, and there is no total and no ranking of roles.
//
// Generated from the source document rather than retyped, so the anchors
// shown in the interface are the anchors the profiles were authored against.

export interface RubricEntry {
  /** Requirement name as the rubric titles it. */
  name: string;
  /** What the requirement measures, in one line. */
  measures: string;
  /** The five anchored bands: 10, 30, 50, 70, 90. */
  bands: Record<string, string>;
}

export const RUBRIC: Record<string, RubricEntry> = {
  "CAP-01": {
    "name": "General intelligence",
    "measures": "Breadth of unfamiliar problems the role must handle without a defined procedure.",
    "bands": {
      "10": "Work follows set procedures; novel situations escalate to someone else.",
      "30": "Occasional novel situations, resolved by analogy to known cases.",
      "50": "Regular novel problems within one familiar domain.",
      "70": "Frequent novel problems spanning several domains; no procedure exists.",
      "90": "Work is defined by problems nobody has framed before."
    }
  },
  "CAP-02": {
    "name": "Multi-step reasoning",
    "measures": "Length of dependent reasoning chains before a conclusion is reached.",
    "bands": {
      "10": "Single-step lookup or transaction.",
      "30": "Two or three linked steps with an obvious order.",
      "50": "Multi-stage analysis where an early error changes the answer.",
      "70": "Long chains with branching conditions and interacting constraints.",
      "90": "Reasoning where the structure of the problem must itself be worked out first."
    }
  },
  "CAP-03": {
    "name": "Domain reasoning",
    "measures": "Depth of specialist knowledge that cannot be looked up in the moment.",
    "bands": {
      "10": "General knowledge suffices.",
      "30": "Familiarity with common terms and processes of the field.",
      "50": "Working practitioner knowledge; recognises standard cases.",
      "70": "Expert knowledge; recognises exceptions and knows why rules exist.",
      "90": "Authority-level; makes calls where the field itself is unsettled."
    }
  },
  "CAP-04": {
    "name": "Coding capability",
    "measures": "Production, review or debugging of executable code or query languages.",
    "bands": {
      "10": "None.",
      "30": "Reads code or writes formulas and simple queries.",
      "50": "Writes and maintains scripts or SQL as a routine part of the work.",
      "70": "Builds and reviews production software or complex data pipelines.",
      "90": "Designs systems others build on; correctness is safety-critical."
    }
  },
  "CAP-05": {
    "name": "Agentic capability",
    "measures": "Extent to which work runs unsupervised over multiple actions and time.",
    "bands": {
      "10": "Every action is prompted and immediately checked.",
      "30": "Short sequences completed independently, reviewed at the end.",
      "50": "Owns a task end to end over hours or days with periodic check-ins.",
      "70": "Runs multi-stage processes independently, coordinating other parties.",
      "90": "Sets the objectives, sequences the work and is accountable for outcomes."
    }
  },
  "CAP-06": {
    "name": "Quantitative reasoning",
    "measures": "Numerical, statistical or financial manipulation intrinsic to the work.",
    "bands": {
      "10": "None beyond counting.",
      "30": "Arithmetic, percentages, reading a chart.",
      "50": "Structured calculation, modelling, variance and ratio analysis.",
      "70": "Statistical inference, forecasting, valuation, sensitivity work.",
      "90": "Method-level quantitative work where the technique itself is chosen and defended."
    }
  },
  "CAP-07": {
    "name": "Research and synthesis",
    "measures": "Locating, weighing and combining evidence from multiple sources.",
    "bands": {
      "10": "Information is provided; none is sought.",
      "30": "Looks things up in known internal sources.",
      "50": "Gathers from several sources and reconciles differences.",
      "70": "Systematic evidence review across contested or incomplete sources.",
      "90": "Establishes what is known in a field and where the gaps are."
    }
  },
  "CAP-08": {
    "name": "Writing and communication",
    "measures": "Demands on produced language: precision, audience, consequence of ambiguity.",
    "bands": {
      "10": "Short factual replies from templates.",
      "30": "Clear routine correspondence.",
      "50": "Structured documents for a defined internal audience.",
      "70": "Persuasive or binding documents for senior or external audiences.",
      "90": "Language whose exact wording carries legal, regulatory or market consequence."
    }
  },
  "CAP-09": {
    "name": "Context handling",
    "measures": "Volume and interdependence of material that must be held together at once.",
    "bands": {
      "10": "One short item at a time.",
      "30": "A handful of related items.",
      "50": "A substantial case file or dataset with cross-references.",
      "70": "Large bodies of material where a detail in one part changes another.",
      "90": "Sustained continuity across very large corpora over long periods."
    }
  },
  "CAP-10": {
    "name": "Instruction following",
    "measures": "Strictness with which stated constraints, formats and procedures must be honoured.",
    "bands": {
      "10": "Loose; approximation is acceptable.",
      "30": "General adherence expected; minor deviation tolerated.",
      "50": "Defined procedures followed; deviation must be justified.",
      "70": "Strict compliance; deviation is a reportable event.",
      "90": "Prescribed to the letter; deviation is a breach with external consequence."
    }
  },
  "CAP-11": {
    "name": "Accuracy and reliability",
    "measures": "Cost of an undetected error in the work product.",
    "bands": {
      "10": "Errors are trivial and self-correcting.",
      "30": "Errors cause rework, no external effect.",
      "50": "Errors reach colleagues or customers and require correction.",
      "70": "Errors cause financial loss, regulatory attention or reputational damage.",
      "90": "Errors risk safety, legal liability or systemic harm."
    }
  },
  "CAP-12": {
    "name": "Tool and structured-output reliability",
    "measures": "Dependence on operating systems, applications or producing machine-readable output.",
    "bands": {
      "10": "None; free-form work only.",
      "30": "Routine use of standard business applications.",
      "50": "Works across several specialist systems; produces structured records.",
      "70": "Orchestrates multiple systems where handoffs must not fail.",
      "90": "Machine-to-machine output where a malformed result breaks a downstream process."
    }
  },
  "CAP-13": {
    "name": "Latency suitability",
    "measures": "How much the value of the work depends on speed of response.",
    "bands": {
      "10": "Days or weeks are acceptable.",
      "30": "Same-day turnaround.",
      "50": "Within the hour; delays are noticed.",
      "70": "Minutes; the person or process is waiting.",
      "90": "Seconds; delay destroys the value or causes harm."
    }
  },
  "CAP-14": {
    "name": "Data sensitivity suitability",
    "measures": "Sensitivity of information handled and the controls that must apply to it.",
    "bands": {
      "10": "Public information only.",
      "30": "Internal business information.",
      "50": "Confidential commercial or limited personal data.",
      "70": "Special-category personal data, regulated financial or health records.",
      "90": "Data whose exposure causes serious harm, or subject to residency or clearance rules."
    }
  },
  "CAP-15": {
    "name": "Risk and assurance suitability",
    "measures": "Degree of oversight, auditability and challenge the work must withstand.",
    "bands": {
      "10": "No review.",
      "30": "Informal supervisory review.",
      "50": "Documented internal review or sign-off.",
      "70": "Formal audit trail; subject to internal audit or regulator inspection.",
      "90": "Externally assured; individual accountability with legal or licensing consequence."
    }
  },
  "CAP-16": {
    "name": "Visual interpretation",
    "measures": "Extent to which the work depends on reading images, scans, diagrams or document layout.",
    "bands": {
      "10": "None. Work is entirely text or numbers.",
      "30": "Occasional charts or screenshots, understood from surrounding context.",
      "50": "Routine reading of documents, forms or diagrams where layout carries meaning.",
      "70": "Interpretation is a core task: imaging, inspection, visual quality assessment.",
      "90": "Diagnostic-grade interpretation where a missed feature causes serious harm."
    }
  },
  "CAP-17": {
    "name": "Speech and audio",
    "measures": "Extent to which the work involves spoken input or output.",
    "bands": {
      "10": "None.",
      "30": "Occasional transcription of clear recorded speech.",
      "50": "Routine handling of recorded speech, including accents and background noise.",
      "70": "Live spoken interaction, or transcription where errors carry consequence.",
      "90": "Real-time speech in noisy, safety-critical or multi-speaker conditions."
    }
  },
  "CAP-18": {
    "name": "Cross-language",
    "measures": "Extent to which the work operates across languages.",
    "bands": {
      "10": "Single language.",
      "30": "Occasional comprehension of another language.",
      "50": "Routine working across two or more languages.",
      "70": "Translation where meaning must be preserved precisely for business use.",
      "90": "Translation with legal, clinical or regulatory force, including low-resource languages."
    }
  }
};
