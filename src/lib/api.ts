const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(body || res.statusText, res.status);
  }

  return res.json();
}

function getToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const stored = localStorage.getItem('callcrafter_token');
  return stored || undefined;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>('/api/users/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) =>
    request<{ token: string; user: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Agents
  getAgents: (token?: string) =>
    request<{ docs: any[]; totalDocs: number }>('/api/agents', {}, token || getToken()),

  getAgent: (id: string) =>
    request<any>(`/api/agents/${id}`, {}, getToken()),

  createAgent: (data: any) =>
    request<any>('/api/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }, getToken()),

  updateAgent: (id: string, data: any) =>
    request<any>(`/api/agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, getToken()),

  deleteAgent: (id: string) =>
    request<void>(`/api/agents/${id}`, { method: 'DELETE' }, getToken()),

  // Voice Configs
  getVoices: () =>
    request<{ docs: any[] }>('/api/voice-configs', {}, getToken()),

  // Phone Numbers
  getPhoneNumbers: () =>
    request<{ docs: any[] }>('/api/phone-numbers', {}, getToken()),

  createPhoneNumber: (data: any) =>
    request<any>('/api/phone-numbers', {
      method: 'POST',
      body: JSON.stringify(data),
    }, getToken()),

  updatePhoneNumber: (id: string, data: any) =>
    request<any>(`/api/phone-numbers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, getToken()),

  deletePhoneNumber: (id: string) =>
    request<void>(`/api/phone-numbers/${id}`, { method: 'DELETE' }, getToken()),

  // SIP Trunks
  getSipTrunks: () =>
    request<{ docs: any[] }>('/api/sip-trunks', {}, getToken()),

  createSipTrunk: (data: any) =>
    request<any>('/api/sip-trunks', {
      method: 'POST',
      body: JSON.stringify(data),
    }, getToken()),

  updateSipTrunk: (id: string, data: any) =>
    request<any>(`/api/sip-trunks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, getToken()),

  deleteSipTrunk: (id: string) =>
    request<void>(`/api/sip-trunks/${id}`, { method: 'DELETE' }, getToken()),

  // Conversations
  getConversations: (params?: { limit?: number; page?: number }) =>
    request<{ docs: any[]; totalDocs: number; page: number; totalPages: number }>(
      `/api/conversations?limit=${params?.limit || 20}&page=${params?.page || 1}${params ? '' : ''}`,
      {},
      getToken(),
    ),

  getConversation: (id: string) =>
    request<any>(`/api/conversations/${id}`, {}, getToken()),

  // Messages
  getMessages: (conversationId: string) =>
    request<{ docs: any[] }>(
      `/api/messages?where[conversation][equals]=${conversationId}&sort=timestamp`,
      {},
      getToken(),
    ),

  // Training Docs
  getTrainingDocs: () =>
    request<{ docs: any[] }>('/api/training-docs', {}, getToken()),

  createTrainingDoc: (data: { title: string; content: string; tags?: string[]; agentId?: string }) =>
    request<any>('/api/training-docs', {
      method: 'POST',
      body: JSON.stringify(data),
    }, getToken()),

  deleteTrainingDoc: (id: string) =>
    request<void>(`/api/training-docs/${id}`, { method: 'DELETE' }, getToken()),

  // Pricing Plans
  getPricingPlans: () =>
    request<{ docs: any[] }>('/api/pricing-plans'),

  // Subscriptions
  getSubscriptions: () =>
    request<{ docs: any[] }>('/api/subscriptions', {}, getToken()),

  // Tenants
  getTenants: () =>
    request<{ docs: any[] }>('/api/tenants', {}, getToken()),

  updateTenant: (id: string, data: any) =>
    request<any>(`/api/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, getToken()),

  // Users
  getCurrentUser: () =>
    request<any>('/api/users/me', {}, getToken()),

  getUsers: () =>
    request<{ docs: any[] }>('/api/users', {}, getToken()),

  updateUser: (id: string, data: any) =>
    request<any>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, getToken()),

  deleteUser: (id: string) =>
    request<void>(`/api/users/${id}`, { method: 'DELETE' }, getToken()),

  // Payments (Admin)
  getPayments: () =>
    request<{ docs: any[] }>('/api/payments', {}, getToken()),

  // Webhook Logs (Admin)
  getWebhookLogs: () =>
    request<{ docs: any[] }>('/api/webhook-logs', {}, getToken()),

  // Provider Configs (Admin)
  getProviderConfigs: () =>
    request<{ docs: any[] }>('/api/provider-configs', {}, getToken()),

  createProviderConfig: (data: any) =>
    request<any>('/api/provider-configs', {
      method: 'POST',
      body: JSON.stringify(data),
    }, getToken()),
};

export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('callcrafter_token', token);
  }
}

export function clearToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('callcrafter_token');
  }
}

export function getUser(): any | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('callcrafter_user');
  return stored ? JSON.parse(stored) : null;
}

export function setUser(user: any) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('callcrafter_user', JSON.stringify(user));
  }
}
