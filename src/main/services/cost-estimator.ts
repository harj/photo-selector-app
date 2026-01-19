import type { Photo, CostEstimate } from '../../shared/types';

// Claude Sonnet pricing (approximate as of 2024)
const INPUT_COST_PER_MILLION = 3.0; // $3 per million input tokens
const OUTPUT_COST_PER_MILLION = 15.0; // $15 per million output tokens

// Approximate token counts for vision
const TOKENS_PER_THUMBNAIL = 1500; // ~400px image
const TOKENS_PER_PHOTO_PROMPT = 50; // Photo ID + separator
const TOKENS_PER_BATCH_PROMPT = 250; // System prompt
const OUTPUT_TOKENS_PER_PHOTO = 100; // Score + comment

const BATCH_SIZE = 10;

export class CostEstimator {
  estimate(photos: Photo[]): CostEstimate {
    const photoCount = photos.length;

    if (photoCount === 0) {
      return {
        photoCount: 0,
        batchCount: 0,
        estimatedInputTokens: 0,
        estimatedOutputTokens: 0,
        estimatedCost: 0,
        formattedCost: '$0.00',
      };
    }

    const batchCount = Math.ceil(photoCount / BATCH_SIZE);

    // Estimate input tokens
    const imageTokens = photoCount * TOKENS_PER_THUMBNAIL;
    const promptTokens = photoCount * TOKENS_PER_PHOTO_PROMPT + batchCount * TOKENS_PER_BATCH_PROMPT;
    const totalInputTokens = imageTokens + promptTokens;

    // Estimate output tokens
    const totalOutputTokens = photoCount * OUTPUT_TOKENS_PER_PHOTO;

    // Calculate costs
    const inputCost = (totalInputTokens / 1_000_000) * INPUT_COST_PER_MILLION;
    const outputCost = (totalOutputTokens / 1_000_000) * OUTPUT_COST_PER_MILLION;
    const totalCost = inputCost + outputCost;

    return {
      photoCount,
      batchCount,
      estimatedInputTokens: totalInputTokens,
      estimatedOutputTokens: totalOutputTokens,
      estimatedCost: totalCost,
      formattedCost: `$${totalCost.toFixed(2)}`,
    };
  }
}
