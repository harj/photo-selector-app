import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import { getDatabase } from '../database';
import type { Project, Photo } from '../../shared/types';

const BATCH_SIZE = 20;
const MODEL = 'claude-sonnet-4-20250514';

interface GroupResult {
  photo_ids: number[];
  reason: string;
}

export class SimilarityGroupingService {
  private client: Anthropic;
  private project: Project;
  private nextGroupId: number;

  constructor(apiKey: string, project: Project) {
    this.client = new Anthropic({ apiKey });
    this.project = project;
    this.nextGroupId = 1;
  }

  async groupPhotos(): Promise<number> {
    const db = getDatabase();

    // Clear existing groups
    db.prepare('UPDATE photos SET similarity_group_id = NULL WHERE project_id = ?')
      .run(this.project.id);

    const photos = db.prepare(
      'SELECT * FROM photos WHERE project_id = ? ORDER BY id'
    ).all(this.project.id) as Photo[];

    if (photos.length < 2) {
      return 0;
    }

    console.log(`[SimilarityGrouping] Starting grouping of ${photos.length} photos`);

    // Process in batches
    for (let i = 0; i < photos.length; i += BATCH_SIZE) {
      const batch = photos.slice(i, i + BATCH_SIZE);

      if (batch.length < 2) {
        continue;
      }

      try {
        await this.processBatch(batch);
      } catch (error) {
        console.error('Batch grouping failed:', error);
        // Continue with next batch
      }
    }

    // Count unique groups created
    const result = db.prepare(`
      SELECT COUNT(DISTINCT similarity_group_id) as count
      FROM photos
      WHERE project_id = ? AND similarity_group_id IS NOT NULL
    `).get(this.project.id) as { count: number };

    console.log(`[SimilarityGrouping] Created ${result.count} groups`);
    return result.count;
  }

  private async processBatch(photos: Photo[], retryCount = 0): Promise<void> {
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

    // Add grouping prompt
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

      // Parse and assign groups
      const textContent = response.content[0];
      if (textContent.type === 'text') {
        const parsed = this.parseResponse(textContent.text);
        this.assignGroups(photos, parsed.groups, db);
      }
    } catch (error: any) {
      if (error.status === 429 && retryCount < 3) {
        // Rate limited - wait and retry
        const waitTime = (retryCount + 1) * 5000;
        console.log(`Rate limited, waiting ${waitTime}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return this.processBatch(photos, retryCount + 1);
      }
      throw error;
    }
  }

  private buildPrompt(): string {
    return `Analyze these photos and identify which ones are VISUALLY SIMILAR.

Photos are "similar" if they show:
- The same scene from slightly different angles
- Burst shots (rapid sequence of the same moment)
- Near-duplicates with minor differences
- The same subject/person in very similar poses

Photos are NOT similar just because they have the same general theme (e.g., all beach photos).
Only group photos that are clearly variations of the same shot.

For each group of similar photos, list them together.
Photos that are unique should NOT be included in any group.

Respond ONLY with valid JSON (no markdown code blocks):
{"groups": [{"photo_ids": [1, 5, 12], "reason": "Same sunset from slightly different angles"}, {"photo_ids": [7, 8], "reason": "Burst shots of jumping"}]}

If no photos are similar, respond with: {"groups": []}`;
  }

  private parseResponse(text: string): { groups: GroupResult[] } {
    // Handle markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text.trim();

    try {
      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Failed to parse grouping response:', text);
      return { groups: [] };
    }
  }

  private assignGroups(photos: Photo[], groups: GroupResult[], db: ReturnType<typeof getDatabase>): void {
    for (const group of groups) {
      const photoIds = group.photo_ids || [];

      if (photoIds.length < 2) {
        continue;
      }

      // Find photos in this batch that match the IDs
      const groupPhotos = photos.filter((p) => photoIds.includes(p.id));

      if (groupPhotos.length < 2) {
        continue;
      }

      // Assign same group ID to all photos in the group
      const groupId = this.nextGroupId++;

      for (const photo of groupPhotos) {
        db.prepare('UPDATE photos SET similarity_group_id = ? WHERE id = ?')
          .run(groupId, photo.id);
      }

      console.log(`[SimilarityGrouping] Created group ${groupId}: ${photoIds.join(', ')} - ${group.reason}`);
    }
  }
}
