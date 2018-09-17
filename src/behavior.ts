/*
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
import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";

import { interactivityService } from "powerbi-visuals-utils-interactivityutils";
import ISelectionHandler = interactivityService.ISelectionHandler;
import SelectableDataPoint = interactivityService.SelectableDataPoint;
import IInteractiveBehavior = interactivityService.IInteractiveBehavior;

import { LineDotPoint } from "./dataInterfaces";

export const MinOpacity: number = 0.1;
export const DimmedOpacity: number = 0.4;

export function getFillOpacity(
    dot: LineDotPoint,
    selected: boolean,
    highlight: boolean,
    hasSelection: boolean,
    hasPartialHighlights: boolean,
): number {
    if ((hasPartialHighlights && !highlight) || (hasSelection && !selected)) {
        const opacity: number = dot.opacity - DimmedOpacity;

        return opacity < MinOpacity ? MinOpacity : opacity;
    }

    return dot.opacity;
}

export interface BehaviorOptions {
    selection: d3.Selection<any, SelectableDataPoint, any, any>;
    clearCatcher: d3.Selection<any, any, any, any>;
    hasHighlights: boolean;
}

export class Behavior implements IInteractiveBehavior {
    private options: BehaviorOptions;

    public bindEvents(options: BehaviorOptions, selectionHandler: ISelectionHandler): void {
        const {
            selection,
            clearCatcher,
        } = options;

        this.options = options;

        selection.on("click", (dataPoint: SelectableDataPoint) => {
            const event: MouseEvent = d3.event as MouseEvent;

            event.stopPropagation();

            selectionHandler.handleSelection(dataPoint, event.ctrlKey);
        });

        clearCatcher.on("click", () => {
            selectionHandler.handleClearSelection();
        });
    }

    public renderSelection(hasSelection: boolean): void {
        const {
            selection,
            hasHighlights,
        } = this.options;

        selection.style("opacity", (dotPoint: LineDotPoint) => {
            return getFillOpacity(
                dotPoint,
                dotPoint.selected,
                dotPoint.highlight,
                !dotPoint.highlight && hasSelection,
                !dotPoint.selected && hasHighlights
            );
        });
    }
}

