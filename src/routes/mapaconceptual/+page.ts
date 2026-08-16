import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { isAuthenticated } from '$lib/pocketbase';

export function load() {
	if (!isAuthenticated()) {
		redirect(302, resolve('/login'));
	}
}
