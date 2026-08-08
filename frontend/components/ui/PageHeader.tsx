import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

// PreSkool uslubidagi sahifa sarlavhasi: breadcrumb + title + o'ng tomonda amallar
interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  crumbs?: Crumb[];
  children?: React.ReactNode; // o'ng tomondagi tugmalar (Export, + Qo'shish...)
}

export default function PageHeader({ title, crumbs, children }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {crumbs && crumbs.length > 0 && (
          <nav className="flex items-center gap-1 mt-1 text-xs text-gray-400">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-gray-300" />}
                {c.href ? (
                  <Link href={c.href} className="hover:text-primary-600 transition-colors">{c.label}</Link>
                ) : (
                  <span className="text-gray-500">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
