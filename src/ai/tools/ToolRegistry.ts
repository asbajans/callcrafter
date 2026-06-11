export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  enabled: boolean;
  parameters: Record<string, unknown>;
  handler: (params: Record<string, unknown>) => Promise<ToolResult>;
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  registerTool(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`ToolRegistry: tool '${tool.name}' is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  async executeTool(name: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      return { success: false, error: `Tool '${name}' not found` };
    }

    if (!tool.enabled) {
      return { success: false, error: `Tool '${name}' is disabled` };
    }

    try {
      return await tool.handler(params);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getEnabledTools(agentTools: string[]): ToolDefinition[] {
    const enabled: ToolDefinition[] = [];

    for (const name of agentTools) {
      const tool = this.tools.get(name);
      if (tool && tool.enabled) {
        enabled.push(tool);
      }
    }

    return enabled;
  }
}
