/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         4.1.0
 */

import React from "react";
import { Link, withRouter } from "react-router-dom";
import PropTypes from "prop-types";
import { Trans, withTranslation } from "react-i18next";
import SpinnerSVG from "../../../img/svg/spinner.svg";
import { withRbac } from "../../../shared/context/Rbac/RbacContext";
import { uiActions } from "../../../shared/services/rbacs/uiActionEnumeration";
import { withAppContext } from "../../../shared/context/AppContext/AppContext";
import { filterResourcesBySearch } from "../../../shared/utils/filterUtils";
import PassbobStorageService from "../../../shared/services/passbob/passbobStorageService";
import { withResourcesLocalStorage } from "../../contexts/ResourceLocalStorageContext";
import memoize from "memoize-one";
import { withResourceTypesLocalStorage } from "../../../shared/context/ResourceTypesLocalStorageContext/ResourceTypesLocalStorageContext";
import ResourceTypesCollection from "../../../shared/models/entity/resourceType/resourceTypesCollection";
import { withMetadataTypesSettingsLocalStorage } from "../../../shared/context/MetadataTypesSettingsLocalStorageContext/MetadataTypesSettingsLocalStorageContext";
import MetadataTypesSettingsEntity from "../../../shared/models/entity/metadata/metadataTypesSettingsEntity";
import {
  RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION_SLUG,
  RESOURCE_TYPE_V5_DEFAULT_SLUG,
} from "../../../shared/models/entity/resourceType/resourceTypeSchemasDefinition";
import CanSuggestService from "../../../shared/services/canSuggestService/canSuggestService";
import MetadataKeysSettingsEntity from "../../../shared/models/entity/metadata/metadataKeysSettingsEntity";
import { withMetadataKeysSettingsLocalStorage } from "../../../shared/context/MetadataKeysSettingsLocalStorageContext/MetadataKeysSettingsLocalStorageContext";
import { sortResourcesByUriMatchingScore } from "../../../shared/utils/sortUtils";
import { withActiveSessionLocalStorage } from "../../../shared/context/ActiveSession/ActiveSessionLocalStorageContext";
import UserActiveSessionEntity from "../../../shared/models/entity/session/userActiveSessionEntity";
import PassbobResourceRow, { COPY_ACTIONS, getHost } from "../PassbobResourceRow/PassbobResourceRow";
import { ResourceEditPage } from "../ResourceEditPage/ResourceEditPage";
import SecretServiceWorkerService from "../../../shared/services/serviceWorker/secret/secretServiceWorkerService";
import ClipboardServiceWorkerService from "../../../shared/services/serviceWorker/clipboard/clipboardServiceWorkerService";
import { TotpCodeGeneratorService } from "../../../shared/services/otp/TotpCodeGeneratorService";

const SUGGESTED_RESOURCES_LIMIT = 20;
const BROWSED_RESOURCES_LIMIT = 100;
// Passbob: how many recently used resources the home shows, how long a copy shows its check mark.
const RECENT_RESOURCES_SHOWN = 5;
const COPY_DONE_DELAY_IN_MS = 1500;
const VIEW_ROUTE = "/webAccessibleResources/quickaccess/resources/view";

class HomePage extends React.Component {
  /**
   * Should be true after the first HomePage mount
   * @type {boolean}
   * @private
   */
  static isInitialised = false;

  /**
   * Default constructor
   * @param props The component props
   */
  constructor(props) {
    super(props);
    this.state = this.defaultState;
    this.initEventHandlers();
  }

  /**
   * Returns the component default state
   * @return {object}
   */
  get defaultState() {
    return {
      activeTabUrl: null,
      usingOnThisTab: false,
      fillingResourceId: null, // Passbob: the resource being filled in
      recentResourceIds: [], // Passbob: the resources used last
      copyState: null, // Passbob: the last copy {resourceId, action, status}
      selectedIndex: 0, // Passbob: the row selected with the keyboard
      actionError: null, // Passbob: why the last copy failed
    };
  }

  /**
   * ComponentDidMount hook.
   * Invoked immediately after component is inserted into the tree
   */
  componentDidMount() {
    /*
     * Given the specific nature of QuickA's usage—focused on quickly consuming and creating passwords rather
     * than ongoing resource management — The local storage should be updated only the first time the application
     * is open.
     */
    if (!HomePage.isInitialised && this.props.activeSession.isSessionOnline) {
      this.props.resourcesLocalStorageContext.updateLocalStorage();
      HomePage.isInitialised = true;
    }

    // Reset the search and any search history, or restore the search of the last view (Passbob).
    this.props.context.searchHistory = [];
    this.props.context.updateSearch(this.props.location?.state?.passbobRestoredSearch || "");

    this.loadActiveTabUrl();
    this.loadRecentResourceIds();
    document.addEventListener("keydown", this.handleKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.handleKeyDown);
    clearTimeout(this.copyDoneTimeout);
  }

  /**
   * Passbob: go back to the first row when the search changes.
   * @param {object} prevProps The previous props
   */
  componentDidUpdate(prevProps) {
    if (prevProps.context.search !== this.props.context.search && this.state.selectedIndex !== 0) {
      this.setState({ selectedIndex: 0 });
    }
  }

  /**
   * Passbob: load the resources used last.
   * @returns {Promise<void>}
   */
  async loadRecentResourceIds() {
    const recentResourceIds = await PassbobStorageService.getRecentResourceIds(this.props.context.storage);
    this.setState({ recentResourceIds });
  }

  /**
   * Initialize the component event handlers
   */
  initEventHandlers() {
    this.handleUseOnThisTabClick = this.handleUseOnThisTabClick.bind(this);
    this.handleCopy = this.handleCopy.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleRowHover = this.handleRowHover.bind(this);
  }

  /**
   * Loads the currently active tab URL, if any, into the state.
   * @returns {Promise<void>}
   */
  async loadActiveTabUrl() {
    try {
      const activeTabUrl = await this.props.context.port.request(
        "passbolt.active-tab.get-url",
        this.props.context.openerTabId,
      );
      this.setState({ activeTabUrl });
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * Get the resources for the suggested section.
   * @param {Array} resources The list of resources to filter.
   * @param {string} activeTabUrl the active tab url
   * @return {Array<Object>} The list of filtered resources.
   */
  filterSuggestedResources = memoize((resources, activeTabUrl) => {
    if (!activeTabUrl) {
      return [];
    }

    const suggestedResources = [];

    for (const i in resources) {
      const resource = resources[i];
      if (CanSuggestService.canSuggestUris(activeTabUrl, resource.metadata.uris)) {
        suggestedResources.push(resource);
        if (suggestedResources.length === SUGGESTED_RESOURCES_LIMIT) {
          break;
        }
      }
    }

    return sortResourcesByUriMatchingScore(suggestedResources, activeTabUrl);
  });

  /**
   * Get the resources for the browse section.
   * @param {array} resources The list of resources to filter.
   * @param {string} search the current search to apply
   * @returns {Array<Object>} The list of resources.
   */
  filterSearchedResources = memoize((resources, search) => {
    if (search && resources) {
      return filterResourcesBySearch(resources, search, BROWSED_RESOURCES_LIMIT);
    }
    return [];
  });

  /**
   * Handles the click event of the button "Use on this tab".
   * @returns {Promise<void>}
   */
  async handleUseOnThisTabClick(resource) {
    if (this.state.usingOnThisTab) {
      return;
    }
    this.setState({ usingOnThisTab: true, fillingResourceId: resource.id, useOnThisTabError: null });
    PassbobStorageService.addRecentResourceId(this.props.context.storage, resource.id);
    try {
      await this.props.context.port.request(
        "passbolt.quickaccess.use-resource-on-current-tab",
        resource.id,
        this.props.context.openerTabId,
      );
      // Passbob: stay open on the filled resource so the user can still copy a field if the page did not take it.
      const settings = await PassbobStorageService.getSettings(this.props.context.storage);
      if (settings.closeAfterAutofill) {
        await this.props.context.closeWindow();
        return;
      }
      this.props.history.push(`/webAccessibleResources/quickaccess/resources/view/${resource.id}`, {
        passbobFilled: true,
      });
    } catch (error) {
      if (error && error.name === "UserAbortsOperationError") {
        this.setState({ usingOnThisTab: false, fillingResourceId: null });
      } else {
        console.error("An error occured", error);
        this.setState({
          usingOnThisTab: false,
          fillingResourceId: null,
          useOnThisTabError: this.props.t(
            "Unable to use the password on this page. Copy and paste the information instead.",
          ),
        });
      }
    }
  }

  /**
   * Passbob: copy a field of a resource, secrets are decrypted on demand and cleared from the clipboard later.
   * @param {object} resource The resource
   * @param {string} action One of COPY_ACTIONS
   * @returns {Promise<void>}
   */
  async handleCopy(resource, action) {
    if (this.state.copyState?.status === "processing") {
      return;
    }
    const clipboard = new ClipboardServiceWorkerService(this.props.context.port);
    this.setState({ copyState: { resourceId: resource.id, action, status: "processing" }, actionError: null });
    try {
      if (action === COPY_ACTIONS.USERNAME) {
        await clipboard.copy(resource.metadata?.username || "");
      } else {
        if (!this.canCopySecret) {
          throw new Error(this.props.t("You are not allowed to copy secrets."));
        }
        const secretService = new SecretServiceWorkerService(this.props.context.port, this.props.activeSession);
        const secret = await secretService.findByResourceId(resource.id);
        const value = action === COPY_ACTIONS.TOTP ? this.generateTotpCode(secret) : this.getPassword(secret);
        if (!value) {
          throw new Error(
            action === COPY_ACTIONS.TOTP
              ? this.props.t("This resource has no one-time code.")
              : this.props.t("The password is empty and cannot be copied to clipboard."),
          );
        }
        await clipboard.copyTemporarily(value);
      }
      PassbobStorageService.addRecentResourceId(this.props.context.storage, resource.id);
      this.setState({ copyState: { resourceId: resource.id, action, status: "done" } });
      clearTimeout(this.copyDoneTimeout);
      this.copyDoneTimeout = setTimeout(() => this.setState({ copyState: null }), COPY_DONE_DELAY_IN_MS);
    } catch (error) {
      this.setState({ copyState: null });
      if (error?.name !== "UserAbortsOperationError") {
        console.error(error);
        this.setState({ actionError: error?.message || String(error) });
      }
    }
  }

  /**
   * @param {object|string} secret The decrypted secret, a string for the legacy password string resources
   * @returns {string}
   */
  getPassword(secret) {
    return typeof secret === "string" ? secret : secret?.password;
  }

  /**
   * @param {object} secret The decrypted secret
   * @returns {string|null}
   */
  generateTotpCode(secret) {
    return secret?.totp ? TotpCodeGeneratorService.generate(secret.totp) : null;
  }

  /**
   * Passbob: the mouse selects the row it is on, as the keyboard does.
   * @param {object} resource The resource
   */
  handleRowHover(resource) {
    const index = this.visibleRows.findIndex((row) => row.resource.id === resource.id);
    if (index >= 0 && index !== this.state.selectedIndex) {
      this.setState({ selectedIndex: index });
    }
  }

  /**
   * Passbob: arrows select a row, Enter fills it (or opens it), C copies its password, T its one-time code, / goes to
   * the search. Letters are left to the inputs.
   * @param {KeyboardEvent} event
   */
  handleKeyDown(event) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const rows = this.visibleRows;
    const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName);
    const selected = rows[Math.min(this.state.selectedIndex, rows.length - 1)];

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (rows.length === 0) {
        return;
      }
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const selectedIndex = (this.state.selectedIndex + step + rows.length) % rows.length;
      this.setState({ selectedIndex });
    } else if (event.key === "Enter" && selected && (isTyping || event.target === document.body)) {
      event.preventDefault();
      if (selected.canFill) {
        this.handleUseOnThisTabClick(selected.resource);
      } else {
        this.props.history.push(`${VIEW_ROUTE}/${selected.resource.id}`);
      }
    } else if (!isTyping && selected && (event.key === "c" || event.key === "C")) {
      event.preventDefault();
      this.handleCopy(selected.resource, COPY_ACTIONS.PASSWORD);
    } else if (!isTyping && selected && (event.key === "t" || event.key === "T")) {
      event.preventDefault();
      this.handleCopy(selected.resource, COPY_ACTIONS.TOTP);
    } else if (!isTyping && event.key === "/") {
      event.preventDefault();
      document.querySelector(".search-wrapper input[name='search']")?.focus();
    }
  }

  /**
   * Passbob: whether the user may copy secrets.
   * @returns {boolean}
   */
  get canCopySecret() {
    return this.props.rbacContext.canIUseAction(uiActions.SECRETS_COPY);
  }

  /**
   * Passbob: the host of the page the quickaccess is used on.
   * @returns {string}
   */
  get activeTabHost() {
    return getHost(this.state.activeTabUrl);
  }

  /**
   * Passbob: the rows of the home, in display order: the page's resources and the recently used ones, or the search
   * results. Computed on each render from the resources.
   * @returns {Array<{resource: object, canFill: boolean, section: string}>}
   */
  get visibleRows() {
    return this._visibleRows || [];
  }

  /**
   * Passbob: the resources used last, the page's ones excluded.
   * @param {Array} resources The resources
   * @param {Array<string>} recentIds The ids used last
   * @param {Array} excluded The resources already shown
   * @returns {Array}
   */
  filterRecentResources = memoize((resources, recentIds, excluded) => {
    const excludedIds = new Set(excluded.map((resource) => resource.id));
    const byId = new Map(resources.map((resource) => [resource.id, resource]));
    return recentIds
      .map((id) => byId.get(id))
      .filter((resource) => resource && !excludedIds.has(resource.id))
      .slice(0, RECENT_RESOURCES_SHOWN);
  });

  /**
   * Is password resource
   * @param {string} resourceTypeId
   * @returns {boolean}
   */
  isPasswordResource(resourceTypeId) {
    return this.props.resourceTypes?.getFirstById(resourceTypeId)?.hasPassword();
  }

  /**
   * Is OTP resource
   * @param {string} resourceTypeId
   * @returns {boolean}
   */
  isOTPResource(resourceTypeId) {
    return this.props.resourceTypes?.getFirstById(resourceTypeId)?.hasTotp();
  }

  /**
   * Get resource filtered by resource type to have only resource with password and totp
   * @return {Array}
   */
  get resourcesFilterByResourceTypePasswordAndTotp() {
    const keepOnlyResourcesPasswordAndTotp = (resource) =>
      this.isPasswordResource(resource.resource_type_id) || this.isOTPResource(resource.resource_type_id);
    return this.props.resources.filter(keepOnlyResourcesPasswordAndTotp);
  }

  /**
   * Has metadata types settings
   * @returns {boolean}
   */
  hasMetadataTypesSettings() {
    return Boolean(this.props.metadataTypeSettings);
  }

  /**
   * Can create password
   * @returns {boolean}
   */
  canCreatePassword() {
    // Creating a resource requires the server, the action is not offered while in an offline session.
    if (!this.props.activeSession?.isSessionOnline) {
      return false;
    }
    if (this.props.metadataTypeSettings.isDefaultResourceTypeV5) {
      return this.props.resourceTypes?.hasOneWithSlug(RESOURCE_TYPE_V5_DEFAULT_SLUG);
    } else if (this.props.metadataTypeSettings.isDefaultResourceTypeV4) {
      return this.props.resourceTypes?.hasOneWithSlug(RESOURCE_TYPE_PASSWORD_AND_DESCRIPTION_SLUG);
    } else {
      return false;
    }
  }

  /**
   * User has missing keys
   * @return {boolean}
   */
  get userHasMissingKeys() {
    return this.props.context.loggedInUser.missing_metadata_key_ids?.length > 0;
  }

  /**
   * Should display action aborted missing metadata keys
   * @return {boolean}
   */
  get shouldDisplayActionAbortedMissingMetadataKeys() {
    return (
      this.props.metadataTypeSettings.isDefaultResourceTypeV5 &&
      this.userHasMissingKeys &&
      !this.props.metadataKeysSettings?.allowUsageOfPersonalKeys
    );
  }

  /**
   * Passbob: the filters of the home, as chips.
   * @returns {JSX}
   */
  renderChips() {
    const canUseTag =
      this.props.context.siteSettings.canIUse("tags") && this.props.rbacContext.canIUseAction(uiActions.TAGS_USE);
    // The groups are retrieved from the API, the filter is not offered while in an offline session.
    const isSessionOnline = Boolean(this.props.activeSession?.isSessionOnline);
    const chips = [
      { to: "/webAccessibleResources/quickaccess/resources/favorite", label: this.props.t("Favorites") },
      { to: "/webAccessibleResources/quickaccess/resources/recently-modified", label: this.props.t("Recent") },
      { to: "/webAccessibleResources/quickaccess/resources/shared-with-me", label: this.props.t("Shared with me") },
      isSessionOnline && { to: "/webAccessibleResources/quickaccess/resources/group", label: this.props.t("Groups") },
      canUseTag && { to: "/webAccessibleResources/quickaccess/resources/tag", label: this.props.t("Tags") },
      { to: "/webAccessibleResources/quickaccess/more-filters", label: this.props.t("More") },
    ].filter(Boolean);
    return (
      <nav className="passbob-chips" aria-label={this.props.t("Filters")}>
        <span className="passbob-chip active" aria-current="page">
          <Trans>All</Trans>
        </span>
        {chips.map((chip) => (
          <Link key={chip.to} to={chip.to} className="passbob-chip">
            {chip.label}
          </Link>
        ))}
      </nav>
    );
  }

  /**
   * Passbob: a list of resource rows.
   * @param {Array<{resource: object, canFill: boolean}>} rows The rows of the section
   * @param {number} offset The index of the first row among all the rows
   * @returns {JSX}
   */
  renderRows(rows, offset) {
    return (
      <ul className="passbob-rows">
        {rows.map(({ resource, canFill }, index) => (
          <PassbobResourceRow
            key={resource.id}
            resource={resource}
            isSelected={offset + index === this.state.selectedIndex}
            canFill={canFill}
            canEdit={ResourceEditPage.canEdit(resource, this.props.activeSession)}
            canCopySecret={this.canCopySecret}
            hasPassword={Boolean(this.isPasswordResource(resource.resource_type_id))}
            hasTotp={Boolean(this.isOTPResource(resource.resource_type_id))}
            isFilling={this.state.fillingResourceId === resource.id}
            copyState={this.state.copyState}
            onFill={this.handleUseOnThisTabClick}
            onCopy={this.handleCopy}
            onHover={this.handleRowHover}
          />
        ))}
      </ul>
    );
  }

  /**
   * Passbob: a section title with an optional count.
   * @param {string|JSX} title The title
   * @param {string} [aside] The text on the right
   * @returns {JSX}
   */
  renderSectionTitle(title, aside) {
    return (
      <div className="passbob-section-title">
        <h2>{title}</h2>
        {aside && <span>{aside}</span>}
      </div>
    );
  }

  renderEmpty(text) {
    return <p className="passbob-empty">{text}</p>;
  }

  /**
   * Component renderer.
   * @returns {JSX}
   */
  render() {
    const isReady = this.props.resources !== null && this.props.resourceTypes != null;
    const hasSearch = this.props.context.search?.length > 0;
    let browsedResources = [];
    let suggestedResources = [];
    let recentResources = [];

    if (isReady) {
      const resources = this.resourcesFilterByResourceTypePasswordAndTotp;
      browsedResources = this.filterSearchedResources(resources, this.props.context.search);
      suggestedResources = this.filterSuggestedResources(resources, this.state.activeTabUrl);
      recentResources = this.filterRecentResources(resources, this.state.recentResourceIds, suggestedResources);
    }

    const suggestedIds = new Set(suggestedResources.map((resource) => resource.id));
    const suggestedRows = suggestedResources.map((resource) => ({ resource, canFill: true }));
    const recentRows = recentResources.map((resource) => ({ resource, canFill: false }));
    const searchRows = browsedResources.map((resource) => ({ resource, canFill: suggestedIds.has(resource.id) }));
    this._visibleRows = hasSearch ? searchRows : [...suggestedRows, ...recentRows];
    const host = this.activeTabHost;

    return (
      <div className="passbob-home">
        {this.renderChips()}
        <div className="passbob-home-list">
          {!isReady && (
            <div className="passbob-loading">
              <SpinnerSVG />
              <Trans>Retrieving your passwords</Trans>
            </div>
          )}
          {isReady && !hasSearch && (
            <>
              <section className="passbob-section">
                {this.renderSectionTitle(
                  host ? this.props.t("This page · {{host}}", { host }) : this.props.t("This page"),
                  suggestedRows.length > 0 ? this.props.t("{{count}} match", { count: suggestedRows.length }) : null,
                )}
                {suggestedRows.length > 0
                  ? this.renderRows(suggestedRows, 0)
                  : this.renderEmpty(this.props.t("Nothing saved for this page. Search, or create it."))}
              </section>
              {recentRows.length > 0 && (
                <section className="passbob-section">
                  {this.renderSectionTitle(this.props.t("Recently used"))}
                  {this.renderRows(recentRows, suggestedRows.length)}
                </section>
              )}
            </>
          )}
          {isReady && hasSearch && (
            <section className="passbob-section">
              {this.renderSectionTitle(
                this.props.t("Results"),
                this.props.t("{{count}} found", { count: searchRows.length }),
              )}
              {searchRows.length > 0
                ? this.renderRows(searchRows, 0)
                : this.renderEmpty(this.props.t("No result match your search. Try with another search term."))}
            </section>
          )}
        </div>
        {(this.state.useOnThisTabError || this.state.actionError) && (
          <div className="passbob-home-error error-message" role="alert">
            {this.state.useOnThisTabError || this.state.actionError}
          </div>
        )}
        <footer className="passbob-home-footer">
          <span className="passbob-shortcuts" aria-hidden="true">
            <span>
              <kbd>↑↓</kbd> <Trans>select</Trans>
            </span>
            <span>
              <kbd>↵</kbd> <Trans>fill</Trans>
            </span>
            <span>
              <kbd>C</kbd> <Trans>password</Trans>
            </span>
            <span>
              <kbd>T</kbd> <Trans>code</Trans>
            </span>
          </span>
          {this.hasMetadataTypesSettings() && this.canCreatePassword() && (
            <Link
              to={`/webAccessibleResources/quickaccess/resources/${this.shouldDisplayActionAbortedMissingMetadataKeys ? "action-aborted-missing-metadata-keys" : "create"}`}
              id="popupAction"
              className="passbob-new-button"
              role="button"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              <Trans>New</Trans>
            </Link>
          )}
        </footer>
      </div>
    );
  }
}

HomePage.propTypes = {
  context: PropTypes.any, // The application context
  rbacContext: PropTypes.any, // The role based access control context
  resources: PropTypes.array, // The resources from the local storage
  resourceTypes: PropTypes.instanceOf(ResourceTypesCollection), // The resource types collection
  resourcesLocalStorageContext: PropTypes.object, // The resources local storage context
  metadataTypeSettings: PropTypes.instanceOf(MetadataTypesSettingsEntity), // The metadata type settings
  metadataKeysSettings: PropTypes.instanceOf(MetadataKeysSettingsEntity), // The metadata key settings
  activeSession: PropTypes.instanceOf(UserActiveSessionEntity), // The user active session
  t: PropTypes.func, // The translation function
};

export default withActiveSessionLocalStorage(
  withAppContext(
    withRbac(
      withRouter(
        withResourceTypesLocalStorage(
          withResourcesLocalStorage(
            withMetadataTypesSettingsLocalStorage(
              withMetadataKeysSettingsLocalStorage(withTranslation("common")(HomePage)),
            ),
          ),
        ),
      ),
    ),
  ),
);
