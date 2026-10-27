export interface AIProviderConfig {
  id: string;
  name: string;
  providerType: 'xai' | 'deepseek' | 'openai' | 'anthropic' | 'gemini' | 'local_proxy' | 'custom_openai';
  baseUrl: string;
  apiKey?: string; // ถ้าเป็น local proxy อาจไม่ต้องใช้
  availableModels: string[];
  defaultModel: string;
  isLocal: boolean;
  isActive: boolean;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface AICallRequest {
  providerId: string;
  modelName: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
}

export interface AICallResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  durationMs: number;
}
