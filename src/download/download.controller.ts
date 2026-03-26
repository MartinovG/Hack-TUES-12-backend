import { Controller, Get, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';

@Controller('download')
export class DownloadController {
  @Get('python')
  getPython(@Res({ passthrough: true }) res: Response): StreamableFile {
    // Prefer asset from compiled dist (when running with Nest CLI), fallback to project root
    const distPath = join(__dirname, '../assets', 'scripts', 'hello.py');
    const srcPath = join(process.cwd(), 'assets', 'scripts', 'hello.py');
    const filePath = existsSync(distPath) ? distPath : srcPath;

    if (!existsSync(filePath)) {
      res.status(404);
      const buffer = Buffer.from('# hello.py was not found on server\n', 'utf-8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="hello.py"');
      return new StreamableFile(buffer);
    }

    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="hello.py"');

    const file = createReadStream(filePath);
    return new StreamableFile(file);
  }
}