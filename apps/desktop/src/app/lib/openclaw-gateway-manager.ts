type GatewayResponseFrame = {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: {
    message?: string;
  };
};

type GatewayEventFrame = {
  type: 'event';
  event: string;
  payload?: unknown;
};

type GatewayHelloFrame = {
  type: 'hello-ok';
};

type GatewayFrame = GatewayResponseFrame | GatewayEventFrame | GatewayHelloFrame;

export type GatewayTransportPhase = 'disconnected' | 'connecting' | 'connected' | 'error';

export type GatewayTransportState = {
  phase: GatewayTransportPhase;
  ready: boolean;
  lastError: string | null;
};

type PendingRequest = {
  method: string;
  params?: unknown;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type WebSocketFactory = (url: string) => WebSocket;

const GATEWAY_CONNECT_SCOPES = ['operator.read', 'operator.write', 'operator.admin'];
const managers = new Map<string, DesktopGatewayConnectionManager>();

function trimText(value: string | null | undefined): string {
  return String(value || '').trim();
}

function buildManagerKey(input: {
  gatewayUrl: string;
  gatewayToken?: string;
  gatewayPassword?: string;
}) {
  return JSON.stringify({
    gatewayUrl: trimText(input.gatewayUrl),
    gatewayToken: trimText(input.gatewayToken),
    gatewayPassword: trimText(input.gatewayPassword),
  });
}

function buildGatewayConnectParams(gatewayToken?: string, gatewayPassword?: string): Record<string, unknown> {
  const token = trimText(gatewayToken) || undefined;
  const password = trimText(gatewayPassword) || undefined;
  return {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: 'gateway-client',
      version: 'iclaw-shell',
      platform: typeof navigator !== 'undefined' ? navigator.platform || 'Unknown' : 'Unknown',
      mode: 'webchat',
    },
    caps: [],
    ...(token || password
      ? {
          auth: {
            ...(token ? { token } : {}),
            ...(password ? { password } : {}),
          },
        }
      : {}),
    role: 'operator',
    scopes: GATEWAY_CONNECT_SCOPES,
  };
}

function parseGatewayFrame(raw: string): GatewayFrame | null {
  try {
    const parsed = JSON.parse(raw) as GatewayFrame | null;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export class DesktopGatewayConnectionManager {
  private readonly gatewayUrl: string;
  private readonly gatewayToken?: string;
  private readonly gatewayPassword?: string;
  private readonly createWebSocket: WebSocketFactory;
  private socket: WebSocket | null = null;
  private connectRequestId: string | null = null;
  private requestQueue: PendingRequest[] = [];
  private inFlight = new Map<string, PendingRequest>();
  private listeners = new Set<(state: GatewayTransportState) => void>();
  private state: GatewayTransportState = {
    phase: 'disconnected',
    ready: false,
    lastError: null,
  };

  constructor(
    input: {
      gatewayUrl: string;
      gatewayToken?: string;
      gatewayPassword?: string;
    },
    options?: {
      createWebSocket?: WebSocketFactory;
    },
  ) {
    this.gatewayUrl = trimText(input.gatewayUrl);
    this.gatewayToken = trimText(input.gatewayToken) || undefined;
    this.gatewayPassword = trimText(input.gatewayPassword) || undefined;
    this.createWebSocket = options?.createWebSocket ?? ((url) => new WebSocket(url));
  }

  getState(): GatewayTransportState {
    return this.state;
  }

  subscribe(listener: (state: GatewayTransportState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  connect() {
    this.ensureConnected();
  }

  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.requestQueue.push({
        method,
        params,
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.ensureConnected();
      this.flushRequestQueue();
    });
  }

  disconnect() {
    const current = this.socket;
    this.socket = null;
    this.connectRequestId = null;
    if (current) {
      try {
        current.close();
      } catch {
        // ignore close failures
      }
    }
    this.updateState({
      phase: 'disconnected',
      ready: false,
      lastError: null,
    });
  }

  private updateState(next: GatewayTransportState) {
    if (
      this.state.phase === next.phase &&
      this.state.ready === next.ready &&
      this.state.lastError === next.lastError
    ) {
      return;
    }
    this.state = next;
    this.listeners.forEach((listener) => listener(this.state));
  }

  private ensureConnected() {
    if (this.socket || !this.gatewayUrl) {
      return;
    }
    const socket = this.createWebSocket(this.gatewayUrl);
    this.socket = socket;
    this.connectRequestId = null;
    this.updateState({
      phase: 'connecting',
      ready: false,
      lastError: null,
    });

    socket.onmessage = (event) => {
      const frame = parseGatewayFrame(String(event.data));
      if (!frame) {
        return;
      }

      if (frame.type === 'event' && frame.event === 'connect.challenge') {
        this.sendConnectRequest();
        return;
      }

      if (frame.type === 'hello-ok') {
        this.updateState({
          phase: 'connected',
          ready: true,
          lastError: null,
        });
        this.flushRequestQueue();
        return;
      }

      if (frame.type !== 'res') {
        return;
      }

      if (this.connectRequestId && frame.id === this.connectRequestId) {
        this.connectRequestId = null;
        if (!frame.ok) {
          this.handleFailure(frame.error?.message || 'gateway connect failed');
          return;
        }
        this.updateState({
          phase: 'connected',
          ready: true,
          lastError: null,
        });
        this.flushRequestQueue();
        return;
      }

      const pending = this.inFlight.get(frame.id);
      if (!pending) {
        return;
      }
      this.inFlight.delete(frame.id);
      if (!frame.ok) {
        pending.reject(new Error(frame.error?.message || 'gateway request failed'));
        return;
      }
      pending.resolve(frame.payload);
    };

    socket.onerror = () => {
      this.handleFailure('gateway websocket error');
    };

    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null;
      }
      this.connectRequestId = null;
      if (this.state.phase !== 'disconnected') {
        this.updateState({
          phase: 'disconnected',
          ready: false,
          lastError: this.state.lastError,
        });
      }
      const error = new Error('gateway websocket closed');
      this.rejectAllInFlight(error);
    };
  }

  private handleFailure(message: string) {
    this.socket = null;
    this.connectRequestId = null;
    const error = new Error(message);
    this.updateState({
      phase: 'error',
      ready: false,
      lastError: message,
    });
    this.rejectAllInFlight(error);
  }

  private rejectAllInFlight(error: Error) {
    const queued = this.requestQueue.splice(0);
    queued.forEach((pending) => pending.reject(error));
    const inFlight = Array.from(this.inFlight.values());
    this.inFlight.clear();
    inFlight.forEach((pending) => pending.reject(error));
  }

  private sendConnectRequest() {
    if (!this.socket || this.connectRequestId) {
      return;
    }
    const requestId = crypto.randomUUID();
    this.connectRequestId = requestId;
    this.socket.send(
      JSON.stringify({
        type: 'req',
        id: requestId,
        method: 'connect',
        params: buildGatewayConnectParams(this.gatewayToken, this.gatewayPassword),
      }),
    );
  }

  private flushRequestQueue() {
    if (!this.socket || !this.state.ready) {
      return;
    }

    const pending = this.requestQueue.splice(0);
    pending.forEach((item) => {
      const requestId = crypto.randomUUID();
      this.inFlight.set(requestId, item);
      this.socket?.send(
        JSON.stringify({
          type: 'req',
          id: requestId,
          method: item.method,
          params: item.params,
        }),
      );
    });
  }
}

export function getDesktopGatewayConnectionManager(
  input: {
    gatewayUrl: string;
    gatewayToken?: string;
    gatewayPassword?: string;
  },
  options?: {
    createWebSocket?: WebSocketFactory;
  },
): DesktopGatewayConnectionManager {
  const key = buildManagerKey(input);
  const existing = managers.get(key);
  if (existing) {
    return existing;
  }
  const manager = new DesktopGatewayConnectionManager(input, options);
  managers.set(key, manager);
  return manager;
}

export function resetDesktopGatewayConnectionManagersForTest() {
  managers.forEach((manager) => manager.disconnect());
  managers.clear();
}
