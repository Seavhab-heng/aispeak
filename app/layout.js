export const metadata = {
  title: 'Gibberlink AI Dashboard with Video Feed',
  description: 'Autonomous AI-to-AI Audio-Visual Evaluation Stream',
};

export default function RootLayout({ children }) {
  return (
    <html lang="km">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#0f172a', color: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
