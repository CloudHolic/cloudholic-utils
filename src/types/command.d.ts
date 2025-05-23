export type RequestId = string;

export type Command = {
  requestId: RequestId;
  [key: string]: any;
};
