import { createContext } from 'react';
import type { IZeroMqService } from '../types/zeromq';

export const ZeroMqContext = createContext<IZeroMqService | null>(null);
