import './globals.css';
import { Providers } from '@/components/Providers';
import Sidebar from '@/components/Sidebar';

export const metadata = {
  title: 'Rental POS',
  description: 'Hardware rental billing system',
};

export const viewport = { width: 'device-width', initialScale: 1 };

// sets the saved theme before the page paints, so dark mode does not flash white
const themeScript = `try{var t=localStorage.getItem('theme');if(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)t='dark';if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          <div className="shell">
            <Sidebar />
            <main className="main">
              <div className="container">{children}</div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
