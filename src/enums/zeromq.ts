import type {Union} from '../types/union';

export const SOCKET_TYPE = {
  REQ: 'req',
  REP: 'rep',

  PUB: 'pub',
  SUB: 'sub',

  ROUTER: 'router',
  DEALER: 'dealer',

  PUSH: 'push',
  PULL: 'pull'
};

export type SocketType = Union<typeof SOCKET_TYPE>;
