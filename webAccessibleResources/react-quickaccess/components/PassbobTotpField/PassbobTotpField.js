/**
 * Passbob ~ fork of the Passbolt browser extension
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * Based on Passbolt, Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 */

import React from "react";
import PropTypes from "prop-types";
import { Trans, withTranslation } from "react-i18next";
import PassbobQrScanService, { QR_SCAN_ERRORS } from "../../../shared/services/passbob/passbobQrScanService";
import { TotpCodeGeneratorService } from "../../../shared/services/otp/TotpCodeGeneratorService";
import SpinnerSVG from "../../../img/svg/spinner.svg";
import QrCodeSVG from "../../../img/svg/qr_code.svg";

/**
 * Passbob: the authenticator key (TOTP) field of the quickaccess forms, with a button reading it from a QR code shown
 * on the page.
 */
class PassbobTotpField extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isScanning: false,
      scanResult: null, // {code} once a QR code was read from the page, {error} when it failed
    };
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleScanClick = this.handleScanClick.bind(this);
  }

  /**
   * @param {React.Event} event
   */
  handleInputChange(event) {
    this.setState({ scanResult: null });
    this.props.onChange(event.target.value);
  }

  /**
   * Read the TOTP from a QR code shown on the page the quickaccess is used on.
   * @returns {Promise<void>}
   */
  async handleScanClick() {
    if (this.props.disabled || this.state.isScanning) {
      return;
    }
    this.setState({ isScanning: true, scanResult: null });
    try {
      const totp = await PassbobQrScanService.scanPage(this.props.port, this.props.openerTabId);
      this.props.onScan(totp);
      this.setState({ isScanning: false, scanResult: { code: TotpCodeGeneratorService.generate(totp) } });
    } catch (error) {
      console.warn(error);
      this.setState({ isScanning: false, scanResult: { error: error?.reason || QR_SCAN_ERRORS.NO_QR_CODE } });
    }
  }

  get translate() {
    return this.props.t;
  }

  renderScanResult() {
    const result = this.state.scanResult;
    if (!result) {
      return null;
    }
    if (result.code) {
      return (
        <div className="passbob-scan-result success" role="status">
          <Trans>Read from this page, current code</Trans> <strong>{result.code}</strong>
        </div>
      );
    }
    return (
      <div className="passbob-scan-result warning" role="status">
        {result.error === QR_SCAN_ERRORS.PAGE_UNREADABLE && <Trans>This page cannot be read.</Trans>}
        {result.error === QR_SCAN_ERRORS.NO_QR_CODE && (
          <Trans>No QR code found. Scroll it into view, then scan again.</Trans>
        )}
        {result.error === QR_SCAN_ERRORS.NOT_TOTP && <Trans>This QR code is not an authenticator key.</Trans>}
      </div>
    );
  }

  render() {
    const disabled = this.props.disabled;
    return (
      <div className={`input text passbob-totp-field ${this.props.hasError ? "error" : ""}`}>
        <label htmlFor={this.props.id}>
          <Trans>Authenticator key (TOTP)</Trans>
        </label>
        <div className="password-button-inline">
          <input
            id={this.props.id}
            name={this.props.name}
            value={this.props.value || ""}
            onChange={this.handleInputChange}
            disabled={disabled}
            ref={this.props.inputRef}
            className="fluid passbob-totp-key"
            maxLength="1024"
            type="text"
            autoComplete="off"
            spellCheck="false"
          />
          <button
            type="button"
            onClick={this.handleScanClick}
            className={`passbob-scan-qr button-icon button ${disabled || this.state.isScanning ? "disabled" : ""}`}
            title={this.translate("Scan the QR code on this page")}
          >
            {this.state.isScanning ? <SpinnerSVG /> : <QrCodeSVG />}
            <span className="visually-hidden">
              <Trans>Scan the QR code on this page</Trans>
            </span>
          </button>
        </div>
        {this.renderScanResult()}
        {this.props.hasError && (
          <div className="error-message">
            <Trans>The key is not valid.</Trans>
          </div>
        )}
      </div>
    );
  }
}

PassbobTotpField.propTypes = {
  id: PropTypes.string.isRequired, // The id of the input
  name: PropTypes.string.isRequired, // The name of the input
  value: PropTypes.string, // The authenticator key
  onChange: PropTypes.func.isRequired, // Called with the key typed by the user
  onScan: PropTypes.func.isRequired, // Called with the TOTP read from a QR code {secret_key, algorithm, digits, period}
  port: PropTypes.object.isRequired, // The port to the background page
  openerTabId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]), // The tab the quickaccess was opened from
  disabled: PropTypes.bool,
  hasError: PropTypes.bool,
  inputRef: PropTypes.object, // The ref of the input
  t: PropTypes.func, // The translation function
};

export default withTranslation("common")(PassbobTotpField);
