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
    const messages = this.buildPrompt(input.context, input.text);
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
