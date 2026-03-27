import { Controller, Get, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import archiver from 'archiver';
import { PassThrough } from 'stream';

@Controller('download')
export class DownloadController {
  @Get('python')
  getPython(@Res({ passthrough: true }) res: Response): StreamableFile {
    // Prefer project assets in development to avoid stale dist; use dist in production
    const distDir = join(__dirname, '../assets', 'scripts');
    const srcDir = join(process.cwd(), 'assets', 'scripts');

    const preferSrc = process.env.NODE_ENV !== 'production';
    const primary = preferSrc ? srcDir : distDir;
    const secondary = preferSrc ? distDir : srcDir;
    const folderPath = existsSync(primary) ? primary : (existsSync(secondary) ? secondary : null);

    if (!folderPath) {
      res.status(404);
      const buffer = Buffer.from('# scripts folder was not found on server\n', 'utf-8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="scripts.zip"');
      return new StreamableFile(buffer);
    }

    // Stream the entire folder as a ZIP
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="scripts.zip"');

    const pass = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (err) => {
      pass.destroy(err);
    });

    archive.pipe(pass);
    archive.directory(folderPath, false);
    void archive.finalize();

    return new StreamableFile(pass);
  }
}