import { ipcRenderer } from 'electron';
import type {Command} from "../../types/command";

export const send = (channel: string, data: Command): void => {
  ipcRenderer.send(channel, data);
};

export const invoke = async (channel: string, data: Command): Promise<Command> => {
  return await ipcRenderer.invoke(channel, data);
};

export const receive = (channel: string, func: (...args: any[]) => void): void => {
  ipcRenderer.on(channel, (_event, ...args) => func(...args));
};

export const removeListeners = (channel: string): void => {
  ipcRenderer.removeAllListeners(channel);
};
