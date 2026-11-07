// client/src/services/installmentView.js
// Display status + search/filter logic for the Installments list (kept out of JSX).

import { addDays, parseDate } from './cashflow.js';

export const daysUntil = (today, date) => Math.round((parseDate(date) - parseDate(today)) / 86400000);

export function getDisplayStatus(inst, today) {
  if (inst.status === 'paid') return { key: 'paid', label: 'Paid' };
  const d = daysUntil(today, inst.dueDate);
  if (d < 0) return { key: 'overdue', label: 'Overdue' };
  if (d === 0) return { key: 'soon', label: 'Due today' };
  if (d <= 3) return { key: 'soon', label: `Due in ${d}d` };
  return { key: 'pending', label: 'Pending' };
}

// filters = { search, status: all|pending|overdue|paid, due: all|next7|next30 }
export function filterInstallments(list, filters, today) {
  const { search = '', status = 'all', due = 'all' } = filters;
  const q = search.trim().toLowerCase();
  const next7 = addDays(today, 7);
  const next30 = addDays(today, 30);

  return list
    .filter((inst) => {
      if (q && !inst.provider.toLowerCase().includes(q)) return false;

      if (status !== 'all') {
        const key = getDisplayStatus(inst, today).key;
        const matches = status === 'pending' ? key === 'pending' || key === 'soon' : key === status;
        if (!matches) return false;
      }

      if (due === 'next7' && !(inst.dueDate >= today && inst.dueDate <= next7)) return false;
      if (due === 'next30' && !(inst.dueDate >= today && inst.dueDate <= next30)) return false;
      return true;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}