import {createSocket, connect, setIdentity, send, receive, subscribe, unsubscribe, receiveSubscription, close} from './functions';

export const zmqApis = {
  createSocket,
  connect,
  setIdentity,
  send,
  receive,
  subscribe,
  unsubscribe,
  receiveSubscription,
  close
};
