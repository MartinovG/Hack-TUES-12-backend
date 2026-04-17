import { Controller, Get, Res, StreamableFile, Req } from '@nestjs/common';
import type { Response } from 'express';
import type { Request } from 'express';
import { DownloadService } from './download.service';

@Controller('download')
export class DownloadController {
  constructor(private readonly downloadService: DownloadService) {}

  @Get('python')
  getPython(@Res({ passthrough: true }) res: Response): StreamableFile {
    const bundle = this.downloadService.buildRawScriptsArchive();
    if (!bundle) {
      res.status(404);
      const buffer = Buffer.from('# scripts folder was not found on server\n', 'utf-8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="scripts.zip"');
      return new StreamableFile(buffer);
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${bundle.filename}"`);
    return bundle.file;
  }

  @Get('connector-template')
  getConnectorTemplate(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    const bundle = this.downloadService.buildConnectorBundle({
      backendUrl: this.resolveBackendUrl(req),
    });
    if (!bundle) {
      res.status(404);
      const buffer = Buffer.from('# connector bundle was not found on server\n', 'utf-8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="provider-connector.zip"');
      return new StreamableFile(buffer);
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${bundle.filename}"`);
    return bundle.file;
  }

  @Get('desktop-apps')
  getDesktopApps() {
    return {
      artifacts: this.downloadService.listDesktopAppArtifacts(),
    };
  }

  @Get('desktop-apps/:filename')
  getDesktopAppArtifact(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    const bundle = this.downloadService.openDesktopAppArtifact(String(req.params.filename || ''));
    if (!bundle) {
      res.status(404);
      const buffer = Buffer.from('# desktop app artifact was not found on server\n', 'utf-8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="desktop-app-not-found.txt"');
      return new StreamableFile(buffer);
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${bundle.filename}"`);
    return bundle.file;
  }

  private resolveBackendUrl(req: Request) {
    const configured = process.env.HIVE_PUBLIC_BACKEND_URL?.trim();
    if (configured) {
      return configured.replace(/\/$/, '');
    }

    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
    return `${proto}://${req.get('host')}`;
  }
}
