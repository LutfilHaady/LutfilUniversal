import type { IScannerError } from '@yudiel/react-qr-scanner';

export function cameraErrorMessage(error: IScannerError): string {
  switch (error.kind) {
    case 'permission-denied': return 'Camera permission denied. Allow camera access in browser settings.';
    case 'no-camera':         return 'No camera found on this device.';
    case 'in-use':            return 'Camera is in use by another application.';
    case 'insecure-context':  return 'Camera requires HTTPS. Please use the secure URL.';
    case 'unsupported':       return 'QR scanning is not supported in this browser.';
    case 'overconstrained':   return 'Camera constraints not met. Try a different browser.';
    default:                  return 'Camera unavailable. Enter a code below.';
  }
}
