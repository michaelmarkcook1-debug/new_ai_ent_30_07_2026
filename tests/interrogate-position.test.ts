import { describe, it, expect } from "vitest";
import { nextQuestion, type InterrogateState } from "@/app/api/interrogate/lib";

// What a saved position changes about the interrogation.
//
// The whole promise of carrying Your AI Position into the Decision Desk is that
// the reader is not asked things the product already knows. If that fails, the
// feature is a prefilled text box and nothing more, so this pins the one place
// the behaviour actually diverges.
//
// This covers the scripted path, which is what runs with no API key and
// therefore what a demo without one shows. live.ts folds the same fact into the
// prompt it sends the question model.

const state = (over: Partial<InterrogateState> = {}): InterrogateState => ({
  situation: "We are Ocado. Should we buy Copilot or go direct to a frontier API?",
  answers: [],
  depth: "quick",
  asked: [],
  position: null,
  ...over,
});

describe("a saved position answers questions the engine would otherwise ask", () => {
  it("asks for the industry when nothing establishes it", () => {
    const q = nextQuestion(state());
    expect(q).toContain("Which industry and regulatory context");
  });

  it("skips that question when the saved research states the sector", () => {
    const q = nextQuestion(
      state({
        position: {
          name: "Ocado",
          industry: "Online grocery",
          what: "an online grocer",
        sectorTag: null,
          aiFindings: [],
          findings: [],
        },
      })
    );
    expect(q).not.toContain("Which industry");
    expect(q).toContain("what scale");
  });

  it("still asks when the position carries no sector", () => {
    // An empty industry is not an answer, and treating it as one would skip a
    // question whose answer nothing supplied.
    const q = nextQuestion(
      state({
        position: {
          name: "Ocado",
          industry: "",
          what: "an online grocer",
        sectorTag: null,
          aiFindings: [],
          findings: [],
        },
      })
    );
    expect(q).toContain("Which industry");
  });

  it("behaves exactly as before when no position is attached", () => {
    // The overwhelmingly common case. Nothing about the engine may change for
    // a reader who never used Your AI Position.
    const withIndustry = state({
      situation: "We are a European bank exploring agentic AI for onboarding.",
    });
    expect(nextQuestion(withIndustry)).toContain("what scale");
    expect(nextQuestion(state({ answers: ["a", "b"] }))).toBeNull();
  });
});
