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
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(body || res.statusText, res.status);
  }

  return res.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) =>
    request<{ token: string; user: any }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Agents
  getAgents: () =>
    request<{ docs: any[]; totalDocs: number }>('/api/agents'),

  getAgent: (id: string) =>
    request<any>(`/api/agents/${id}`),

  createAgent: (data: any) =>
    request<any>('/api/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateAgent: (id: string, data: any) =>
    request<any>(`/api/agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteAgent: (id: string) =>
    request<void>(`/api/agents/${id}`, { method: 'DELETE' }),

  // Voice Configs
  getVoices: () =>
    request<{ docs: any[] }>('/api/voice-configs'),

  // Phone Numbers
  getPhoneNumbers: () =>
    request<{ docs: any[] }>('/api/phone-numbers'),

  createPhoneNumber: (data: any) =>
    request<any>('/api/phone-numbers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePhoneNumber: (id: string, data: any) =>
    request<any>(`/api/phone-numbers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deletePhoneNumber: (id: string) =>
    request<void>(`/api/phone-numbers/${id}`, { method: 'DELETE' }),

  // SIP Trunks
  getSipTrunks: () =>
    request<{ docs: any[] }>('/api/sip-trunks'),

  createSipTrunk: (data: any) =>
    request<any>('/api/sip-trunks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSipTrunk: (id: string, data: any) =>
    request<any>(`/api/sip-trunks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteSipTrunk: (id: string) =>
    request<void>(`/api/sip-trunks/${id}`, { method: 'DELETE' }),

  // Conversations
  getConversations: (params?: { limit?: number; page?: number }) =>
    request<{ docs: any[]; totalDocs: number; page: number; totalPages: number }>(
      `/api/conversations?limit=${params?.limit || 20}&page=${params?.page || 1}`,
    ),

  getConversation: (id: string) =>
    request<any>(`/api/conversations/${id}`),

  // Messages
  getMessages: (conversationId: string) =>
    request<{ docs: any[] }>(
      `/api/messages?where[conversation][equals]=${conversationId}&sort=timestamp`,
    ),

  // Training Docs
  getTrainingDocs: () =>
    request<{ docs: any[] }>('/api/training-docs'),

  createTrainingDoc: (data: { title: string; content: string; tags?: string[]; agentId?: string }) =>
    request<any>('/api/training-docs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteTrainingDoc: (id: string) =>
    request<void>(`/api/training-docs/${id}`, { method: 'DELETE' }),

  // Pricing Plans
  getPricingPlans: () =>
    request<{ docs: any[] }>('/api/pricing-plans'),

  // Subscriptions
  getSubscriptions: () =>
    request<{ docs: any[] }>('/api/subscriptions'),

  // Credit Packages
  getCreditPackages: () =>
    request<{ docs: any[] }>('/api/credit-packages'),

  createCreditCheckout: (data: { packageId: number; tenantId?: number; successUrl: string; cancelUrl: string }) =>
    request<{ url: string }>('/api/billing/create-checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Credit balance
  getMyCredits: () =>
    request<any>('/api/billing/credits'),

  // Tenants
  getTenants: () =>
    request<{ docs: any[] }>('/api/tenants'),

  updateTenant: (id: string, data: any) =>
    request<any>(`/api/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Users
  getCurrentUser: () =>
    request<any>('/api/users/me'),

  getUsers: () =>
    request<{ docs: any[] }>('/api/users'),

  updateUser: (id: string, data: any) =>
    request<any>(`/api/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteUser: (id: string) =>
    request<void>(`/api/users/${id}`, { method: 'DELETE' }),

  // Payments (Admin)
  getPayments: () =>
    request<{ docs: any[] }>('/api/payments'),

  // Webhook Logs (Admin)
  getWebhookLogs: () =>
    request<{ docs: any[] }>('/api/webhook-logs'),

  // Provider Configs (Admin)
  getProviderConfigs: () =>
    request<{ docs: any[] }>('/api/provider-configs'),

  createProviderConfig: (data: any) =>
    request<any>('/api/provider-configs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // AI Providers
  getAiProviders: () =>
    request<{ docs: any[] }>('/api/ai-providers'),

  // WhatsApp
  getWhatsAppAccounts: () =>
    request<{ docs: any[] }>('/api/whatsapp/accounts'),

  getWhatsAppConversations: (params?: { page?: number; limit?: number; status?: string }) => {
    const qs = new URLSearchParams()
    if (params?.page) qs.set('page', String(params.page))
    if (params?.limit) qs.set('limit', String(params.limit))
    if (params?.status) qs.set('status', params.status)
    return request<{ docs: any[] }>(`/api/whatsapp/conversations?${qs.toString()}`)
  },

  getWhatsAppMessages: (conversationId: string) =>
    request<{ docs: any[] }>(`/api/whatsapp/conversations/${conversationId}/messages`),

  sendWhatsAppMessage: (conversationId: string, data: any) =>
    request<any>(`/api/whatsapp/conversations/${conversationId}/send`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  sendNewWhatsAppMessage: (data: any) =>
    request<any>('/api/whatsapp/send-new', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  assignWhatsAppConversation: (id: string, userId: string | null) =>
    request<any>(`/api/whatsapp/conversations/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ userId }),
    }),

  updateWhatsAppConversationStatus: (id: string, status: string) =>
    request<any>(`/api/whatsapp/conversations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export function setUser(user: any) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('callcrafter_user', JSON.stringify(user));
  }
}

export function getUser(): any | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem('callcrafter_user');
  return stored ? JSON.parse(stored) : null;
}
