import type { RecordModel } from 'pocketbase';

export type UserRole = 'estudiante' | 'editor_contenido';

export interface UserRecord extends RecordModel {
	email: string;
	name: string;
	role: UserRole;
}

export type DiagnosticCategory =
	'organizacion' | 'motivacion' | 'estrategias_estudio' | 'autorregulacion';

export interface DiagnosticQuestionRecord extends RecordModel {
	text: string;
	category: DiagnosticCategory;
	order: number;
	active: boolean;
	reverse_scored: boolean;
}

export interface DiagnosticResponseRecord extends RecordModel {
	user: string;
	answers: Record<string, number>;
	completed_at: string;
}
