import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'node:https';
import { URL } from 'node:url';
import {
  DetectedGap,
  GapCourseMatch,
  GeneratedLearningPath,
} from './recommendation-rag.types';

interface LlmResult {
  provider: 'gemini' | 'groq' | 'fallback';
  model: string;
  learningPath: GeneratedLearningPath;
}

@Injectable()
export class LlmClientService {
  private readonly logger = new Logger(LlmClientService.name);
  private readonly embeddingProvider: 'huggingface' | 'gemini';
  private readonly huggingFaceApiKey: string;
  private readonly huggingFaceEmbeddingModel: string;
  private readonly huggingFaceBaseUrl: string;
  private readonly geminiApiKey: string;
  private readonly groqApiKey: string;
  private readonly geminiModel: string;
  private readonly groqModel: string;
  private readonly embeddingModel: string;

  constructor(private readonly configService: ConfigService) {
    this.embeddingProvider =
      (this.configService.get<string>('EMBEDDING_PROVIDER') as
        | 'huggingface'
        | 'gemini'
        | undefined) || 'huggingface';
    this.huggingFaceApiKey =
      this.configService.get<string>('HF_TOKEN') ||
      this.configService.get<string>('HUGGINGFACE_API_KEY') ||
      '';
    this.huggingFaceEmbeddingModel =
      this.configService.get<string>('HF_EMBEDDING_MODEL') ||
      this.configService.get<string>('HUGGINGFACE_EMBEDDING_MODEL') ||
      'sentence-transformers/all-MiniLM-L6-v2';
    this.huggingFaceBaseUrl =
      this.configService.get<string>('HUGGINGFACE_INFERENCE_BASE_URL') ||
      'https://router.huggingface.co/hf-inference/models';
    this.geminiApiKey =
      this.configService.get<string>('GEMINI_API_KEY') ||
      this.configService.get<string>('GOOGLE_API_KEY') ||
      '';
    this.groqApiKey = this.configService.get<string>('GROQ_API_KEY') || '';
    this.geminiModel =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-2.5-flash';
    this.groqModel =
      this.configService.get<string>('GROQ_MODEL') || 'llama-3.3-70b-versatile';
    this.embeddingModel =
      this.configService.get<string>('GOOGLE_EMBEDDING_MODEL') ||
      'gemini-embedding-001';
  }

  async embedText(
    text: string,
    taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY' = 'RETRIEVAL_DOCUMENT',
  ): Promise<number[]> {
    const results = await this.embedTexts([text], taskType);
    return results[0] || [];
  }

  async embedTexts(
    texts: string[],
    taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY' = 'RETRIEVAL_DOCUMENT',
  ): Promise<number[][]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    if (this.embeddingProvider === 'huggingface') {
      try {
        return await this.embedWithHuggingFace(texts);
      } catch (error) {
        this.logger.warn(
          `Hugging Face embedding failed, falling back to Gemini: ${error instanceof Error ? error.message : error}`,
        );
      }
    }

    return Promise.all(texts.map((text) => this.embedWithGemini(text, taskType)));
  }

  private async embedWithGemini(
    text: string,
    taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY',
  ): Promise<number[]> {
    if (!this.geminiApiKey) {
      throw new InternalServerErrorException(
        'Gemini API key is required to generate embeddings',
      );
    }

    const response = await this.requestJson<{
      embedding?: { values?: number[] };
    }>(
      'POST',
      `https://generativelanguage.googleapis.com/v1beta/models/${this.embeddingModel}:embedContent`,
      {
        model: `models/${this.embeddingModel}`,
        content: {
          parts: [{ text }],
        },
        task_type: taskType,
      },
      {
        'x-goog-api-key': this.geminiApiKey,
      },
    );

    const values = response.embedding?.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw new InternalServerErrorException('Embedding API returned no vector');
    }

    return values;
  }

  private async embedWithHuggingFace(texts: string[]): Promise<number[][]> {
    const headers: Record<string, string> = {};
    if (this.huggingFaceApiKey) {
      headers.Authorization = `Bearer ${this.huggingFaceApiKey}`;
    }

    const response = await this.requestJson<number[][] | number[]>(
      'POST',
      `${this.huggingFaceBaseUrl}/${this.huggingFaceEmbeddingModel}/pipeline/feature-extraction`,
      {
        inputs: texts,
        normalize: true,
      },
      headers,
    );

    if (!Array.isArray(response)) {
      throw new InternalServerErrorException(
        'Hugging Face embedding API returned an unexpected response',
      );
    }

    if (typeof response[0] === 'number') {
      return [response as number[]];
    }

    return response as number[][];
  }

  async generateLearningPath(params: {
    developerLabel: string;
    repoName: string;
    dominantLanguage: string | null;
    commitTopics: string[];
    strengths: string[];
    detectedGaps: DetectedGap[];
    matches: GapCourseMatch[];
  }): Promise<LlmResult> {
    const prompt = this.buildPrompt(params);

    try {
      const learningPath = await this.generateWithGemini(prompt);
      return {
        provider: 'gemini',
        model: this.geminiModel,
        learningPath,
      };
    } catch (error) {
      this.logger.warn(
        `Gemini generation failed, falling back to Groq: ${error instanceof Error ? error.message : error}`,
      );
    }

    try {
      const learningPath = await this.generateWithGroq(prompt);
      return {
        provider: 'groq',
        model: this.groqModel,
        learningPath,
      };
    } catch (error) {
      this.logger.error(
        `Groq fallback failed, using deterministic fallback: ${error instanceof Error ? error.message : error}`,
      );
    }

    return {
      provider: 'fallback',
      model: 'deterministic-template',
      learningPath: this.buildFallbackLearningPath(params.detectedGaps, params.matches),
    };
  }

  private buildPrompt(params: {
    developerLabel: string;
    repoName: string;
    dominantLanguage: string | null;
    commitTopics: string[];
    strengths: string[];
    detectedGaps: DetectedGap[];
    matches: GapCourseMatch[];
  }) {
    const gapSection = params.detectedGaps
      .map(
        (gap, index) =>
          `${index + 1}. ${gap.label} | severity=${gap.severity} | score=${gap.score.toFixed(
            2,
          )} | evidence=${gap.evidence.join('; ') || 'none'}`,
      )
      .join('\n');

    const courseSection = params.matches
      .map((match) => {
        const renderedCourses = match.courses
          .map(
            (course) =>
              `- course_id=${course.courseId}; title=${course.title}; skills=${course.skills.join(', ') || 'n/a'}; partner=${course.partner || 'n/a'}; type=${course.type || 'n/a'}; rating=${course.rating ?? 'n/a'}; description=${course.description || 'n/a'}`,
          )
          .join('\n');

        return `Gap: ${match.gap.label}\n${renderedCourses}`;
      })
      .join('\n\n');

    return `You are an experienced engineering peer creating a practical learning path for another developer.

Project repository: ${params.repoName}
Developer label: ${params.developerLabel}
Dominant language: ${params.dominantLanguage || 'unknown'}
Recent commit topics: ${params.commitTopics.join(', ') || 'none'}
Observed strengths: ${params.strengths.join(', ') || 'none'}

Detected technical gaps:
${gapSection}

Retrieved Coursera course options:
${courseSection}

Instructions:
- Return valid JSON only.
- Tone must be technical, direct, and peer-to-peer. Avoid HR language.
- Produce exactly 3 steps.
- Each step should combine one or more detected gaps with one or two retrieved courses.
- Use course IDs from the retrieved list only.
- Keep each practice task concrete and tied to production coding habits.
- Optimize for the developer's current weaknesses, not a generic curriculum.

JSON schema:
{
  "title": "string",
  "summary": "string",
  "tone": "peer-to-peer technical",
  "estimated_total_hours": 12,
  "steps": [
    {
      "order": 1,
      "title": "string",
      "goal": "string",
      "why_it_matters": "string",
      "practice_task": "string",
      "success_signal": "string",
      "estimated_hours": 4,
      "gap_keys": ["string"],
      "recommended_course_ids": ["string"]
    }
  ]
}`;
  }

  private async generateWithGemini(prompt: string): Promise<GeneratedLearningPath> {
    if (!this.geminiApiKey) {
      throw new Error('Gemini API key is missing');
    }

    const response = await this.requestJson<{
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    }>(
      'POST',
      `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: 'application/json',
        },
      },
    );

    const text =
      response.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('') || '';

    return this.normalizeLearningPath(this.parseJsonText(text));
  }

  private async generateWithGroq(prompt: string): Promise<GeneratedLearningPath> {
    if (!this.groqApiKey) {
      throw new Error('Groq API key is missing');
    }

    const response = await this.requestJson<{
      choices?: Array<{
        message?: { content?: string };
      }>;
    }>(
      'POST',
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: this.groqModel,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You produce valid JSON only and write concise, technical, peer-to-peer learning plans.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      },
      {
        Authorization: `Bearer ${this.groqApiKey}`,
      },
    );

    const text = response.choices?.[0]?.message?.content || '';
    return this.normalizeLearningPath(this.parseJsonText(text));
  }

  private buildFallbackLearningPath(
    gaps: DetectedGap[],
    matches: GapCourseMatch[],
  ): GeneratedLearningPath {
    const primaryGaps = gaps.slice(0, 3);

    return {
      title: 'Practical recovery plan for your recent code gaps',
      summary:
        'This path focuses on the highest-signal weaknesses from the latest analysis and ties each step to one concrete learning resource and one production habit.',
      tone: 'peer-to-peer technical',
      estimated_total_hours: primaryGaps.length * 4,
      steps: primaryGaps.map((gap, index) => {
        const match = matches.find((item) => item.gap.key === gap.key);
        return {
          order: index + 1,
          title: `Close the gap on ${gap.label}`,
          goal: `Reduce repeat mistakes around ${gap.label.toLowerCase()} in the next analysis cycle.`,
          why_it_matters:
            gap.evidence[0] ||
            `This gap is showing up as a meaningful weakness in recent commits.`,
          practice_task: `Apply one focused refactor or implementation pass in ${gap.label.toLowerCase()} and document the before/after tradeoff in your next PR.`,
          success_signal: `The next analysis should show fewer findings tied to ${gap.label.toLowerCase()}.`,
          estimated_hours: 4,
          gap_keys: [gap.key],
          recommended_course_ids: (match?.courses || []).slice(0, 2).map((course) => course.courseId),
        };
      }),
    };
  }

  private normalizeLearningPath(raw: any): GeneratedLearningPath {
    const steps = Array.isArray(raw?.steps) ? raw.steps : [];
    if (steps.length === 0) {
      throw new Error('LLM response did not include steps');
    }

    return {
      title: String(raw?.title || 'Generated learning path'),
      summary: String(raw?.summary || ''),
      tone: String(raw?.tone || 'peer-to-peer technical'),
      estimated_total_hours: Number(raw?.estimated_total_hours || 12),
      steps: steps.slice(0, 3).map((step: any, index: number) => ({
        order: Number(step?.order || index + 1),
        title: String(step?.title || `Step ${index + 1}`),
        goal: String(step?.goal || ''),
        why_it_matters: String(step?.why_it_matters || ''),
        practice_task: String(step?.practice_task || ''),
        success_signal: String(step?.success_signal || ''),
        estimated_hours: Number(step?.estimated_hours || 4),
        gap_keys: Array.isArray(step?.gap_keys)
          ? step.gap_keys.map((item: unknown) => String(item))
          : [],
        recommended_course_ids: Array.isArray(step?.recommended_course_ids)
          ? step.recommended_course_ids.map((item: unknown) => String(item))
          : [],
      })),
    };
  }

  private parseJsonText(text: string) {
    const trimmed = String(text || '').trim();
    const withoutFence = trimmed
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '');

    return JSON.parse(withoutFence);
  }

  private requestJson<T>(
    method: string,
    url: string,
    body: Record<string, any>,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const target = new URL(url);

      const req = https.request(
        {
          method,
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port || 443,
          path: `${target.pathname}${target.search}`,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            ...extraHeaders,
          },
        },
        (res) => {
          let raw = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            raw += chunk;
          });
          res.on('end', () => {
            if (!res.statusCode || res.statusCode >= 400) {
              reject(
                new Error(
                  `HTTP ${res.statusCode || 500}: ${raw.slice(0, 500)}`,
                ),
              );
              return;
            }

            try {
              resolve((raw ? JSON.parse(raw) : {}) as T);
            } catch (error) {
              reject(error);
            }
          });
        },
      );

      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
}
