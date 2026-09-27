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
import { withAppContext } from "../../../shared/context/AppContext/AppContext";
import PassbobStorageService from "../../../shared/services/passbob/passbobStorageService";

const LOGIN_ROUTES = ["/webAccessibleResources/quickaccess/login", "/webAccessibleResources/quickaccess/login-offline"];

/**
 * Remembers the current quickaccess route and search so the popup can reopen where the user left it.
 * Renders nothing.
 */
export class PassbobRouteTracker extends React.Component {
  componentDidMount() {
    this.unlisten = this.props.history.listen((location) => this.handleLocationChange(location));
  }

  componentDidUpdate(prevProps) {
    if (prevProps.context.search !== this.props.context.search) {
      this.save(this.props.location.pathname);
    }
  }

  componentWillUnmount() {
    this.unlisten?.();
  }

  /**
   * Handle a route change.
   * @param {object} location The new location
   */
  handleLocationChange(location) {
    if (LOGIN_ROUTES.includes(location.pathname)) {
      // The user is signed out: never bring them back to a previous page after the next sign in.
      PassbobStorageService.clearLastView(this.props.context.storage);
      return;
    }
    this.save(location.pathname);
  }

  /**
   * Save the route with the current search.
   * @param {string} pathname The route pathname
   */
  save(pathname) {
    PassbobStorageService.saveLastView(this.props.context.storage, {
      pathname,
      search: this.props.context.search || "",
    });
  }

  render() {
    return null;
  }
}

PassbobRouteTracker.propTypes = {
  context: PropTypes.any, // The application context
  history: PropTypes.object, // The router history
  location: PropTypes.object, // The router location
};

export default withRouter(withAppContext(PassbobRouteTracker));
