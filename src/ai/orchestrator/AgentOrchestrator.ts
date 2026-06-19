import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  name: string;
  result: unknown;
  error?: string;
}

export interface AgentContext {
  agentId: string;
  tenantId: string;
  systemPrompt: string;
  conversationHistory: Array<{ role: string; content: string }>;
  trainingContext?: string;
  channel: string;
  tools: ToolDefinition[];
}

export interface AgentResponse {
  content: string;
  toolCalls?: ToolCall[];
  audio?: Buffer;
  metadata?: Record<string, unknown>;
}

function isOpenAIError(err: unknown): err is { status?: number; message: string } {
  return typeof err === 'object' && err !== null && 'message' in err;
}

export class AgentOrchestrator {
  private llm: OpenAI | Anthropic;
  private provider: string;
  private model: string;

  // Prompt injection detection patterns
  private readonly INJECTION_PATTERNS = [
    /ignore\s+(previous|above|all)\s+(instructions|prompts?|directions)/gi,
    /forget\s+(previous|all|your)\s+(instructions|prompts?)/gi,
    /disregard\s+(previous|all)\s+(instructions|prompts?)/gi,
    /you\s+(are\s+)?(now|will)\s+(act\s+as|become|be)/gi,
    /system\s*(prompt|message|instruction)/gi,
    /override\s+(your\s+)?(instructions|prompts?|system)/gi,
    /jailbreak/gi,
    /new\s+(instructions|prompts?|rules)/gi,
    /role\s*(play|play)/gi,
    /you\s+are\s+(not\s+)?(an?\s+)?(AI|assistant|bot|chatbot)/gi,
  ];

  constructor(config: {
    provider: 'openai' | 'anthropic';
    apiKey: string;
    model?: string;
  }) {
    this.provider = config.provider;
    this.model = config.model ?? (config.provider === 'openai' ? 'gpt-4o' : 'claude-3-5-sonnet-latest');

    if (config.provider === 'openai') {
      this.llm = new OpenAI({ apiKey: config.apiKey });
    } else {
      this.llm = new Anthropic({ apiKey: config.apiKey });
    }
  }

  async process(input: {
    text: string;
    context: AgentContext;
    channel: string;
  }): Promise<AgentResponse> {
    // Sanitize input and detect injection attempts
    const sanitizedText = this.sanitizeInput(input.text);
    if (this.detectInjection(sanitizedText)) {
      console.warn('Prompt injection attempt detected:', sanitizedText.slice(0, 100));
      return {
        content: this.buildSafeResponse(input.context.systemPrompt),
        metadata: { warning: 'Input blocked by security filter' },
      };
    }

    const messages = this.buildPrompt(input.context, sanitizedText);
    const tools = input.context.tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    try {
      if (this.provider === 'openai') {
        return await this.processOpenAI(messages, tools);
      }
      return await this.processAnthropic(messages, tools);
    } catch (err) {
      const message = isOpenAIError(err) ? err.message : String(err);
      return {
        content: `I encountered an error processing your request. Please try again.`,
        metadata: { error: message },
      };
    }
  }

  private sanitizeInput(text: string): string {
    if (!text) return '';
    // Remove null bytes and control characters
    let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    // Truncate very long inputs
    if (sanitized.length > 10000) {
      sanitized = sanitized.substring(0, 10000) + ' [truncated]';
    }
    return sanitized;
  }

  private detectInjection(text: string): boolean {
    return this.INJECTION_PATTERNS.some((pattern) => pattern.test(text));
  }

  private buildSafeResponse(systemPrompt: string): string {
    // Extract first sentence of system prompt for a safe refusal
    const firstLine = systemPrompt.split('\n')[0] || 'I am an AI assistant';
    const roleMatch = firstLine.match(/You are (an?\s+)?(.+?)[\.!]/i);
    const role = roleMatch ? roleMatch[2] : 'AI assistant';
    return `I'm sorry, but I can only respond as ${role}. Please ask your question appropriately.`;
  }

  private async processOpenAI(
    messages: Array<{ role: string; content: string }>,
    tools: OpenAI.Chat.ChatCompletionTool[],
  ): Promise<AgentResponse> {
    const client = this.llm as OpenAI;

    const response = await client.chat.completions.create({
      model: this.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools: tools.length > 0 ? tools : undefined,
    });

    const choice = response.choices[0];
    const content = choice.message.content ?? '';

    const toolCalls = choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
    }));

    return {
      content,
      toolCalls,
      metadata: { finishReason: choice.finish_reason },
    };
  }

  private async processAnthropic(
    messages: Array<{ role: string; content: string }>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _tools: OpenAI.Chat.ChatCompletionTool[],
  ): Promise<AgentResponse> {
    const client = this.llm as Anthropic;

    const formattedMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const response = await client.messages.create({
      model: this.model as Anthropic.Messages.Model,
      max_tokens: 4096,
      messages: formattedMessages,
    });

    const content = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as Anthropic.TextBlock).text)
      .join('\n');

    return {
      content,
      metadata: { stopReason: response.stop_reason },
    };
  }

  private buildPrompt(context: AgentContext, userInput: string): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: context.systemPrompt },
    ];

    if (context.trainingContext) {
      messages.push({
        role: 'system',
        content: `Relevant context:\n${context.trainingContext}`,
      });
    }

    messages.push(...context.conversationHistory);
    messages.push({ role: 'user', content: userInput });

    return messages;
  }
}
