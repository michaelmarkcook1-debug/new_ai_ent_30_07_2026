// Types for the /reputation-tracker/unified BoardRadar response, matching
// the recorded shape in fixtures/br/reputation-tracker_unified_MSFT.json.
//
// The rating and review-count figures are nullable, which the recorded
// fixtures do not show: every one of them carries a number. Live responses do
// not, and a platform the endpoint holds no count for arrives as null. That is
// the difference that took the page down, so the types now say it.

export interface UnifiedCompetitorMetrics {
  social?: {
    volumeRank?: number;
    sentimentScore?: number;
    dominantTopic?: string;
    trendDirection?: string;
  };
  product?: {
    reliabilityScore?: number;
    featureInnovation?: number;
    devFeedbackApi?: number;
  };
  pricing?: {
    pricingComplaints?: number;
    licensingFriction?: number;
    valueForMoneyRank?: number;
  };
  developer?: {
    gitHubEngagementRank?: string;
    sdkApiFeedbackSentiment?: number;
    documentationQualityScore?: number;
  };
  support?: {
    supportQuality?: number;
    responseTime?: number;
    issueResolution?: number;
  };
}

/** One customer-review platform's reading, on that platform's own scale. */
export interface UnifiedReviewPlatform {
  platform: string;
  rating: number | null;
  ratingOutOf10: number | null;
  reviewCount: number | null;
}

/** One employee-review platform's reading for the company. */
export interface UnifiedEmployerReviews {
  overallRating: number | null;
  reviewCount: number | null;
  recommendPercent?: number | null;
  ceoApprovalPercent?: number | null;
  businessOutlookPercent?: number | null;
  categories: Record<string, number | null>;
}

export interface UnifiedReputation {
  success: boolean;
  ticker: string;
  companyName: string;
  displayName: string;
  website?: string;
  isPrivate: boolean;
  overview?: {
    description: string;
    lastUpdated: string;
  };
  competitiveSentiment?: {
    companies: {
      ticker: string;
      name: string;
      displayName: string;
      website?: string;
      domain?: string;
      type: string;
    }[];
    metrics: Record<string, UnifiedCompetitorMetrics>;
  };
  comparisonTables?: {
    category: string;
    rows: { metric: string; values: Record<string, number> }[];
  }[];
  employeeReviews?: {
    company: {
      ticker: string;
      name: string;
      glassdoor?: UnifiedEmployerReviews;
      indeed?: UnifiedEmployerReviews;
    };
  };
  customerReviews?: {
    platforms: UnifiedReviewPlatform[];
    likes: { category: string; total: number }[];
    dislikes: { category: string; total: number }[];
  };
  timestamp?: string;
}

