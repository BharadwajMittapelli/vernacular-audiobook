const STORAGE_KEY = 'ekithab-recent-accounts';
const MAX_ACCOUNTS = 5;

interface AccountEntry {
  email: string;
  displayName: string;
}

function read(): AccountEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AccountEntry[]) : [];
  } catch {
    return [];
  }
}

function write(list: AccountEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getRecentAccounts(): AccountEntry[] {
  return read();
}

export function clearRecentAccounts(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function pushRecentAccount(email: string, displayName?: string): AccountEntry[] {
  const list = read().filter((a: AccountEntry) => a.email !== email);
  const next: AccountEntry[] = [{ email, displayName: displayName || email.split('@')[0] }, ...list].slice(0, MAX_ACCOUNTS);
  write(next);
  return next;
}

