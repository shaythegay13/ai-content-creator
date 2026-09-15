import type { Metadata } from 'next';
import { Shell } from '@/components/shell';
import './globals.css';
import './manage.css';
export const metadata: Metadata = {
  title: 'Fieldnotes — Your content workspace',
  description:
    'A private workspace for ideas, content and editorial intelligence.',
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
