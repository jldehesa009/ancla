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

export type AutorregulacionStatus = 'en_progreso' | 'evaluando' | 'completed';

export interface AutorregulacionResponseRecord extends RecordModel {
	user: string;
	status: AutorregulacionStatus;
	subject: string;
	topic: string;
	study_goal: string;
	planned_duration_minutes: number;
	started_at: string;
	actual_duration_minutes: number | null;
	strategy_used: string;
	next_adjustment: string;
	completed_at: string | null;
}

export interface ConceptMapNode {
	id: string;
	position: { x: number; y: number };
	data: { label: string };
}

export interface ConceptMapEdge {
	id: string;
	source: string;
	target: string;
	type?: string;
	label?: string;
}

export interface ConceptMapRecord extends RecordModel {
	user: string;
	subject: string;
	nodes: ConceptMapNode[];
	edges: ConceptMapEdge[];
}

export interface LearningSystemRecord extends RecordModel {
	user: string;
	subject: string;
	personal_summary: string;
}

export type StudySessionStatus = 'planeada' | 'completada';

export interface StudySessionRecord extends RecordModel {
	user: string;
	topic: string;
	planned_date: string;
	status: StudySessionStatus;
	completed_at: string | null;
}
