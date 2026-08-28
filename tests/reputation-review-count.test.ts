import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PlatformRow,
  ReviewCount,
} from "@/app/(ai-ent)/reputation-tracker/components/live-unified";
import type { UnifiedReviewPlatform } from "@/app/(ai-ent)/reputation-tracker/types";

// The null that took the page down.
//
// Every recorded fixture carries a number in reviewCount, so the types said
// `number` and the component called toLocaleString straight on it. The live
// endpoint returns null for a platform it holds no count for, that threw
// during hydration, and the whole Reputation Tracker rendered as
// "Application error: a client-side exception has occurred" - not merely the
// one row, and not merely the one card.
//
// So these render the real row over the real shape and read the markup. The
// second half of the fix is the one worth pinning: the absence is named, not
// filled with a zero. "0 reviews" beside a 4.3 rating is a figure the endpoint
// never published, which is the failure mode this codebase exists to avoid.
//
// Written with createElement rather than JSX because vitest.config.mts
// includes tests/**/*.test.ts only.

const render = (el: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(el)
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&");

const platform = (
  over: Partial<UnifiedReviewPlatform> = {}
): UnifiedReviewPlatform => ({
  platform: "TrustRadius",
  rating: 4.3,
  ratingOutOf10: 8.6,
  reviewCount: 260,
  ...over,
});

const row = (over: Partial<UnifiedReviewPlatform> = {}) =>
  render(createElement(PlatformRow, { platform: platform(over) }));

describe("a customer-review platform with no review count", () => {
  it("renders at all", () => {
    expect(() => row({ reviewCount: null })).not.toThrow();
  });

  it("names the absence rather than counting zero", () => {
    const html = row({ reviewCount: null });
    expect(html).toContain("no review count");
    expect(html).not.toContain("0 reviews");
  });

  it("still shows the platform and the rating it does have", () => {
    const html = row({ reviewCount: null });
    expect(html).toContain("TrustRadius");
    expect(html).toContain("4.3");
    expect(html).toContain("/ 5");
  });

  it("names both absences when the rating is missing too", () => {
    const html = row({ reviewCount: null, rating: null });
    expect(html).toContain("no review count");
    expect(html).toContain("no data");
    expect(html).not.toContain("0 reviews");
    expect(html).not.toContain("/ 5");
  });
});

describe("a customer-review platform with a review count", () => {
  it("formats it on the en-GB scale", () => {
    expect(row({ reviewCount: 5833 })).toContain("5,833 reviews");
  });

  it("shows the rating out of five", () => {
    const html = row({ rating: 4.6 });
    expect(html).toContain("4.6");
    expect(html).toContain("/ 5");
  });
});

describe("the review count on its own", () => {
  // Glassdoor and Indeed read the same nullable payload through this same
  // component, so the two employee-review call sites are covered here.
  it("names an absent count", () => {
    const html = render(createElement(ReviewCount, { count: null }));
    expect(html).toContain("no review count");
    expect(html).not.toContain("0");
  });

  it("names an undefined count the same way", () => {
    const html = render(createElement(ReviewCount, { count: undefined }));
    expect(html).toContain("no review count");
  });

  // A zero the endpoint actually published is a reading, not an absence. The
  // recorded AMZN response carries reviewCount 0 on all three platforms, and
  // reporting that as "no review count" would be the same fabrication in the
  // opposite direction.
  it("passes a published zero through", () => {
    const html = render(createElement(ReviewCount, { count: 0 }));
    expect(html).toContain("0 reviews");
    expect(html).not.toContain("no review count");
  });

  it("groups a large count", () => {
    expect(render(createElement(ReviewCount, { count: 22500 }))).toContain(
      "22,500 reviews"
    );
  });
});
