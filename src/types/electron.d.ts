import type { SubscriptionMessage } from './zeromq';
import type { SocketType } from '../enums/zeroMq';

declare namespace Electron {
  interface Ipc {
    send: (channel: string, data: Command) => void;
    invoke: (channel: string, data: Command) => Promise<any>;
    receive: (channel: string, func: (...args: any[]) => void) => void;
    removeListeners: (channel: string) => void;
  }

  interface Zmq {
    createSocket: (type: SocketType) => Promise<number>;
    connect: (socketId: number, endpoint: string) => Promise<boolean>;
    setIdentity: (socketId: number, identity: string) => Promise<boolean>;
    send: (socketId: number, message: any) => Promise<boolean>;
    receive: (socketId: number) => Promise<any>;
    subscribe: (socketId: number, topic: string) => Promise<boolean>;
    unsubscribe: (socketId: number, topic: string) => Promise<boolean>;
    receiveSubscription: (socketId: number) => Promise<SubscriptionMessage>;
    close: (socketId: number) => boolean;
  }
}

declare global {
  interface Window {
    ipc: Electron.Ipc;
    zmq: Electron.Zmq;
  }
}

export {};
