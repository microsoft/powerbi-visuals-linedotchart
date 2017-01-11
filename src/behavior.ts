﻿/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved. 
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *   
 *  The above copyright notice and this permission notice shall be included in 
 *  all copies or substantial portions of the Software.
 *   
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    import converterHelper = powerbi.extensibility.utils.dataview.converterHelper;
    import IInteractiveBehavior = powerbi.extensibility.utils.interactivity.IInteractiveBehavior;
    import IInteractivityService = powerbi.extensibility.utils.interactivity.IInteractivityService;
    import ISelectionHandler = powerbi.extensibility.utils.interactivity.ISelectionHandler;
    import SelectableDataPoint = powerbi.extensibility.utils.interactivity.SelectableDataPoint;

    export class LineDotChartWebBehavior implements IInteractiveBehavior {
        private selection: d3.Selection<any>;
        private interactivityService: IInteractivityService;
        private hasHighlights: boolean;

        public bindEvents(options: LineDotChartBehaviorOptions, selectionHandler: ISelectionHandler): void {
            let selection: d3.Selection<any> = this.selection = options.selection;
            let clearCatcher: d3.Selection<any> = options.clearCatcher;
            this.interactivityService = options.interactivityService;
            this.hasHighlights = options.hasHighlights;

            selection.on('click', function (d: SelectableDataPoint) {
                selectionHandler.handleSelection(d, (d3.event as MouseEvent).ctrlKey);
                (d3.event as MouseEvent).stopPropagation();
            });

            clearCatcher.on('click', function () {
                selectionHandler.handleClearSelection();
            });
        }

        public renderSelection(hasSelection: boolean): void {
            let hasHighlights: boolean = this.hasHighlights;

            this.selection.style("opacity", (d: LineDotPoint) => {
                return lineDotChartUtils.getFillOpacity(d.selected, d.highlight, !d.highlight && hasSelection, !d.selected && hasHighlights);
            });
        }
    }

    export interface LineDotChartBehaviorOptions {
        selection: d3.Selection<any>;
        clearCatcher: d3.Selection<any>;
        interactivityService: IInteractivityService;
        hasHighlights: boolean;
    }
}
