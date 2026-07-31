// Types for the /reputation-tracker/unified BoardRadar response, matching
// the recorded shape in fixtures/br/reputation-tracker_unified_MSFT.json.

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
      glassdoor?: {
        overallRating: number;
        reviewCount: number;
        recommendPercent: number;
        ceoApprovalPercent: number;
        businessOutlookPercent: number;
        categories: Record<string, number>;
      };
      indeed?: {
        overallRating: number;
        reviewCount: number;
        categories: Record<string, number>;
      };
    };
  };
  customerReviews?: {
    platforms: {
      platform: string;
      rating: number;
      ratingOutOf10: number;
      reviewCount: number;
    }[];
    likes: { category: string; total: number }[];
    dislikes: { category: string; total: number }[];
  };
  timestamp?: string;
}

