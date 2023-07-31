
export type Bucket = {
  name: string;
};

export type Secret = {
  nickname: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export type ListResults = {
  key: string;
  type: string
  size: number;
  storage_class: string;
  etag: string;
  last_modified: string
}[];