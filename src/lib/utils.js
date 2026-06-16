export const normalizeAvatarPath = (avatar) => {
	if (!avatar || typeof avatar !== 'string') return '';
	const trimmed = avatar.trim();
	if (!trimmed) return '';
	if (trimmed.startsWith('data:')) return trimmed;
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;

	const clean = trimmed.replace(/^\/+/, '');
	if (clean.startsWith('api/uploads/') || clean.startsWith('api/')) return `/${clean}`;
	if (clean.startsWith('uploads/')) return `/${clean}`;
	return `/uploads/${clean}`;
};
