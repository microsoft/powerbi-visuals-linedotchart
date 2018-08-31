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

import * as d3 from "d3";
import * as _ from "lodash";
import powerbi from "powerbi-visuals-api";

import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import { VisualLayout } from "./visualLayout";
import IVisual = powerbi.extensibility.visual.IVisual;
import IViewport = powerbi.IViewport;
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;
import ISelectionId = powerbi.visuals.ISelectionId;

import { axis as AxisHelper, axisInterfaces } from "powerbi-visuals-utils-chartutils";
import IAxisProperties = axisInterfaces.IAxisProperties;

import { valueFormatter as vf, textMeasurementService as TextMeasurementService } from "powerbi-visuals-utils-formattingutils";
import IValueFormatter = vf.IValueFormatter;

import * as SVGUtil from "powerbi-visuals-utils-svgutils";
import ClassAndSelector = SVGUtil.CssConstants.ClassAndSelector;
import createClassAndSelector = SVGUtil.CssConstants.createClassAndSelector;

import { valueType, pixelConverter as PixelConverter } from "powerbi-visuals-utils-typeutils";
import { TooltipEventArgs, ITooltipServiceWrapper, createTooltipServiceWrapper } from "powerbi-visuals-utils-tooltiputils";
import { interfaces, interactivityUtils, interactivityService } from "powerbi-visuals-utils-interactivityutils";
import SelectableDataPoint = interactivityService.SelectableDataPoint;
import IInteractiveBehavior = interactivityService.IInteractiveBehavior;
import IInteractivityService = interactivityService.IInteractivityService;
import { LineSettings } from "./settings"
import {
    Legend,
    LineDotChartViewModel,
    LineDotPoint,
    DateValue,
    ColumnNames
} from "./dataInterfaces"
import { Behavior, BehaviorOptions } from "./behavior";
import { LineDotChartColumns } from "./columns";
import { ColorHelper } from "powerbi-visuals-utils-colorutils";

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



    private root: d3.Selection<any>;
    private main: d3.Selection<any>;
    private axes: d3.Selection<any>;
    private axisX: d3.Selection<any>;
    private axisY: d3.Selection<any>;
    private axisY2: d3.Selection<any>;
    private legends: d3.Selection<any>;
    private line: d3.Selection<any>;
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
        this.behavior = new behavior.Behavior();

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

    private clearElement(selection: d3.Selection<any>): void {
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

        this.yAxis2Properties.axis.orient("right");
    }

    private static rotateAngle: number = 270;

    private generateAxisLabels(): Legend[] {
        return [
            {
                transform: SVGUtil.translate((this.layout.viewportIn.width) / 2, (this.layout.viewportIn.height)),
                text: "", // xAxisTitle
                dx: "1em",
                dy: "-1em"
            }, {
                transform: SVGUtil.translateAndRotate(0, this.layout.viewportIn.height / 2, 0, 0, LineDotChart.rotateAngle),
                text: "", // yAxisTitle
                dx: "3em"
            }
        ];
    }

    private resize(): void {
        this.root.attr({
            width: this.layout.viewport.width,
            height: this.layout.viewport.height
        });

        this.main.attr(
            "transform",
            SVGUtil.translate(this.layout.margin.left, this.layout.margin.top)
        );

        this.legends.attr(
            "transform",
            SVGUtil.translate(this.layout.margin.left, this.layout.margin.top)
        );

        this.line.attr(
            "transform",
            SVGUtil.translate(this.layout.margin.left + LineDotChart.LegendSize, 0)
        );

        this.axes.attr(
            "transform",
            SVGUtil.translate(this.layout.margin.left + LineDotChart.LegendSize, 0)
        );

        this.axisX.attr(
            "transform",
            SVGUtil.translate(0, this.layout.viewportIn.height - LineDotChart.LegendSize)
        );

        this.axisY2.attr(
            "transform",
            SVGUtil.translate(this.layout.viewportIn.width - LineDotChart.LegendSize - LineDotChart.AxisSize, 0)
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
                this.axisY2.call(this.yAxis2Properties.axis);
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

        let linePathSelection: d3.selection.Update<LineDotPoint[]> = this.line
            .selectAll(LineDotChart.dotPathText)
            .data([this.data.dotPoints]);

        linePathSelection
            .exit()
            .remove();

        this.drawLine(linePathSelection);
        this.drawClipPath(linePathSelection);

        this.drawDots();
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

    public static edgeAndIETranslateY: number = 4;
    public static standartTranslateY: number = 8;

    public static getActivePlayBackButtonTranslateY() {
        const userAgent = window.navigator.userAgent;
        let translateY: number = (userAgent.indexOf("Edge") !== -1 || userAgent.indexOf("MSIE") !== -1) ?
            LineDotChart.edgeAndIETranslateY : LineDotChart.standartTranslateY;

        return translateY;
    }

    private drawPlaybackButtons() {
        const playBtn: d3.selection.Update<string> = this.line
            .selectAll(LineDotChart.gLineDotChartPayBtn)
            .data([""]);

        const playBtnGroup: d3.Selection<string> = playBtn
            .enter()
            .append("g")
            .attr("transform", "translate(40, 20)")
            .classed(LineDotChart.lineDotChartPlayBtn, true);

        playBtnGroup.style("opacity", this.settings.play.opacity);

        const circleSelection: d3.selection.Update<any> = playBtnGroup
            .selectAll("circle")
            .data(d => [d]);

        circleSelection
            .enter()
            .append("circle")
            .attr("r", LineDotChart.playBtnGroupDiameter / 2)
            .on("click", () => this.setIsStopped(!this.settings.misc.isStopped));

        circleSelection.style({
            fill: this.settings.play.fill,
            stroke: this.settings.play.stroke,
            "stroke-width": PixelConverter.toString(this.settings.play.strokeWidth),
            opacity: this.settings.play.opacity,
        });

        circleSelection
            .exit()
            .remove();

        const firstPathSelection: d3.selection.Update<any> = playBtnGroup
            .selectAll(this.firstPathSelector.selectorName)
            .data(d => [d]);

        firstPathSelection
            .enter()
            .append("path")
            .classed("play", true)
            .attr({
                "d": LineDotChart.playBtnGroupLineValues,
                "transform": "translate(-4, -8)",
            })
            .style("pointer-events", "none");

        firstPathSelection.style("fill", this.settings.play.innerColor);

        firstPathSelection
            .exit()
            .remove();

        const secondPathSelection: d3.selection.Update<any> = playBtnGroup
            .selectAll(this.secondPathSelector.selectorName)
            .data(d => [d]);

        secondPathSelection
            .enter()
            .append("path")
            .classed(LineDotChart.StopButton.className, true)
            .attr({
                "d": LineDotChart.playBtnGroupLineValues,
                "pointer-events": "none",
                "transform-origin": "top left",
                "transform": "translate(6, " + LineDotChart.getActivePlayBackButtonTranslateY() + ") rotate(180)"
            });

        secondPathSelection.style("fill", this.settings.play.innerColor);

        secondPathSelection
            .exit()
            .remove();

        const rectSelection: d3.selection.Update<any> = playBtnGroup
            .selectAll("rect")
            .data(d => [d]);

        rectSelection
            .enter()
            .append("rect")
            .classed(LineDotChart.StopButton.className, true)
            .attr({
                "width": LineDotChart.playBtnGroupRectWidth,
                "height": LineDotChart.playBtnGroupRectHeight,
                "pointer-events": "none",
                "transform": "translate(-7, -6)",
            });

        rectSelection.style("fill", this.settings.play.innerColor);

        rectSelection
            .exit()
            .remove();

        playBtn
            .selectAll("circle")
            .attr("opacity", () => this.settings.misc.isAnimated ? 1 : 0);

        playBtn
            .selectAll(".play")
            .attr("opacity", () => this.settings.misc.isAnimated && this.settings.misc.isStopped ? 1 : 0);

        playBtn
            .selectAll(LineDotChart.StopButton.selectorName)
            .attr("opacity", () => this.settings.misc.isAnimated && !this.settings.misc.isStopped ? 1 : 0);

        playBtn
            .exit()
            .remove();
    }

    private static pathClassName: string = "path";
    private static pathPlotClassName: string = "path.plot";
    private static plotClassName: string = "plot";
    private static lineClip: string = "lineClip";

    private drawLine(linePathSelection: d3.selection.Update<LineDotPoint[]>) {
        linePathSelection
            .enter()
            .append("g")
            .classed(LineDotChart.pathClassName, true);

        const pathPlot: d3.selection.Update<LineDotPoint[]> = linePathSelection
            .selectAll(LineDotChart.pathPlotClassName)
            .data(d => [d]);

        pathPlot
            .enter()
            .append("path")
            .classed(LineDotChart.plotClassName, true);

        // Draw the line
        const drawLine: d3.svg.Line<LineDotPoint> = d3.svg.line<LineDotPoint>()
            .x((dataPoint: LineDotPoint) => {
                return this.xAxisProperties.scale(dataPoint.dateValue.value);
            })
            .y((dataPoint: LineDotPoint) => {
                return this.yAxisProperties.scale(dataPoint.value);
            });

        pathPlot
            .attr("stroke", () => this.settings.lineoptions.fill)
            .attr("stroke-width", this.settings.lineoptions.lineThickness)
            .attr("d", drawLine)
            .attr("clip-path", "url(" + location.href + "#" + LineDotChart.lineClip + ")");
    }

    private static zeroX: number = 0;
    private static zeroY: number = 0;
    private static millisecondsInOneSecond: number = 1000;

    private drawClipPath(linePathSelection: d3.selection.Update<any>) {
        const clipPath: d3.selection.Update<any> = linePathSelection
            .selectAll("clipPath")
            .data(d => [d]);

        clipPath
            .enter()
            .append("clipPath")
            .attr("id", LineDotChart.lineClip)
            .append("rect")
            .attr("x", LineDotChart.zeroX)
            .attr("y", LineDotChart.zeroY)
            .attr("height", this.layout.viewportIn.height);

        const line_left: any = this.xAxisProperties.scale(_.first(this.data.dotPoints).dateValue.value);
        const line_right: any = this.xAxisProperties.scale(_.last(this.data.dotPoints).dateValue.value);

        const rectSettings: LineAnimationSettings = this.getRectAnimationSettings(line_left, line_right);

        if (this.settings.misc.isAnimated) {
            clipPath
                .selectAll("rect")
                .attr("x", rectSettings.startX)
                .attr("width", 0)
                .attr("height", this.layout.viewportIn.height)
                .interrupt()
                .transition()
                .ease("linear")
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

    private drawDots() {
        const point_time: number = this.settings.misc.isAnimated && !this.settings.misc.isStopped
            ? LineDotChart.pointTime
            : 0;

        const hasHighlights: boolean = this.data.hasHighlights;
        const hasSelection: boolean = this.interactivityService && this.interactivityService.hasSelection();

        // Draw the individual data points that will be shown on hover with a tooltip
        const lineTipSelection: d3.selection.Update<LineDotPoint[]> = this.line
            .selectAll("g." + LineDotChart.dotPointsClass)
            .data([this.data.dotPoints]);

        lineTipSelection.enter()
            .append("g")
            .classed(LineDotChart.dotPointsClass, true);

        const dotsSelection: d3.selection.Update<LineDotPoint> = lineTipSelection
            .selectAll("circle." + LineDotChart.pointClassName)
            .data(d => d);

        dotsSelection.enter()
            .append("circle")
            .classed(LineDotChart.pointClassName, true)
            .on("mouseover.point", this.showDataPoint)
            .on("mouseout.point", this.hideDataPoint);

        dotsSelection
            .style({
                "fill": this.settings.dotoptions.color,
                "stroke": this.settings.dotoptions.stroke,
                "stroke-opacity": this.settings.dotoptions.strokeOpacity,
                "stroke-width": this.settings.dotoptions.strokeWidth
                    ? PixelConverter.toString(this.settings.dotoptions.strokeWidth)
                    : null,
                "opacity": (dotPoint: LineDotPoint) => {
                    return behavior.getFillOpacity(
                        dotPoint,
                        dotPoint.selected,
                        dotPoint.highlight,
                        !dotPoint.highlight && hasSelection,
                        !dotPoint.selected && hasHighlights
                    );
                },
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

            const lineText: d3.selection.Update<string> = this.line
                .selectAll(LineDotChart.textSelector)
                .data([""]);

            lineText
                .enter()
                .append("text")
                .attr("text-anchor", "end")
                .classed("text", true);

            lineText
                .attr("x", this.layout.viewportIn.width - LineDotChart.widthMargin)
                .attr("y", LineDotChart.yPosition)
                .style({
                    fill: this.settings.counteroptions.color,
                    "font-size": PixelConverter.toString(PixelConverter.fromPointToPixel(this.settings.counteroptions.textSize)),
                })
                .call(selection => TextMeasurementService.svgEllipsis(<any>selection.node(), maxTextLength));

            lineText
                .exit()
                .remove();

            dotsSelection
                .interrupt()
                .attr("transform", (dataPoint: LineDotPoint) => {
                    return SVGUtil.translateAndScale(
                        this.xAxisProperties.scale(dataPoint.dateValue.value),
                        this.yAxisProperties.scale(dataPoint.value),
                        LineDotChart.pointScaleValue);
                })
                .transition()
                .each("start", (d: LineDotPoint, i: number) => {
                    if (this.settings.counteroptions.show) {
                        let text: string = `${this.settings.counteroptions.counterTitle} `;

                        if (d.counter) {
                            text += this.settings.isCounterDateTime.isCounterDateTime
                                ? this.data.dateColumnFormatter.format(d.counter)
                                : d.counter;
                        } else {
                            text += (i + 1);
                        }

                        this.updateLineText(lineText, text);
                    } else {
                        this.updateLineText(lineText, "");
                    }
                })
                .duration(point_time)
                .delay((_, i: number) => this.pointDelay(this.data.dotPoints, i, this.animationDuration))
                .ease("linear")
                .attr("transform", (dataPoint: LineDotPoint) => {
                    return SVGUtil.translateAndScale(
                        this.xAxisProperties.scale(dataPoint.dateValue.value),
                        this.yAxisProperties.scale(dataPoint.value),
                        LineDotChart.pointTransformScaleValue);
                })
                .transition()
                .duration(point_time)
                .delay((_, i: number) => {
                    return this.pointDelay(this.data.dotPoints, i, this.animationDuration) + point_time;
                })
                .ease("elastic")
                .attr("transform", (dataPoint: LineDotPoint) => {
                    return SVGUtil.translateAndScale(
                        this.xAxisProperties.scale(dataPoint.dateValue.value),
                        this.yAxisProperties.scale(dataPoint.value),
                        1);
                });
        } else {
            dotsSelection
                .interrupt()
                .attr("transform", (dataPoint: LineDotPoint) => {
                    return SVGUtil.translateAndScale(
                        this.xAxisProperties.scale(dataPoint.dateValue.value),
                        this.yAxisProperties.scale(dataPoint.value),
                        1);
                });

            this.line
                .selectAll(LineDotChart.textSelector)
                .remove();
        }

        this.tooltipServiceWrapper.addTooltip<LineDotPoint>(
            dotsSelection,
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
            const behaviorOptions: behavior.BehaviorOptions = {
                selection: dotsSelection,
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

        d3.timer.flush();
    }

    private static textSelector: string = "text.text";
    private static widthMargin: number = 85;
    private static yPosition: number = 30;

    private updateLineText(textSelector: d3.Selection<any>, text?: string): void {
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
        const legendSelection: d3.selection.Update<Legend> = this.legends
            .selectAll(LineDotChart.Legend.selectorName)
            .data(this.generateAxisLabels());

        legendSelection
            .enter()
            .append("svg:text");

        legendSelection
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

