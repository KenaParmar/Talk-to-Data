export type DocumentKind = 'pdf' | 'docx' | 'txt' | 'md';
export interface SourceDocument {
  id: string;
  name: string;
  kind: DocumentKind;
  text: string;
  sizeBytes: number;
}
