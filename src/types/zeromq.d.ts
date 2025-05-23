import type { SocketType } from '../../types/enums/zeroMq';
import type { Command } from '../../types/command';

export type EndpointConfig = {
  port: number;
  type: SocketType;
  identity?: string;
  topics?: string[];
};

export type ZmqConfig = {
  endpoints: Record<string, EndpointConfig>;
  options: {
    timeout: number;
    hostname: string;
  };
};

export type SocketInfo = {
  id: number;
  type: SocketType;
};

export type SubscriptionMessage = {
  receivedTopic: string;
  message: any;
}

export type IZeroMqService = {
  getEndpointConfig(key: string): EndpointConfig | null;
  request(key: string, message: any): Promise<any>;
  dealer(key: string, message: Command, callback: (response: any) => void): Promise<{
    resend: (newMessage: Command) => Promise<void>;
    cancel: () => void;
  }>;
  push(key: string, message: any): Promise<boolean>;
  pull(key: string, callback: (message: any) => void): Promise<() => void>;
  subscribe(key: string, topic: string, callback: (message: any) => void): Promise<() => void>;
  cleanup(): void;
};

export type ZeroMqHook = {
  send: (key: string, message: Command) => Promise<any>;
  useDealer: (key: string, callback: (response: any) => void) => {
    send: (message: Command) => Promise<void>;
    unsubscribe: () => void;
  };
  useReceive: (key: string, callback: (message: any) => void, options?: { topic?: string }) => {
    start: () => void;
    stop: () => void;
  };
};
