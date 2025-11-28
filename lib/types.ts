export type FileRecord = {
  cid: string;
  owner: string;
  filename: string;
  mime: string;
  size: number;
  createdAt: string;
  nodeId: string;
};

export type UploadEvent = {
  type: 'upload';
  user: string;
  filename: string;
  cid: string;
  nodeId: string;
  createdAt: string;
};

export type Quota = {
  max: number;
  used: number;
};
