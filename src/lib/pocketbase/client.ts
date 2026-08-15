import PocketBase from 'pocketbase';
import { PUBLIC_POCKETBASE_URL } from '$env/static/public';
import type { UserRecord } from './types';

export const pb = new PocketBase(PUBLIC_POCKETBASE_URL);

export function currentUser(): UserRecord | null {
	return pb.authStore.record as UserRecord | null;
}
