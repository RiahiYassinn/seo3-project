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

export interface QuizQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  gapKey: string;
  skill?: string;
}

export interface QuizResult {
  provider: 'gemini' | 'groq' | 'fallback';
  model: string;
  questions: QuizQuestion[];
}

export interface QuizSourceGap {
  key: string;
  label: string;
  severity: string;
  evidence?: string[];
}

export interface QuizSourceStep {
  title?: string;
  goal?: string;
  whyItMatters?: string;
  practiceTask?: string;
  successSignal?: string;
  gapKeys?: string[];
  skill?: string;
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

  /**
   * Builds a validation quiz from the developer's own gaps and the steps that
   * were recommended to them. Same provider chain as the learning path, with a
   * deterministic fallback so the feature still works without API keys.
   */
  async generateQuiz(params: {
    developerLabel: string;
    repoName: string;
    dominantLanguage: string | null;
    detectedGaps: QuizSourceGap[];
    steps: QuizSourceStep[];
    questionCount: number;
  }): Promise<QuizResult> {
    const prompt = this.buildQuizPrompt(params);

    try {
      const questions = await this.generateQuizWithGemini(prompt);
      if (questions.length) {
        return { provider: 'gemini', model: this.geminiModel, questions };
      }
      throw new Error('Gemini returned no usable questions');
    } catch (error) {
      this.logger.warn(
        `Gemini quiz generation failed, falling back to Groq: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }

    try {
      const questions = await this.generateQuizWithGroq(prompt);
      if (questions.length) {
        return { provider: 'groq', model: this.groqModel, questions };
      }
      throw new Error('Groq returned no usable questions');
    } catch (error) {
      this.logger.error(
        `Groq quiz fallback failed, using deterministic quiz: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }

    return {
      provider: 'fallback',
      model: 'deterministic-template',
      questions: this.buildFallbackQuiz(params),
    };
  }

  private buildQuizPrompt(params: {
    developerLabel: string;
    repoName: string;
    dominantLanguage: string | null;
    detectedGaps: QuizSourceGap[];
    steps: QuizSourceStep[];
    questionCount: number;
  }) {
    const gapSection = params.detectedGaps
      .map(
        (gap, index) =>
          `${index + 1}. key=${gap.key} | ${gap.label} | severity=${gap.severity} | evidence=${
            (gap.evidence || []).join('; ') || 'none'
          }`,
      )
      .join('\n');

    const stepSection = params.steps
      .map(
        (step, index) =>
          `${index + 1}. ${step.title} | goal=${step.goal || 'n/a'} | why=${
            step.whyItMatters || 'n/a'
          } | practice=${step.practiceTask || 'n/a'} | success=${
            step.successSignal || 'n/a'
          } | gap_keys=${(step.gapKeys || []).join(',') || 'n/a'}`,
      )
      .join('\n');

    return `You are an engineering peer writing a short knowledge check for another developer.

Repository: ${params.repoName}
Developer label: ${params.developerLabel}
Dominant language: ${params.dominantLanguage || 'unknown'}

Their detected gaps:
${gapSection || 'none recorded'}

The learning steps they were given:
${stepSection || 'none recorded'}

Instructions:
- Return valid JSON only.
- Produce exactly ${params.questionCount} multiple-choice questions.
- Every question must test a concept from the gaps or steps above — never generic trivia.
- Prefer questions about applying the concept in ${params.dominantLanguage || 'their language'} code over definitions.
- Exactly 4 options per question, exactly one correct.
- Distractors must be plausible to someone who half-learned the material.
- correct_index is zero-based.
- explanation is one or two sentences saying why the answer is right.
- gap_key must be one of the gap keys above when the question maps to one, otherwise "general".

JSON schema:
{
  "questions": [
    {
      "prompt": "string",
      "options": ["string", "string", "string", "string"],
      "correct_index": 0,
      "explanation": "string",
      "gap_key": "string",
      "skill": "string"
    }
  ]
}`;
  }

  private async generateQuizWithGemini(prompt: string): Promise<QuizQuestion[]> {
    if (!this.geminiApiKey) {
      throw new Error('Gemini API key is missing');
    }

    const response = await this.requestJson<{
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    }>(
      'POST',
      `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`,
      {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: 'application/json',
        },
      },
    );

    const text =
      response.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('') || '';

    return this.normalizeQuizQuestions(this.parseJsonText(text));
  }

  private async generateQuizWithGroq(prompt: string): Promise<QuizQuestion[]> {
    if (!this.groqApiKey) {
      throw new Error('Groq API key is missing');
    }

    const response = await this.requestJson<{
      choices?: Array<{ message?: { content?: string } }>;
    }>(
      'POST',
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: this.groqModel,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You produce valid JSON only and write precise technical multiple-choice questions.',
          },
          { role: 'user', content: prompt },
        ],
      },
      { Authorization: `Bearer ${this.groqApiKey}` },
    );

    const text = response.choices?.[0]?.message?.content || '';
    return this.normalizeQuizQuestions(this.parseJsonText(text));
  }

  /** Drops anything malformed rather than trusting the model's shape. */
  private normalizeQuizQuestions(parsed: any): QuizQuestion[] {
    const rawQuestions = Array.isArray(parsed?.questions)
      ? parsed.questions
      : Array.isArray(parsed)
        ? parsed
        : [];

    const questions: QuizQuestion[] = [];

    for (const raw of rawQuestions) {
      const prompt = String(raw?.prompt || '').trim();
      const options = Array.isArray(raw?.options)
        ? raw.options.map((option: any) => String(option || '').trim()).filter(Boolean)
        : [];
      const correctIndex = Number(raw?.correct_index ?? raw?.correctIndex);

      if (
        !prompt ||
        options.length < 2 ||
        !Number.isInteger(correctIndex) ||
        correctIndex < 0 ||
        correctIndex >= options.length
      ) {
        continue;
      }

      questions.push({
        prompt,
        options,
        correctIndex,
        explanation: String(raw?.explanation || '').trim(),
        gapKey: String(raw?.gap_key || raw?.gapKey || 'general').trim() || 'general',
        skill: String(raw?.skill || '').trim() || undefined,
      });
    }

    return questions;
  }

  /**
   * Comprehension check built from the plan itself: match each step to the
   * outcome it targets, with the other steps' goals as distractors. Weaker than
   * a model-written quiz, but honest and always available.
   */
  private buildFallbackQuiz(params: {
    detectedGaps: QuizSourceGap[];
    steps: QuizSourceStep[];
    questionCount: number;
  }): QuizQuestion[] {
    const questions: QuizQuestion[] = [];
    const usableSteps = params.steps.filter((step) => step.title && step.goal);

    for (const step of usableSteps) {
      if (questions.length >= params.questionCount) break;

      const distractors = usableSteps
        .filter((other) => other.title !== step.title && other.goal)
        .map((other) => other.goal as string)
        .slice(0, 2);

      const gapDistractor = params.detectedGaps
        .map((gap) => `Remove all ${gap.label.toLowerCase()} checks from the codebase`)
        .slice(0, 1);

      const options = [step.goal as string, ...distractors, ...gapDistractor].slice(
        0,
        4,
      );

      if (options.length < 2) continue;

      questions.push({
        prompt: `In your plan, what is the goal of the step "${step.title}"?`,
        options,
        correctIndex: 0,
        explanation:
          step.whyItMatters ||
          `That step was added because of the gaps found in your recent contributions.`,
        gapKey: step.gapKeys?.[0] || 'general',
        skill: step.skill,
      });
    }

    for (const gap of params.detectedGaps) {
      if (questions.length >= params.questionCount) break;

      questions.push({
        prompt: `Which area did the analysis flag in your recent work on this repository?`,
        options: [
          gap.label,
          'Commit message formatting',
          'Branch naming conventions',
          'Repository licensing',
        ],
        correctIndex: 0,
        explanation:
          (gap.evidence || [])[0] ||
          `${gap.label} was detected as a ${gap.severity} severity gap in your contributions.`,
        gapKey: gap.key,
      });
    }

    return questions;
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
- Never leave recommended_course_ids empty when relevant retrieved courses are available for that step.
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
