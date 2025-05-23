import type { IZeroMqService, ZmqConfig } from '../types/zeromq';
import { type ReactNode, useEffect, useState } from 'react';
import { ZeromqService } from '../services/zeromqService';
import { ZeroMqContext } from '../contexts/zeromqContext';

type ZeroMqProviderProps = {
  children: ReactNode;
  config: ZmqConfig;
};

export const ZeroMqProvider = ({ children, config }: ZeroMqProviderProps) => {
  const [service] = useState<IZeroMqService>(() => new ZeromqService(config));

  useEffect(() => {
    return () => {
      service.cleanup();
    };
  }, [service]);

  return <ZeroMqContext.Provider value={service}>{children}</ZeroMqContext.Provider>;
};
