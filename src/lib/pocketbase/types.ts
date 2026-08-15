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

export type MetacognitionStatus = 'en_progreso' | 'evaluando' | 'completed';

export interface MetacognitionResponseRecord extends RecordModel {
	user: string;
	status: MetacognitionStatus;
	task_description: string;
	predicted_duration_minutes: number;
	predicted_difficulty: number;
	predicted_success: number;
	started_at: string;
	mid_check_response: 'si' | 'no' | null;
	actual_duration_minutes: number | null;
	actual_difficulty: number | null;
	actual_success: number | null;
	reflection: string;
	completed_at: string | null;
}
