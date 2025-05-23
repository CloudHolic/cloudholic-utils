import type { EndpointConfig, IZeroMqService, ZmqConfig, SocketInfo } from '../types/zeromq';
import type { SocketType } from '../enums/zeromq';
import { SOCKET_TYPE } from '../enums/zeromq';
import type { Command, RequestId } from '../types/command';
import { Mutex } from 'async-mutex';

export class ZeromqService implements IZeroMqService {
  // region Private Fields

  private isInitialized: boolean;
  private readonly maxCachedMessages: number;

  private config: ZmqConfig;
  private readonly sockets: Map<string, SocketInfo>;
  private locks = new Map<string, Mutex>();
  private dealerCallbacks: Map<RequestId, (response: any) => void>;
  private activeReceivers: Map<string, boolean>;
  private subscribers: Map<string, Set<(message: any) => void>>;
  private latestMessages: Map<string, any[]>;

  private getLock(key: string) {
    if (!this.locks.has(key)) {
      this.locks.set(key, new Mutex());
    }
    return this.locks.get(key)!;
  }

  // endregion

  constructor(config: ZmqConfig) {
    this.isInitialized = false;
    this.maxCachedMessages = 100;

    this.config = { ...config };
    this.sockets = new Map();
    this.dealerCallbacks = new Map();
    this.activeReceivers = new Map();
    this.subscribers = new Map();
    this.latestMessages = new Map();

    this.init();
  }

  // region Public Methods

  // key에 지정된 EndpointConfig를 가져옴.
  public getEndpointConfig(key: string): EndpointConfig | null {
    return this.config.endpoints[key] || null;
  }

  // REQ-REP
  // 요청 전송 후 응답을 받기까지 기다림
  public async request(key: string, message: Command): Promise<any> {
    if (!this.isInitialized) throw new Error('ZeroMQ service not initialized');

    const config = this.getEndpointConfig(key);
    if (!config || config.type !== SOCKET_TYPE.REQ)
      throw new Error(`Invalid endpoint configuration for key: ${key}`);

    try {
      const socketId = await this.getSocket(key, config.type);

      const timeout = new Promise<never>((_resolve, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout for key: ${key}`));
        }, this.config.options.timeout);
      });

      const request = async () => {
        console.log('Request received');
        await window.zmq.send(socketId, message);
        return await window.zmq.receive(socketId);
      };

      return await Promise.race([request(), timeout]);
    } catch (error) {
      this.closeSocket(key);
      throw error;
    }
  }

  // ROUTER-DEALER
  // 요청을 전송하고, 응답을 처리할 콜백함수 제공
  public async dealer(
    key: string,
    message: Command,
    callback: (response: any) => void
  ): Promise<{
    resend: (newMessage: Command) => Promise<void>;
    cancel: () => void;
  }> {
    if (!this.isInitialized)
      throw new Error('ZeroMQ service not initialized');

    const config = this.getEndpointConfig(key);
    if (!config || config.type !== SOCKET_TYPE.DEALER)
      throw new Error(`Invalid endpoint configuration for key: ${key}`);

    if (!message.requestId) throw new Error(`Message must include a requestId`);
    const requestId = message.requestId;

    try {
      const socketId = await this.getSocket(key, config.type);
      let timeoutId: number | null = null;

      const setupTimeout = () => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        const timeout = this.config.options.timeout;
        if (timeout > 0) {
          timeoutId = window.setTimeout(() => {
            console.warn(
              `Request timeout for key: ${key}, requestId: ${requestId}`
            );
          }, timeout);
        }
      };

      const callbackWrapper = (response: any) => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }

        callback(response);
        this.dealerCallbacks.delete(requestId);
      };

      this.dealerCallbacks.set(requestId, callbackWrapper);
      if (this.dealerCallbacks.size === 1) 
        await this.startDealerReceiving(key);

      setupTimeout();

      const resend = async (newMessage: Command) => {
        try {
          this.dealerCallbacks.set(newMessage.requestId, callbackWrapper);
          setupTimeout();
          await window.zmq.send(socketId, newMessage);
        } catch (error) {
          console.error('Error resending message:', error);
          throw error;
        }
      };

      const cancel = () => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        this.dealerCallbacks.delete(requestId);
      };

      await window.zmq.send(socketId, message);

      return { resend, cancel };
    } catch (error) {
      this.closeSocket(key);
      throw error;
    }
  }

  // PUSH
  // 메시지를 보내기만 하고 응답을 기다리지 않음.
  public async push(key: string, message: Command): Promise<boolean> {
    if (!this.isInitialized) throw new Error('ZeroMQ service not initialized');

    const config = this.getEndpointConfig(key);
    if (!config || config.type !== SOCKET_TYPE.PUSH)
      throw new Error(`Invalid endpoint configuration for key: ${key}`);

    try {
      const socketId = await this.getSocket(key, config.type);
      await window.zmq.send(socketId, message);
      return true;
    } catch (error) {
      this.closeSocket(key);
      throw error;
    }
  }

  // PULL
  // 메시지 수신 등록 후 실제로 메시지가 오면 수신
  public async pull(key: string, callback: (message: any) => void): Promise<() => void> {
    if (!this.isInitialized) throw new Error('ZeroMQ service not initialized');

    const config = this.getEndpointConfig(key);
    if (!config || config.type !== SOCKET_TYPE.PULL)
      throw new Error(`Invalid endpoint configuration for key: ${key}`);

    try {
      const socketId = await this.getSocket(key, config.type);
      const pullKey = `pull:${key}`;

      const unsubscribe = this.subscribeToMessages(pullKey, callback);

      if (!this.activeReceivers.has(pullKey))
        this.startReceiving(pullKey, socketId, config.type).then();

      return unsubscribe;
    } catch (error) {
      this.closeSocket(key);
      throw error;
    }
  }

  // PUB-SUB
  // topic에 대한 구독 설정 후 해당 topic에 대해 지속적으로 메시지 수신
  public async subscribe(
    key: string,
    topic: string,
    callback: (message: any) => void
  ): Promise<() => void> {
    if (!this.isInitialized) throw new Error('ZeroMQ service not initialized');

    const config = this.getEndpointConfig(key);
    if (!config || config.type !== SOCKET_TYPE.SUB)
      throw new Error(`Invalid endpoint configuration for key: ${key}`);

    try {
      const socketId = await this.getSocket(key, config.type);
      const subscribeKey = `sub:${key}:${topic}`;

      await window.zmq.subscribe(socketId, topic);

      const unsubscribe = this.subscribeToMessages(subscribeKey, callback);

      if (!this.activeReceivers.has(subscribeKey))
        this.startReceiving(subscribeKey, socketId, config.type, topic).then();

      return () => {
        unsubscribe();

        if (!this.hasMessageSubscribers(subscribeKey))
          window.zmq.unsubscribe(socketId, topic).then();
      };
    } catch (error) {
      this.closeSocket(key);
      throw error;
    }
  }

  public cleanup(): void {
    if (!this.isInitialized) return;

    for (const [, socketInfo] of this.sockets.entries()) window.zmq.close(socketInfo.id);

    this.sockets.clear();
    this.subscribers.clear();
  }

  // endregion

  // region Private Methods

  private init(): void {
    if (!window.zmq) {
      console.error('window.zmq not found. Make sure preload script is configured correctly.');
      return;
    }

    this.isInitialized = true;
  }

  private closeSocket(key: string): void {
    const socketInfo = this.sockets.get(key);
    if (socketInfo) {
      window.zmq.close(socketInfo.id);
      this.sockets.delete(key);
      this.locks.delete(key);
    }
  }

  private getEndpointUrl(key: string): string | null {
    const config = this.getEndpointConfig(key);
    if (!config) return null;

    return `tcp://${this.config.options.hostname}:${config.port}`;
  }

  // 요구하는 타입에 맞는 소켓 get or create
  private async getSocket(key: string, type: SocketType): Promise<number> {
    if (!this.isInitialized)
      throw new Error('ZeroMQ service is not initialized');

    const lock = this.getLock(key);
    return await lock.runExclusive(async () => {
      let socketInfo = this.sockets.get(key);

      if (!socketInfo || socketInfo.type !== type) {
        // 이미 존재하면 기존 소켓을 닫음.
        if (socketInfo)
          window.zmq.close(socketInfo.id);

        const socketId = await window.zmq.createSocket(type);
        const url = this.getEndpointUrl(key);

        if (!url)
          throw new Error(`Invalid endpoint configuration for key: ${key}`);

        if (type === 'dealer') {
          const config = this.getEndpointConfig(key);

          if (!config)
            throw new Error(`Invalid endpoint configuration for key: ${key}`);

          if (config.identity)
            await window.zmq.setIdentity(socketId, config.identity);
        }

        await window.zmq.connect(socketId, url);

        socketInfo = { id: socketId, type: type };
        this.sockets.set(key, socketInfo);
      }

      return socketInfo.id;
    });
  }

  private subscribeToMessages(key: string, callback: (message: any) => void): () => void {
    if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());

    const subscribers = this.subscribers.get(key)!;
    subscribers.add(callback);

    const cachedMessages = this.latestMessages.get(key) || [];
    if (cachedMessages.length > 0) {
      setTimeout(() => {
        cachedMessages.forEach((m) => callback(m));
      }, 0);
    }

    // 구독 취소 함수 반환
    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(key);

          if (this.activeReceivers.has(key)) this.activeReceivers.delete(key);
        }
      }
    };
  }

  private hasMessageSubscribers(key: string): boolean {
    return this.subscribers.has(key) && this.subscribers.get(key)!.size > 0;
  }

  private broadcastMessage(key: string, message: any): void {
    const subscribers = this.subscribers.get(key);
    if (subscribers && subscribers.size > 0) {
      subscribers.forEach((callback) => {
        try {
          callback(message);
        } catch (error) {
          console.error('Error in message subscriber callback:', error);
        }
      });
    }
  }

  private async startReceiving(
    key: string,
    socketId: number,
    type: SocketType,
    topic?: string
  ): Promise<void> {
    // 이미 수신 중이면 중복 실행 방지
    if (this.activeReceivers.has(key)) {
      console.log('Duplicate key:', key);
      return;
    }

    this.activeReceivers.set(key, true);

    if (!this.latestMessages.has(key)) this.latestMessages.set(key, []);

    const receiveMessages = async () => {
      try {
        while (this.activeReceivers.get(key)) {
          try {
            let actualTopic: string;
            let actualMessage: any;

            if (type === SOCKET_TYPE.SUB) {
              const { receivedTopic, message } = await window.zmq.receiveSubscription(socketId);
              actualTopic = receivedTopic;
              actualMessage = message;
            } else {
              // if type === SOCKET_TYPE.PULL
              actualTopic = '';
              actualMessage = await window.zmq.receive(socketId);
            }

            if (type === SOCKET_TYPE.SUB && actualTopic !== topic) continue;

            const cached = this.latestMessages.get(key) || [];
            if (cached.length >= this.maxCachedMessages) cached.shift();

            cached.push(actualMessage);
            this.latestMessages.set(key, cached);

            // Broadcasting
            this.broadcastMessage(key, actualMessage);
          } catch (error) {
            console.warn(`Message receiving error for ${key}, retrying:`, error);
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        console.log(`Message receiver stopped for key: ${key}`);
        this.activeReceivers.delete(key);
      } catch (error) {
        console.error(`Fatal error in message receiver for ${key}:`, error);
        this.activeReceivers.delete(key);
      }
    };

    receiveMessages().then();
  }

  private async startDealerReceiving(key: string): Promise<void> {
    try {
      const socketId = await this.getSocket(key, SOCKET_TYPE.DEALER);

      // 이미 수신 중이면 중복 실행 방지
      if (this.activeReceivers && this.activeReceivers.has(key)) return;

      // 활성 수신자로 체크
      if (!this.activeReceivers) this.activeReceivers = new Map();
      this.activeReceivers.set(key, true);

      const receiveResponses = async () => {
        try {
          while (this.activeReceivers?.get(key)) {
            try {
              const response = await window.zmq.receive(socketId);

              const requestId = response.requestId;
              if (requestId && this.dealerCallbacks.has(requestId)) {
                const callback = this.dealerCallbacks.get(requestId);
                if (callback) {
                  try {
                    callback(response);
                  } catch (callbackError) {
                    console.error('Error in dealer callback:', callbackError);
                  }
                }
              } else console.warn(`Received response with unknown requestId: ${requestId}`);
            } catch (receiveError) {
              console.warn('Dealer receive error, retrying...:', receiveError);
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
          }

          console.log(`Dealer receiver stopped for key: ${key}`);
          this.activeReceivers?.delete(key);
        } catch (loopError) {
          console.error('Fata dealer receiving error:', loopError);
          this.activeReceivers?.delete(key);
        }
      };

      receiveResponses().then();
    } catch (error) {
      console.error('Error starting dealer receiver:', error);
      this.activeReceivers?.delete(key);
    }
  }

  // endregion
}
