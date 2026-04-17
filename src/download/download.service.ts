import { Injectable, StreamableFile } from '@nestjs/common';
import { createReadStream, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import archiver from 'archiver';
import { PassThrough } from 'stream';

interface ConnectorBundleOptions {
  backendUrl: string;
  connectionToken?: string;
  vmId?: string;
  vmName?: string;
}

export interface DesktopAppArtifact {
  platform: 'linux' | 'windows' | 'macos';
  filename: string;
  sizeBytes: number;
  updatedAt: string;
  downloadPath: string;
}

@Injectable()
export class DownloadService {
  resolveScriptsFolder(): string | null {
    const distDir = join(__dirname, '../assets', 'scripts');
    const srcDir = join(process.cwd(), 'assets', 'scripts');

    const preferSrc = process.env.NODE_ENV !== 'production';
    const primary = preferSrc ? srcDir : distDir;
    const secondary = preferSrc ? distDir : srcDir;

    return existsSync(primary) ? primary : existsSync(secondary) ? secondary : null;
  }

  buildRawScriptsArchive(): { file: StreamableFile; filename: string } | null {
    const folderPath = this.resolveScriptsFolder();
    if (!folderPath) {
      return null;
    }

    const bundle = this.createArchive();
    this.appendBaseScripts(bundle.archive, folderPath);
    void bundle.archive.finalize();

    return {
      file: new StreamableFile(bundle.stream),
      filename: 'scripts.zip',
    };
  }

  buildConnectorBundle(
    options: ConnectorBundleOptions,
  ): { file: StreamableFile; filename: string } | null {
    const folderPath = this.resolveScriptsFolder();
    if (!folderPath) {
      return null;
    }

    const bundle = this.createArchive();
    this.appendBaseScripts(bundle.archive, folderPath);

    const config = {
      backendUrl: options.backendUrl,
      socketPath: '/computer-socket',
      connectionToken: options.connectionToken ?? '',
      heartbeatInterval: 30,
      reconnectDelay: 5,
      jsonLogs: true,
    };

    bundle.archive.append(`${JSON.stringify(config, null, 2)}\n`, {
      name: 'connector-config.json',
    });
    bundle.archive.append(this.buildReadme(options), { name: 'README.md' });
    void bundle.archive.finalize();

    const safeVmName = (options.vmName || options.vmId || 'provider-connector')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48);

    return {
      file: new StreamableFile(bundle.stream),
      filename: `${safeVmName || 'provider-connector'}.zip`,
    };
  }

  listDesktopAppArtifacts(): DesktopAppArtifact[] {
    const folderPath = this.resolveDesktopAppsFolder();
    if (!folderPath) {
      return [];
    }

    return readdirSync(folderPath)
      .map((filename) => {
        const fullPath = join(folderPath, filename);
        const stats = statSync(fullPath);
        if (!stats.isFile()) {
          return null;
        }

        const platform = this.inferPlatformFromFilename(filename);
        if (!platform) {
          return null;
        }

        return {
          platform,
          filename,
          sizeBytes: stats.size,
          updatedAt: stats.mtime.toISOString(),
          downloadPath: `/download/desktop-apps/${encodeURIComponent(filename)}`,
        } satisfies DesktopAppArtifact;
      })
      .filter((artifact): artifact is DesktopAppArtifact => Boolean(artifact))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  openDesktopAppArtifact(
    filename: string,
  ): { file: StreamableFile; filename: string } | null {
    const folderPath = this.resolveDesktopAppsFolder();
    if (!folderPath || !filename) {
      return null;
    }

    const safeFilename = filename.trim();
    if (!safeFilename || safeFilename.includes('/') || safeFilename.includes('\\')) {
      return null;
    }

    const fullPath = join(folderPath, safeFilename);
    if (!existsSync(fullPath) || !statSync(fullPath).isFile()) {
      return null;
    }

    return {
      file: new StreamableFile(createReadStream(fullPath)),
      filename: safeFilename,
    };
  }

  private createArchive(): { archive: archiver.Archiver; stream: PassThrough } {
    const stream = new PassThrough();
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.on('error', (error) => {
      stream.destroy(error);
    });

    archive.pipe(stream);
    return { archive, stream };
  }

  private resolveDesktopAppsFolder(): string | null {
    const distDir = join(__dirname, '../assets', 'desktop-apps');
    const srcDir = join(process.cwd(), 'assets', 'desktop-apps');

    const preferSrc = process.env.NODE_ENV !== 'production';
    const primary = preferSrc ? srcDir : distDir;
    const secondary = preferSrc ? distDir : srcDir;

    return existsSync(primary) ? primary : existsSync(secondary) ? secondary : null;
  }

  private inferPlatformFromFilename(filename: string): DesktopAppArtifact['platform'] | null {
    const normalized = filename.toLowerCase();

    if (
      normalized.endsWith('.msi') ||
      normalized.endsWith('.exe') ||
      normalized.includes('windows')
    ) {
      return 'windows';
    }

    if (
      normalized.endsWith('.dmg') ||
      normalized.endsWith('.app.tar.gz') ||
      normalized.includes('macos') ||
      normalized.includes('darwin')
    ) {
      return 'macos';
    }

    if (
      normalized.endsWith('.appimage') ||
      normalized.endsWith('.deb') ||
      normalized.endsWith('.rpm') ||
      normalized.endsWith('.tar.gz') ||
      normalized.includes('linux')
    ) {
      return 'linux';
    }

    return null;
  }

  private appendBaseScripts(archive: archiver.Archiver, folderPath: string) {
    archive.glob('**/*', {
      cwd: folderPath,
      dot: true,
      ignore: ['__pycache__/**', '**/__pycache__/**', '*.pyc', '**/*.pyc'],
    });
  }

  private buildReadme(options: ConnectorBundleOptions) {
    const vmLabel = options.vmName || options.vmId || 'your provider machine';
    const keyStatus = options.connectionToken ? 'already pre-filled' : 'not pre-filled';

    return [
      '# Hive Provider Connector',
      '',
      `This bundle is for ${vmLabel}.`,
      '',
      '## Quick start',
      '',
      '1. Install Python 3 if it is not already available on the laptop.',
      '2. Install the Python dependencies with `pip install -r requirements.txt`.',
      '3. Start the connector with `python agent.py --config connector-config.json`.',
      '4. Keep the connector running while the laptop is offered to renters.',
      '',
      '## What is preconfigured',
      '',
      `- Backend URL: ${options.backendUrl}`,
      `- Setup key: ${keyStatus}`,
      '- Socket path: `/computer-socket`',
      '- JSON logs: enabled so a future desktop shell can read structured events',
      '',
      '## Desktop-shell ready',
      '',
      'The agent supports `--config` and `--json-logs`, so it can be launched as a background sidecar from a Tauri or Electron UI without asking the user to paste anything manually.',
      '',
      '## Helper launchers',
      '',
      '- macOS / Linux: `./start-connector.sh`',
      '- Windows: `start-connector.bat`',
      '',
    ].join('\n');
  }
}
