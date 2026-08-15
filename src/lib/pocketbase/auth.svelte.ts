import { pb } from './client';
import type { UserRecord } from './types';

let user = $state<UserRecord | null>(pb.authStore.record as UserRecord | null);

pb.authStore.onChange(() => {
	user = pb.authStore.record as UserRecord | null;
});

export function getAuthUser(): UserRecord | null {
	return user;
}

export function isAuthenticated(): boolean {
	return pb.authStore.isValid;
}

export async function login(email: string, password: string) {
	return pb.collection('users').authWithPassword(email, password);
}

export async function signup(email: string, password: string, name: string) {
	await pb.collection('users').create({
		email,
		password,
		passwordConfirm: password,
		name,
		role: 'estudiante'
	});
	return login(email, password);
}

export function logout() {
	pb.authStore.clear();
}
