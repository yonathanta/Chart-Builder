export type DataQuery = {
  source: string; // endpoint, file URL, or future table/view
  params?: Record<string, unknown>;
  schema?: Record<string, string>; // optional field:type expectations
};

export type DataBindingRequest = {
  provider: string; // registry key
  kind: "json" | "http" | "db";
  query: DataQuery;
};

export type DataRecord = Record<string, unknown>;

export interface DataProvider {
  name: string;
  kind: DataBindingRequest["kind"];
  canHandle(binding: DataBindingRequest): boolean;
  load(binding: DataBindingRequest): Promise<DataRecord[]>;
}
