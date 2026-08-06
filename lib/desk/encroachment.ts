// Encroachment: a supplier building what the lab it powers sells.
//
// ORIGIN. Ported 6 August 2026 from The Security Desk
// (~/Documents/Dev Projects/the-desk, lib/map-data.ts, commit b9bb51c),
// read-only and unmodified at source. Editorial punctuation adapted to the
// house rule; the quoted spans are the sources' own.
//
// This is the structural risk sitting under a vendor relationship, and it is
// the one thing on the brief that is never "breaking". AWS hosts Anthropic's
// training and ships frontier models that compete with Claude. Microsoft
// invests in OpenAI and ships in-house models against it. Neither is a
// scandal and neither will ever appear as news, but both change who has
// leverage in a renewal, which is a thing a buyer can act on.
//
// Curated and cited: an entry exists only where a primary announcement on the
// stamped date supports it.

export const ENCROACHMENT_VERSION = "2026-07-14";

export interface Encroachment {
  /** Who is encroaching. */
  actor: string;
  /** Whose turf. */
  against: string;
  /** The pattern, in one line. */
  note: string;
  /** The receipt's own wording, trimmed. */
  fact: string;
  date: string;
  source: { name: string; url: string };
}

export const ENCROACHMENTS: Encroachment[] = [
  {
    actor: "AWS",
    against: "Anthropic",
    note: "hosts Anthropic's training, ships competing Nova frontier models",
    fact: "AWS expanded its Nova portfolio with four new frontier models at the same re:Invent that named Anthropic among Trainium customers.",
    date: "4 Dec 2025",
    source: {
      name: "About Amazon",
      url: "https://www.aboutamazon.com/news/aws/aws-re-invent-2025-ai-news-updates",
    },
  },
  {
    actor: "Microsoft",
    against: "OpenAI",
    note: "invests in and hosts OpenAI, ships in-house MAI models",
    fact: "“Microsoft has released three in-house models that directly challenge the partner it spent $13 billion cultivating” (MAI-Voice-1, MAI-Image-2, MAI-Transcribe-1).",
    date: "3 Apr 2026",
    source: {
      name: "The Next Web",
      url: "https://thenextweb.com/news/microsoft-mai-models-openai-independence",
    },
  },
  {
    actor: "OpenAI",
    against: "NVIDIA",
    note: "buys NVIDIA GPUs, co-designs its own inference silicon",
    fact: "OpenAI is co-designing a custom inference chip with Broadcom, 10GW of custom processors, offsetting its NVIDIA dependence.",
    date: "13 Oct 2025",
    source: {
      name: "Techstrong.ai",
      url: "https://techstrong.ai/articles/openai-teams-with-broadcom-to-develop-custom-ai-chips-in-10-billion-deal/",
    },
  },
  {
    actor: "Google",
    against: "Anthropic",
    note: "supplies up to 1M TPUs to Anthropic while Gemini competes with Claude",
    fact: "Google provides Anthropic up to one million TPUs even as Gemini competes head-on with Claude: the arms-dealer-to-a-rival pattern.",
    date: "23 Oct 2025",
    source: {
      name: "Anthropic newsroom",
      url: "https://www.anthropic.com/news/expanding-our-use-of-google-cloud-tpus-and-services",
    },
  },
];
