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
import { Link } from "react-router-dom";
import { Trans, withTranslation } from "react-i18next";
import SpinnerSVG from "../../../img/svg/spinner.svg";

/**
 * The tones of the letter tile, picked from the resource name so a resource keeps its color.
 */
const AVATAR_TONES = ["indigo", "amber", "green", "blue", "pink"];

/**
 * The copy actions of a row.
 */
export const COPY_ACTIONS = Object.freeze({
  USERNAME: "username",
  PASSWORD: "password",
  TOTP: "totp",
});

const UserIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
  </svg>
);

const KeyIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="8" cy="15" r="4" />
    <path d="M11 12l9-9M17 6l3 3M15 8l2 2" />
  </svg>
);

const ClockIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const PencilIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 20h4L19 9l-4-4L4 16z" />
    <path d="M14 6l4 4" />
  </svg>
);

const CheckIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12l5 5 9-10" />
  </svg>
);

/**
 * The host of a URL, without www.
 * @param {string} uri The URL
 * @returns {string}
 */
export const getHost = (uri) => {
  if (!uri) {
    return "";
  }
  try {
    return new URL(uri.includes("://") ? uri : `https://${uri}`).hostname.replace(/^www\./, "");
  } catch {
    return uri;
  }
};

/**
 * Passbob: a resource of the quickaccess home, its fill and copy actions on hover, focus or keyboard selection.
 */
class PassbobResourceRow extends React.Component {
  /**
   * The tone of the letter tile.
   * @param {string} name The resource name
   * @returns {string}
   */
  static getTone(name = "") {
    let hash = 0;
    for (const char of name) {
      hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }
    return AVATAR_TONES[hash % AVATAR_TONES.length];
  }

  get translate() {
    return this.props.t;
  }

  renderCopyButton(action, label, Icon) {
    const { copyState, resource } = this.props;
    const isThisAction = copyState?.resourceId === resource.id && copyState?.action === action;
    return (
      <button
        type="button"
        className="passbob-row-action"
        title={label}
        aria-label={label}
        onClick={() => this.props.onCopy(resource, action)}
        disabled={isThisAction && copyState.status === "processing"}
      >
        {isThisAction && copyState.status === "processing" && <SpinnerSVG />}
        {isThisAction && copyState.status === "done" && <CheckIcon />}
        {!(isThisAction && copyState.status) && <Icon />}
      </button>
    );
  }

  render() {
    const { resource, isSelected, canFill, canEdit, canCopySecret, hasTotp, hasPassword, isFilling } = this.props;
    const name = resource.metadata?.name || "";
    const username = resource.metadata?.username;
    const host = getHost(resource.metadata?.uris?.[0]);
    const subtitle = [username, host].filter(Boolean).join(" · ");
    const viewPath = `/webAccessibleResources/quickaccess/resources/view/${resource.id}`;

    return (
      <li
        className={`passbob-row ${isSelected ? "selected" : ""}`}
        aria-selected={isSelected}
        onMouseEnter={() => this.props.onHover?.(resource)}
      >
        <Link to={viewPath} className="passbob-row-main" title={this.translate("Open {{name}}", { name })}>
          <span className={`passbob-avatar tone-${PassbobResourceRow.getTone(name)}`} aria-hidden="true">
            {name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="passbob-row-text">
            <span className="passbob-row-name">{name}</span>
            {subtitle && <span className="passbob-row-subtitle">{subtitle}</span>}
          </span>
        </Link>
        <span className="passbob-row-actions">
          {username && this.renderCopyButton(COPY_ACTIONS.USERNAME, this.translate("Copy username"), UserIcon)}
          {canCopySecret &&
            hasPassword &&
            this.renderCopyButton(COPY_ACTIONS.PASSWORD, this.translate("Copy password"), KeyIcon)}
          {canCopySecret &&
            hasTotp &&
            this.renderCopyButton(COPY_ACTIONS.TOTP, this.translate("Copy one-time code"), ClockIcon)}
          {canEdit && (
            <Link
              to={`/webAccessibleResources/quickaccess/resources/edit/${resource.id}`}
              className="passbob-row-action"
              title={this.translate("Edit")}
              aria-label={this.translate("Edit")}
            >
              <PencilIcon />
            </Link>
          )}
          {canFill && (
            <button
              type="button"
              className="passbob-fill-button"
              onClick={() => this.props.onFill(resource)}
              disabled={isFilling}
            >
              {isFilling ? <SpinnerSVG /> : <Trans>Fill</Trans>}
            </button>
          )}
        </span>
      </li>
    );
  }
}

PassbobResourceRow.propTypes = {
  resource: PropTypes.object.isRequired, // The resource
  isSelected: PropTypes.bool, // Selected with the keyboard
  canFill: PropTypes.bool, // The resource matches the page, it can be filled in
  canEdit: PropTypes.bool, // The user can update the resource
  canCopySecret: PropTypes.bool, // The user can copy secrets (RBAC)
  hasPassword: PropTypes.bool, // The resource type has a password
  hasTotp: PropTypes.bool, // The resource type has a TOTP
  isFilling: PropTypes.bool, // The resource is being filled in
  copyState: PropTypes.object, // The last copy {resourceId, action, status: processing|done}
  onFill: PropTypes.func, // Fill the resource on the page
  onCopy: PropTypes.func, // Copy a field (resource, action)
  onHover: PropTypes.func, // The mouse is on the row
  t: PropTypes.func, // The translation function
};

export default withTranslation("common")(PassbobResourceRow);
