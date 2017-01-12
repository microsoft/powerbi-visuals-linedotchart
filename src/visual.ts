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

module powerbi.extensibility.visual {
    import ClassAndSelector = powerbi.extensibility.utils.svg.CssConstants.ClassAndSelector;
    import createClassAndSelector = powerbi.extensibility.utils.svg.CssConstants.createClassAndSelector;
    import DataViewObjectPropertyTypeDescriptor = powerbi.DataViewPropertyValue;
    import SelectableDataPoint = powerbi.extensibility.utils.interactivity.SelectableDataPoint;
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;
    import IInteractivityService = powerbi.extensibility.utils.interactivity.IInteractivityService;
    import IMargin = powerbi.extensibility.utils.chart.axis.IMargin;
    import IInteractiveBehavior = powerbi.extensibility.utils.interactivity.IInteractiveBehavior;
    import ISelectionHandler = powerbi.extensibility.utils.interactivity.ISelectionHandler;
    import appendClearCatcher = powerbi.extensibility.utils.interactivity.appendClearCatcher;
    import createInteractivityService = powerbi.extensibility.utils.interactivity.createInteractivityService;
    import valueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;
    import IAxisProperties = powerbi.extensibility.utils.chart.axis.IAxisProperties;
    import IVisualHost = powerbi.extensibility.visual.IVisualHost;
    import SVGUtil = powerbi.extensibility.utils.svg;
    import AxisHelper = powerbi.extensibility.utils.chart.axis;
    import TextMeasurementService = powerbi.extensibility.utils.formatting.textMeasurementService;
    import IColorPalette = powerbi.extensibility.IColorPalette;
    import tooltip = powerbi.extensibility.utils.tooltip;
    import TooltipEventArgs = powerbi.extensibility.utils.tooltip.TooltipEventArgs;
    import ITooltipServiceWrapper = powerbi.extensibility.utils.tooltip.ITooltipServiceWrapper;
    import valueType = utils.type.ValueType;
    import DataViewObjectsParser = utils.dataview.DataViewObjectsParser;

    export interface LineDotChartDataRoles<T> {
        Date?: T;
        Values?: T;
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

        private static defaultSettingsRange: LineDotChartDefaultSettingsRange = {
            dotSize: {
                min: 0,
                max: 100
            },
            lineThickness: {
                min: 0,
                max: 50,
            },
            animationDuration: {
                min: 0,
                max: 1000,
            }
        };

        private data: LineDotChartViewModel;
        private root: d3.Selection<any>;
        private main: d3.Selection<any>;
        private axes: d3.Selection<any>;
        private axisX: d3.Selection<any>;
        private axisY: d3.Selection<any>;
        private axisY2: d3.Selection<any>;
        private legends: d3.Selection<any>;
        private line: d3.Selection<any>;
        private colors: IColorPalette;
        private xAxisProperties: IAxisProperties;
        private yAxisProperties: IAxisProperties;
        private yAxis2Properties: IAxisProperties;
        private layout: VisualLayout;
        private interactivityService: IInteractivityService;
        private behavior: IInteractiveBehavior;
        private hostService: IVisualHost;

        private get settings(): LineDotChartSettings {
            return this.data && this.data.settings;
        }

        private static viewportMargins = {
            top: 10,
            right: 30,
            bottom: 10,
            left: 10
        };

        private static viewportDimentions = {
            width: 150,
            height: 150
        };

        private tooltipServiceWrapper: ITooltipServiceWrapper;
        constructor(options: VisualConstructorOptions) {
            this.tooltipServiceWrapper = tooltip.createTooltipServiceWrapper(
                options.host.tooltipService,
                options.element);
            this.hostService = options.host;
            this.layout = new VisualLayout(null, LineDotChart.viewportMargins);
            this.layout.minViewport = <IViewport>LineDotChart.viewportDimentions;
            this.interactivityService = createInteractivityService(options.host);
            this.behavior = new LineDotChartWebBehavior();
            this.root = d3.select(options.element)
                .append('svg')
                .classed(LineDotChart.Identity.class, true);

            this.main = this.root.append('g');
            this.axes = this.main.append('g').classed(LineDotChart.Axes.class, true);
            this.axisX = this.axes.append('g').classed(LineDotChart.Axis.class, true);
            this.axisY = this.axes.append('g').classed(LineDotChart.Axis.class, true);
            this.axisY2 = this.axes.append('g').classed(LineDotChart.Axis.class, true);
            this.legends = this.main.append('g').classed(LineDotChart.Legends.class, true);
            this.line = this.main.append('g').classed(LineDotChart.Line.class, true);

            this.colors = options.host.colorPalette;
        }

        public update(options: VisualUpdateOptions) {

            if (!options || !options.dataViews || !options.dataViews[0]) {
                return;
            }

            this.layout.viewport = options.viewport;
            let data: LineDotChartViewModel = LineDotChart.converter(options.dataViews[0], this.hostService);
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

        public onClearSelection(): void {
            if (this.interactivityService) {
                this.interactivityService.clearSelection();
            }
        }

        public clear() {
            this.settings.misc.isAnimated = false;
            this.axes.selectAll(LineDotChart.Axis.selector).selectAll("*").remove();
            this.main.selectAll(LineDotChart.Legends.selector).selectAll("*").remove();
            this.main.selectAll(LineDotChart.Line.selector).selectAll("*").remove();
            this.main.selectAll(LineDotChart.Legend.selector).selectAll("*").remove();  
            this.line.selectAll(LineDotChart.textSelector).remove();    
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
            return LineDotChartSettings.enumerateObjectInstances(
                this.settings || LineDotChartSettings.getDefault(),
                options);
        }

        private static validateDataValue(value: number, defaultValues: MinMaxValue): number {
            if (value < defaultValues.min) {
                return defaultValues.min;
            } else if (value > defaultValues.max) {
                return defaultValues.max;
            }
            return value;
        }
        private static dateMaxCutter: number = .05;
        private static makeSomeSpaceForCounter: number = .10;
        private static converter(dataView: DataView, visualHost: IVisualHost): LineDotChartViewModel {
            let categorical: LineDotChartColumns<DataViewCategoryColumn & DataViewValueColumn[]> = LineDotChartColumns.getCategoricalColumns(dataView);
            if (!categorical
                || !categorical.Date
                || _.isEmpty(categorical.Date.values)
                || !categorical.Values
                || !categorical.Values[0]
                || _.isEmpty(categorical.Values[0].values)) {
                return null;
            }

            let categoryType: valueType = AxisHelper.getCategoryValueType(categorical.Date.source, true);
            if (AxisHelper.isOrdinal(categoryType)) {
                return null;
            }

            let isDateTime: boolean = AxisHelper.isDateTime(categoryType);
            let categoricalValues: LineDotChartColumns<any[]> = LineDotChartColumns.getCategoricalValues(dataView);
            let settings: LineDotChartSettings = this.parseSettings(dataView);
            let dateValues: number[] = [],
                valueValues: number[] = [];
            for (let i = 0, length = categoricalValues.Date.length; i < length; i++) {
                if (_.isDate(categoricalValues.Date[i]) || _.isNumber(categoricalValues.Date[i])) {
                    if (isDateTime) {
                        dateValues.push((<Date>categoricalValues.Date[i]).getTime());
                    } else {
                        dateValues.push(categoricalValues.Date[i]);
                    }

                    valueValues.push(categoricalValues.Values[i] || 0);
                }
            }

            let hasHighlights: boolean = !!(categorical.Values.length > 0 && categorical.Values[0].highlights);

            let extentDate: [number, number] = d3.extent(dateValues);
            let minDate: number = extentDate[0];
            let maxDate: number = extentDate[1] + (extentDate[1] - extentDate[0]) * LineDotChart.dateMaxCutter;
            let dateColumnFormatter = valueFormatter.create({
                format: valueFormatter.getFormatStringByColumn(categorical.Date.source, true) || categorical.Date.source.format
            });

            let extentValues: [number, number] = d3.extent(valueValues);
            let minValue: number = extentValues[0];
            let maxValue: number = extentValues[1];
            let dotPoints: LineDotPoint[] = [];
            let sumOfValues: number = 0;
            for (let i: number = 0, length: number = dateValues.length; i < length; i++) {
                let value: number = valueValues[i];
                let time: number = dateValues[i];
                sumOfValues += value;

                let selector: ISelectionId = visualHost.createSelectionIdBuilder().withCategory(categorical.Date, i).createSelectionId();
                dotPoints.push({
                    dot: (maxValue - minValue) ? (value - minValue) / (maxValue - minValue) : 0,
                    value: value,
                    sum: sumOfValues,
                    time: time,
                    selected: false,
                    identity: selector,
                    highlight: hasHighlights && !!(categorical.Values[0].highlights[i])
                });
            }

            // make some space for counter + 25%
            sumOfValues = sumOfValues + (sumOfValues - minValue) * LineDotChart.makeSomeSpaceForCounter;

            return {
                dotPoints: dotPoints,
                settings: settings,
                dateMetadataColumn: categorical.Date.source,
                valuesMetadataColumn: categorical.Values[0].source,
                dateColumnFormatter: dateColumnFormatter,
                isDateTime: isDateTime,
                minDate: minDate,
                maxDate: maxDate,
                minValue: minValue,
                maxValue: maxValue,
                sumOfValues: sumOfValues,
                hasHighlights: hasHighlights,
            };
        }

        private static parseSettings(dataView: DataView): LineDotChartSettings {
            let settings: LineDotChartSettings = LineDotChartSettings.parse<LineDotChartSettings>(dataView);
            let defaultRange: LineDotChartDefaultSettingsRange = this.defaultSettingsRange;
            settings.dotoptions.dotSizeMin = this.validateDataValue(settings.dotoptions.dotSizeMin, defaultRange.dotSize);
            settings.dotoptions.dotSizeMax = this.validateDataValue(settings.dotoptions.dotSizeMax, {
                min: settings.dotoptions.dotSizeMin,
                max: defaultRange.dotSize.max
            });
            settings.lineoptions.lineThickness = this.validateDataValue(settings.lineoptions.lineThickness, defaultRange.lineThickness);
            settings.misc.duration = this.validateDataValue(settings.misc.duration, defaultRange.animationDuration);

            return settings;
        }
        private static outerPadding: number = 0;
        private static forcedTickSize: number = 150;
        private static xLabelMaxWidth: number = 160;
        private static xLabelTickSize: number = 3.2;
        private calculateAxes() {
            let effectiveWidth: number = Math.max(0, this.layout.viewportIn.width - LineDotChart.LegendSize - LineDotChart.AxisSize);
            let effectiveHeight: number = Math.max(0, this.layout.viewportIn.height - LineDotChart.LegendSize);

            this.xAxisProperties = AxisHelper.createAxis({
                pixelSpan: effectiveWidth,
                dataDomain: [this.data.minDate, this.data.maxDate],
                metaDataColumn: this.data.dateMetadataColumn,
                formatString: null,
                outerPadding: LineDotChart.outerPadding,
                isCategoryAxis: true,
                isScalar: true,
                isVertical: false,
                forcedTickCount: Math.max(this.layout.viewport.width / LineDotChart.forcedTickSize, 0),
                useTickIntervalForDisplayUnits: true,
                getValueFn: (index: number, type: valueType) => {
                    if (this.data.isDateTime) {
                        return this.data.dateColumnFormatter.format(new Date(index));
                    } else {
                        return index;
                    }
                }
            });
            this.xAxisProperties.xLabelMaxWidth = Math.min(LineDotChart.xLabelMaxWidth, this.layout.viewportIn.width / LineDotChart.xLabelTickSize);
            this.xAxisProperties.formatter = this.data.dateColumnFormatter;

            this.yAxisProperties = AxisHelper.createAxis({
                pixelSpan: effectiveHeight,
                dataDomain: [this.data.minValue, this.data.sumOfValues],
                metaDataColumn: this.data.valuesMetadataColumn,
                formatString: null,
                outerPadding: LineDotChart.outerPadding,
                isCategoryAxis: false,
                isScalar: true,
                isVertical: true,
                useTickIntervalForDisplayUnits: true
            });

            this.yAxis2Properties = AxisHelper.createAxis({
                pixelSpan: effectiveHeight,
                dataDomain: [this.data.minValue, this.data.sumOfValues],
                metaDataColumn: this.data.valuesMetadataColumn,
                formatString: null,
                outerPadding: LineDotChart.outerPadding,
                isCategoryAxis: false,
                isScalar: true,
                isVertical: true,
                useTickIntervalForDisplayUnits: true
            });
            this.yAxis2Properties.axis.orient('right');
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
            this.main.attr('transform', SVGUtil.translate(this.layout.margin.left, this.layout.margin.top));
            this.legends.attr('transform', SVGUtil.translate(this.layout.margin.left, this.layout.margin.top));
            this.line.attr('transform', SVGUtil.translate(this.layout.margin.left + LineDotChart.LegendSize, 0));
            this.axes.attr('transform', SVGUtil.translate(this.layout.margin.left + LineDotChart.LegendSize, 0));
            this.axisX.attr('transform', SVGUtil.translate(0, this.layout.viewportIn.height - LineDotChart.LegendSize));
            this.axisY2.attr('transform', SVGUtil.translate(this.layout.viewportIn.width - LineDotChart.LegendSize - LineDotChart.AxisSize, 0));
        }
        private static tickText: string = '.tick text';
        private static dotPointsText: string = "g.path, g.dot-points";
        private static dotPathText: string = "g.path";
        private draw(): void {
            this.stopAnimation();
            this.renderLegends();
            this.drawPlaybackButtons();

            this.axisX.call(this.xAxisProperties.axis);
            this.axisY.call(this.yAxisProperties.axis);
            this.axisY2.call(this.yAxis2Properties.axis);

            this.axisX.selectAll(LineDotChart.tickText).call(
                AxisHelper.LabelLayoutStrategy.clip,
                this.xAxisProperties.xLabelMaxWidth,
                TextMeasurementService.svgEllipsis);

            if (this.settings.misc.isAnimated && this.settings.misc.isStopped) {
                this.main.selectAll(LineDotChart.Line.selector).selectAll(LineDotChart.dotPointsText).remove();
                this.line.selectAll(LineDotChart.textSelector).remove();   
               // this.updateLineText("");
                return;
            }

            let linePathSelection: d3.selection.Update<LineDotPoint[]> = this.line
                .selectAll(LineDotChart.dotPathText)
                .data([this.data.dotPoints]);

            this.drawLine(linePathSelection);
            this.drawClipPath(linePathSelection);

            linePathSelection
                .exit().remove();

            this.drawDots();
        }

        private static lineDotChartPlayBtn: string = "lineDotChart__playBtn";
        private static lineDotChartPlayBtnTranslate: string = "lineDotChartPlayBtnTranslate";
        private static gLineDotChartPayBtn: string = "g.lineDotChart__playBtn";
        private static playBtnGroupDiameter: number = 34;
        private static playBtnGroupLineValues: string = "M0 2l10 6-10 6z";
        private static playBtnGroupPlayTranslate: string = "playBtnGroupPlayTranslate";
        private static playBtnGroupPathTranslate: string = "playBtnGroupPathTranslate";
        private static playBtnGroupRectTranslate: string = "playBtnGroupRectTranslate";
        private static playBtnGroupRectWidth: string = "2";
        private static playBtnGroupRectHeight: string = "12";
        private static StopButton: ClassAndSelector = createClassAndSelector("stop");
        private drawPlaybackButtons() {
            let playBtn: d3.selection.Update<string> = this.line.selectAll(LineDotChart.gLineDotChartPayBtn).data([""]);
            let playBtnGroup: d3.Selection<string> = playBtn.enter()
                .append("g")
                .classed(LineDotChart.lineDotChartPlayBtn, true);

            playBtnGroup
                .classed(LineDotChart.lineDotChartPlayBtnTranslate, true)
                .append("circle")
                .attr("r", LineDotChart.playBtnGroupDiameter / 2)
                .on('click', () => this.setIsStopped(!this.settings.misc.isStopped));

            playBtnGroup.append("path")
                .classed("play", true)
                .classed(LineDotChart.playBtnGroupPlayTranslate, true)
                .attr("d", LineDotChart.playBtnGroupLineValues)
                .attr('pointer-events', "none");

            playBtnGroup
                .append("path")
                .classed(LineDotChart.StopButton.class, true)
                .classed(LineDotChart.playBtnGroupPathTranslate, true)
                .attr("d", LineDotChart.playBtnGroupLineValues)
                .attr("transform-origin", "center")
                .attr('pointer-events', "none");

            playBtnGroup
                .append("rect")
                .classed(LineDotChart.StopButton.class, true)
                .classed(LineDotChart.playBtnGroupRectTranslate, true)
                .attr("width", LineDotChart.playBtnGroupRectWidth)
                .attr("height", LineDotChart.playBtnGroupRectHeight)
                .attr('pointer-events', "none");

            playBtn.selectAll("circle").attr("opacity", () => this.settings.misc.isAnimated ? 1 : 0);
            playBtn.selectAll(".play").attr("opacity", () => this.settings.misc.isAnimated && this.settings.misc.isStopped ? 1 : 0);
            playBtn.selectAll(LineDotChart.StopButton.selector).attr("opacity", () => this.settings.misc.isAnimated && !this.settings.misc.isStopped ? 1 : 0);

            playBtn.exit().remove();
        }

        private static pathClassName: string = "path";
        private static pathPlotClassName: string = "path.plot";
        private static plotClassName: string = "plot";
        private static lineClip: string = "lineClip";
        private drawLine(linePathSelection: d3.selection.Update<LineDotPoint[]>) {
            linePathSelection.enter().append("g").classed(LineDotChart.pathClassName, true);

            let pathPlot: d3.selection.Update<LineDotPoint[]> = linePathSelection.selectAll(LineDotChart.pathPlotClassName).data(d => [d]);
            pathPlot.enter()
                .append('path')
                .classed(LineDotChart.plotClassName, true);

            // Draw the line
            let drawLine: d3.svg.Line<any> = d3.svg.line()
                .x((d: any) => this.xAxisProperties.scale(d.time))
                .y((d: any) => this.yAxisProperties.scale(d.sum));

            pathPlot
                .attr('stroke', () => this.settings.lineoptions.fill)
                .attr('stroke-width', this.settings.lineoptions.lineThickness)
                .attr('d', drawLine)
                .attr("clip-path", "url(" + location.href + '#' + LineDotChart.lineClip + ")");
        }

        private static zeroX: number = 0;
        private static zeroY: number = 0;
        private static millisecondsInOneSecond: number = 1000;
        private drawClipPath(linePathSelection: d3.selection.Update<any>) {
            let clipPath: d3.selection.Update<any> = linePathSelection.selectAll("clipPath").data(d => [d]);
            clipPath.enter().append("clipPath")
                .attr("id", LineDotChart.lineClip)
                .append("rect")
                .attr("x", LineDotChart.zeroX)
                .attr("y", LineDotChart.zeroY);

            let line_left: any = this.xAxisProperties.scale(_.first(this.data.dotPoints).time);
            let line_right: any = this.xAxisProperties.scale(_.last(this.data.dotPoints).time);

            if (this.settings.misc.isAnimated) {
                clipPath
                    .selectAll("rect")
                    .attr('x', line_left)
                    .attr('width', 0)
                    .interrupt()
                    .transition()
                    .ease("linear")
                    .duration(this.animationDuration * LineDotChart.millisecondsInOneSecond)
                    .attr('width', line_right - line_left)
                    .attr("height", this.layout.viewportIn.height);
            } else {
                clipPath
                    .selectAll("rect")
                    .interrupt()
                    .attr('x', line_left)
                    .attr('width', line_right - line_left);
            }
        }

        private static pointTime: number = 300;
        private static dotPointsClass: string = "dot-points";
        private static pointClassName: string = 'point';
        private static pointScaleValue: number = 0.005;
        private static pointTransformScaleValue: number = 3.4;
        private drawDots() {
            let point_time: number = this.settings.misc.isAnimated && !this.settings.misc.isStopped ? LineDotChart.pointTime : 0;

            let hasHighlights: boolean = this.data.hasHighlights;
            let hasSelection: boolean = this.interactivityService && this.interactivityService.hasSelection();

            // Draw the individual data points that will be shown on hover with a tooltip
            let lineTipSelection: d3.selection.Update<LineDotPoint[]> = this.line.selectAll('g.' + LineDotChart.dotPointsClass)
                .data([this.data.dotPoints]);

            lineTipSelection.enter()
                .append("g")
                .classed(LineDotChart.dotPointsClass, true);

            let dotsSelection: d3.selection.Update<LineDotPoint> = lineTipSelection
                .selectAll("circle." + LineDotChart.pointClassName)
                .data(d => d);

            dotsSelection.enter()
                .append('circle')
                .classed(LineDotChart.pointClassName, true)
                .on('mouseover.point', this.showDataPoint)
                .on('mouseout.point', this.hideDataPoint);

            dotsSelection
                .attr('fill', this.settings.dotoptions.color)
                .style("opacity", (d: LineDotPoint) => {
                    return lineDotChartUtils.getFillOpacity(d.selected, d.highlight, !d.highlight && hasSelection, !d.selected && hasHighlights);
                })
                .attr('r', (d: LineDotPoint) =>
                    this.settings.dotoptions.dotSizeMin + d.dot * (this.settings.dotoptions.dotSizeMax - this.settings.dotoptions.dotSizeMin));

            if (this.settings.misc.isAnimated) {
                let maxTextLength: number = Math.min(350, this.xAxisProperties.scale.range()[1] - this.xAxisProperties.scale.range()[0] - 60);
                let lineTextSelection: d3.Selection<any> = this.line.selectAll(LineDotChart.textSelector);
                let lineText: d3.selection.Update<string> = lineTextSelection.data([""]);
                lineText
                    .enter()
                    .append("text")
                    .attr('text-anchor', "end")
                    .classed("text", true);
                lineText
                    .attr('x', this.layout.viewportIn.width - LineDotChart.widthMargin)
                    .attr('y', LineDotChart.yPosition)
                    .call(selection => TextMeasurementService.svgEllipsis(<any>selection.node(), maxTextLength));
                lineText.exit().remove();

                dotsSelection
                    .interrupt()
                    .attr('transform', (d: LineDotPoint) =>
                        SVGUtil.translateAndScale(this.xAxisProperties.scale(d.time), this.yAxisProperties.scale(d.sum), LineDotChart.pointScaleValue))
                    .transition()
                    .each("start", (d: LineDotPoint, i: number) => {
                        let text = this.settings.counteroptions.counterTitle + ' ' + (i + 1);
                        this.updateLineText(lineText, text);
                    })
                    .duration(point_time)
                    .delay((d: LineDotPoint, i: number) => this.pointDelay(this.data.dotPoints, i, this.animationDuration))
                    .ease("linear")
                    .attr('transform', (d: LineDotPoint) =>
                        SVGUtil.translateAndScale(this.xAxisProperties.scale(d.time), this.yAxisProperties.scale(d.sum), LineDotChart.pointTransformScaleValue))
                    .transition()
                    .duration(point_time)
                    .delay((d: LineDotPoint, i: number) => this.pointDelay(this.data.dotPoints, i, this.animationDuration) + point_time)
                    .ease("elastic")
                    .attr('transform', (d: LineDotPoint) =>
                        SVGUtil.translateAndScale(this.xAxisProperties.scale(d.time), this.yAxisProperties.scale(d.sum), 1));
            } else {
                dotsSelection
                    .interrupt()
                    .attr('transform', (d: LineDotPoint) =>
                        SVGUtil.translateAndScale(this.xAxisProperties.scale(d.time), this.yAxisProperties.scale(d.sum), 1));
                this.line.selectAll(LineDotChart.textSelector).remove();
            }

            for (let i: number = 0; i < dotsSelection[0].length; i++) {
                this.addTooltip(dotsSelection[0][i]);
            }

            dotsSelection.exit().remove();
            lineTipSelection.exit().remove();

            if (this.interactivityService) {
                // Register interactivity;
                let behaviorOptions: LineDotChartBehaviorOptions = {
                    selection: dotsSelection,
                    clearCatcher: this.root,
                    interactivityService: this.interactivityService,
                    hasHighlights: hasHighlights
                };
                this.interactivityService.bind(this.data.dotPoints, this.behavior, behaviorOptions);
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
        private updateLineText(textSelector: d3.Selection<any>,   text?: string): void {
            textSelector.text(d => text);
        }

        private pointDelay(points: LineDotPoint[], num: number, animation_duration: number): number {
            if (!points.length || !points[num] || num === 0 || !this.settings.misc.isAnimated || this.settings.misc.isStopped) {
                return 0;
            }

            let time: number = <number>points[num].time;
            let min: number = <number>points[0].time;
            let max: number = <number>points[points.length - 1].time;
            return animation_duration * 1000 * (time - min) / (max - min);
        }
        private static showClassName: string = 'show';
        private showDataPoint(data: LineDotPoint, index: number): void {
            d3.select(<any>this).classed(LineDotChart.showClassName, true);
        }

        private hideDataPoint(data: LineDotPoint, index: number): void {
            d3.select(<any>this).classed(LineDotChart.showClassName, false);
        }

        private addTooltip(element: any): void {
            let selection: d3.Selection<any> = d3.select(element);
            let data: LineDotPoint = selection.datum();
            this.tooltipServiceWrapper.addTooltip(selection, (event) => {
                return [
                    {
                        displayName: "",
                        value: this.data.dateColumnFormatter.format(data.time)
                    },
                    {
                        displayName: "",
                        value: data.value.toString()
                    }
                ];
            });
        }

        private renderLegends(): void {
            let legends: Legend[] = this.generateAxisLabels();
            let legendSelection: d3.selection.Update<any> = this.legends
                .selectAll(LineDotChart.Legend.selector)
                .data(legends);

            legendSelection
                .enter()
                .append("svg:text");

            legendSelection
                .attr("x", 0)
                .attr("y", 0)
                .attr("dx", (item: Legend) => item.dx)
                .attr("dy", (item: Legend) => item.dy)
                .attr("transform", (item: Legend) => item.transform)
                .text((item: Legend) => item.text)
                .classed(LineDotChart.Legend.class, true);

            legendSelection
                .exit()
                .remove();
        }
    }

    export module lineDotChartUtils {
        export let DimmedOpacity: number = 0.4;
        export let DefaultOpacity: number = 1.0;

        export function getFillOpacity(selected: boolean, highlight: boolean, hasSelection: boolean, hasPartialHighlights: boolean): number {
            if ((hasPartialHighlights && !highlight) || (hasSelection && !selected)) {
                return DimmedOpacity;
            }
            return DefaultOpacity;
        }
    }
}
