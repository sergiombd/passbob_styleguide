/**
 * Passbob ~ fork of the Passbolt browser extension
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * Based on Passbolt, Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 */
import { Html5QrcodeSupportedFormats } from "html5-qrcode";
import { ZXingHtml5QrcodeDecoder } from "html5-qrcode/esm/zxing-html5-qrcode-decoder";
import TotpEntity from "../../models/entity/totp/totpEntity";

export const CAPTURE_TAB_EVENT = "passbob.tab.capture-visible";

/**
 * Why a scan did not give a TOTP.
 */
export const QR_SCAN_ERRORS = Object.freeze({
  PAGE_UNREADABLE: "page_unreadable", // The browser refused the screenshot (browser pages, web store...)
  NO_QR_CODE: "no_qr_code", // No QR code on the visible part of the page
  NOT_TOTP: "not_totp", // A QR code, but not an authenticator key (otpauth://totp/...)
});

export class PassbobQrScanError extends Error {
  /**
   * @param {string} reason One of QR_SCAN_ERRORS
   * @param {Error} [cause] The original error
   */
  constructor(reason, cause) {
    super(`QR code scan failed: ${reason}`);
    this.name = "PassbobQrScanError";
    this.reason = reason;
    this.cause = cause;
  }
}

/**
 * Reads an authenticator key (TOTP) from a QR code shown on the page the quickaccess is used on.
 *
 * The background page takes a screenshot of the visible part of the page, the QR code is decoded here, in the
 * quickaccess, and the screenshot is dropped right after. The screenshot is drawn from its data: URL, the extension
 * CSP does not allow the blob: URLs the html5-qrcode file scanner uses.
 */
class PassbobQrScanService {
  /**
   * Scan the page for an authenticator QR code.
   * @param {object} port The port to the background page
   * @param {number|null} tabId The tab the quickaccess was opened from, the current tab if none
   * @returns {Promise<{secret_key: string, algorithm: string, digits: number, period: number}>}
   * @throws {PassbobQrScanError}
   */
  static async scanPage(port, tabId) {
    let dataUrl;
    try {
      dataUrl = await port.request(CAPTURE_TAB_EVENT, tabId ?? null);
    } catch (error) {
      throw new PassbobQrScanError(QR_SCAN_ERRORS.PAGE_UNREADABLE, error);
    }

    let decodedText;
    try {
      const canvas = await PassbobQrScanService.drawImage(dataUrl);
      const result = await PassbobQrScanService.createDecoder().decodeAsync(canvas);
      decodedText = result.text;
    } catch (error) {
      throw new PassbobQrScanError(QR_SCAN_ERRORS.NO_QR_CODE, error);
    }

    return PassbobQrScanService.parseOtpAuthUri(decodedText);
  }

  /**
   * Parse an otpauth://totp/ URI into a TOTP.
   * @param {string} text The content of the QR code
   * @returns {{secret_key: string, algorithm: string, digits: number, period: number}}
   * @throws {PassbobQrScanError} If it is not a valid TOTP URI
   */
  static parseOtpAuthUri(text) {
    try {
      const url = new URL(text);
      if (url.protocol !== "otpauth:" || url.host.toLowerCase() !== "totp") {
        throw new Error("Not an otpauth://totp/ URI");
      }
      return TotpEntity.createTotpFromUrl(url).toDto();
    } catch (error) {
      throw new PassbobQrScanError(QR_SCAN_ERRORS.NOT_TOTP, error);
    }
  }

  /**
   * The QR code decoder of html5-qrcode (ZXing).
   * @returns {ZXingHtml5QrcodeDecoder}
   */
  static createDecoder() {
    const logger = { log: () => {}, warn: () => {}, logError: () => {}, logErrors: () => {} };
    return new ZXingHtml5QrcodeDecoder([Html5QrcodeSupportedFormats.QR_CODE], false, logger);
  }

  /**
   * Draw the screenshot on a canvas, at full size.
   * @param {string} dataUrl The PNG data URL
   * @returns {Promise<HTMLCanvasElement>}
   */
  static drawImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        canvas.getContext("2d").drawImage(image, 0, 0);
        resolve(canvas);
      };
      image.onerror = () => reject(new Error("The screenshot cannot be loaded."));
      image.src = dataUrl;
    });
  }
}

export default PassbobQrScanService;
