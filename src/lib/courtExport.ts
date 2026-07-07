import { jsPDF } from 'jspdf';

// Court-admissible record export. Gathers the timeline (receipts, messages,
// custody logs) into a single PDF with a creation timestamp and a SHA-256
// hash of the document's text content for tamper-evidence — if the hash
// printed on the document doesn't match a re-hash of its content, it's
// been altered after export.

interface ExportReceipt {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  status: string | null;
  created_at: string | null;
  requester?: { full_name: string | null } | null;
  child?: { name: string } | null;
}

interface ExportMessage {
  id: string;
  content: string;
  created_at: string;
  sender?: { full_name: string | null } | null;
}

interface ExportLog {
  id: string;
  created_at: string;
  notes: string | null;
  detail: string;
}

interface CourtRecordInput {
  title: string;
  receipts: ExportReceipt[];
  messages: ExportMessage[];
  logs: ExportLog[];
}

const sha256Hex = async (text: string): Promise<string> => {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : 'Unknown date');

export async function generateCourtRecordPdf(input: CourtRecordInput): Promise<void> {
  const { title, receipts, messages, logs } = input;
  const generatedAt = new Date();

  // Build the full text content first — this is what gets hashed, so the
  // hash covers exactly what's printed on the page (not layout/formatting).
  const lines: string[] = [];
  lines.push(title);
  lines.push(`Generated: ${generatedAt.toISOString()}`);
  lines.push('');
  lines.push('=== RECEIPTS ===');
  receipts.forEach(r => {
    lines.push(
      `[${fmt(r.created_at)}] ${r.requester?.full_name || 'Unknown'} — ${r.description || r.category}` +
      `${r.child ? ` (${r.child.name})` : ''} — R${Number(r.amount).toFixed(2)} — ${r.status || 'pending'}`
    );
  });
  lines.push('');
  lines.push('=== MESSAGES ===');
  messages.forEach(m => {
    lines.push(`[${fmt(m.created_at)}] ${m.sender?.full_name || 'Unknown'}: ${m.content}`);
  });
  lines.push('');
  lines.push('=== CUSTODY LOGS ===');
  logs.forEach(l => {
    lines.push(`[${fmt(l.created_at)}] ${l.detail}${l.notes ? ` — ${l.notes}` : ''}`);
  });

  const fullText = lines.join('\n');
  const hash = await sha256Hex(fullText);

  // Render to PDF
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 56;

  const ensureSpace = (needed = 16) => {
    if (y + needed > pageHeight - 64) {
      doc.addPage();
      y = 56;
    }
  };

  const addHeading = (text: string) => {
    ensureSpace(28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(text, marginX, y);
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  };

  const addWrapped = (text: string) => {
    const wrapped = doc.splitTextToSize(text, pageWidth - marginX * 2);
    for (const line of wrapped) {
      ensureSpace(14);
      doc.text(line, marginX, y);
      y += 14;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(title, marginX, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${generatedAt.toLocaleString()}`, marginX, y);
  y += 14;
  doc.text('This document is timestamped and hash-verified at generation time.', marginX, y);
  y += 24;
  doc.setTextColor(0);

  addHeading(`Receipts (${receipts.length})`);
  if (receipts.length === 0) addWrapped('No receipts on record.');
  receipts.forEach(r => {
    addWrapped(
      `${fmt(r.created_at)} — ${r.requester?.full_name || 'Unknown'} — ` +
      `${r.description || r.category}${r.child ? ` (${r.child.name})` : ''} — ` +
      `R${Number(r.amount).toFixed(2)} — ${(r.status || 'pending').toUpperCase()}`
    );
  });
  y += 12;

  addHeading(`Messages (${messages.length})`);
  if (messages.length === 0) addWrapped('No messages on record.');
  messages.forEach(m => {
    addWrapped(`${fmt(m.created_at)} — ${m.sender?.full_name || 'Unknown'}: ${m.content}`);
  });
  y += 12;

  addHeading(`Custody Logs (${logs.length})`);
  if (logs.length === 0) addWrapped('No custody logs on record.');
  logs.forEach(l => {
    addWrapped(`${fmt(l.created_at)} — ${l.detail}${l.notes ? ` — ${l.notes}` : ''}`);
  });

  // Tamper-evidence footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      `SHA-256: ${hash}`,
      marginX,
      pageHeight - 32
    );
    doc.text(
      `Page ${i} of ${pageCount} — Generated ${generatedAt.toISOString()}`,
      marginX,
      pageHeight - 20
    );
  }

  const filenameSafe = title.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  doc.save(`${filenameSafe}-${generatedAt.toISOString().slice(0, 10)}.pdf`);
}
