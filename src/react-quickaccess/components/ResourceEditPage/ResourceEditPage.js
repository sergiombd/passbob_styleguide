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
import { withRouter } from "react-router-dom";
import { Trans, withTranslation } from "react-i18next";
import { DateTime } from "luxon";
import { withAppContext } from "../../../shared/context/AppContext/AppContext";
import { withResourceTypesLocalStorage } from "../../../shared/context/ResourceTypesLocalStorageContext/ResourceTypesLocalStorageContext";
import { withPasswordPolicies } from "../../../shared/context/PasswordPoliciesContext/PasswordPoliciesContext";
import { withPasswordExpiry } from "../../../react-extension/contexts/PasswordExpirySettingsContext";
import { withPrepareResourceContext } from "../../contexts/PrepareResourceContext";
import { withActiveSessionLocalStorage } from "../../../shared/context/ActiveSession/ActiveSessionLocalStorageContext";
import ResourceTypesCollection from "../../../shared/models/entity/resourceType/resourceTypesCollection";
import ResourceFormEntity from "../../../shared/models/entity/resource/resourceFormEntity";
import CustomFieldsCollection from "../../../shared/models/entity/customField/customFieldsCollection";
import { ResourceEditCreateFormEnumerationTypes } from "../../../shared/models/resource/ResourceEditCreateFormEnumerationTypes";
import UserActiveSessionEntity from "../../../shared/models/entity/session/userActiveSessionEntity";
import SecretServiceWorkerService from "../../../shared/services/serviceWorker/secret/secretServiceWorkerService";
import PownedService from "../../../shared/services/api/secrets/pownedService";
import { SecretGenerator } from "../../../shared/lib/SecretGenerator/SecretGenerator";
import { ENTROPY_THRESHOLDS } from "../../../shared/lib/SecretGenerator/SecretGeneratorComplexity";
import Password from "../../../shared/components/Password/Password";
import PasswordComplexity from "../../../shared/components/PasswordComplexity/PasswordComplexity";
import SpinnerSVG from "../../../img/svg/spinner.svg";
import CaretLeftSVG from "../../../img/svg/caret_left.svg";
import DiceSVG from "../../../img/svg/dice.svg";

/**
 * The permission type required to edit a resource (update).
 */
const UPDATE_PERMISSION_TYPE = 7;

/**
 * Passbob: edit a resource from the quickaccess (name, URL, username, password and TOTP key).
 *
 * The form is backed by the same ResourceFormEntity as the web application edit dialog, so the fields the quickaccess
 * does not show (notes, custom fields, extra URLs, appearance...) are kept as they are.
 */
class ResourceEditPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = this.defaultState;
    this.secretServiceWorkerService = new SecretServiceWorkerService(props.context.port, props.activeSession);
    this.bindCallbacks();
  }

  get defaultState() {
    return {
      resource: null, // The resource form dto
      originalSecret: null, // The secret as decrypted, to know whether it changed
      isLoading: true,
      processing: false,
      errors: null, // The validation errors (EntityValidationError)
      passwordEntropy: null,
      passwordWarning: null, // "weak" or "pwned" when the new password needs a confirmation
      unexpectedErrorMessage: "",
    };
  }

  bindCallbacks() {
    this.handleGoBackClick = this.handleGoBackClick.bind(this);
    this.handleInputChange = this.handleInputChange.bind(this);
    this.handleGeneratePasswordButtonClick = this.handleGeneratePasswordButtonClick.bind(this);
    this.handleFormSubmit = this.handleFormSubmit.bind(this);
  }

  async componentDidMount() {
    const [, policies] = await Promise.all([
      this.props.passwordExpiryContext.findSettings(),
      this.props.passwordPoliciesContext.loadPolicies(),
    ]);
    if (policies?.external_dictionary_check) {
      this.pownedService = new PownedService(this.props.context.port);
    }
    await this.initResourceForm();
  }

  /**
   * Load the resource and its decrypted secret into the form.
   * @returns {Promise<void>}
   */
  async initResourceForm() {
    const storageData = await this.props.context.storage.local.get(["resources"]);
    const resourceDto = structuredClone(storageData.resources?.find((item) => item.id === this.props.match.params.id));
    if (!resourceDto || !ResourceEditPage.canEdit(resourceDto, this.props.activeSession)) {
      this.props.history.goBack();
      return;
    }

    let secret;
    try {
      secret = await this.secretServiceWorkerService.findByResourceId(resourceDto.id);
    } catch (error) {
      // The user may have closed the passphrase request.
      console.warn(error);
      this.props.history.goBack();
      return;
    }

    // A v4 "password string" secret is the password itself.
    if (typeof secret === "string") {
      secret = { password: secret };
    }
    ResourceEditPage.mergeCustomFieldsMetadataAndSecret(resourceDto, secret);
    resourceDto.secret = secret;
    this.initialResourceTypeId = resourceDto.resource_type_id;
    this.resourceFormEntity = new ResourceFormEntity(resourceDto, {
      validate: false,
      resourceTypes: this.props.resourceTypes,
    });

    this.setState({
      isLoading: false,
      originalSecret: structuredClone(secret),
      resource: this.resourceFormEntity.toDto(),
      passwordEntropy: secret?.password?.length ? SecretGenerator.entropy(secret.password) : null,
    });
  }

  /**
   * Whether the resource can be edited from the quickaccess.
   * @param {object} resourceDto The resource
   * @param {UserActiveSessionEntity} activeSession The active session
   * @returns {boolean}
   */
  static canEdit(resourceDto, activeSession) {
    const isOnline = activeSession?.isSessionOnline ?? true;
    return isOnline && resourceDto?.permission?.type >= UPDATE_PERMISSION_TYPE;
  }

  /**
   * Custom fields keep their name in the metadata and their value in the secret, the form holds both in the secret.
   * @param {object} resourceDto The resource dto, modified
   * @param {object} secret The decrypted secret, modified
   */
  static mergeCustomFieldsMetadataAndSecret(resourceDto, secret) {
    if (secret?.custom_fields?.length > 0) {
      const metadataCollection = new CustomFieldsCollection(resourceDto.metadata.custom_fields);
      const secretCollection = new CustomFieldsCollection(secret.custom_fields);
      secret.custom_fields = CustomFieldsCollection.mergeCollectionsMetadataAndSecret(
        metadataCollection,
        secretCollection,
      ).toDto();
      delete resourceDto.metadata.custom_fields;
    }
  }

  get resourceType() {
    return this.props.resourceTypes.getFirstById(this.state.resource.resource_type_id);
  }

  get hasPassword() {
    return this.resourceType?.hasPassword();
  }

  get hasTotp() {
    return this.resourceType?.hasTotp();
  }

  /**
   * Whether a TOTP can be added to the resource: its resource type has a sibling type with a TOTP.
   * @returns {boolean}
   */
  get canAddTotp() {
    if (this.hasTotp) {
      return true;
    }
    try {
      const probe = new ResourceFormEntity(this.state.resource, {
        validate: false,
        resourceTypes: this.props.resourceTypes,
      });
      probe.addSecret(ResourceEditCreateFormEnumerationTypes.TOTP, { validate: false });
      return Boolean(this.props.resourceTypes.getFirstById(probe.resourceTypeId)?.hasTotp());
    } catch {
      return false;
    }
  }

  handleGoBackClick(event) {
    event.preventDefault();
    this.props.history.goBack();
  }

  /**
   * Handle a form field change, the input name is the path in the resource form (metadata.name, secret.password...).
   * @param {React.Event} event
   */
  handleInputChange(event) {
    const { name, value } = event.target;
    this.setField(name, value);
  }

  /**
   * Set a field of the form.
   * @param {string} name The path in the resource form
   * @param {string} value The value
   */
  setField(name, value) {
    // Typing a TOTP key on a resource without TOTP first turns it into a resource with TOTP.
    if (name.startsWith("secret.totp.") && !this.hasTotp) {
      this.resourceFormEntity.addSecret(ResourceEditCreateFormEnumerationTypes.TOTP, { validate: false });
    }
    this.resourceFormEntity.set(name, value, { validate: false });

    const newState = { resource: this.resourceFormEntity.toDto(), unexpectedErrorMessage: "" };
    if (name === "secret.password") {
      newState.passwordEntropy = value?.length ? SecretGenerator.entropy(value) : null;
      newState.passwordWarning = null;
    }
    if (this.state.errors) {
      newState.errors = this.createSanitizedResourceFormEntity(newState.resource).validate();
    }
    this.setState(newState);
  }

  handleGeneratePasswordButtonClick() {
    if (this.state.processing) {
      return;
    }
    this.setField("secret.password", SecretGenerator.generate(this.props.prepareResourceContext.settings));
  }

  /**
   * Build the entity to save: without an empty TOTP, with the secrets the resource type requires.
   * @param {object} resourceDto The resource form dto
   * @returns {ResourceFormEntity}
   */
  createSanitizedResourceFormEntity(resourceDto) {
    const resourceFormEntity = new ResourceFormEntity(resourceDto, {
      validate: false,
      resourceTypes: this.props.resourceTypes,
    });
    // As the web application does, a resource without name is saved as "no name".
    if (!resourceFormEntity.metadata.name) {
      resourceFormEntity.set("metadata.name", "no name", { validate: false });
    }
    resourceFormEntity.removeEmptySecret({ validate: false });
    resourceFormEntity.addRequiredSecret({ validate: false });
    resourceFormEntity.removeUnusedNonEmptyMetadata();
    return resourceFormEntity;
  }

  get isPasswordChanged() {
    return (this.state.resource.secret?.password || "") !== (this.state.originalSecret?.password || "");
  }

  /**
   * Check the new password, never the one the resource already had.
   * @returns {Promise<"weak"|"pwned"|null>}
   */
  async getPasswordWarning() {
    const password = this.state.resource.secret?.password;
    if (!this.hasPassword || !password || !this.isPasswordChanged) {
      return null;
    }
    if (!(this.state.passwordEntropy >= ENTROPY_THRESHOLDS.WEAK)) {
      return "weak";
    }
    if (this.pownedService) {
      const { isPwnedServiceAvailable, inDictionary } = await this.pownedService.evaluateSecret(password);
      if (isPwnedServiceAvailable && inDictionary) {
        return "pwned";
      }
    }
    return null;
  }

  async handleFormSubmit(event) {
    event.preventDefault();
    if (this.state.processing) {
      return;
    }
    this.setState({ processing: true, unexpectedErrorMessage: "" });

    const resourceFormEntity = this.createSanitizedResourceFormEntity(this.state.resource);
    const errors = resourceFormEntity.validate();
    if (errors?.hasErrors()) {
      this.setState({ errors, processing: false });
      return;
    }

    // A weak or pwned password is saved on the second click, once the user has seen the warning.
    if (!this.state.passwordWarning) {
      const passwordWarning = await this.getPasswordWarning();
      if (passwordWarning) {
        this.setState({ passwordWarning, processing: false });
        return;
      }
    }

    await this.save(resourceFormEntity);
  }

  /**
   * Save the resource, the secret is sent only when it changed. The background page encrypts it for every user who
   * has access to the resource.
   * @param {ResourceFormEntity} resourceFormEntity
   * @returns {Promise<void>}
   */
  async save(resourceFormEntity) {
    const isSecretChanged = resourceFormEntity.secret.areSecretsDifferent(this.state.originalSecret);
    const isResourceTypeChanged = this.initialResourceTypeId !== resourceFormEntity.resourceTypeId;
    if (isSecretChanged && this.isPasswordChanged && this.shouldUpdateExpirationDate) {
      resourceFormEntity.set("expired", this.resourceExpirationDate);
    }

    let secretDto = null;
    if (isSecretChanged || isResourceTypeChanged) {
      const resourceType = this.props.resourceTypes.getFirstById(resourceFormEntity.resourceTypeId);
      secretDto = resourceType.isPasswordString()
        ? resourceFormEntity.toSecretDto().password
        : resourceFormEntity.toSecretDto();
    }

    try {
      await this.props.context.port.request("passbolt.resources.update", resourceFormEntity.toResourceDto(), secretDto);
    } catch (error) {
      this.handleSaveError(error);
      return;
    }
    this.props.history.goBack();
  }

  handleSaveError(error) {
    if (error?.name === "UserAbortsOperationError" || error?.name === "UntrustedMetadataKeyError") {
      this.setState({ processing: false });
      return;
    }
    console.error(error);
    this.setState({ processing: false, unexpectedErrorMessage: error?.message || String(error) });
  }

  get shouldUpdateExpirationDate() {
    return Boolean(this.props.passwordExpiryContext.getSettings()?.automatic_update);
  }

  /**
   * @returns {string|null} The new expiration date, null when passwords do not expire by default
   */
  get resourceExpirationDate() {
    const period = this.props.passwordExpiryContext.getSettings()?.default_expiry_period;
    return period == null ? null : DateTime.utc().plus({ days: period }).toISO();
  }

  /**
   * Get the error of a field.
   * @param {"metadata"|"secret"|"totp"} association Where the field is
   * @param {string} field The field
   * @returns {boolean}
   */
  hasError(association, field) {
    const details = this.state.errors?.details;
    if (association === "totp") {
      return Boolean(details?.secret?.details?.totp?.hasError(field));
    }
    return Boolean(details?.[association]?.hasError?.(field));
  }

  get translate() {
    return this.props.t;
  }

  renderPasswordWarning() {
    if (!this.state.passwordWarning) {
      return null;
    }
    return (
      <div className="passbob-edit-warning" role="alert">
        {this.state.passwordWarning === "weak" ? (
          <Trans>This password is very weak.</Trans>
        ) : (
          <Trans>This password is in a list of leaked passwords.</Trans>
        )}{" "}
        <Trans>Save again to use it anyway.</Trans>
      </div>
    );
  }

  render() {
    if (this.state.isLoading) {
      return (
        <div className="resource-create passbob-resource-edit">
          <div className="processing-wrapper">
            <SpinnerSVG />
          </div>
        </div>
      );
    }

    const { metadata, secret } = this.state.resource;
    const disabled = this.state.processing;
    return (
      <div className="resource-create passbob-resource-edit">
        <div className="back-link">
          <a href="#" className="primary-action" onClick={this.handleGoBackClick} title={this.translate("Cancel")}>
            <CaretLeftSVG />
            <span className="primary-action-title">
              <Trans>Edit</Trans> {metadata?.name}
            </span>
          </a>
        </div>
        <form onSubmit={this.handleFormSubmit} noValidate>
          <div className="resource-create-form">
            <div className="form-container">
              <div className={`input text ${this.hasError("metadata", "name") ? "error" : ""}`}>
                <label htmlFor="edit-name">
                  <Trans>Name</Trans>
                </label>
                <input
                  id="edit-name"
                  name="metadata.name"
                  value={metadata?.name || ""}
                  onChange={this.handleInputChange}
                  disabled={disabled}
                  className="required fluid"
                  maxLength="255"
                  type="text"
                  autoComplete="off"
                />
                {this.hasError("metadata", "name") && (
                  <div className="error-message">
                    <Trans>The name is not valid.</Trans>
                  </div>
                )}
              </div>
              <div className={`input text ${this.hasError("metadata", "uris") ? "error" : ""}`}>
                <label htmlFor="edit-uri">
                  <Trans>URL</Trans>
                </label>
                <input
                  id="edit-uri"
                  name="metadata.uris.0"
                  value={metadata?.uris?.[0] || ""}
                  onChange={this.handleInputChange}
                  disabled={disabled}
                  className="fluid"
                  maxLength="1024"
                  type="text"
                  autoComplete="off"
                />
                {metadata?.uris?.length > 1 && (
                  <div className="help-message">
                    <Trans>Other URLs are kept as they are.</Trans>
                  </div>
                )}
              </div>
              {this.hasPassword && (
                <div className="input text">
                  <label htmlFor="edit-username">
                    <Trans>Username</Trans>
                  </label>
                  <input
                    id="edit-username"
                    name="metadata.username"
                    value={metadata?.username || ""}
                    onChange={this.handleInputChange}
                    disabled={disabled}
                    className="fluid"
                    maxLength="255"
                    type="text"
                    autoComplete="off"
                  />
                </div>
              )}
              {this.hasPassword && (
                <div className="input-password-wrapper input">
                  <label htmlFor="edit-password">
                    <Trans>Password</Trans>
                  </label>
                  <div className="password-button-inline">
                    <Password
                      id="edit-password"
                      name="secret.password"
                      value={secret?.password || ""}
                      preview={true}
                      onChange={this.handleInputChange}
                      disabled={disabled}
                      autoComplete="new-password"
                      placeholder={this.translate("Password")}
                    />
                    <button
                      type="button"
                      onClick={this.handleGeneratePasswordButtonClick}
                      className={`password-generate button-icon button ${disabled ? "disabled" : ""}`}
                    >
                      <DiceSVG />
                      <span className="visually-hidden">
                        <Trans>Generate</Trans>
                      </span>
                    </button>
                  </div>
                  <PasswordComplexity entropy={this.state.passwordEntropy} />
                  {this.renderPasswordWarning()}
                </div>
              )}
              {this.canAddTotp && (
                <div className={`input text ${this.hasError("totp", "secret_key") ? "error" : ""}`}>
                  <label htmlFor="edit-totp">
                    <Trans>Authenticator key (TOTP)</Trans>
                  </label>
                  <input
                    id="edit-totp"
                    name="secret.totp.secret_key"
                    value={secret?.totp?.secret_key || ""}
                    onChange={this.handleInputChange}
                    disabled={disabled}
                    className="fluid passbob-totp-key"
                    maxLength="1024"
                    type="text"
                    autoComplete="off"
                    spellCheck="false"
                  />
                  {this.hasError("totp", "secret_key") && (
                    <div className="error-message">
                      <Trans>The key is not valid.</Trans>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="submit-wrapper input">
            <button
              type="submit"
              className={`button primary big full-width ${disabled ? "processing" : ""}`}
              disabled={disabled}
            >
              {this.state.passwordWarning ? <Trans>Save anyway</Trans> : <Trans>Save</Trans>}
              {disabled && <SpinnerSVG />}
            </button>
            {this.state.unexpectedErrorMessage && (
              <div className="error-message">{this.state.unexpectedErrorMessage}</div>
            )}
          </div>
        </form>
      </div>
    );
  }
}

ResourceEditPage.propTypes = {
  context: PropTypes.any, // The application context
  resourceTypes: PropTypes.instanceOf(ResourceTypesCollection), // The resource types
  activeSession: PropTypes.instanceOf(UserActiveSessionEntity), // The active session
  prepareResourceContext: PropTypes.any, // The password generator settings
  passwordPoliciesContext: PropTypes.object, // The password policies
  passwordExpiryContext: PropTypes.object, // The password expiry settings
  match: PropTypes.object,
  history: PropTypes.object,
  t: PropTypes.func, // The translation function
};

export { ResourceEditPage };

export default withAppContext(
  withRouter(
    withActiveSessionLocalStorage(
      withResourceTypesLocalStorage(
        withPrepareResourceContext(
          withPasswordExpiry(withPasswordPolicies(withTranslation("common")(ResourceEditPage))),
        ),
      ),
    ),
  ),
);
