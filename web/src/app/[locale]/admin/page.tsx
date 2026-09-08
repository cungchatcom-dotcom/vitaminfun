import { getTranslations, setRequestLocale } from 'next-intl/server';

import { AuthProvider } from '@/components/auth-context';
import { TopBar } from '@/components/top-bar';
import { apiFetch } from '@/lib/api-client';
import { requireUser } from '@/lib/auth';
import type { UserSummary } from '@/lib/types';

// Trang này hiển thị dữ liệu RIÊNG của từng người, không bao giờ được nằm
// trong bộ nhớ đệm dùng chung. `cookies()` vốn đã làm nó động, nhưng ghi rõ ra
// đây vì hậu quả của việc đoán sai là người này thấy trang của người kia.
export const dynamic = 'force-dynamic';

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await requireUser();
  // Endpoint này có require_role(ADMIN) ở backend. Middleware đã chặn từ trước,
  // nhưng đó chỉ là trải nghiệm — đây mới là chỗ thật sự chặn.
  const users = await apiFetch<UserSummary[]>('/users');

  const t = await getTranslations('admin');
  const tRole = await getTranslations('role');

  return (
    <AuthProvider user={user}>
      <div className="flex min-h-full flex-col">
        <TopBar accent="admin" />

        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
          <h1 className="text-xl font-semibold">{t('title')}</h1>

          <section className="mt-6 overflow-x-auto rounded-2xl border border-abyss-800 bg-abyss-900/50">
            <h2 className="border-b border-abyss-800 px-5 py-3 text-sm font-semibold tracking-wide text-slate-300 uppercase">
              {t('accounts')}
            </h2>
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-5 py-2 font-medium">{t('colEmail')}</th>
                  <th className="px-5 py-2 font-medium">{t('colName')}</th>
                  <th className="px-5 py-2 font-medium">{t('colRole')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-abyss-800/60">
                    <td className="px-5 py-2 font-mono text-slate-300">{u.email}</td>
                    <td className="px-5 py-2 text-slate-200">{u.display_name}</td>
                    <td className="px-5 py-2 text-slate-400">{tRole(u.role)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </main>
      </div>
    </AuthProvider>
  );
}
