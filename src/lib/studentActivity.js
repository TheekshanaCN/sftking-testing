export function getClientOS() {
  if (typeof navigator === 'undefined') return 'Unknown';

  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '').toLowerCase();

  if (ua.includes('android') || platform.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod') || /ios|ipad|iphone/.test(platform)) return 'iOS';
  if (platform.includes('win') || ua.includes('windows')) return 'Windows';
  if (platform.includes('mac') || ua.includes('mac os')) return 'macOS';
  if (ua.includes('cros') || platform.includes('chrome os')) return 'ChromeOS';
  if (platform.includes('linux') || ua.includes('linux')) return 'Linux';

  return 'Unknown';
}

export function emitStudentActivity(socket, user, payload = {}) {
  if (!socket || !user || user.role !== 'student') return;

  const userName = user.name || user.fullName || user.firstName || user.username || `Student #${user.id}`;
  const page = payload.page || payload.route || 'Browsing Platform';
  const action = payload.action || payload.event || page;
  const detail = payload.detail || payload.target || payload.meta || '';
  const sessionId = user.sessionId || user.sid || payload.sessionId || null;

  socket.emit('student_activity', {
    userId: user.id,
    sessionId,
    name: userName,
    avatar: user.avatar || null,
    page,
    action,
    detail,
    route: payload.route || null,
    kind: payload.kind || 'navigation',
    contentId: payload.contentId || null,
    quizId: payload.quizId || null,
    os: payload.os || getClientOS(),
    timestamp: Date.now(),
  });
}
