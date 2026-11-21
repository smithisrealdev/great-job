export type Ats = 'greenhouse' | 'lever' | 'ashby';
export type Source = Ats | 'remoteok' | 'extension' | 'paste';
export type Status = 'found'|'interested'|'preparing'|'applied'|'interview'|'offer'|'rejected'|'withdrawn';
export type Mood = 'idle'|'wave'|'searching'|'thinking'|'happy'|'celebrate'|'spooked'|'sad'|'cheer'|'sleepy';
export type GhostLevel = 'low' | 'mid' | 'high';
export type GhostSignal = 'age_30'|'age_60'|'reposted'|'missing_from_careers'|'vague_description'|'evergreen';
export type WorkMode = 'remote' | 'thailand' | 'hybrid';
export interface Prefs { roles: string[]; modes: WorkMode[]; minSalaryThb: number | null; seniority: 'junior'|'mid'|'senior'|'lead' | null }
export interface ResumeProfile { skills: string[]; experience: {title:string; company:string; start:string; end:string|null; summary:string}[]; education: {school:string; degree:string}[]; yearsTotal: number }
export interface ParsedJob { title: string; companyName: string; location: string|null; remote: boolean; salaryText: string|null; skills: string[]; description: string; postedAt: string|null; vagueDescription: boolean; evergreen: boolean }
export interface RawJob { source: Source; externalId: string; url: string; title: string; companyName: string; location: string|null; remote: boolean; salaryText: string|null; description: string; postedAt: string|null }
export interface Evaluation { score: number; matches: string[]; gaps: string[]; notes: string[] }
