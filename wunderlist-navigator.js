'use strict';

/**
 * WunderlistNavigator
 *
 * This file is part of the WunderlistNavigator; an opensource Google Chrome extension
 * https://github.com/pedrocatre/wunderlist-navigator
 *
 * MIT (c) Pedro Catré <http://pedrocatre.com/>
 */
(function(){

    /**
     * Configuration constants for the extension
     *
     * @type {Object}
     */
    var Config = {

        // Default favicon to use
        DEFAULT_FAVICON: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAMklEQVR4AWMgEkT9R4INWBUgKX0Q1YBXQYQCkhKEMDILogSnAhhEV4AGRqoCTEhkPAMAbO9DU+cdCDkAAAAASUVORK5CYII=',

        // Templates
        MAIN_TEMPLATE :'<div class="tab-switcher" style="display: none;">' +
                            '<input type="text">' +
                            '<ul class="tabs-list">' +
                            '</ul>' +
                        '</div>',

        TAB_TEMPLATE  : '<li data-tab-id="{id}" data-window-id="{windowId}" class="tab-item">' +
                            '<span class="favicon-img">' +
                            '<img src="{favicon}" onerror="this.src=\'{default_favicon}\';">' +
                            '</span>' +
                            '<span class="title">{title}</span>' +
                        '</li>',

        // References to DOM elements
        SELECTED_CLASS: 'selected-tab',
        TAB_SELECTED  : '.selected-tab',
        FAVICON_IMG   : '.favicon-img img',
        TAB_SWITCHER  : '.tab-switcher',
        TAB_LIST      : '.tab-switcher .tabs-list',
        TAB_ITEM      : '.tab-item',
        TAB_INPUT     : '.tab-switcher input[type="text"]',

        // Shortcut for activation
        MASTER_KEY    : '⌘+⇧+l',

        // Key codes for certain actions
        DOWN_KEY      : 40,
        UP_KEY        : 38,
        ESCAPE_KEY    : 27,
        ENTER_KEY     : 13,
        SEMICOLON_KEY : 186,

        // Actions
        GOING_UP      : 'going_up',
        GOING_DOWN    : 'going_down',
        ESCAPING      : 'escaping',
        SWITCHING     : 'switching',
        CLOSING       : 'closing'
    };

    /**
     * Houses all the browser related actions
     *
     * @type {Object}
     */
    var BrowserTab = {

        /**
         * Houses all the tabs, once fetched
         *
         * @param array
         */
        allTabs: [],

        /**
         * Closes the tab whose tabId is passed
         *
         * @param tabId
         * @returns {boolean}
         */
        close: function (tabId) {
            chrome.extension.sendMessage({
                type: 'closeTab',
                params: {
                    tabId: tabId
                }
            }, function(res) {});

            return true;
        },

        /**
         * Switches to the specified tab
         *
         * @param tabId
         * @param windowId
         */
        switch: function (tabId, windowId) {
            // TODO just switch list instead of switch tab
            chrome.extension.sendMessage({
                type: 'switchTab',
                params: {
                    tabId: tabId,
                    windowId: windowId
                }
            }, function(res) {});
        },

        /**
         * Gets all the tabs that are opened
         *
         * @param callback Function which will be called whilst passing the tabs
         */
        getAll: function (callback) {
            chrome.extension.sendMessage({ type: 'getTabs' }, function(tabs) {
                if (!tabs) {
                    return false;
                }

                // Cache the tabs, this is the list, we will be filtering
                BrowserTab.allTabs = tabs;

                callback(tabs);
            });
        }
    };

    /**
     * Main extension class
     *
     * @returns {{loadExtension: loadExtension, bindUI: bindUI}}
     * @constructor
     */
    function TabSwitcher() {

        /**
         * Populates the tabs
         * @param tabs
         */
        function populateTabs(lists) {
            var tabsHtml = getTabsHtml(lists);

            $(Config.TAB_LIST).html(tabsHtml);
            $(Config.TAB_ITEM).first().addClass(Config.SELECTED_CLASS);
        }

        /**
         * Hides the switcher input and list
         */
        function hideSwitcher() {
            $(Config.TAB_SWITCHER).hide();
            $(Config.TAB_INPUT).val('');
        }

        /**
         * Gets the action to be performed for the given keycode
         *
         * @param keyCode
         * @returns {*}
         */
        function getSwitcherAction(keyCode) {
            switch (keyCode) {
                case Config.UP_KEY:
                    return Config.GOING_UP;
                case Config.DOWN_KEY:
                    return Config.GOING_DOWN;
                case Config.ESCAPE_KEY:
                    return Config.ESCAPING;
                case Config.ENTER_KEY:
                    return Config.SWITCHING;
                case Config.SEMICOLON_KEY:
                    return Config.CLOSING;
                default:
                    return false;
            }
        }

        /**
         * Moves the focus for the selected tab for the passed action
         *
         * @param action
         */
        function moveTabFocus(action) {

            var $firstSelected  = $(Config.TAB_SELECTED);

            // If some tab was already selected
            if ($firstSelected.length !== 0 ) {

                // Make it unselected
                $firstSelected.removeClass(Config.SELECTED_CLASS);

                var $toSelect = null;

                if (action === Config.GOING_DOWN) {
                    var $nextSelected = $firstSelected.next(Config.TAB_ITEM);
                    $toSelect         = $nextSelected.length !== 0 ? $nextSelected : $(Config.TAB_ITEM).first();
                } else if (action === Config.GOING_UP) {
                    var $prevSelected = $firstSelected.prev(Config.TAB_ITEM);
                    $toSelect = $prevSelected.length !== 0 ? $prevSelected : $(Config.TAB_ITEM).last();
                }

                $nextSelected = $toSelect.addClass(Config.SELECTED_CLASS);
            } else {
                $nextSelected = $(Config.TAB_ITEM).first().addClass(Config.SELECTED_CLASS);
            }

            $nextSelected.get(0).scrollIntoViewIfNeeded();
        }

        /**
         * Closes the tab having focus
         */
        function closeSelectedTab() {
            var $firstSelected = $(Config.TAB_SWITCHER).find(Config.TAB_SELECTED).first();

            if (BrowserTab.close($firstSelected.data('tabId'))) {
                $firstSelected.remove();
                $(Config.TAB_ITEM).first().addClass(Config.SELECTED_CLASS);
            }
        }

        /**
         * Switches the browser to the currently focused tab
         */
        function switchSelectedTab() {
            var $firstSelected = $(Config.TAB_SWITCHER).find(Config.TAB_SELECTED).first();
            window.location.href = 'https://www.wunderlist.com' + $firstSelected.data('tabId');
            //
            //BrowserTab.switch($firstSelected.data('tabId'), $firstSelected.data('windowId'));
        }

        /**
         * Performs the action for the passed keypress event
         *
         * @param event
         */
        function handleKeyPress(event) {

            var action = getSwitcherAction(event.keyCode);

            switch (action) {
                case Config.GOING_UP:
                case Config.GOING_DOWN:
                    moveTabFocus(action);
                    break;
                case Config.ESCAPING:
                    $(Config.TAB_SWITCHER).hide();
                    break;
                case Config.CLOSING:
                    // Because we are using `;` to close so prevent entering
                    event.preventDefault();
                    closeSelectedTab();
                    break;
                case Config.SWITCHING:
                    switchSelectedTab();
                    break;
            }
        }

        /**
         * Generates HTML string for the passed array of objects
         *
         * @param tabs
         * @returns {string}
         */
        function getTabsHtml(lists) {
            var tabsHtml = '';
            lists.forEach(function(list){

                var tempTabTemplate = Config.TAB_TEMPLATE,
                    faviconUrl = list.favIconUrl || Config.DEFAULT_FAVICON;

                tempTabTemplate = tempTabTemplate.replace('{favicon}', faviconUrl);
                tempTabTemplate = tempTabTemplate.replace('{default_favicon}', Config.DEFAULT_FAVICON);
                tempTabTemplate = tempTabTemplate.replace('{title}', list.title);
                tempTabTemplate = tempTabTemplate.replace('{id}', list.href);
                tempTabTemplate = tempTabTemplate.replace('{windowId}', list.windowId);

                tabsHtml += tempTabTemplate;
            });

            return tabsHtml;
        }

        /**
         * Filters tabs by the specified keyword string
         *
         * @param keyword
         */
        function filterTabs(keyword) {

            keyword = keyword.toLowerCase();

            var matches   = [],
                tempTitle = '',
                tempUrl   = '';

            BrowserTab.allTabs.map(function (tab) {
                tempTitle = tab.title.toLowerCase();
                tempUrl   = tab.url.toLowerCase();

                if (tempTitle.match(keyword) || tempUrl.match(keyword)) {
                    matches.push(tab);
                }
            });

            populateTabs(matches);
        }

        return {

            appendTheUi: function ($container) {
                if (!($container instanceof jQuery)) {
                    $container = $($container);
                }

                $container.append(Config.MAIN_TEMPLATE);
                return $container;
            },

            /**
             * Loads the extension in specified container
             *
             * @param $container
             */
            loadExtension: function ($container) {
                this.appendTheUi($container);
                this.bindUI();
            },

            /**
             * Binds the UI elements for the extension
             */
            bindUI: function () {
                var self = this;
                // mouse-down instead of click because click gets triggered after the blur event in which case tab
                // switcher would already be hidden (@see blur event below) and click will not be performed
                $(document).on('mousedown', Config.TAB_ITEM, function () {

                    var $this = $(this),
                        tabId = $this.data('tabId'),
                        windowId = $this.data('windowId');

                    BrowserTab.switch(tabId, windowId);
                });

                // Hide the switcher on blurring of input
                $(document).on('blur', Config.TAB_INPUT, function () {
                    hideSwitcher();
                });

                // Actions on tabs listing
                $(document).on('keydown', Config.TAB_INPUT, function (e) {
                    // Switcher was visible and either down or up key was pressed
                    if ($(Config.TAB_SWITCHER).is(':visible')) {
                        handleKeyPress(e);
                    }
                });

                // Filter for tabs
                $(document).on('keyup', Config.TAB_INPUT, function (e) {

                    var keyCode = e.keyCode,
                        action  = getSwitcherAction(keyCode);

                    switch (action) {
                        case Config.GOING_DOWN:
                        case Config.GOING_UP:
                        case Config.ESCAPING:
                        case Config.SWITCHING:
                        case Config.CLOSING:
                            return;
                        default:
                            var keyword = $(this).val();
                            if ($.trim(keyword) !== '') {
                                filterTabs(keyword);
                            } else {
                                populateTabs(BrowserTab.allTabs);
                            }
                    }
                });

                // Master key binding for which extension will be enabled
                function showNavigator() {
                    console.log('........................Shortcut clicked');
                    $(Config.TAB_SWITCHER).show();
                    $(Config.TAB_INPUT).focus();
                    var lists = [];
                    $('.sidebarItem a').each(function (index, element) {
                        var list = {};
                        var $this = $(this);
                        list.href = $this.attr('href');
                        list.title = $this.find('.title').text();
                        lists.push(list);
                    });
                    populateTabs(lists);
                }

                key(Config.MASTER_KEY, function () {
                    if($(Config.TAB_SWITCHER).length === 0) {
                        self.appendTheUi('body');
                    } else {
                        showNavigator();
                    }

                });
            }
        };
    }

    $(document).ready(function () {
        var tabSwitcher = new TabSwitcher();
        tabSwitcher.loadExtension('body');
    });

}());
