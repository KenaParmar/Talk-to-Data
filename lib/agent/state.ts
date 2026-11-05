export type Route = 'DATA' | 'DOCS' | 'BOTH' | 'UNSAFE';
export interface AgentState {
  question: string;
  route: Route;
  attempts: number;
  status: 'ROUTING'|'RETRIEVING'|'QUERYING'|'GENERATING'|'VERIFYING'|'REPAIRING'|'COMPLETED'|'FAILED';
  errors: string[];
}
