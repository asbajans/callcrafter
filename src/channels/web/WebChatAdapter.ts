interface Session {
  id: string;
  agentId: string;
  visitor: { name?: string; email?: string };
  status: 'active' | 'closed';
  createdAt: Date;
}

interface Visitor {
  name?: string;
  email?: string;
}

export class WebChatAdapter {
  private sessions: Map<string, Session> = new Map();
  private messageQueues: Map<string, string[]> = new Map();
  private eventTarget: EventTarget = new EventTarget();

  async createSession(agentId: string, visitor: Visitor): Promise<string> {
    const sessionId = crypto.randomUUID();
    const session: Session = {
      id: sessionId,
      agentId,
      visitor,
      status: 'active',
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    this.messageQueues.set(sessionId, []);

    this.eventTarget.dispatchEvent(
      new CustomEvent('session:created', { detail: session })
    );

    return sessionId;
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    if (session.status !== 'active') {
      throw new Error(`Session ${sessionId} is no longer active`);
    }

    const queue = this.messageQueues.get(sessionId);
    if (queue) {
      queue.push(message);
    }

    this.eventTarget.dispatchEvent(
      new CustomEvent('message:sent', {
        detail: { sessionId, message, timestamp: new Date() },
      })
    );
  }

  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = 'closed';

    this.eventTarget.dispatchEvent(
      new CustomEvent('session:closed', { detail: session })
    );
  }

  onSessionCreated(listener: (event: CustomEvent<Session>) => void): void {
    this.eventTarget.addEventListener('session:created', listener as EventListener);
  }

  onSessionClosed(listener: (event: CustomEvent<Session>) => void): void {
    this.eventTarget.addEventListener('session:closed', listener as EventListener);
  }

  onMessageSent(
    listener: (event: CustomEvent<{ sessionId: string; message: string; timestamp: Date }>) => void
  ): void {
    this.eventTarget.addEventListener('message:sent', listener as EventListener);
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getActiveSessions(agentId?: string): Session[] {
    const active: Session[] = [];
    for (const session of this.sessions.values()) {
      if (session.status === 'active') {
        if (!agentId || session.agentId === agentId) {
          active.push(session);
        }
      }
    }
    return active;
  }

  getMessages(sessionId: string): string[] {
    return this.messageQueues.get(sessionId) ?? [];
  }
}
