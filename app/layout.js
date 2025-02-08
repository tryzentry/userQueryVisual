// app/layout.js
import '../styles/globals.css';

export const metadata = {
  title: 'User Query AI',
  description: 'A collaborative AI board application.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
