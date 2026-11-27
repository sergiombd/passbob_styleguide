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
export const CAPTURE_TIMEOUT_IN_MS = 15000;

/**
 * The decoder misses a small QR code in a full screenshot full of text. The screenshot is then searched in
 * overlapping tiles of a half, a third and a quarter of its size, the QR code takes more room in a smaller tile.
 */
const TILE_DIVISIONS = [2, 3, 4];

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
      dataUrl = await PassbobQrScanService.withTimeout(port.request(CAPTURE_TAB_EVENT, tabId ?? null));
    } catch (error) {
      throw new PassbobQrScanError(QR_SCAN_ERRORS.PAGE_UNREADABLE, error);
    }

    let decodedText;
    try {
      const canvas = await PassbobQrScanService.drawImage(dataUrl);
      decodedText = await PassbobQrScanService.decodeInRegions(canvas);
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
   * Reject when the background page does not answer, the button would spin forever otherwise.
   * @param {Promise} promise The request
   * @returns {Promise}
   */
  static withTimeout(promise) {
    let timeout;
    const timer = new Promise((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error("The screenshot request timed out.")), CAPTURE_TIMEOUT_IN_MS);
    });
    return Promise.race([promise, timer]).finally(() => clearTimeout(timeout));
  }

  /**
   * Decode the first QR code found, in the whole screenshot first, then tile by tile.
   * @param {HTMLCanvasElement} canvas The screenshot
   * @returns {Promise<string>} The content of the QR code
   * @throws {Error} If no QR code is found
   */
  static async decodeInRegions(canvas) {
    const decoder = PassbobQrScanService.createDecoder();
    let lastError;
    for (const region of PassbobQrScanService.getRegions(canvas.width, canvas.height)) {
      const isWhole = region.width === canvas.width && region.height === canvas.height;
      try {
        const source = isWhole ? canvas : PassbobQrScanService.cropCanvas(canvas, region);
        const result = await decoder.decodeAsync(source);
        return result.text;
      } catch (error) {
        lastError = error;
      }
      // Each decode blocks for a while, let the popup breathe between two tiles.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw lastError || new Error("No QR code found.");
  }

  /**
   * The regions to search: the whole image, then the overlapping tiles, each overlapping its neighbours by half.
   * @param {number} width The image width
   * @param {number} height The image height
   * @returns {Array<{x: number, y: number, width: number, height: number}>}
   */
  static getRegions(width, height) {
    const regions = [{ x: 0, y: 0, width, height }];
    for (const division of TILE_DIVISIONS) {
      const tileWidth = Math.ceil(width / division);
      const tileHeight = Math.ceil(height / division);
      for (let y = 0; y < height - tileHeight / 2; y += tileHeight / 2) {
        for (let x = 0; x < width - tileWidth / 2; x += tileWidth / 2) {
          const left = Math.round(x);
          const top = Math.round(y);
          regions.push({
            x: left,
            y: top,
            width: Math.min(tileWidth, width - left),
            height: Math.min(tileHeight, height - top),
          });
        }
      }
    }
    return regions;
  }

  /**
   * Copy a region of the screenshot on its own canvas.
   * @param {HTMLCanvasElement} canvas The screenshot
   * @param {{x: number, y: number, width: number, height: number}} region The region
   * @returns {HTMLCanvasElement}
   */
  static cropCanvas(canvas, { x, y, width, height }) {
    const tile = document.createElement("canvas");
    tile.width = width;
    tile.height = height;
    tile.getContext("2d").drawImage(canvas, x, y, width, height, 0, 0, width, height);
    return tile;
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
   * @param {string} dataUrl The screenshot data URL
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
