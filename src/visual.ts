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

import * as d3 from "d3";
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
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;

import ILocalizationManager = powerbi.extensibility.ILocalizationManager;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import IVisual = powerbi.extensibility.visual.IVisual;
import ISelectionId = powerbi.visuals.ISelectionId;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;

import { axis as AxisHelper, axisInterfaces } from "powerbi-visuals-utils-chartutils";
import IAxisProperties = axisInterfaces.IAxisProperties;

import { valueFormatter as vf, textMeasurementService as tms } from "powerbi-visuals-utils-formattingutils";
import TextMeasurementService = tms.textMeasurementService;
import IValueFormatter = vf.IValueFormatter;
import valueFormatter = vf.valueFormatter;

import * as SVGUtil from "powerbi-visuals-utils-svgutils";
import SVGManipulations = SVGUtil.manipulation;
import ClassAndSelector = SVGUtil.CssConstants.ClassAndSelector;
import createClassAndSelector = SVGUtil.CssConstants.createClassAndSelector;

import { valueType as vt, pixelConverter as PixelConverter } from "powerbi-visuals-utils-typeutils";
import valueType = vt.ValueType;

import { TooltipEventArgs, ITooltipServiceWrapper, createTooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import { ColorHelper } from "powerbi-visuals-utils-colorutils";

import { interfaces, interactivityUtils, interactivityService } from "powerbi-visuals-utils-interactivityutils";
import createInteractivityService = interactivityService.createInteractivityService;
import SelectableDataPoint = interactivityService.SelectableDataPoint;
import IInteractiveBehavior = interactivityService.IInteractiveBehavior;
import IInteractivityService = interactivityService.IInteractivityService;

import { VisualLayout } from "./visualLayout";
import { Behavior, BehaviorOptions, getFillOpacity } from "./behavior";
import { LineDotChartColumns } from "./columns";
import { LineSettings, Settings } from "./settings";
import {
    Legend,
    LineDotChartViewModel,
    LineDotPoint,
    DateValue,
    ColumnNames
} from "./dataInterfaces";
import { textMeasurementService } from "powerbi-visuals-utils-formattingutils/lib/textMeasurementService";

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

    private root: d3.Selection<d3.BaseType, any, any, any>;
    private main: d3.Selection<d3.BaseType, any, any, any>;
    private axes: d3.Selection<d3.BaseType, any, any, any>;
    private axisX: d3.Selection<d3.BaseType, any, any, any>;
    private axisY: d3.Selection<d3.BaseType, any, any, any>;
    private axisY2: d3.Selection<d3.BaseType, any, any, any>;
    private legends: d3.Selection<d3.BaseType, any, any, any>;
    private line: d3.Selection<d3.BaseType, any, any, any>;
    private xAxisProperties: IAxisProperties;
    private yAxisProperties: IAxisProperties;
    private yAxis2Properties: IAxisProperties;
    private layout: VisualLayout;
    private interactivityService: IInteractivityService;
    private behavior: IInteractiveBehavior;
    private hostService: IVisualHost;
    private localizationManager: ILocalizationManager;

    public data: LineDotChartViewModel;

    private get settings(): Settings {
        return this.data && this.data.settings;
    }

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

    public static columnFormattingFn(data: LineDotChartViewModel) {
        return function (index: number, dataType: valueType): any {
            if (dataType.dateTime) {
                return data.dateColumnFormatter.format(new Date(index));
            }
            else if (dataType.text) {
                return data.dateValues[index].label;
            }
            return data.dateColumnFormatter.format(index);
        };
    }

    public static valueFormattingFn(data: LineDotChartViewModel) {
        return function (index: number, dataType: valueType): any {
            if (dataType.dateTime) {
                return data.dataValueFormatter.format(new Date(index));
            }
            else if (dataType.text) {
                return data.dateValues[index].label;
            }
            let formatted: string = data.dataValueFormatter.format(index);

            return formatted !== index.toString() ? formatted : index;
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

        this.layout = new VisualLayout(null, LineDotChart.viewportMargins);
        this.layout.minViewport = LineDotChart.viewportDimensions;

        this.interactivityService = createInteractivityService(options.host);
        this.behavior = new Behavior();

        this.root = d3.select(options.element)
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
        if (!options
            || !options.dataViews
            || !options.dataViews[0]
        ) {
            return;
        }

        this.layout.viewport = options.viewport;

        const data: LineDotChartViewModel = LineDotChart.converter(
            options.dataViews[0],
            this.hostService,
            this.localizationManager,
            this.colorHelper,
        );

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
    }

    public destroy() {
        this.root = null;
    }

    public clear() {
        if (this.settings && this.settings.misc) {
            this.settings.misc.isAnimated = false;
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
    }

    public setIsStopped(isStopped: Boolean): void {
        let objects: VisualObjectInstancesToPersist = {
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

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        return Settings.enumerateObjectInstances(
            this.settings || Settings.getDefault(),
            options
        );
    }

    private clearElement(selection: d3.Selection<d3.BaseType, any, any, any>): void {
        selection
            .selectAll("*")
            .remove();
    }

    private static dateMaxCutter: number = .05;
    private static makeSomeSpaceForCounter: number = .10;

    private static converter(
        dataView: DataView,
        visualHost: IVisualHost,
        localizationManager: ILocalizationManager,
        colorHelper: ColorHelper,
    ): LineDotChartViewModel {
        let categorical: LineDotChartColumns<DataViewCategoryColumn & DataViewValueColumn[]>
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

        const settings: Settings = Settings.parseSettings(
            dataView,
            localizationManager,
            colorHelper,
        );

        if (counterValues && counterValues.length > 0) {
            let fValue: any = counterValues[0];
            settings.isCounterDateTime.isCounterDateTime = fValue.getDate ? true : false;
        }

        let hasHighlights: boolean = !!(categorical.Values.length > 0 && valuesColumn.highlights);

        const dateColumnFormatter = valueFormatter.create({
            format: valueFormatter.getFormatStringByColumn(categorical.Date.source, true) || categorical.Date.source.format,
            cultureSelector: visualHost.locale
        });

        let extentValues: [number, number] = d3.extent(categoricalValues.Values),
            yMinValue: number = extentValues[0],
            yMaxValue: number = extentValues[1],
            dotPoints: LineDotPoint[] = [],
            sumOfValues: number = 0;

        const dateValues: DateValue[] = [],
            isOrdinal: boolean = AxisHelper.isOrdinal(categoryType),
            isDateTime: boolean = AxisHelper.isDateTime(categoryType);

        for (let valueIndex: number = 0, length: number = categoricalValues.Date.length; valueIndex < length; valueIndex++) {
            const value: number = categoricalValues.Values[valueIndex] || 0;
            let dateValue: DateValue = new DateValue(categoricalValues.Date[valueIndex], null);

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
                opacity: settings.dotoptions.percentile / 100,
                counter: counterValues ? counterValues[valueIndex] : null
            });
        }

        // make some space for counter + 25%
        sumOfValues = sumOfValues + (sumOfValues - yMinValue) * LineDotChart.makeSomeSpaceForCounter;

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
            settings,
            dataValueFormatter,
            dateColumnFormatter,
            isOrdinal,
            dateValues,
            yMinValue,
            yMaxValue,
            sumOfValues,
            hasHighlights,
            dateMetadataColumn: categorical.Date.source,
            valuesMetadataColumn: valuesColumn.source
        };
    }

    private static getDisplayName(column: DataViewCategoricalColumn): string {
        return (column && column.source && column.source.displayName) || "";
    }

    private static outerPadding: number = 0;
    private static forcedTickSize: number = 150;
    private static xLabelMaxWidth: number = 160;
    private static xLabelTickSize: number = 3.2;

    private calculateAxes() {
        let effectiveWidth: number = Math.max(0, this.layout.viewportIn.width - LineDotChart.LegendSize - LineDotChart.AxisSize);
        let effectiveHeight: number = Math.max(0, this.layout.viewportIn.height - LineDotChart.LegendSize);

        const extentDate: [number, number] = d3.extent(
            this.data.dateValues,
            (dateValue: DateValue) => dateValue.value);

        let minDate: number = extentDate[0],
            maxDate: number = extentDate[1] + (extentDate[1] - extentDate[0]) * LineDotChart.dateMaxCutter;

        this.xAxisProperties = AxisHelper.createAxis({
            pixelSpan: effectiveWidth,
            dataDomain: !this.data.isOrdinal
                ? [minDate, maxDate]
                : this.data.dateValues.map((dateValue: DateValue, index: number) => { return dateValue.value; }),
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
            getValueFn: LineDotChart.columnFormattingFn(this.data)
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
            getValueFn: LineDotChart.valueFormattingFn(this.data)
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
            getValueFn: LineDotChart.valueFormattingFn(this.data)
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

        if (this.settings.xAxis.show === true) {
            this.axisX.call(this.xAxisProperties.axis);
        } else {
            this.clearElement(this.axisX);
        }

        if (this.settings.yAxis.show === true) {
            this.axisY.call(this.yAxisProperties.axis);

            if (this.settings.yAxis.isDuplicated) {
                const scale: any = this.yAxis2Properties.scale;
                const ticksCount: number = this.yAxis2Properties.values.length;
                const format: any = (domainValue: d3.AxisDomain, value: any) => this.yAxis2Properties.values[value];

                let axis = d3.axisRight(scale);
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
            TextMeasurementService.svgEllipsis
        );

        if (this.settings.misc.isAnimated && this.settings.misc.isStopped) {
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

        let linePathSelection: d3.Selection<d3.BaseType, LineDotPoint[], any, any> = this.line
            .selectAll(LineDotChart.dotPathText)
            .data([this.data.dotPoints]);

        linePathSelection
            .exit()
            .remove();

        const lineTipSelection: d3.Selection<d3.BaseType, LineDotPoint[], any, any> = this.line
            .selectAll("g." + LineDotChart.dotPointsClass)
            .data([this.data.dotPoints]);

        lineTipSelection
            .exit()
            .remove();

        let linePathSelectionMerged = this.drawLine(linePathSelection);
        this.drawClipPath(linePathSelectionMerged);

        this.drawDots(lineTipSelection);
    }

    public applyAxisSettings(): void {
        let xColor: string = LineDotChart.axesDefaultColor,
            yColor: string = LineDotChart.axesDefaultColor,
            xFontSize: string = PixelConverter.fromPoint(LineDotChart.axesDefaultFontSize),
            yFontSize: string = PixelConverter.fromPoint(LineDotChart.axesDefaultFontSize);

        if (this.settings.xAxis.show === true) {
            xColor = this.settings.xAxis.color;
            xFontSize = PixelConverter.fromPoint(this.settings.xAxis.textSize);
            this.axisX.selectAll("line").style("stroke", function (d, i) { return xColor; });
            this.axisX.selectAll("path").style("stroke", function (d, i) { return xColor; });
            this.axisX.selectAll("text").style("fill", function (d, i) { return xColor; }).style("font-size", xFontSize);
        }

        if (this.settings.yAxis.show === true) {
            yColor = this.settings.yAxis.color;
            yFontSize = PixelConverter.fromPoint(this.settings.yAxis.textSize);
            this.axisY.selectAll("line").style("stroke", function (d, i) { return yColor; });
            this.axisY.selectAll("path").style("stroke", function (d, i) { return yColor; });
            this.axisY.selectAll("text").style("fill", function (d, i) { return yColor; }).style("font-size", yFontSize);

            if (this.settings.yAxis.isDuplicated) {
                this.axisY2.selectAll("line").style("stroke", function (d, i) { return yColor; });
                this.axisY2.selectAll("path").style("stroke", function (d, i) { return yColor; });
                this.axisY2.selectAll("text").style("fill", function (d, i) { return yColor; }).style("font-size", yFontSize);
            }
        }
    }

    private static lineDotChartPlayBtn: string = "lineDotChart__playBtn";

    private static gLineDotChartPayBtn: string = "g.lineDotChart__playBtn";
    private static playBtnGroupDiameter: number = 34;
    private static playBtnGroupLineValues: string = "M0 2l10 6-10 6z";
    private static playBtnGroupRectWidth: string = "2";
    private static playBtnGroupRectHeight: string = "12";
    private static StopButton: ClassAndSelector = createClassAndSelector("stop");

    private firstPathSelector: ClassAndSelector = createClassAndSelector("firstPath");
    private secondPathSelector: ClassAndSelector = createClassAndSelector("secondPath");

    private drawPlaybackButtons() {
        const playBtn: d3.Selection<d3.BaseType, string, any, any> = this.line
            .selectAll(LineDotChart.gLineDotChartPayBtn)
            .data([""]);

        const playBtnGroup: d3.Selection<d3.BaseType, string, any, any> = playBtn
            .enter()
            .append("g")
            .merge(playBtn);

        playBtnGroup
            .attr("transform", "translate(40, 20)")
            .classed(LineDotChart.lineDotChartPlayBtn, true);

        playBtnGroup.style("opacity", this.settings.play.opacity);

        const circleSelection: d3.Selection<d3.BaseType, any, any, any> = playBtnGroup
            .selectAll("circle")
            .data(d => [d]);

        const circleSelectionMegred = circleSelection
            .enter()
            .append("circle")
            .merge(circleSelection);

        circleSelectionMegred
            .attr("r", LineDotChart.playBtnGroupDiameter / 2)
            .on("click", () => this.setIsStopped(!this.settings.misc.isStopped));

        circleSelectionMegred.style("fill", this.settings.play.fill)
            .style("stroke", this.settings.play.stroke)
            .style("stroke-width", PixelConverter.toString(this.settings.play.strokeWidth))
            .style("opacity", this.settings.play.opacity);

        circleSelection
            .exit()
            .remove();

        const firstPathSelection: d3.Selection<d3.BaseType, any, any, any> = playBtnGroup
            .selectAll(this.firstPathSelector.selectorName)
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

        firstPathSelectionMerged.style("fill", this.settings.play.innerColor);

        firstPathSelection
            .exit()
            .remove();

        const secondPathSelection: d3.Selection<d3.BaseType, any, any, any> = playBtnGroup
            .selectAll(this.secondPathSelector.selectorName)
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

        secondPathSelectionMerged.style("fill", this.settings.play.innerColor);

        secondPathSelection
            .exit()
            .remove();

        const rectSelection: d3.Selection<d3.BaseType, any, any, any> = playBtnGroup
            .selectAll("rect")
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

        rectSelectionMerged.style("fill", this.settings.play.innerColor);

        rectSelection
            .exit()
            .remove();

        playBtnGroup
            .selectAll("circle")
            .attr("opacity", () => this.settings.misc.isAnimated ? 1 : 0);

        playBtnGroup
            .selectAll(".play")
            .merge(playBtn)
            .attr("opacity", () => this.settings.misc.isAnimated && this.settings.misc.isStopped ? 1 : 0);

        playBtnGroup
            .selectAll(LineDotChart.StopButton.selectorName)
            .merge(playBtn)
            .attr("opacity", () => this.settings.misc.isAnimated && !this.settings.misc.isStopped ? 1 : 0);

        playBtn
            .exit()
            .remove();
    }

    private static pathClassName: string = "path";
    private static pathPlotClassName: string = "path.plot";
    private static plotClassName: string = "plot";
    private static lineClip: string = "lineClip";

    private drawLine(linePathSelection: d3.Selection<d3.BaseType, LineDotPoint[], any, any>) {
        const linePathSelectionMerged = linePathSelection
            .enter()
            .append("g")
            .merge(linePathSelection);

        linePathSelectionMerged
            .classed(LineDotChart.pathClassName, true);

        let pathPlot: d3.Selection<d3.BaseType, LineDotPoint[], any, any> = linePathSelectionMerged
            .selectAll(LineDotChart.pathPlotClassName)
            .data(d => [d]);

        const pathPlotMerged = pathPlot
            .enter()
            .append("path")
            .merge(pathPlot);

        pathPlotMerged
            .classed(LineDotChart.plotClassName, true);

        // Draw the line
        const drawLine: d3.Line<LineDotPoint> = d3.line<LineDotPoint>()
            .x((dataPoint: LineDotPoint) => {
                return this.xAxisProperties.scale(dataPoint.dateValue.value);
            })
            .y((dataPoint: LineDotPoint) => {
                return this.yAxisProperties.scale(dataPoint.value);
            });

        pathPlotMerged
            .attr("stroke", () => this.settings.lineoptions.fill)
            .attr("stroke-width", this.settings.lineoptions.lineThickness)
            .attr("d", drawLine)
            .attr("clip-path", "url(" + location.href + "#" + LineDotChart.lineClip + ")");

        return linePathSelectionMerged;
    }

    private static zeroX: number = 0;
    private static zeroY: number = 0;
    private static millisecondsInOneSecond: number = 1000;

    private drawClipPath(linePathSelection: d3.Selection<d3.BaseType, any, any, any>) {
        const clipPath: d3.Selection<d3.BaseType, any, any, any> = linePathSelection
            .selectAll("clipPath")
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

        if (this.settings.misc.isAnimated) {
            clipPathMerged
                .selectAll("rect")
                .attr("x", rectSettings.startX)
                .attr("width", 0)
                .attr("height", this.layout.viewportIn.height)
                .interrupt()
                .transition()
                .ease(d3.easeLinear)
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

    private drawDots(lineTipSelection) {
        const point_time: number = this.settings.misc.isAnimated && !this.settings.misc.isStopped
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

        const dotsSelection: d3.Selection<d3.BaseType, LineDotPoint, any, any> = lineTipSelectionMerged
            .selectAll("circle." + LineDotChart.pointClassName)
            .data(d => d);

        const dotsSelectionMerged = dotsSelection.enter()
            .append("circle")
            .merge(dotsSelection);

        dotsSelectionMerged
            .classed(LineDotChart.pointClassName, true)
            .on("mouseover.point", this.showDataPoint)
            .on("mouseout.point", this.hideDataPoint);

        dotsSelectionMerged
            .style("fill", this.settings.dotoptions.color)
            .style("stroke", this.settings.dotoptions.stroke)
            .style("stroke-opacity", this.settings.dotoptions.strokeOpacity)
            .style("stroke-width", this.settings.dotoptions.strokeWidth
                ? PixelConverter.toString(this.settings.dotoptions.strokeWidth)
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
                return this.settings.dotoptions.dotSizeMin
                    + dotPoint.dot * (this.settings.dotoptions.dotSizeMax - this.settings.dotoptions.dotSizeMin);
            });

        if (this.settings.misc.isAnimated) {
            const maxTextLength: number = Math.min(
                350,
                this.xAxisProperties.scale.range()[1] - this.xAxisProperties.scale.range()[0] - 60
            );

            const lineText: d3.Selection<d3.BaseType, string, any, any> = this.line
                .selectAll(LineDotChart.textSelector)
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
                .style("fill", this.settings.counteroptions.color)
                .style("font-size", PixelConverter.toString(PixelConverter.fromPointToPixel(this.settings.counteroptions.textSize)))
                .call(selection => TextMeasurementService.svgEllipsis(<any>selection.node(), maxTextLength));

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
                .each((d: LineDotPoint, i: number) => {
                    if (this.settings.counteroptions.show) {
                        let text: string = `${this.settings.counteroptions.counterTitle} `;

                        if (d.counter) {
                            text += this.settings.isCounterDateTime.isCounterDateTime
                                ? this.data.dateColumnFormatter.format(d.counter)
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
                .ease(d3.easeLinear)
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
                .ease(d3.easeElastic)
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

        this.tooltipServiceWrapper.addTooltip<LineDotPoint>(
            dotsSelectionMerged,
            (tooltipEvent: TooltipEventArgs<LineDotPoint>) => {
                return this.getTooltipDataItems(tooltipEvent.data);
            });

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
            };

            this.interactivityService.bind(
                this.data.dotPoints,
                this.behavior,
                behaviorOptions,
            );
        }
    }

    private get animationDuration(): number {
        if (this.settings && this.settings.misc) {
            return this.settings.misc.duration;
        }
        return 0;
    }

    private stopAnimation(): void {
        this.line.selectAll("*")
            .transition()
            .duration(0)
            .delay(0);

        d3.timerFlush();
    }

    private static textSelector: string = "text.text";
    private static widthMargin: number = 85;
    private static yPosition: number = 30;

    private updateLineText(textSelector: d3.Selection<d3.BaseType, any, any, any>, text?: string): void {
        textSelector.text(d => text);
    }

    private pointDelay(points: LineDotPoint[], num: number, animation_duration: number): number {
        if (!points.length
            || !points[num]
            || num === 0
            || !this.settings.misc.isAnimated
            || this.settings.misc.isStopped
        ) {

            return 0;
        }

        const time: number = points[num].dateValue.value;
        const min: number = points[0].dateValue.value;
        const max: number = points[points.length - 1].dateValue.value;

        return animation_duration * 1000 * (time - min) / (max - min);
    }

    private static showClassName: string = "show";

    private showDataPoint(data: LineDotPoint, index: number): void {
        d3.select(<any>this).classed(LineDotChart.showClassName, true);
    }

    private hideDataPoint(data: LineDotPoint, index: number): void {
        d3.select(<any>this).classed(LineDotChart.showClassName, false);
    }

    public getTooltipDataItems(dataPoint: LineDotPoint): VisualTooltipDataItem[] {
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
        const legendSelection: d3.Selection<d3.BaseType, Legend, any, any> = this.legends
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

