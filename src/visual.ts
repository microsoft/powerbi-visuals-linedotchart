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

import "./../style/lineDotChart.less";

import "d3-transition";
import { Selection, select, BaseType } from "d3-selection";
import { extent } from "d3-array";
import { axisRight, AxisDomain } from "d3-axis";
import { line, Line } from "d3-shape";
import { easeLinear, easeElastic } from "d3-ease";
import { timerFlush } from "d3-timer";
import * as _ from "lodash";
import powerbi from "powerbi-visuals-api";

import DataView = powerbi.DataView;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import DataViewCategoricalColumn = powerbi.DataViewCategoricalColumn;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import PrimitiveValue = powerbi.PrimitiveValue;
import IViewport = powerbi.IViewport;
import VisualObjectInstancesToPersist = powerbi.VisualObjectInstancesToPersist;
import VisualObjectInstance = powerbi.VisualObjectInstance;

import ILocalizationManager = powerbi.extensibility.ILocalizationManager;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisual = powerbi.extensibility.visual.IVisual;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;

import { axis as AxisHelper, axisInterfaces } from "powerbi-visuals-utils-chartutils";
import IAxisProperties = axisInterfaces.IAxisProperties;

import { valueFormatter as valueFormatter, textMeasurementService } from "powerbi-visuals-utils-formattingutils";

import IValueFormatter = valueFormatter.IValueFormatter;

import * as SVGUtil from "powerbi-visuals-utils-svgutils";
import SVGManipulations = SVGUtil.manipulation;
import ClassAndSelector = SVGUtil.CssConstants.ClassAndSelector;
import createClassAndSelector = SVGUtil.CssConstants.createClassAndSelector;

import { valueType as vt, pixelConverter as PixelConverter } from "powerbi-visuals-utils-typeutils";
import valueType = vt.ValueType;

import { ITooltipServiceWrapper, createTooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import { ColorHelper } from "powerbi-visuals-utils-colorutils";

import { interactivitySelectionService, interactivityBaseService } from 'powerbi-visuals-utils-interactivityutils';
import createInteractivityService = interactivitySelectionService.createInteractivitySelectionService
import IInteractiveBehavior = interactivityBaseService.IInteractiveBehavior;
import IInteractivityService = interactivityBaseService.IInteractivityService;

import { VisualLayout } from "./visualLayout";
import { Behavior, BehaviorOptions, getFillOpacity } from "./behavior";
import { LineDotChartColumns } from "./columns";
import { LineDotChartSettingsModel } from './lineDotChartSettingsModel';
import {
    Legend,
    LineDotChartViewModel,
    LineDotPoint,
    DateValue,
    ColumnNames
} from "./dataInterfaces";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";

export interface LineDotChartDataRoles<T> {
    Date?: T;
    Values?: T;
}

export interface LineAnimationSettings {
    startX: number;
    endX: number;
    endWidth: number;
}

export class LineDotChart implements IVisual {
    private static Identity: ClassAndSelector = createClassAndSelector("lineDotChart");
    private static Axes: ClassAndSelector = createClassAndSelector("axes");
    private static Axis: ClassAndSelector = createClassAndSelector("axis");
    private static Legends: ClassAndSelector = createClassAndSelector("legends");
    private static Legend: ClassAndSelector = createClassAndSelector("legend");
    private static Line: ClassAndSelector = createClassAndSelector("line");

    private static LegendSize: number = 50;
    private static AxisSize: number = 30;

    private root: Selection<SVGElement, any, any, any>;
    private main: Selection<SVGGElement, any, any, any>;
    private axes: Selection<SVGGElement, any, any, any>;
    private axisX: Selection<SVGGElement, any, any, any>;
    private axisY: Selection<SVGGElement, any, any, any>;
    private axisY2: Selection<SVGGElement, any, any, any>;
    private legends: Selection<SVGGElement, any, any, any>;
    private line: Selection<SVGGElement, any, any, any>;
    private xAxisProperties: IAxisProperties;
    private yAxisProperties: IAxisProperties;
    private yAxis2Properties: IAxisProperties;
    private layout: VisualLayout;
    private interactivityService: IInteractivityService<LineDotPoint>;
    private behavior: IInteractiveBehavior;
    private hostService: IVisualHost;
    private localizationManager: ILocalizationManager;
    private formattingSettingsService: FormattingSettingsService;
    private events: IVisualEventService;

    private dataView: DataView;
    public data: LineDotChartViewModel;
    private formattingSettings: LineDotChartSettingsModel;

    private static counterTitleDefaultKey: string = "Visual_CounterTitle";
    private static axesDefaultColor: string = "black";
    private static axesDefaultFontSize: number = 10.5;

    private static viewportMargins = {
        top: 10,
        right: 30,
        bottom: 10,
        left: 10
    };

    private static viewportDimensions: IViewport = {
        width: 150,
        height: 150
    };

    public static getColumnFormattingCallback(data: LineDotChartViewModel) {
        return (index: number, dataType: valueType): string | number => {
            if (dataType.dateTime) {
                return data.dateColumnFormatter.format(new Date(index));
            }
            else if (dataType.text) {
                return data.dateValues[index].label;
            }
            return data.dateColumnFormatter.format(index);
        };
    }

    public static getValueFormattingCallback(data: LineDotChartViewModel) {
        return (index: number, dataType: valueType): string | number => {
            if (dataType.dateTime) {
                return data.dataValueFormatter.format(new Date(index));
            }
            else if (dataType.text) {
                return data.dateValues[index].label;
            }

            const formatted: string = data.dataValueFormatter.format(index); // format to percent or unit str if needed

            if (formatted === index.toString()) {
                return index; // number return preferred
            }
            if (isNaN(Number(formatted))) {
                return formatted; // returns string with unit sign
            }

            return (Math.floor(index) !== index)
                ? index
                : formatted;
        };
    }

    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private colorHelper: ColorHelper;

    constructor(options: VisualConstructorOptions) {
        this.tooltipServiceWrapper = createTooltipServiceWrapper(
            options.host.tooltipService,
            options.element
        );

        this.colorHelper = new ColorHelper(options.host.colorPalette);
        this.hostService = options.host;
        this.localizationManager = this.hostService.createLocalizationManager();
        this.formattingSettingsService = new FormattingSettingsService(this.localizationManager);
        this.events = this.hostService.eventService;

        this.layout = new VisualLayout(null, LineDotChart.viewportMargins);
        this.layout.minViewport = LineDotChart.viewportDimensions;

        this.interactivityService = createInteractivityService(options.host);
        this.behavior = new Behavior();

        this.root = select(options.element)
            .append("svg")
            .classed(LineDotChart.Identity.className, true);

        this.main = this.root.append("g");

        this.axes = this.main
            .append("g")
            .classed(LineDotChart.Axes.className, true);

        this.axisX = this.axes
            .append("g")
            .classed(LineDotChart.Axis.className, true);

        this.axisY = this.axes
            .append("g")
            .classed(LineDotChart.Axis.className, true);

        this.axisY2 = this.axes
            .append("g")
            .classed(LineDotChart.Axis.className, true);

        this.legends = this.main
            .append("g")
            .classed(LineDotChart.Legends.className, true);

        this.line = this.main
            .append("g")
            .classed(LineDotChart.Line.className, true);
    }

    public update(options: VisualUpdateOptions) {
        try {
            this.events.renderingStarted(options);

            if (!options
                || !options.dataViews
                || !options.dataViews[0]
            ) {
                return;
            }

            this.dataView = options.dataViews[0];
            this.layout.viewport = options.viewport;

            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(LineDotChartSettingsModel, this.dataView);
            this.setHighcontrastMode(this.colorHelper);

            const data: LineDotChartViewModel = this.converter(this.dataView, this.hostService);

            if (!data || _.isEmpty(data.dotPoints)) {
                this.clear();
                return;
            }

            this.data = data;

            if (this.interactivityService) {
                this.interactivityService.applySelectionStateToData(this.data.dotPoints);
            }

            this.resize();
            this.calculateAxes();
            this.draw();

            this.events.renderingFinished(options);
        } catch (ex) {
            this.events.renderingFailed(options, JSON.stringify(ex));
        }
    }

    public destroy() {
        this.root = null;
    }

    public clear() {
        if (this.formattingSettings && this.formattingSettings.misc) {
            // TODO:// persist properties
            this.formattingSettings.misc.isAnimated.value = false;
            // this.hostService.persistProperties({
            //     merge: [
            //         {
            //             objectName: "misc",
            //             selector: undefined,
            //             properties: {
            //                 "isAnimated": false
            //             }
            //         }
            //     ]
            // });
        }

        this.axes
            .selectAll(LineDotChart.Axis.selectorName)
            .selectAll("*")
            .remove();

        this.main
            .selectAll(LineDotChart.Legends.selectorName)
            .selectAll("*")
            .remove();

        this.main
            .selectAll(LineDotChart.Line.selectorName)
            .selectAll("*")
            .remove();

        this.main
            .selectAll(LineDotChart.Legend.selectorName)
            .selectAll("*")
            .remove();

        this.line
            .selectAll(LineDotChart.textSelector)
            .remove();

        this.line
            .selectAll(LineDotChart.PlayButton.selectorName)
            .remove();
    }

    public setIsStopped(isStopped: boolean): void {
        const objects: VisualObjectInstancesToPersist = {
            merge: [
                <VisualObjectInstance>{
                    objectName: "misc",
                    selector: undefined,
                    properties: {
                        "isStopped": isStopped,
                    }
                }
            ]
        };

        this.hostService.persistProperties(objects);
    }

    private setHighcontrastMode(colorHelper: ColorHelper): void {
        if (colorHelper.isHighContrast) {
            const foregroundColor: string = colorHelper.getThemeColor("foreground");
            const backgroundColor: string = colorHelper.getThemeColor("background");

            this.formattingSettings.lineoptions.fill.value.value = foregroundColor;
            this.formattingSettings.lineoptions.lineThickness.value = 2;

            this.formattingSettings.dotoptions.color.value.value = backgroundColor;
            this.formattingSettings.dotoptions.strokeOpacity = null;
            this.formattingSettings.dotoptions.strokeWidth = 2;
            this.formattingSettings.dotoptions.stroke = foregroundColor;

            this.formattingSettings.counteroptions.color.value.value = foregroundColor;

            this.formattingSettings.xAxis.color.value.value = foregroundColor;
            this.formattingSettings.yAxis.color.value.value = foregroundColor;

            this.formattingSettings.playButton.fill.value.value = backgroundColor;
            this.formattingSettings.playButton.stroke.value.value = foregroundColor;
            this.formattingSettings.playButton.strokeWidth.value = 1;
            this.formattingSettings.playButton.innerColor.value.value = foregroundColor;
            this.formattingSettings.playButton.opacity.value = 100;
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        if (!this.formattingSettings.counteroptions.counterTitle.value) {
            this.formattingSettings.counteroptions.counterTitle.value = this.localizationManager.getDisplayName(LineDotChart.counterTitleDefaultKey);
        }

        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    private clearElement(selection: Selection<SVGGElement, any, any, any>): void {
        selection
            .selectAll("*")
            .remove();
    }

    private static dateMaxCutter: number = .05;
    private static makeSomeSpaceForCounter: number = .10;

    private converter(
        dataView: DataView,
        visualHost: IVisualHost,
    ): LineDotChartViewModel {
        const categorical: LineDotChartColumns<DataViewCategoryColumn & DataViewValueColumn[]>
            = LineDotChartColumns.getCategoricalColumns(dataView);

        if (!categorical
            || !categorical.Date
            || !categorical.Date.source
            || _.isEmpty(categorical.Date.values)
            || !categorical.Values
            || !categorical.Values[0]
            || !categorical.Values[0].source
            || _.isEmpty(categorical.Values[0].values)) {
            return null;
        }

        let counterValues: PrimitiveValue[] = null;

        for (let i = 0; i < dataView.categorical.values.length; i++) {
            if (dataView.categorical.values[i].source.roles["Counter"]) {
                counterValues = dataView.categorical.values[i].values;
            }
        }

        const valuesColumn: DataViewValueColumn = categorical.Values[0];
        const categoryType: valueType = AxisHelper.getCategoryValueType(categorical.Date.source, true);

        const categoricalValues: LineDotChartColumns<any[]> = LineDotChartColumns.getCategoricalValues(dataView);

        if (counterValues && counterValues.length > 0) {
            const fValue: any = counterValues[0];
            if (typeof fValue.getMonth === "function") {
                this.formattingSettings.isCounterDateTime.isCounterDateTime = true;
            } else if (typeof fValue === "string" && !isNaN(Date.parse(fValue))) {
                this.formattingSettings.isCounterDateTime.isCounterDateTime = true;
            } else {
                this.formattingSettings.isCounterDateTime.isCounterDateTime = false;
            }
        }

        const hasHighlights: boolean = !!(categorical.Values.length > 0 && valuesColumn.highlights);

        const dateColumnFormatter = valueFormatter.create({
            format: valueFormatter.getFormatStringByColumn(categorical.Date.source, true) || categorical.Date.source.format,
            cultureSelector: visualHost.locale
        });

        const { sumOfValues, yMinValue, dotPoints, isOrdinal, dateValues, yMaxValue }: { sumOfValues: number; yMinValue: number; dotPoints: LineDotPoint[]; isOrdinal: boolean; dateValues: DateValue[]; yMaxValue: number; } = LineDotChart.calculateLineDotChartValues(categoricalValues, categoryType, visualHost, categorical, hasHighlights, valuesColumn, this.formattingSettings, counterValues);

        // make some space for counter + 25%
        const sumOfValuesSpaced = sumOfValues + (sumOfValues - yMinValue) * LineDotChart.makeSomeSpaceForCounter;

        const columnNames: ColumnNames = {
            category: LineDotChart.getDisplayName(categorical.Date),
            values: LineDotChart.getDisplayName(valuesColumn)
        };

        const dataValueFormatter: IValueFormatter = valueFormatter.create({
            format: valueFormatter.getFormatStringByColumn(valuesColumn.source, true) || "#",
            cultureSelector: visualHost.locale
        });

        return {
            columnNames,
            dotPoints,
            dataValueFormatter,
            dateColumnFormatter,
            isOrdinal,
            dateValues,
            yMinValue,
            yMaxValue,
            sumOfValues: sumOfValuesSpaced,
            hasHighlights,
            dateMetadataColumn: categorical.Date.source,
            valuesMetadataColumn: valuesColumn.source
        };
    }

    private static calculateLineDotChartValues(categoricalValues: LineDotChartColumns<any[]>, categoryType: vt.ValueType, visualHost: IVisualHost, categorical: LineDotChartColumns<powerbi.DataViewCategoryColumn & powerbi.DataViewValueColumn[]>, hasHighlights: boolean, valuesColumn: powerbi.DataViewValueColumn, settings: LineDotChartSettingsModel, counterValues: powerbi.PrimitiveValue[]) {
        const extentValues: [number, number] = extent(categoricalValues.Values);
        const yMinValue: number = extentValues[0];
        const yMaxValue: number = extentValues[1];
        const dotPoints: LineDotPoint[] = [];
        let sumOfValues: number = 0;

        const dateValues: DateValue[] = [], isOrdinal: boolean = AxisHelper.isOrdinal(categoryType), isDateTime: boolean = AxisHelper.isDateTime(categoryType);

        for (let valueIndex: number = 0, length: number = categoricalValues.Date.length; valueIndex < length; valueIndex++) {
            const value: number = categoricalValues.Values[valueIndex] || 0;
            const dateValue: DateValue = new DateValue(categoricalValues.Date[valueIndex], null);

            if (isDateTime) {
                dateValue.value = categoricalValues.Date[valueIndex].getTime();
            } else if (!isOrdinal) {
                dateValue.value = categoricalValues.Date[valueIndex];
            } else {
                dateValue.value = valueIndex;
            }

            dateValues.push(dateValue);
            sumOfValues += value;

            const selector: ISelectionId = visualHost.createSelectionIdBuilder()
                .withCategory(categorical.Date, valueIndex)
                .createSelectionId();

            dotPoints.push({
                dateValue,
                value,
                dot: (yMaxValue - yMinValue)
                    ? (value - yMinValue) / (yMaxValue - yMinValue)
                    : 0,
                sum: sumOfValues,
                selected: false,
                identity: selector,
                highlight: hasHighlights && !!(valuesColumn.highlights[valueIndex]),
                opacity: settings.dotoptions.percentile.value.valueOf() / 100,
                counter: counterValues ? counterValues[valueIndex] : null
            });
        }

        return { sumOfValues, yMinValue, dotPoints, isOrdinal, dateValues, yMaxValue };
    }

    private static getDisplayName(column: DataViewCategoricalColumn): string {
        return (column && column.source && column.source.displayName) || "";
    }

    private static outerPadding: number = 0;
    private static forcedTickSize: number = 150;
    private static xLabelMaxWidth: number = 160;
    private static xLabelTickSize: number = 3.2;

    private calculateAxes() {
        const effectiveWidth: number = Math.max(0, this.layout.viewportIn.width - LineDotChart.LegendSize - LineDotChart.AxisSize);
        const effectiveHeight: number = Math.max(0, this.layout.viewportIn.height - LineDotChart.LegendSize);

        const extentDate: [number, number] = extent(
            this.data.dateValues,
            (dateValue: DateValue) => dateValue.value);

        const minDate: number = extentDate[0],
            maxDate: number = extentDate[1] + (extentDate[1] - extentDate[0]) * LineDotChart.dateMaxCutter;

        this.xAxisProperties = AxisHelper.createAxis({
            pixelSpan: effectiveWidth,
            dataDomain: !this.data.isOrdinal
                ? [minDate, maxDate]
                : this.data.dateValues.map((dateValue: DateValue) => { return dateValue.value; }),
            metaDataColumn: this.data.dateMetadataColumn,
            formatString: null,
            outerPadding: LineDotChart.outerPadding,
            useRangePoints: true,
            isCategoryAxis: true,
            isScalar: !this.data.isOrdinal,
            isVertical: false,
            forcedTickCount: Math.max(this.layout.viewport.width / LineDotChart.forcedTickSize, 0),
            useTickIntervalForDisplayUnits: false,
            shouldClamp: true,
            getValueFn: LineDotChart.getColumnFormattingCallback(this.data)
        });

        this.xAxisProperties.xLabelMaxWidth = Math.min(
            LineDotChart.xLabelMaxWidth,
            this.layout.viewportIn.width / LineDotChart.xLabelTickSize
        );

        this.xAxisProperties.formatter = this.data.dateColumnFormatter;
        let yMin = this.data.yMinValue;
        let yMax = this.data.yMaxValue;
        // Expanding a scope by increasing yMin and yMax to render y-axes
        // - if all data values are the same (yMin = yMax) we increasing them all, for floats - increasing by const float, for integers - by 1;
        // - if the data has diffrent minimum and maximum values we increasing only yMax
        if (yMax === yMin) {
            if ((Math.floor(yMin) === yMin) && yMin !== 0) {
                yMin = yMin - 1;
                yMax = yMax + 1;
            } else {
                yMin = yMin - LineDotChart.dateMaxCutter;
                yMax = yMax + LineDotChart.dateMaxCutter;
            }
        } else {
            yMax = yMax + (yMax - yMin) * LineDotChart.makeSomeSpaceForCounter;
        }

        this.yAxisProperties = AxisHelper.createAxis({
            pixelSpan: effectiveHeight,
            dataDomain: [yMin, yMax],
            metaDataColumn: this.data.valuesMetadataColumn,
            formatString: null,
            outerPadding: LineDotChart.outerPadding,
            isCategoryAxis: false,
            isScalar: true,
            isVertical: true,
            useTickIntervalForDisplayUnits: true,
            getValueFn: LineDotChart.getValueFormattingCallback(this.data)
        });

        this.yAxis2Properties = AxisHelper.createAxis({
            pixelSpan: effectiveHeight,
            dataDomain: [yMin, yMax],
            metaDataColumn: this.data.valuesMetadataColumn,
            formatString: null,
            outerPadding: LineDotChart.outerPadding,
            isCategoryAxis: false,
            isScalar: true,
            isVertical: true,
            useTickIntervalForDisplayUnits: true,
            getValueFn: LineDotChart.getValueFormattingCallback(this.data)
        });

        this.yAxis2Properties.formatter = this.data.dataValueFormatter;
    }

    private static rotateAngle: number = 270;

    private generateAxisLabels(): Legend[] {
        return [
            {
                transform: SVGManipulations.translate((this.layout.viewportIn.width) / 2, (this.layout.viewportIn.height)),
                text: "", // xAxisTitle
                dx: "1em",
                dy: "-1em"
            }, {
                transform: SVGManipulations.translateAndRotate(0, this.layout.viewportIn.height / 2, 0, 0, LineDotChart.rotateAngle),
                text: "", // yAxisTitle
                dx: "3em"
            }
        ];
    }

    private resize(): void {
        this.root
            .attr("width", this.layout.viewport.width)
            .attr("height", this.layout.viewport.height);

        this.main.attr(
            "transform",
            SVGManipulations.translate(this.layout.margin.left, this.layout.margin.top)
        );

        this.legends.attr(
            "transform",
            SVGManipulations.translate(this.layout.margin.left, this.layout.margin.top)
        );

        this.line.attr(
            "transform",
            SVGManipulations.translate(this.layout.margin.left + LineDotChart.LegendSize, 0)
        );

        this.axes.attr(
            "transform",
            SVGManipulations.translate(this.layout.margin.left + LineDotChart.LegendSize, 0)
        );

        this.axisX.attr(
            "transform",
            SVGManipulations.translate(0, this.layout.viewportIn.height - LineDotChart.LegendSize)
        );

        this.axisY2.attr(
            "transform",
            SVGManipulations.translate(this.layout.viewportIn.width - LineDotChart.LegendSize - LineDotChart.AxisSize, 0)
        );
    }

    private static tickText: string = ".tick text";
    private static dotPointsText: string = "g.path, g.dot-points";
    private static dotPathText: string = "g.path";

    private draw(): void {
        this.stopAnimation();
        this.renderLegends();
        this.drawPlaybackButtons();

        if (this.formattingSettings.xAxis.show.value === true) {
            this.axisX.call(this.xAxisProperties.axis);
        } else {
            this.clearElement(this.axisX);
        }

        if (this.formattingSettings.yAxis.show.value === true) {
            this.axisY.call(this.yAxisProperties.axis);

            if (this.formattingSettings.yAxis.isDuplicated.value) {
                const scale: any = this.yAxis2Properties.scale;
                const ticksCount: number = this.yAxis2Properties.values.length;
                const format: any = (domainValue: AxisDomain, value: any) => this.yAxis2Properties.values[value];

                const axis = axisRight(scale);
                this.axisY2.call(axis.tickArguments([ticksCount]).tickFormat(format));
            } else {
                this.clearElement(this.axisY2);
            }
        } else {
            this.clearElement(this.axisY);
            this.clearElement(this.axisY2);
        }

        this.axisX.selectAll(LineDotChart.tickText).call(
            AxisHelper.LabelLayoutStrategy.clip,
            this.xAxisProperties.xLabelMaxWidth,
            textMeasurementService.svgEllipsis
        );

        if (this.formattingSettings.misc.isAnimated.value && this.formattingSettings.misc.isStopped.value) {
            this.main
                .selectAll(LineDotChart.Line.selectorName)
                .selectAll(LineDotChart.dotPointsText)
                .remove();

            this.line
                .selectAll(LineDotChart.textSelector)
                .remove();

            return;
        }

        this.applyAxisSettings();

        const linePathSelection: Selection<SVGGElement, LineDotPoint[], any, any> = this.line
            .selectAll<SVGGElement, any>(LineDotChart.dotPathText)
            .data([this.data.dotPoints]);

        linePathSelection
            .exit()
            .remove();

        const lineTipSelection: Selection<SVGPathElement, LineDotPoint[], any, any> = this.line
            .selectAll<SVGPathElement, any>("g." + LineDotChart.dotPointsClass)
            .data([this.data.dotPoints]);

        lineTipSelection
            .exit()
            .remove();

        const linePathSelectionMerged = this.drawLine(linePathSelection);
        this.drawClipPath(linePathSelectionMerged);

        this.drawDots(lineTipSelection);
    }

    public applyAxisSettings(): void {
        let xColor: string = LineDotChart.axesDefaultColor,
            yColor: string = LineDotChart.axesDefaultColor,
            xFontSize: string = PixelConverter.fromPoint(LineDotChart.axesDefaultFontSize),
            yFontSize: string = PixelConverter.fromPoint(LineDotChart.axesDefaultFontSize);

        if (this.formattingSettings.xAxis.show.value === true) {
            xColor = this.formattingSettings.xAxis.color.value.value;
            xFontSize = PixelConverter.fromPoint(this.formattingSettings.xAxis.textSize.value);
            this.axisX.selectAll("line").style("stroke", xColor);
            this.axisX.selectAll("path").style("stroke", xColor);
            this.axisX.selectAll("text").style("fill", xColor).style("font-size", xFontSize);
        }

        if (this.formattingSettings.yAxis.show.value === true) {
            yColor = this.formattingSettings.yAxis.color.value.value;
            yFontSize = PixelConverter.fromPoint(this.formattingSettings.yAxis.textSize.value);
            this.axisY.selectAll("line").style("stroke", yColor);
            this.axisY.selectAll("path").style("stroke", yColor);
            this.axisY.selectAll("text").style("fill", yColor).style("font-size", yFontSize);

            if (this.formattingSettings.yAxis.isDuplicated.value) {
                this.axisY2.selectAll("line").style("stroke", yColor);
                this.axisY2.selectAll("path").style("stroke", yColor);
                this.axisY2.selectAll("text").style("fill", yColor).style("font-size", yFontSize);
            }
        }
    }

    private static gLineDotChartPayBtn: string = "g.lineDotChart__playBtn";
    private static playBtnGroupDiameter: number = 34;
    private static playBtnGroupLineValues: string = "M0 2l10 6-10 6z";
    private static playBtnGroupRectWidth: string = "2";
    private static playBtnGroupRectHeight: string = "12";
    private static StopButton: ClassAndSelector = createClassAndSelector("stop");
    private static PlayButton: ClassAndSelector = createClassAndSelector("lineDotChart__playBtn");

    private firstPathSelector: ClassAndSelector = createClassAndSelector("firstPath");
    private secondPathSelector: ClassAndSelector = createClassAndSelector("secondPath");

    private drawPlaybackButtons() {
        if (this.formattingSettings.playButton.show.value) {
            const playBtn: Selection<SVGGElement, string, any, any> = this.line
                .selectAll<SVGGElement, any>(LineDotChart.gLineDotChartPayBtn)
                .data([""]);

            const playBtnGroup: Selection<SVGGElement, string, any, any> = playBtn
                .enter()
                .append("g")
                .merge(playBtn);

            playBtnGroup
                .attr("transform", "translate(40, 20)")
                .classed(LineDotChart.PlayButton.className, true);

            playBtnGroup.style("opacity", this.formattingSettings.playButton.opacity.value.valueOf() / 100);

            const circleSelection: Selection<SVGCircleElement, any, any, any> = playBtnGroup
                .selectAll<SVGCircleElement, any>("circle")
                .data(d => [d]);

            const circleSelectionMegred = circleSelection
                .enter()
                .append("circle")
                .merge(circleSelection);

            circleSelectionMegred
                .attr("r", LineDotChart.playBtnGroupDiameter / 2)
                .on("click", () => this.setIsStopped(!this.formattingSettings.misc.isStopped.value));

            circleSelectionMegred.style("fill", this.formattingSettings.playButton.fill.value.value)
                .style("stroke", this.formattingSettings.playButton.stroke.value.value)
                .style("stroke-width", PixelConverter.toString(this.formattingSettings.playButton.strokeWidth.value.valueOf()))
                .style("opacity", this.formattingSettings.playButton.opacity.value.valueOf() / 100);

            circleSelection
                .exit()
                .remove();

            const firstPathSelection: Selection<SVGPathElement, any, any, any> = playBtnGroup
                .selectAll<SVGPathElement, any>(this.firstPathSelector.selectorName)
                .data(d => [d]);

            const firstPathSelectionMerged = firstPathSelection
                .enter()
                .append("path")
                .merge(firstPathSelection);

            firstPathSelectionMerged
                .classed("play", true)
                .attr("d", LineDotChart.playBtnGroupLineValues)
                .attr("transform", "translate(-4, -8)")
                .style("pointer-events", "none");

            firstPathSelectionMerged.style("fill", this.formattingSettings.playButton.innerColor.value.value);

            firstPathSelection
                .exit()
                .remove();

            const secondPathSelection: Selection<SVGPathElement, any, any, any> = playBtnGroup
                .selectAll<SVGPathElement, any>(this.secondPathSelector.selectorName)
                .data(d => [d]);

            const secondPathSelectionMerged = secondPathSelection
                .enter()
                .append("path")
                .merge(secondPathSelection);

            secondPathSelectionMerged
                .classed(LineDotChart.StopButton.className, true)
                .attr("d", LineDotChart.playBtnGroupLineValues)
                .attr("pointer-events", "none")
                .attr("transform", "translate(6, 8) rotate(180)");

            secondPathSelectionMerged.style("fill", this.formattingSettings.playButton.innerColor.value.value);

            secondPathSelection
                .exit()
                .remove();

            const rectSelection: Selection<SVGRectElement, any, any, any> = playBtnGroup
                .selectAll<SVGRectElement, any>("rect")
                .data(d => [d]);

            const rectSelectionMerged = rectSelection
                .enter()
                .append("rect")
                .merge(rectSelection);

            rectSelectionMerged
                .classed(LineDotChart.StopButton.className, true)
                .merge(rectSelection);

            rectSelectionMerged
                .attr("width", LineDotChart.playBtnGroupRectWidth)
                .attr("height", LineDotChart.playBtnGroupRectHeight)
                .attr("pointer-events", "none")
                .attr("transform", "translate(-7, -6)");

            rectSelectionMerged.style("fill", this.formattingSettings.playButton.innerColor.value.value);

            rectSelection
                .exit()
                .remove();

            playBtnGroup
                .selectAll("circle")
                .attr("opacity", () => this.formattingSettings.misc.isAnimated.value ? 1 : 0);

            playBtnGroup
                .selectAll(".play")
                .merge(playBtn)
                .attr("opacity", () => this.formattingSettings.misc.isAnimated.value && this.formattingSettings.misc.isStopped.value ? 1 : 0);

            playBtnGroup
                .selectAll(LineDotChart.StopButton.selectorName)
                .merge(playBtn)
                .attr("opacity", () => this.formattingSettings.misc.isAnimated.value && !this.formattingSettings.misc.isStopped.value ? 1 : 0);

            playBtn
                .exit()
                .remove();
        } else {
            this.line.selectAll(LineDotChart.PlayButton.selectorName).remove()
        }
    }

    private static pathClassName: string = "path";
    private static pathPlotClassName: string = "path.plot";
    private static plotClassName: string = "plot";
    private static lineClip: string = "lineClip";

    private drawLine(linePathSelection: Selection<SVGGElement, LineDotPoint[], any, any>) {
        const linePathSelectionMerged: Selection<SVGGElement, LineDotPoint[], any, any> = linePathSelection
            .enter()
            .append("g")
            .merge(linePathSelection);

        linePathSelectionMerged
            .classed(LineDotChart.pathClassName, true);

        const pathPlot: Selection<SVGPathElement, LineDotPoint[], any, any> = linePathSelectionMerged
            .selectAll<SVGPathElement, any>(LineDotChart.pathPlotClassName)
            .data(d => [d]);

        const pathPlotMerged = pathPlot
            .enter()
            .append("path")
            .merge(pathPlot);

        pathPlotMerged
            .classed(LineDotChart.plotClassName, true);

        // Draw the line
        const drawLine: Line<LineDotPoint> = line<LineDotPoint>()
            .x((dataPoint: LineDotPoint) => {
                return this.xAxisProperties.scale(dataPoint.dateValue.value);
            })
            .y((dataPoint: LineDotPoint) => {
                return this.yAxisProperties.scale(dataPoint.value);
            });

        pathPlotMerged
            .attr("stroke", () => this.formattingSettings.lineoptions.fill.value.value)
            .attr("stroke-width", this.formattingSettings.lineoptions.lineThickness.value.valueOf())
            .attr("d", drawLine)
            .attr("clip-path", "url(" + location.href + "#" + LineDotChart.lineClip + ")");

        return linePathSelectionMerged;
    }

    private static zeroX: number = 0;
    private static zeroY: number = 0;
    private static millisecondsInOneSecond: number = 1000;

    private drawClipPath(linePathSelection: Selection<BaseType, any, any, any>) {
        const clipPath: Selection<SVGClipPathElement, any, any, any> = linePathSelection
            .selectAll<SVGClipPathElement, any>("clipPath")
            .data(d => [d]);

        const clipPathMerged = clipPath
            .enter()
            .append("clipPath")
            .merge(clipPath);

        clipPathMerged
            .attr("id", LineDotChart.lineClip)
            .append("rect")
            .attr("x", LineDotChart.zeroX)
            .attr("y", LineDotChart.zeroY)
            .attr("height", this.layout.viewportIn.height);

        const line_left: any = this.xAxisProperties.scale(_.first(this.data.dotPoints).dateValue.value);
        const line_right: any = this.xAxisProperties.scale(_.last(this.data.dotPoints).dateValue.value);

        const rectSettings: LineAnimationSettings = this.getRectAnimationSettings(line_left, line_right);

        if (this.formattingSettings.misc.isAnimated.value) {
            clipPathMerged
                .selectAll("rect")
                .attr("x", rectSettings.startX)
                .attr("width", 0)
                .attr("height", this.layout.viewportIn.height)
                .interrupt()
                .transition()
                .ease(easeLinear)
                .duration(this.animationDuration * LineDotChart.millisecondsInOneSecond)
                .attr("x", rectSettings.endX)
                .attr("width", rectSettings.endWidth);
        } else {
            linePathSelection.selectAll("clipPath").remove();
        }
    }

    public getRectAnimationSettings(firstValue: number, secondValue: number): LineAnimationSettings {
        const isReverted: boolean = secondValue - firstValue < 0;

        if (isReverted) {
            return {
                startX: firstValue,
                endX: secondValue,
                endWidth: firstValue - secondValue
            };
        }

        // x always the same, in this case only width changes
        return {
            startX: firstValue,
            endX: firstValue,
            endWidth: secondValue - firstValue
        };
    }

    private static pointTime: number = 300;
    private static dotPointsClass: string = "dot-points";
    private static pointClassName: string = "point";
    private static pointScaleValue: number = 0;
    private static pointTransformScaleValue: number = 3.4;
    private static pointDelayCoefficient: number = 1000;

    private drawDots(lineTipSelection: Selection<SVGPathElement, LineDotPoint[], any, any>) {
        const point_time: number = this.formattingSettings.misc.isAnimated.value && !this.formattingSettings.misc.isStopped.value
            ? LineDotChart.pointTime
            : 0;

        const hasHighlights: boolean = this.data.hasHighlights;
        const hasSelection: boolean = this.interactivityService && this.interactivityService.hasSelection();

        // Draw the individual data points that will be shown on hover with a tooltip

        const lineTipSelectionMerged = lineTipSelection.enter()
            .append("g")
            .merge(lineTipSelection);

        lineTipSelectionMerged
            .classed(LineDotChart.dotPointsClass, true);

        const dotsSelection: Selection<SVGCircleElement, LineDotPoint, any, any> = lineTipSelectionMerged
            .selectAll<SVGCircleElement, LineDotPoint>("circle." + LineDotChart.pointClassName)
            .data(d => d);

        const dotsSelectionMerged = dotsSelection.enter()
            .append("circle")
            .merge(dotsSelection);

        dotsSelectionMerged
            .classed(LineDotChart.pointClassName, true)
            .on("mouseover.point", this.showDataPoint)
            .on("mouseout.point", this.hideDataPoint);

        dotsSelectionMerged
            .style("fill", this.formattingSettings.dotoptions.color.value.value)
            .style("stroke", this.formattingSettings.dotoptions.stroke)
            .style("stroke-opacity", this.formattingSettings.dotoptions.strokeOpacity)
            .style("stroke-width", this.formattingSettings.dotoptions.strokeWidth
                ? PixelConverter.toString(this.formattingSettings.dotoptions.strokeWidth)
                : null)
            .style("opacity", (dotPoint: LineDotPoint) => {
                return getFillOpacity(
                    dotPoint,
                    dotPoint.selected,
                    dotPoint.highlight,
                    !dotPoint.highlight && hasSelection,
                    !dotPoint.selected && hasHighlights
                );
            })
            .attr("r", (dotPoint: LineDotPoint) => {
                return this.formattingSettings.dotoptions.dotSizeMin.value
                    + dotPoint.dot * (this.formattingSettings.dotoptions.dotSizeMax.value - this.formattingSettings.dotoptions.dotSizeMin.value);
            });

        this.handleDotsTransformation(dotsSelectionMerged, point_time);

        this.tooltipServiceWrapper.addTooltip<LineDotPoint>(
            dotsSelectionMerged,
            (dataPoint: LineDotPoint) => this.getTooltipDataItems(dataPoint));

        dotsSelection
            .exit()
            .remove();

        lineTipSelection
            .exit()
            .remove();

        if (this.interactivityService) {
            const behaviorOptions: BehaviorOptions = {
                selection: dotsSelectionMerged,
                clearCatcher: this.root,
                hasHighlights: hasHighlights,
                behavior: this.behavior,
                dataPoints: this.data.dotPoints,
            };

            this.interactivityService.bind(behaviorOptions);
        }
    }

    private handleDotsTransformation(dotsSelectionMerged: Selection<SVGCircleElement, LineDotPoint, any, any>, point_time: number) {
        if (this.formattingSettings.misc.isAnimated.value) {
            const maxTextLength: number = Math.min(
                350,
                this.xAxisProperties.scale.range()[1] - this.xAxisProperties.scale.range()[0] - 60
            );

            const lineText: Selection<SVGTextElement, string, any, any> = this.line
                .selectAll<SVGTextElement, any>(LineDotChart.textSelector)
                .data([""]);

            const lineTextMerged = lineText
                .enter()
                .append("text")
                .merge(lineText);

            lineTextMerged
                .attr("text-anchor", "end")
                .classed("text", true);

            lineTextMerged
                .attr("x", this.layout.viewportIn.width - LineDotChart.widthMargin)
                .attr("y", LineDotChart.yPosition)
                .style("fill", this.formattingSettings.counteroptions.color.value.value)
                .style("font-size", PixelConverter.toString(PixelConverter.fromPointToPixel(this.formattingSettings.counteroptions.textSize.value)))
                .call(selection => textMeasurementService.svgEllipsis(<any>selection.node(), maxTextLength));

            lineText
                .exit()
                .remove();

            dotsSelectionMerged
                .interrupt()
                .attr("transform", (dataPoint: LineDotPoint) => {
                    return SVGManipulations.translateAndScale(
                        this.xAxisProperties.scale(dataPoint.dateValue.value),
                        this.yAxisProperties.scale(dataPoint.value),
                        LineDotChart.pointScaleValue);
                })
                .transition()
                .on("start", (d: LineDotPoint, i: number) => {
                    if (this.formattingSettings.counteroptions.show.value) {
                        let text: string = `${this.formattingSettings.counteroptions.counterTitle.value.valueOf()} `;

                        if (d.counter) {
                            text += this.formattingSettings.isCounterDateTime.isCounterDateTime
                                ? this.data.dateColumnFormatter.format(new Date(d.counter))
                                : d.counter;
                        } else {
                            text += (i + 1);
                        }
                        this.updateLineText(lineTextMerged, text);
                    } else {
                        this.updateLineText(lineTextMerged, "");
                    }
                })
                .duration(point_time)
                .delay((_, i: number) => this.pointDelay(this.data.dotPoints, i, this.animationDuration))
                .ease(easeLinear)
                .attr("transform", (dataPoint: LineDotPoint) => {
                    return SVGManipulations.translateAndScale(
                        this.xAxisProperties.scale(dataPoint.dateValue.value),
                        this.yAxisProperties.scale(dataPoint.value),
                        LineDotChart.pointTransformScaleValue);
                })
                .transition()
                .duration(point_time)
                .delay((_, i: number) => {
                    return (this.pointDelay(this.data.dotPoints, i, this.animationDuration) + point_time) / LineDotChart.pointDelayCoefficient;
                })
                .ease(easeElastic)
                .attr("transform", (dataPoint: LineDotPoint) => {
                    return SVGManipulations.translateAndScale(
                        this.xAxisProperties.scale(dataPoint.dateValue.value),
                        this.yAxisProperties.scale(dataPoint.value),
                        1);
                });
        } else {
            dotsSelectionMerged
                .interrupt()
                .attr("transform", (dataPoint: LineDotPoint) => {
                    return SVGManipulations.translateAndScale(
                        this.xAxisProperties.scale(dataPoint.dateValue.value),
                        this.yAxisProperties.scale(dataPoint.value),
                        1);
                });

            this.line
                .selectAll(LineDotChart.textSelector)
                .remove();
        }
    }

    private get animationDuration(): number {
        if (this.formattingSettings && this.formattingSettings.misc) {
            return this.formattingSettings.misc.duration.value.valueOf();
        }
        return 0;
    }

    private stopAnimation(): void {
        this.line.selectAll("*")
            .transition()
            .duration(0)
            .delay(0);

        timerFlush();
    }

    private static textSelector: string = "text.text";
    private static widthMargin: number = 85;
    private static yPosition: number = 30;

    private updateLineText(textSelector: Selection<BaseType, any, any, any>, text?: string): void {
        textSelector.text(text);
    }

    private pointDelay(points: LineDotPoint[], num: number, animation_duration: number): number {
        if (!points.length
            || !points[num]
            || num === 0
            || !this.formattingSettings.misc.isAnimated.value
            || this.formattingSettings.misc.isStopped.value
        ) {

            return 0;
        }

        const time: number = points[num].dateValue.value;
        const min: number = points[0].dateValue.value;
        const max: number = points[points.length - 1].dateValue.value;

        return animation_duration * 1000 * (time - min) / (max - min);
    }

    private static showClassName: string = "show";

    private showDataPoint(): void {
        select(<any>this).classed(LineDotChart.showClassName, true);
    }

    private hideDataPoint(): void {
        select(<any>this).classed(LineDotChart.showClassName, false);
    }

    public getTooltipDataItems(dataPoint?: LineDotPoint): VisualTooltipDataItem[] {
        if (!dataPoint) {
            return [];
        }

        const unformattedDate: string | number = dataPoint.dateValue.label || dataPoint.dateValue.value;

        const formattedDate: string = this.data.dateColumnFormatter.format(unformattedDate);
        const formattedValue: string = this.data.dataValueFormatter.format(dataPoint.value);

        const columnNames: ColumnNames = this.data.columnNames;

        return [
            {
                displayName: columnNames.category,
                value: formattedDate
            },
            {
                displayName: columnNames.values,
                value: formattedValue
            }
        ];
    }

    private renderLegends(): void {
        const legendSelection: Selection<BaseType, Legend, any, any> = this.legends
            .selectAll(LineDotChart.Legend.selectorName)
            .data(this.generateAxisLabels());

        const legendSelectionMerged = legendSelection
            .enter()
            .append("svg:text")
            .merge(legendSelection);

        legendSelectionMerged
            .attr("x", 0)
            .attr("y", 0)
            .attr("dx", (legend: Legend) => legend.dx)
            .attr("dy", (legend: Legend) => legend.dy)
            .attr("transform", (legend: Legend) => legend.transform)
            .text((legend: Legend) => legend.text)
            .classed(LineDotChart.Legend.className, true);

        legendSelection
            .exit()
            .remove();
    }
}