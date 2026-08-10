## 2.1.2
### Visual changes
* Reserve the axis space from the measured tick label and title sizes, so axis titles no longer overlap the tick labels at large text sizes
* Keep the tick labels inside the visual bounds by ellipsising them to the space that is actually available
* Ellipsise the X-axis tick labels to the space between ticks, so they stop colliding without dropping the labels in between
* Reduce the Y-axis tick density, because vertical labels cannot be shortened to avoid a collision
* Hide the axis title, and then the tick labels, when the visual is too small to show them without overlapping
* Fix the second Y-axis, which could pair its labels with the wrong tick positions
* Limit the axis text size to 60pt

## 2.1.1
### Code improvements
* Update packages
* Fix npm vulnerabilities

## 2.1.0
### Visual changes
* Migrate to new formatting model
* Add keyboard navigation
* Add Rendering API support
* Add report page tooltip support
* Add context menu support

### Code improvements
* Update API to 5.11.0, tools to 5.5.1 and other packages
* Migrate to eslint from tslint
* Update to latest d3, split d3 into submodules
* Remove core-js, .travis.yml, azure-pipelines.yml
* Add CI/CD and CodeQL
* Fix less-loader options, fix running tests, migrate from puppeteer to playwright-chromium
* Remove interactivity-utils
* Add selection and highlight tests
* Remove "coveralls" package

## 2.0.3
* Fixed ticks formatting of fractional numbers

## 2.0.2
* UPD: powerbi-visuals-tools has been updated to 3.0.9 to add IE11 support
* UPD: API has been updated to 2.3.0 to add IE11 support
* UPD: powerbi-visuals-api has been updated to 2.3.1 to add IE11 support

## 2.0.1
* Azure Pipelines integration
* Visual packages update
* Counter issue fixed 

## 2.0.0
* API 2.1.0
* Webpack integration
* Fixed Edge SVG issue

## 1.5.1
* Fixed wrong chart's scale yAxis rendering
* Fixed bug with not displayed lines and reverse order animation, when data is sorted descending

## 1.5.0
* High contrast mode
* API 1.13.0
* Fixes Edge/IE11 SVG issues

## 1.4.1
* Fixed chart animation for descending order of dates 

## 1.4.0
* Added localization for all supported languages

## 1.3.0
* UPD: powerbi-visuals-tools has been updated to 1.11.2 to support Bookmarks
* UPD: API has been updated to 1.11.0 to support Bookmarks
* UPD: powerbi-visuals-utils-interactivityutils has been updated to 3.1.0 to support Bookmarks
* UPD: powerbi-visuals-utils-testutils has been updated to "1.2.0" to support Bookmarks

## 1.2.1
* UPD: Using the version 1.5.1 of powerbi-visuals-utils-chartutils

## 1.2.0
* ADD: X-axis and Y-axis option groups that let to show or hide axes and set color with font size
* REM: Axis properties option group was removed
* ADD: Possibility to use string labels in X-axis
* ADD: Using of a new version 1.5 of Chart utils

## 1.1.2
* Fixed blank window issue in Internet Explorer

## 1.1.0
* Add Dot opacity property
* Add axes color property
* Add new basket "Counter"

## 1.0.3
* Return jQuery reference

## 1.0.2
* Updrage to API 1.7.0
* Fix bug: "Incorrect behavior in Focus mode"

## 1.0.1
* Fix bug: "Visual doesn't display lines when animation is disabled"
* Add changelog.md
