/**
 * Passbolt ~ Open source password manager for teams
 * Copyright (c) 2023 Passbolt SA (https://www.passbolt.com)
 *
 * Licensed under GNU Affero General Public License version 3 of the or any later version.
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) 2023 Passbolt SA (https://www.passbolt.com)
 * @license       https://opensource.org/licenses/AGPL-3.0 AGPL License
 * @link          https://www.passbolt.com Passbolt(tm)
 * @since         4.1.0
 */

import { fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";
import { Router } from "react-router-dom";
import HomePage from "./HomePage";
import MockTranslationProvider from "../../../react-extension/test/mock/components/Internationalisation/MockTranslationProvider";
import { createMemoryHistory } from "history";

/**
 * The HomePage component represented as a page
 */
export default class HomePagePage {
  /**
   * Default constructor
   * @param props Props to attach
   */
  constructor(props) {
    this._page = render(
      <MockTranslationProvider>
        <Router history={props.history || createMemoryHistory()}>
          <HomePage {...props} />
        </Router>
      </MockTranslationProvider>,
    );
  }

  /**
   * The sections of the home: the page's resources and the recently used ones, or the search results.
   * @returns {NodeListOf<HTMLElement>}
   */
  get sections() {
    return this._page.container.querySelectorAll(".passbob-section");
  }

  /**
   * Returns the content of the page's resources section (or of the search results)
   * @returns {HTMLElement}
   */
  get suggestedResourcesContent() {
    return this.sections[0];
  }

  /**
   * Returns the suggested resources if any
   * @returns {NodeListOf<HTLMElement>}
   */
  get suggestedResourcesEntries() {
    return this.sections[0]?.querySelectorAll(".passbob-row") || [];
  }

  /**
   * Returns a suggested resource if any
   * @returns {HTLMElement | null}
   */
  getSuggestedResourceItem(index) {
    return this.suggestedResourcesEntries?.[index] || null;
  }

  /**
   * Returns a browsed resource if any
   * @returns {HTLMElement | null}
   */
  getBrowsedResourceItem(index) {
    return this.browsedResources?.[index] || null;
  }

  /**
   * Returns the search results
   * @returns {NodeListOf<Element>}
   */
  get browsedResources() {
    return this.sections[0]?.querySelectorAll(".passbob-row") || [];
  }

  /**
   * Returns the content of the search results section
   * @returns {HTMLElement}
   */
  get browsedResourcesContent() {
    return this.sections[0];
  }

  /**
   * Returns the filter chips (All excluded)
   * @returns {NodeListOf<Element>}
   */
  get chips() {
    return this._page.container.querySelectorAll(".passbob-chips a.passbob-chip");
  }

  /**
   * Returns the chip leading to a route, null if none
   * @param {string} route The end of the route
   * @returns {HTMLElement|null}
   */
  getChip(route) {
    return this._page.container.querySelector(`.passbob-chips a[href="/webAccessibleResources/quickaccess/${route}"]`);
  }

  /**
   * Has tag filter entry?
   * @returns {boolean}
   */
  get hasTagFilterEntry() {
    return Boolean(this.getChip("resources/tag"));
  }

  /**
   * Returns the Groups filter entry
   * @returns {HTMLElement|null}
   */
  get groupsFilterEntry() {
    return this.getChip("resources/group");
  }

  /**
   * Returns the create button
   * @returns {HTMLElement}
   */
  get createButton() {
    return this._page.container.querySelector(".passbob-home-footer #popupAction");
  }

  /**
   * Returns error message if any
   * @returns {HTMLElement}
   */
  get useOnThisTabError() {
    return this._page.container.querySelector(".passbob-home-error");
  }

  /**
   * Simulates a click on the Fill button of the nth suggested resource
   * @returns {Promise<void>}
   */
  async clickOnSuggestedResource(index) {
    const element = this.getSuggestedResourceItem(index)?.querySelector(".passbob-fill-button");
    fireEvent.click(element, { button: 0 });
    await waitFor(() => {});
  }

  /**
   * Simulates a click on the Fill button of the nth search result
   * @returns {Promise<void>}
   */
  async clickOnBrowsedResource(index) {
    const element = this.getBrowsedResourceItem(index)?.querySelector(".passbob-fill-button");
    fireEvent.click(element, { button: 0 });
    await waitFor(() => {});
  }

  /**
   * Simulates a click on the create button
   * @returns {Promise<void>}
   */
  async clickOnCreateButton() {
    fireEvent.click(this.createButton, { button: 0 });
    await waitFor(() => {});
  }
}
