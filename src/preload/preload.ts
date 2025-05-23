import {contextBridge} from 'electron';
import { zmqApis } from './zmq/apis';
import { ipcApis } from './ipc/apis';

contextBridge.exposeInMainWorld('ipc', ipcApis);
contextBridge.exposeInMainWorld('zmq', zmqApis);
