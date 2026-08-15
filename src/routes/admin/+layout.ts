import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getAuthUser, isAuthenticated } from '$lib/pocketbase';

export function load() {
	if (!isAuthenticated()) {
		redirect(302, resolve('/login'));
	}
	if (getAuthUser()?.role !== 'editor_contenido') {
		redirect(302, resolve('/'));
	}
}
