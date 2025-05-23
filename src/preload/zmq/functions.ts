import { SOCKET_TYPE, type SocketType } from '../../enums/zeromq';
import type { SocketInfo } from './types';
import type { SubscriptionMessage } from "../../types/zeromq";
import * as zmq from 'zeromq';

const sockets = new Map<number, SocketInfo>;
let socketCounter = 0;

export const createSocket = async (type: SocketType): Promise<number> => {
  try {
    const socketId = socketCounter++;
    let socket: zmq.Socket;

    switch (type) {
      case SOCKET_TYPE.REQ:
        socket = new zmq.Request();
        break;
      case SOCKET_TYPE.REP:
        socket = new zmq.Reply();
        break;
      case SOCKET_TYPE.PUB:
        socket = new zmq.Publisher();
        break;
      case SOCKET_TYPE.SUB:
        socket = new zmq.Subscriber();
        break;
      case SOCKET_TYPE.ROUTER:
        socket = new zmq.Router();
        break;
      case SOCKET_TYPE.DEALER:
        socket = new zmq.Dealer();
        break;
      case SOCKET_TYPE.PUSH:
        socket = new zmq.Push();
        break;
      case SOCKET_TYPE.PULL:
        socket = new zmq.Pull();
        break;
      default:
        console.error(`Unsupported socket type: ${type}`);
        return -1;
    }

    sockets.set(socketId, { socket, type });
    return socketId;
  } catch (error) {
    console.error('Error creating socket:', error);
    throw error;
  }
};

export const connect = async (socketId: number, endpoint: string): Promise<boolean> => {
  try {
    const socketInfo = sockets.get(socketId);
    if (!socketInfo) {
      console.error('Invalid socket ID');
      return false;
    }

    await socketInfo.socket.connect(endpoint);
    return true;
  } catch (error) {
    console.error('Error connecting socket:', error);
    throw error;
  }
};

export const setIdentity = async (socketId: number, identity: string): Promise<boolean> => {
  try {
    const socketInfo = sockets.get(socketId);
    if (!socketInfo) {
      console.error('Invalid socket ID');
      return false;
    }

    if (socketInfo.type !== SOCKET_TYPE.ROUTER && socketInfo.type !== SOCKET_TYPE.DEALER) {
      console.error('Identity can only be set on ROUTER or DEALER sockets');
      return false;
    }

    const sock = socketInfo.socket as zmq.Dealer | zmq.Router;
    sock.routingId = identity;
    return true;
  } catch (error) {
    console.error('Error setting identity:', error);
    throw error;
  }
};

export const send = async (socketId: number, message: any): Promise<boolean> => {
  try {
    const socketInfo = sockets.get(socketId);
    if (!socketInfo) {
      console.error('Invalid socket ID');
      return false;
    }

    await socketInfo.socket.send(JSON.stringify(message));
    return true;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

export const receive = async (socketId: number): Promise<any> => {
  try {
    const socketInfo = sockets.get(socketId);
    if (!socketInfo) {
      console.error('Invalid socket ID');
      return false;
    }

    let message: any;

    if (socketInfo.type === SOCKET_TYPE.ROUTER) {
      const frames = await (socketInfo.socket as zmq.Router).receive();
      const id = frames[0];
      const content = frames[1];

      message = {
        clientId: id.toString(),
        data: JSON.parse(content.toString())
      };
    } else {
      const [response] = await socketInfo.socket.receive();
      message = JSON.parse(response.toString());
    }

    return message;
  } catch (error) {
    console.error('Error receiving message:', error);
    throw error;
  }
};

export const subscribe = async (socketId: number, topic: string): Promise<boolean> => {
  try {
    const socketInfo = sockets.get(socketId);
    if (!socketInfo || socketInfo.type !== SOCKET_TYPE.SUB) {
      console.error('Invalid socket ID or not a SUB socket');
      return false;
    }

    const sock = socketInfo.socket as zmq.Subscriber;
    sock.subscribe(topic);
    return true;
  } catch (error) {
    console.error('Error subscribing topic:', error);
    throw error;
  }
};

export const unsubscribe = async (socketId: number, topic: string): Promise<boolean> => {
  try {
    const socketInfo = sockets.get(socketId);
    if (!socketInfo || socketInfo.type !== SOCKET_TYPE.SUB) {
      console.error('Invalid socket ID or not a SUB socket');
      return false;
    }

    const sock = socketInfo.socket as zmq.Subscriber;
    sock.unsubscribe(topic);
    return true;
  } catch (error) {
    console.error('Error unsubscribing topic:', error);
    throw error;
  }
};

export const receiveSubscription = async (socketId: number): Promise<SubscriptionMessage> => {
  try {
    const socketInfo = sockets.get(socketId);
    if (!socketInfo || socketInfo.type !== SOCKET_TYPE.SUB) {
      console.error('Invalid socket ID or not a SUB socket');
      return { receivedTopic: "", message: null };
    }

    const sock = socketInfo.socket as zmq.Subscriber;
    const [topicBuffer, messageBuffer] = await sock.receive();

    return {
      receivedTopic: topicBuffer.toString(),
      // TODO: 메시지가 어떻게 들어오는지에 따라 파싱 수정
      message: JSON.parse(messageBuffer.toString())
    };
  } catch (error) {
    throw error;
  }
};

export const close = (socketId: number): boolean => {
  try {
    const socketInfo = sockets.get(socketId);
    if (!socketInfo)
      return false;

    socketInfo.socket.close();
    sockets.delete(socketId);
    return true;
  } catch (error) {
    console.error('Error closing socket:', error);
    return false;
  }
};

