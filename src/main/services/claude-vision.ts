import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import { getDatabase } from '../database';
import type { Project, Photo, AnalysisProgress } from '../../shared/types';

const BATCH_SIZE = 10;
const MODEL = 'claude-sonnet-4-20250514';

type ProgressCallback = (progress: AnalysisProgress) => void;

interface Evaluation {
  photo_id: number;
  score: number;
  comment: string;
}

export class ClaudeVisionService {
  private client: Anthropic;
  private project: Project;

  constructor(apiKey: string, project: Project) {
    this.client = new Anthropic({ apiKey });
    this.project = project;
  }

  static async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const client = new Anthropic({ apiKey });
      // Make a minimal API call to validate
      await client.messages.create({
        model: MODEL,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return true;
    } catch (error: any) {
      console.error('API key validation failed:', error.message);
      return false;
    }
  }

  async analyzePhotos(onProgress: ProgressCallback): Promise<number> {
    const db = getDatabase();
    const photos = db.prepare(
      'SELECT * FROM photos WHERE project_id = ? AND score IS NULL ORDER BY id'
    ).all(this.project.id) as Photo[];

    const total = photos.length;
    let processed = 0;

    if (total === 0) {
      return 0;
    }

    // Process in batches
    for (let i = 0; i < photos.length; i += BATCH_SIZE) {
      const batch = photos.slice(i, i + BATCH_SIZE);

      onProgress({
        current: processed,
        total,
        message: `Analyzing batch ${Math.floor(i / BATCH_SIZE) + 1}...`,
      });

      try {
        await this.analyzeBatch(batch);
        processed += batch.length;
      } catch (error: any) {
        console.error('Batch analysis failed:', error);
        // Continue with next batch on error
        onProgress({
          current: processed,
          total,
          message: `Error in batch, continuing... (${error.message})`,
        });
      }
    }

    onProgress({
      current: processed,
      total,
      message: 'Analysis complete!',
    });

    return processed;
  }

  private async analyzeBatch(photos: Photo[], retryCount = 0): Promise<void> {
    const db = getDatabase();

    type ContentBlockParam = Anthropic.Messages.ContentBlockParam;
    const content: ContentBlockParam[] = [];

    // Build content with images and IDs
    for (const photo of photos) {
      try {
        const imageBuffer = await fs.readFile(photo.thumbnail_path);
        const base64 = imageBuffer.toString('base64');

        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: base64,
          },
        });

        content.push({
          type: 'text',
          text: `[Photo ID: ${photo.id}]`,
        });
      } catch (error) {
        console.error(`Error reading thumbnail for photo ${photo.id}:`, error);
      }
    }

    if (content.length === 0) {
      return;
    }

    // Add evaluation prompt
    content.push({
      type: 'text',
      text: this.buildPrompt(),
    });

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content }],
      });

      // Parse and save results
      const textContent = response.content[0];
      if (textContent.type === 'text') {
        const parsed = this.parseResponse(textContent.text);

        for (const evaluation of parsed.evaluations) {
          const photo = photos.find((p) => p.id === evaluation.photo_id);
          if (photo) {
            const score = Math.round(evaluation.score * 10) / 10; // Round to 1 decimal
            db.prepare(`
              UPDATE photos SET score = ?, ai_comment = ?, updated_at = datetime('now')
              WHERE id = ?
            `).run(score, evaluation.comment, evaluation.photo_id);
          }
        }
      }
    } catch (error: any) {
      if (error.status === 429 && retryCount < 3) {
        // Rate limited - wait and retry
        const waitTime = (retryCount + 1) * 5000;
        console.log(`Rate limited, waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return this.analyzeBatch(photos, retryCount + 1);
      }
      throw error;
    }
  }

  private buildPrompt(): string {
    let prompt = `You are a professional photo evaluator. Analyze each photo above and provide:
1. A score from 0.0 to 10.0 (one decimal place)
2. A brief comment (1-2 sentences) explaining the score

Consider: composition, lighting, focus, subject interest, emotional impact, and technical quality.`;

    if (this.project.prompt) {
      prompt += `\n\nAdditional evaluation criteria from the user:\n${this.project.prompt}`;
    }

    prompt += `\n\nRespond ONLY with valid JSON (no markdown code blocks):
{"evaluations": [{"photo_id": 123, "score": 8.5, "comment": "Brief explanation."}]}`;

    return prompt;
  }

  private parseResponse(text: string): { evaluations: Evaluation[] } {
    // Handle markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text.trim();

    try {
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Failed to parse response:', text);
      return { evaluations: [] };
    }
  }
}
