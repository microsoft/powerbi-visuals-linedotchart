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
import { Selection } from "d3-selection";
import powerbi from "powerbi-visuals-api";

import ISelectionId = powerbi.visuals.ISelectionId;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ITooltipService = powerbi.extensibility.ITooltipService;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { LegendDataPoint } from "powerbi-visuals-utils-chartutils/lib/legend/legendInterfaces";
import { LineDotPoint } from "./dataInterfaces";

export interface BaseDataPoint {
    selected: boolean;
}

export interface SelectableDataPoint extends BaseDataPoint {
    identity: ISelectionId;
    specificIdentity?: ISelectionId;
}


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
    selection: Selection<any, LineDotPoint, any, any>;
    clearCatcher: Selection<any, any, any, any>;
    dataPoints: LineDotPoint[];
    hasHighlights: boolean;
    tooltipService: ITooltipService;
    getTooltipInfo: (dataPoint?: LineDotPoint) => VisualTooltipDataItem[]
}

export class Behavior {
    private selectionManager: ISelectionManager;
    private options: BehaviorOptions;

    constructor(selectionManager: ISelectionManager) {
        this.selectionManager = selectionManager;
        this.selectionManager.registerOnSelectCallback(this.onSelectCallback.bind(this));
    }

    public get isInitialized(): boolean {
        return !!this.options;
    }

    public get hasSelection(): boolean {
        const selectionIds = this.selectionManager.getSelectionIds();
        return selectionIds.length > 0;
    }

    public bindEvents(options: BehaviorOptions): void {
        this.options = options;

        this.bindClickEvents();
        this.bindContextMenuEvents();
        this.bindKeyboardEvents();
    }

    public setSelectedToDataPoints(dataPoints: SelectableDataPoint[] | LegendDataPoint[], ids?: ISelectionId[], hasHighlightsParameter?: boolean): void {
        const hasHighlights: boolean = hasHighlightsParameter || (this.options && this.options.hasHighlights);
        const selectedIds: ISelectionId[] = ids || <ISelectionId[]>this.selectionManager.getSelectionIds();

        if (hasHighlights && this.hasSelection) {
            this.selectionManager.clear();
        }

        for (const dataPoint of dataPoints) { 
            dataPoint.selected = this.isDataPointSelected(dataPoint, selectedIds);
        }
    }

    private bindClickEvents(): void {
        this.options.selection.on("click", (event: MouseEvent, dataPoint: SelectableDataPoint) => {
            event.stopPropagation();
            this.selectDataPoint(dataPoint, event.ctrlKey || event.metaKey || event.shiftKey);
            this.onSelectCallback();
        });

        this.options.clearCatcher.on("click", () => {
            this.selectionManager.clear();
            this.onSelectCallback();
        });
    }

    private bindContextMenuEvents(): void {
        this.options.selection.on("contextmenu", (event: MouseEvent, dataPoint: SelectableDataPoint) => {
            event.preventDefault();
            event.stopPropagation();
            this.selectionManager.showContextMenu(dataPoint.identity, {
                x: event.clientX,
                y: event.clientY
            });
        });

        this.options.clearCatcher.on("contextmenu", (event: MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();

            const emptySelection = {
                "measures": [],
                "dataMap": {
                }
            };

            this.selectionManager.showContextMenu(emptySelection, {
                x: event.clientX,
                y: event.clientY
            });
        });
    }

    private bindKeyboardEvents(): void {
        this.options.selection.on("keydown", (event: KeyboardEvent, dataPoint: LineDotPoint) => {
            if (event.code === "Enter" || event.code === "Space") {
                event.preventDefault();
                this.selectDataPoint(dataPoint, event.ctrlKey || event.metaKey || event.shiftKey);
                this.onSelectCallback();

                this.showTooltip(dataPoint, <SVGCircleElement>event.target);
            } else {
                this.options.tooltipService.hide({ immediately: true, isTouchEvent: false });
            }
        });
    }

    private showTooltip(dataPoint: LineDotPoint, domElement: SVGCircleElement): void {
        const rect = domElement.getBoundingClientRect();

        const tooltipInfo = this.options.getTooltipInfo(dataPoint);
        const coordinates = [rect.left + rect.width / 2 + window.scrollX, rect.top + rect.height / 2 + window.scrollY];

        this.options.tooltipService.show({ dataItems: tooltipInfo, coordinates: coordinates, identities: [dataPoint.identity], isTouchEvent: false });
    }

    private onSelectCallback(selectionIds?: ISelectionId[]): void {
        const selectedIds: ISelectionId[] = selectionIds || <ISelectionId[]>this.selectionManager.getSelectionIds();
        this.setSelectedToDataPoints(this.options.dataPoints, selectedIds);
        this.renderSelection();
    }

    private renderSelection(): void {
        this.options.selection.style("opacity", (dotPoint: LineDotPoint) => {
            return getFillOpacity(
                dotPoint,
                dotPoint.selected,
                dotPoint.highlight,
                !dotPoint.highlight && this.hasSelection,
                !dotPoint.selected && this.options.hasHighlights
            );
        });

        if (!this.hasSelection) {
            this.options.tooltipService.hide({ immediately: true, isTouchEvent: false });
        }
    }

    private selectDataPoint(dataPoint: SelectableDataPoint | LegendDataPoint, multiSelect: boolean = false): void {
        if (!dataPoint || !dataPoint.identity) return;        

        const selectedIds: ISelectionId[] = <ISelectionId[]>this.selectionManager.getSelectionIds();
        const isSelected: boolean = this.isDataPointSelected(dataPoint, selectedIds);

        const selectionIdsToSelect: ISelectionId[] = [];
        if (!isSelected) {
            dataPoint.selected = true;
            selectionIdsToSelect.push(dataPoint.identity);
        } else {
            // toggle selected back to false
            dataPoint.selected = false;
            if (multiSelect) {
                selectionIdsToSelect.push(dataPoint.identity);
            }
        }

        if (selectionIdsToSelect.length > 0) {
            this.selectionManager.select(selectionIdsToSelect, multiSelect);
        } else {
            this.selectionManager.clear();
        }
    }

    private isDataPointSelected(dataPoint: SelectableDataPoint | LegendDataPoint, selectedIds: ISelectionId[]): boolean {
        return selectedIds.some((value: ISelectionId) => value.equals(<ISelectionId>dataPoint.identity));
    }
}

