import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricStatus {
  hasHardware: boolean;
  isEnrolled: boolean;
  enrolledLevel: LocalAuthentication.SecurityLevel;
  supportedTypes: LocalAuthentication.AuthenticationType[];
}

let authInProgress = false;
let lastAuthFinishedTime = 0;

/**
 * Returns whether a biometric / passcode authentication prompt is currently in-flight
 * or was completed within the last 2000ms.
 * Used by AppState observers to distinguish between native auth dialogs and app switching.
 */
export function isAuthenticationInProgress(): boolean {
  return authInProgress || Date.now() - lastAuthFinishedTime < 2000;
}

/**
 * Checks if the hardware supports biometric authentication, enrolled credentials, and security level.
 */
export async function checkBiometricCapability(): Promise<BiometricStatus> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();

    return {
      hasHardware,
      isEnrolled,
      enrolledLevel,
      supportedTypes,
    };
  } catch (error) {
    console.error('[Biometrics] Hardware inspection failure:', error);
    return {
      hasHardware: false,
      isEnrolled: false,
      enrolledLevel: LocalAuthentication.SecurityLevel.NONE,
      supportedTypes: [],
    };
  }
}

/**
 * Triggers Face ID, Touch ID, or OS-level device passcode fallback.
 *
 * Security Policy:
 * 1. If biometrics are enrolled: Evaluates LAPolicyDeviceOwnerAuthentication (with biometric prompt,
 *    falling back to device passcode if failed or upon user tapping "Enter Device Passcode").
 * 2. If biometrics are UN-ENROLLED but device passcode is enrolled: Evaluates device passcode/PIN
 *    directly via LAPolicyDeviceOwnerAuthentication / Android KeyguardManager.
 * 3. If NEITHER biometrics NOR device passcode are enrolled: Emits security warning and allows terminal
 *    operation to prevent locking users on un-secured devices / simulators.
 */
export async function authenticateLocalOwner(
  promptMessage = 'Verify identity to unlock command terminal'
): Promise<boolean> {
  if (authInProgress) {
    // Avoid re-entrant or duplicate concurrent authentication cycles
    return false;
  }

  authInProgress = true;
  try {
    const { isEnrolled, enrolledLevel } = await checkBiometricCapability();

    // If device has zero security credentials enrolled (no biometrics, no PIN, no passcode)
    if (enrolledLevel === LocalAuthentication.SecurityLevel.NONE && !isEnrolled) {
      console.warn(
        '[Biometrics] Zero security credentials enrolled on device (no Face ID, Touch ID, or passcode). Operating in unconstrained enclave mode.'
      );
      return true;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      fallbackLabel: 'Enter Device Passcode',
      disableDeviceFallback: false,
    });

    if (!result.success) {
      // In case of an un-enrolled device returning not_enrolled error
      if (result.error === 'not_enrolled' || result.error === 'passcode_not_set') {
        console.warn(
          `[Biometrics] Device security not configured (${result.error}). Bypassing hardware gate.`
        );
        return true;
      }
      return false;
    }

    return result.success;
  } catch (error) {
    console.error('[Biometrics] Authentication loop aborted:', error);
    return false;
  } finally {
    authInProgress = false;
    lastAuthFinishedTime = Date.now();
  }
}