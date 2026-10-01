/**
 * Passbob ~ fork of the Passbolt browser extension
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * Based on Passbolt, Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 */
import QRCode from "qrcode";
import PassbobQrScanService, { CAPTURE_TAB_EVENT, CAPTURE_TIMEOUT_IN_MS, QR_SCAN_ERRORS } from "./passbobQrScanService";

const SCREENSHOT = "data:image/png;base64,iVBORw0KGgo=";
const TOTP_URI = "otpauth://totp/AWS:smoubayed?secret=JBSWY3DPEHPK3PXP&issuer=AWS&digits=8&period=60&algorithm=SHA256";

/**
 * A canvas holding a real QR code, drawn as the decoder reads it (jsdom has no canvas).
 * @param {string} text The content of the QR code
 * @returns {object}
 */
const qrCodeCanvas = (text) => {
  const { modules } = QRCode.create(text);
  const scale = 4;
  const margin = 32;
  const size = modules.size * scale + margin * 2;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const moduleX = Math.floor((x - margin) / scale);
      const moduleY = Math.floor((y - margin) / scale);
      const inside = moduleX >= 0 && moduleY >= 0 && moduleX < modules.size && moduleY < modules.size;
      if (inside && modules.get(moduleY, moduleX)) {
        const i = (y * size + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
  }
  return { width: size, height: size, getContext: () => ({ getImageData: () => ({ data }) }) };
};

const mockPort = (implementation = async () => SCREENSHOT) => ({ request: jest.fn(implementation) });

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("PassbobQrScanService", () => {
  describe("::scanPage", () => {
    it("reads the TOTP from a QR code on the page", async () => {
      const port = mockPort();
      const draw = jest.spyOn(PassbobQrScanService, "drawImage").mockImplementation(async () => qrCodeCanvas(TOTP_URI));

      const totp = await PassbobQrScanService.scanPage(port, 42);

      expect(port.request).toHaveBeenCalledWith(CAPTURE_TAB_EVENT, 42);
      expect(draw).toHaveBeenCalledWith(SCREENSHOT);
      expect(totp).toStrictEqual({ secret_key: "JBSWY3DPEHPK3PXP", algorithm: "SHA256", digits: 8, period: 60 });
    });

    it("asks for the current tab when the quickaccess has no opener tab", async () => {
      const port = mockPort();
      jest.spyOn(PassbobQrScanService, "drawImage").mockImplementation(async () => qrCodeCanvas(TOTP_URI));

      await PassbobQrScanService.scanPage(port, undefined);

      expect(port.request).toHaveBeenCalledWith(CAPTURE_TAB_EVENT, null);
    });

    it("fails when the browser refuses the screenshot", async () => {
      const port = mockPort(async () => {
        throw new Error("Cannot access a chrome:// URL");
      });

      await expect(PassbobQrScanService.scanPage(port, null)).rejects.toMatchObject({
        reason: QR_SCAN_ERRORS.PAGE_UNREADABLE,
      });
    });

    it("fails when the background page never answers", async () => {
      jest.useFakeTimers();
      const port = mockPort(() => new Promise(() => {}));

      const scan = PassbobQrScanService.scanPage(port, null);
      const assertion = expect(scan).rejects.toMatchObject({ reason: QR_SCAN_ERRORS.PAGE_UNREADABLE });
      await jest.advanceTimersByTimeAsync(CAPTURE_TIMEOUT_IN_MS);
      await assertion;
      jest.useRealTimers();
    });

    it("fails when there is no QR code on the page", async () => {
      const blankCanvas = (width, height) => {
        const data = new Uint8ClampedArray(width * height * 4).fill(255);
        return { width, height, getContext: () => ({ getImageData: () => ({ data }) }) };
      };
      jest.spyOn(PassbobQrScanService, "drawImage").mockImplementation(async () => blankCanvas(200, 200));
      const crop = jest
        .spyOn(PassbobQrScanService, "cropCanvas")
        .mockImplementation((canvas, region) => blankCanvas(region.width, region.height));

      await expect(PassbobQrScanService.scanPage(mockPort(), null)).rejects.toMatchObject({
        reason: QR_SCAN_ERRORS.NO_QR_CODE,
      });
      expect(crop).toHaveBeenCalledTimes(PassbobQrScanService.getRegions(200, 200).length - 1);
    });

    it("searches the tiles when the whole screenshot gives nothing", async () => {
      const screenshot = { width: 3840, height: 2160 };
      const tile = { width: 1920, height: 1080 };
      jest.spyOn(PassbobQrScanService, "drawImage").mockImplementation(async () => screenshot);
      const crop = jest.spyOn(PassbobQrScanService, "cropCanvas").mockImplementation(() => tile);
      const decodeAsync = jest.fn(async (canvas) => {
        if (canvas === screenshot) {
          throw new Error("NotFoundException");
        }
        return { text: TOTP_URI };
      });
      jest.spyOn(PassbobQrScanService, "createDecoder").mockImplementation(() => ({ decodeAsync }));

      const totp = await PassbobQrScanService.scanPage(mockPort(), null);

      expect(totp.secret_key).toStrictEqual("JBSWY3DPEHPK3PXP");
      expect(decodeAsync).toHaveBeenCalledTimes(2);
      expect(crop).toHaveBeenCalledWith(screenshot, { x: 0, y: 0, width: 1920, height: 1080 });
    });

    it("fails when the screenshot cannot be loaded", async () => {
      jest.spyOn(PassbobQrScanService, "drawImage").mockImplementation(async () => {
        throw new Error("The screenshot cannot be loaded.");
      });

      await expect(PassbobQrScanService.scanPage(mockPort(), null)).rejects.toMatchObject({
        reason: QR_SCAN_ERRORS.NO_QR_CODE,
      });
    });

    it("fails when the QR code is not an authenticator key", async () => {
      jest
        .spyOn(PassbobQrScanService, "drawImage")
        .mockImplementation(async () => qrCodeCanvas("https://www.passbolt.com"));

      await expect(PassbobQrScanService.scanPage(mockPort(), null)).rejects.toMatchObject({
        reason: QR_SCAN_ERRORS.NOT_TOTP,
      });
    });
  });

  describe("::parseOtpAuthUri", () => {
    it("uses the default settings when the URI only has a secret", () => {
      expect(PassbobQrScanService.parseOtpAuthUri("otpauth://totp/Site?secret=JBSWY3DPEHPK3PXP")).toStrictEqual({
        secret_key: "JBSWY3DPEHPK3PXP",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
      });
    });

    it.each([
      ["a counter based key", "otpauth://hotp/Site?secret=JBSWY3DPEHPK3PXP&counter=1"],
      ["a key without secret", "otpauth://totp/Site?issuer=Site"],
      ["a key that is not base32", "otpauth://totp/Site?secret=0189"],
      ["plain text", "hello"],
    ])("refuses %s", (_, text) => {
      expect(() => PassbobQrScanService.parseOtpAuthUri(text)).toThrow(
        expect.objectContaining({ reason: QR_SCAN_ERRORS.NOT_TOTP }),
      );
    });
  });

  describe("::getRegions", () => {
    it("starts with the whole image, then overlapping tiles inside the image", () => {
      const regions = PassbobQrScanService.getRegions(3840, 2160);

      expect(regions[0]).toStrictEqual({ x: 0, y: 0, width: 3840, height: 2160 });
      // Halves overlapping by a quarter: 3 x 3, thirds: 5 x 5, quarters: 7 x 7.
      expect(regions).toHaveLength(1 + 9 + 25 + 49);
      for (const { x, y, width, height } of regions) {
        expect(x + width).toBeLessThanOrEqual(3840);
        expect(y + height).toBeLessThanOrEqual(2160);
      }
    });
  });
});
