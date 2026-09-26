/**
 * Data backup file operations — the file/share layer on top of the
 * integrity-verified export/import in services/storage.ts.
 *
 * - Export: serialize via exportTelemetryBackup() (checksummed JSON), write to
 *   a timestamped .json file in the app document directory, then hand it to
 *   the OS share sheet so the user can save it to the Files app, AirDrop it,
 *   or send it to themselves.
 * - Import: open the system file picker and read the chosen file as text.
 *   Validation happens inside importTelemetryBackup() — this module never
 *   touches live state, so a bad file can never clobber good data.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportTelemetryBackup } from './storage';

export interface BackupFileResult {
  readonly success: boolean;
  readonly fileName?: string;
  readonly fileUri?: string;
  readonly error?: string;
}

function backupFileName(now: number): string {
  const d = new Date(now);
  const pad = (n: number): string => String(n).padStart(2, '0');
  const stamp =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `sovereign-backup-${stamp}.json`;
}

/**
 * Serializes the current app state into a checksummed, timestamped JSON file
 * in the app's document directory. Returns the file URI for sharing.
 */
export async function createBackupFile(): Promise<BackupFileResult> {
  const exported = await exportTelemetryBackup();
  if (!exported.success) {
    return {
      success: false,
      error: exported.error,
    };
  }
  const backupJson = exported.data;
  const fileName = backupFileName(Date.now());
  try {
    const file = new File(Paths.document, fileName);
    file.write(backupJson);
    return { success: true, fileName, fileUri: file.uri };
  } catch (error) {
    return {
      success: false,
      error: `Could not write the backup file: ${String(error)}`,
    };
  }
}

/**
 * Opens the OS share sheet for a backup file URI (Save to Files, AirDrop,
 * …). The file remains in the document directory either way.
 */
export async function shareBackupFile(
  fileUri: string
): Promise<{ shared: boolean; error?: string }> {
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      return { shared: false, error: 'Sharing is not available on this device.' };
    }
    await Sharing.shareAsync(fileUri, {
      dialogTitle: 'Save your Sovereign backup',
    });
    return { shared: true };
  } catch (error) {
    // A dismissed share sheet can surface as an error on some platforms; the
    // backup file itself is unaffected and still on disk.
    return {
      shared: false,
      error: `Sharing was dismissed or failed: ${String(error)}`,
    };
  }
}

export interface PickedBackupResult {
  readonly canceled: boolean;
  readonly fileName?: string;
  readonly json?: string;
  readonly error?: string;
}

/**
 * Opens the system file picker and reads the chosen file as text. Returns the
 * raw JSON for importTelemetryBackup() to validate — live state is never
 * touched here.
 */
export async function pickBackupFileContents(): Promise<PickedBackupResult> {
  try {
    const picked = await File.pickFileAsync({
      mimeTypes: ['application/json'],
    });
    if (picked.canceled || !picked.result) {
      return { canceled: true };
    }
    const file = picked.result;
    const json = await file.text();
    if (!json || !json.trim()) {
      return { canceled: false, error: 'The selected file is empty.' };
    }
    return { canceled: false, fileName: file.name, json };
  } catch (error) {
    return {
      canceled: false,
      error: `Could not read the selected file: ${String(error)}`,
    };
  }
}
