import { redirect } from 'next/navigation';

// Root sahifa → loginga yo'naltirish
export default function RootPage() {
  redirect('/login');
}
