# Desktop App Releases

Drop packaged Tauri desktop installers into this folder so the backend can expose them on the public download endpoints.

## Supported naming

The backend infers the target platform from the filename. Include one of these keywords or extensions:

- Linux: `linux`, `.AppImage`, `.deb`, `.rpm`, `.tar.gz`
- Windows: `windows`, `.exe`, `.msi`
- macOS: `macos`, `darwin`, `.dmg`, `.app.tar.gz`

## Example filenames

- `hive-desktop-connector_0.1.0_linux_amd64.AppImage`
- `hive-desktop-connector_0.1.0_windows_x64.msi`
- `hive-desktop-connector_0.1.0_macos_universal.dmg`

## API endpoints

- `GET /download/desktop-apps` returns the list of available artifacts.
- `GET /download/desktop-apps/:filename` streams the installer file.

Only files in this directory are exposed.
