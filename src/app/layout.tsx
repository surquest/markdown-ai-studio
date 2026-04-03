import fs from 'fs';
import path from 'path';
import aiConfigJson from '@/lib/config/ai-config.json';
import Providers from './providers';
import { Bai_Jamjuree } from 'next/font/google';
const baiJamjuree = Bai_Jamjuree({
  weight: ['200', '300', '400', '500', '600', '700'],
  subsets: ['latin', 'vietnamese'],
  display: 'swap',
  variable: '--font-bai-jamjuree',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const promptsDir = path.join(process.cwd(), 'src/lib/prompts');
  const defaultInstruction = fs.readFileSync(
    path.join(promptsDir, aiConfigJson.defaultConfig.systemInstructionFile),
    'utf-8'
  );
  const examples = aiConfigJson.systemInstructionExampleFiles.map(file =>
    fs.readFileSync(path.join(promptsDir, file), 'utf-8')
  );
  
  const defaultDocument = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/assets/default-document.md'),
    'utf-8'
  );

  return (
    <html lang="en" className={baiJamjuree.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Markdown AI Studio</title>
        <meta name="description" content="Client-side Markdown editor with Vertex AI integration" />
      </head>
      <body style={{ margin: 0, padding: 0 }}>
        <Providers defaultInstruction={defaultInstruction} examples={examples} defaultDocument={defaultDocument}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
