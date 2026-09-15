import type {
  AIProvider,
  AIRequest,
  AIResult,
  TranscriptionProvider,
} from './contracts';
export class GroqAIProvider implements AIProvider {
  readonly name = 'groq';
  constructor(
    private env: Record<string, string | undefined> = process.env,
    private request: typeof fetch = fetch,
  ) {}
  async generate(prompt: string) {
    return this.complete({ messages: [{ role: 'user', content: prompt }] });
  }
  async complete(input: AIRequest): Promise<AIResult> {
    const model =
      input.tier === 'fast'
        ? this.env.AI_FAST_MODEL
        : this.env.AI_PRIMARY_MODEL;
    if (!this.env.GROQ_API_KEY || !model)
      throw new Error(
        `Configure GROQ_API_KEY and ${input.tier === 'fast' ? 'AI_FAST_MODEL' : 'AI_PRIMARY_MODEL'}.`,
      );
    const response = await this.request(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: input.messages,
          tools: input.tools?.length ? input.tools : undefined,
          response_format: input.json ? { type: 'json_object' } : undefined,
          temperature: 0.5,
          max_completion_tokens: 3000,
        }),
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Groq request failed (${response.status}). Check model configuration, quota and permissions.`,
      );
    const result = await response.json();
    const message = result.choices?.[0]?.message;
    if (!message) throw new Error('Groq returned no response.');
    return {
      text: message.content || '',
      model,
      inputTokens: result.usage?.prompt_tokens || 0,
      outputTokens: result.usage?.completion_tokens || 0,
      toolCalls: message.tool_calls,
    };
  }
}
export class GroqTranscriptionProvider implements TranscriptionProvider {
  constructor(
    private env: Record<string, string | undefined> = process.env,
    private request: typeof fetch = fetch,
  ) {}
  async transcribe(data: Uint8Array, mimeType: string) {
    if (!this.env.GROQ_API_KEY || !this.env.AI_TRANSCRIPTION_MODEL)
      throw new Error('Configure GROQ_API_KEY and AI_TRANSCRIPTION_MODEL.');
    const form = new FormData();
    const ext: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp4': 'm4a',
      'audio/wav': 'wav',
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
    };
    form.set(
      'file',
      new Blob([new Uint8Array(data)], { type: mimeType }),
      `voice.${ext[mimeType] || 'wav'}`,
    );
    form.set('model', this.env.AI_TRANSCRIPTION_MODEL);
    const response = await this.request(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.env.GROQ_API_KEY}` },
        body: form,
        signal: AbortSignal.timeout(90000),
      },
    );
    if (!response.ok)
      throw new Error(`Transcription failed (${response.status}).`);
    const result = await response.json();
    if (typeof result.text !== 'string')
      throw new Error('No transcript returned');
    return { text: result.text, mock: false };
  }
}
