// GodHand Support Ticket HTML Export Generator
export function generateTicketHtml(ticket: any, messages: any[], isUserFacing: boolean = false): string {
  const createdDate = ticket.createdAt?.toDate ? ticket.createdAt.toDate().toLocaleString() : new Date().toLocaleString();
  const statusColors: Record<string, string> = {
    open: '#38bdf8',
    in_progress: '#f59e0b',
    resolved: '#10b981',
    closed: '#ef4444',
    deleted: '#64748b'
  };
  const statusColor = statusColors[ticket.status] || '#94a3b8';

  // Filter internal notes if user-facing
  const visibleMessages = isUserFacing ? (messages || []).filter(m => !m.isInternal) : (messages || []);

  const messagesHtml = visibleMessages.map(m => {
    const isInternal = Boolean(m.isInternal);
    const sender = m.senderName || m.senderEmail || 'User';
    const role = isInternal ? 'INTERNAL STAFF NOTE' : m.senderRole === 'system' ? 'SYSTEM' : 'MESSAGE';
    const time = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString() : '';
    const bubbleBg = isInternal ? '#2a1a08' : m.senderRole === 'system' ? '#14141c' : '#1c1c24';
    const borderColor = isInternal ? '#f59e0b44' : '#2e2e38';

    return `
      <div style="margin-bottom: 12px; padding: 14px; border-radius: 10px; background: ${bubbleBg}; border: 1px solid ${borderColor};">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;">
          <strong style="color: ${isInternal ? '#fcd34d' : '#e2e8f0'}; display: flex; align-items: center; gap: 6px;">
            ${escapeHtml(sender)}
            <span style="font-size: 9px; font-weight: 700; letter-spacing: 0.05em; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.08); color: ${isInternal ? '#f59e0b' : '#94a3b8'};">${role}</span>
          </strong>
          <span style="color: #64748b; font-size: 11px;">${time}</span>
        </div>
        <div style="font-size: 13px; color: #cbd5e1; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(m.text || '')}</div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GodHand Support Ticket - #${escapeHtml(ticket.id || '')}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0c0c10; color: #f1f5f9; padding: 28px 16px; margin: 0; line-height: 1.5; }
    .container { max-width: 820px; margin: 0 auto; background: #16161c; border: 1px solid #282834; border-radius: 14px; padding: 28px; box-shadow: 0 16px 40px rgba(0,0,0,0.6); }
    .header { border-bottom: 1px solid #282834; padding-bottom: 20px; margin-bottom: 24px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 12px; color: #94a3b8; background: #101014; padding: 14px; border-radius: 10px; margin-top: 14px; border: 1px solid #22222d; }
    .meta div { display: flex; flex-direction: column; gap: 2px; }
    .meta strong { color: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
    .meta span { color: #e2e8f0; font-weight: 500; }
    .desc-box { margin-top: 18px; padding: 16px; background: #111116; border-left: 3px solid #6366f1; border-radius: 8px; border-top: 1px solid #20202a; border-right: 1px solid #20202a; border-bottom: 1px solid #20202a; }
    .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #64748b; border-top: 1px solid #282834; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;">
        <div>
          <span style="font-size: 11px; font-weight: 700; color: #818cf8; text-transform: uppercase; letter-spacing: 0.08em; display: block; margin-bottom: 4px;">GodHand Support Protocol</span>
          <h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">${escapeHtml(ticket.title || 'Support Ticket')}</h1>
        </div>
        <span class="badge" style="background: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}55;">${escapeHtml(ticket.status || 'open')}</span>
      </div>

      <div class="meta">
        <div><strong>Ticket-ID</strong><span>${escapeHtml(ticket.id || '')}</span></div>
        <div><strong>Kategorie</strong><span>${escapeHtml(ticket.category || 'Support')}</span></div>
        <div><strong>Ersteller</strong><span>${escapeHtml(ticket.reporterUsername || ticket.reporterEmail || 'User')}</span></div>
        <div><strong>Erstellt am</strong><span>${createdDate}</span></div>
        <div><strong>Zugewiesen an</strong><span>${escapeHtml(ticket.assignedToName || 'Unzugewiesen')}</span></div>
        <div><strong>Abschluss-Grund</strong><span>${escapeHtml(ticket.resolutionReason || ticket.deletionReason || 'Offen / In Bearbeitung')}</span></div>
      </div>

      <div class="desc-box">
        <strong style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #818cf8; display: block; margin-bottom: 6px;">Originale Beschreibung:</strong>
        <div style="font-size: 13px; color: #e2e8f0; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(ticket.description || '')}</div>
      </div>
    </div>

    <h3 style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.08em; margin-bottom: 14px;">Nachrichtenverlauf (${visibleMessages.length})</h3>
    <div>${messagesHtml || '<p style="color: #64748b; font-size: 13px; font-style: italic;">Keine zusätzlichen Nachrichten vorhanden.</p>'}</div>

    <div class="footer">Exportiert aus dem GodHand Engine Support Center · ${new Date().toLocaleString()}</div>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
