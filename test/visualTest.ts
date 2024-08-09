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
import * as _ from "lodash";

import DataView = powerbi.DataView;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { renderTimeout, assertColorsMatch, getSolidColorStructuralObject } from "powerbi-visuals-utils-testutils";
import { valueFormatter as vf } from "powerbi-visuals-utils-formattingutils";
import IValueFormatter = vf.IValueFormatter;

import { areColorsEqual, getRandomHexColor } from "./helpers";
import { LineDotChartData } from "./visualData";
import { LineDotChartBuilder } from "./visualBuilder";

import { LineDotChart } from "./../src/visual";
import { ColumnNames, LineDotPoint, LineDotChartViewModel } from "./../src/dataInterfaces";
import { LineDotChartColumns } from "./../src/columns";

describe("LineDotChartTests", () => {
    let visualBuilder: LineDotChartBuilder,
        defaultDataViewBuilder: LineDotChartData,
        dataView: DataView,
        dataViewForCategoricalColumn: DataView;

    beforeEach(() => {
        visualBuilder = new LineDotChartBuilder(1000, 500);
        defaultDataViewBuilder = new LineDotChartData();

        dataView = defaultDataViewBuilder.getDataView();
    });

    describe("DOM tests", () => {
        it("main element was created", () => {
            expect(visualBuilder.mainElement).toBeDefined();
        });

        it("update", (done) => {
            visualBuilder.updateRenderTimeout(dataView, () => {
                expect(visualBuilder.axis.length).toBeGreaterThan(0);
                expect(visualBuilder.ticks.length).toBeGreaterThan(0);
                expect(visualBuilder.line).toBeDefined()
                expect(visualBuilder.animationPlayButton).toBeDefined();
                expect(visualBuilder.legends).toBeDefined();

                done();
            });
        });
    });

    describe("Resize test", () => {
        it("Counter", (done) => {
            visualBuilder.viewport.width = 300;

            dataView.metadata.objects = {
                misc: {
                    isAnimated: true,
                    duration: 20,
                    isStopped: false
                },
                counteroptions: {
                    counterTitle: "Counter: "
                }
            };

            visualBuilder.updateFlushAllD3Transitions(dataView);

            renderTimeout(() => {
                expect(visualBuilder.counterTitle).toBeDefined();
                done();
            });
        });
    });

    describe("Counter animation test", () => {
        const durationInSeconds: number = 20;
        const durationInMilliSeconds: number = durationInSeconds * 1000;

        it("Counter update", (done) => {
            dataView.metadata.objects = {
                misc: {
                    isAnimated: true,
                    duration: durationInSeconds,
                    isStopped: false
                },
                counteroptions: {
                    counterTitle: ""
                }
            };

            visualBuilder.updateFlushAllD3Transitions(dataView);

            renderTimeout(() => {
                let counterNumber: number = 0;
                expect(visualBuilder.counterTitle).toBeDefined();
                setInterval(() => {
                    const newCounterNumber: number = Number(visualBuilder.counterTitle);
                    expect(newCounterNumber).toBeGreaterThan(counterNumber);
                    counterNumber = newCounterNumber;
                }, durationInMilliSeconds);
                done();
            });
        });
    });

    describe("Axes test", () => {
        it("set color and font-size", () => {
            let color: string = getRandomHexColor();
            let color2: string = getRandomHexColor();
            let textSize: number = 14;
            let expectedTextSize: string = "18.6667px";

            dataView.metadata.objects = {
                xAxis: {
                    show: true,
                    color: getSolidColorStructuralObject(color),
                    textSize: textSize
                },
                yAxis: {
                    show: true,
                    color: getSolidColorStructuralObject(color),
                    textSize: textSize
                }
            };

            visualBuilder.updateFlushAllD3Transitions(dataView);
            visualBuilder.visualInstance.applyAxisSettings();

            expect(visualBuilder.tickText.length).toBeGreaterThan(0);

            visualBuilder.tickText.forEach((element: SVGTextElement) => {
                const styles = getComputedStyle(element);
                const fontSize: string = styles.fontSize;
                expect(fontSize).toBe(expectedTextSize);
                assertColorsMatch(styles.fill, color);
            });
        });

        it("disable the second Y axis", () => {
            dataView.metadata.objects = {
                yAxis: {
                    show: true,
                    isDuplicated: false
                }
            };

            visualBuilder.updateFlushAllD3Transitions(dataView);
            visualBuilder.visualInstance.applyAxisSettings();

            expect(visualBuilder.emptyAxis.length).toBe(1);
        });

        it("disable X and the second Y axes", () => {
            dataView.metadata.objects = {
                xAxis: {
                    show: false,
                },
                yAxis: {
                    show: true,
                    isDuplicated: false
                }
            };

            visualBuilder.updateFlushAllD3Transitions(dataView);
            visualBuilder.visualInstance.applyAxisSettings();

            expect(visualBuilder.emptyAxis.length).toBe(2);
        });

        it("disable all axes", () => {
            dataView.metadata.objects = {
                xAxis: {
                    show: false,
                },
                yAxis: {
                    show: false,
                }
            };

            visualBuilder.updateFlushAllD3Transitions(dataView);
            visualBuilder.visualInstance.applyAxisSettings();

            expect(visualBuilder.emptyAxis.length).toBe(3);
        });
    });

    describe("Clear test", () => {
        it("clear all", (done) => {
            dataView.metadata.objects = {
                misc: {
                    isStopped: false
                }
            }
            visualBuilder.updateFlushAllD3Transitions(dataView);
            renderTimeout(() => {
                visualBuilder.visualInstance.clear();
                expect(visualBuilder.dots).toBeNull();
                done();
            });
        });
    });

    describe("Animation off test", () => {
        it("should not render lineClip", (done) => {
            visualBuilder.viewport.width = 300;

            dataView.metadata.objects = {
                misc: {
                    isAnimated: false,
                    duration: 20,
                    isStopped: true
                },
                counteroptions: {
                    counterTitle: "Counter: "
                }
            };

            visualBuilder.updateFlushAllD3Transitions(dataView);
            renderTimeout(() => {
                expect(visualBuilder.clipPath).toBeNull();
                done();
            });
        });
    });

    describe("Format settings test", () => {
        beforeEach(() => {
            dataView.metadata.objects = {
                misc: {
                    isAnimated: false
                }
            };
        });

        describe("Line", () => {
            it("color", () => {
                const color: string = "#123123";

                dataView.metadata.objects = {
                    lineoptions: {
                        fill: getSolidColorStructuralObject("#123123")
                    },
                    misc: {
                        isAnimated: false
                    }
                }
                visualBuilder.updateFlushAllD3Transitions(dataView);
                assertColorsMatch(getComputedStyle(visualBuilder.linePath!).stroke, color);
            });
        });

        describe("Dot", () => {
            it("color", () => {
                // check
                let color: string = getRandomHexColor();

                dataView.metadata.objects = {
                    dotoptions: {
                        color: getSolidColorStructuralObject(color)
                    },
                    misc: {
                        isAnimated: false
                    }
                };
                visualBuilder.updateFlushAllD3Transitions(dataView);
                visualBuilder.dots!.forEach((dot: SVGCircleElement) => {
                    assertColorsMatch(dot.style.fill, color);
                });
            });
            it("opacity", () => {
                const color: string = getRandomHexColor();
                const opacity: number = 50;
                dataView.metadata.objects = {
                    dotoptions: {
                        color: getSolidColorStructuralObject(color),
                        percentile: opacity
                    },
                    misc: {
                        isAnimated: false
                    }
                };
                visualBuilder.updateFlushAllD3Transitions(dataView);
                expect(visualBuilder.dots).toBeDefined();
                visualBuilder.dots!.forEach(e => {
                    assertColorsMatch(e.style.fill, color);
                    expect(parseFloat(e.style.opacity)).toBe(opacity / 100);
                });
            });
        });

        describe("Validate params", () => {
            it("Dots", () => {
                dataView.metadata.objects = {
                    dotoptions: {
                        dotSizeMin: -6,
                        dotSizeMax: 678
                    },
                    misc: {
                        isAnimated: false
                    }
                };
                visualBuilder.updateFlushAllD3Transitions(dataView);
                visualBuilder.dots!.forEach(e => {
                    // TODO:// FIX ERRORS
                    expect(e.getAttribute("r")).toBeGreaterThan(-1);
                    expect(e.getAttribute("r")).toBeLessThan(101);
                });
            });
        });

    });

    describe("getTooltipDataItems", () => {
        const columnNames: ColumnNames = {
            category: "Power BI - category",
            values: "Power BI - values"
        };

        const defaultFormattedValue: string = " - Power BI - formatted value";

        beforeEach(() => {
            const valueFormatter: IValueFormatter = {
                format: (value: any) => `${value}${defaultFormattedValue}`
            } as IValueFormatter;

            const data: LineDotChartViewModel = {
                columnNames: Object.assign(columnNames),
                dateColumnFormatter: valueFormatter,
                dataValueFormatter: valueFormatter,
            } as LineDotChartViewModel;

            visualBuilder.visualInstance.data = data;
        });

        it("should return an empty array if the given data point is undefined", () => {
            const actualResult: VisualTooltipDataItem[]
                = visualBuilder.visualInstance.getTooltipDataItems(undefined);

            expect(actualResult.length).toBe(0);
        });

        it("the date should be formatted", () => {
            const dataPoint: LineDotPoint = <any>{
                dateValue: {
                    date: new Date(2008, 1, 1),
                    label: undefined,
                    value: null
                },
                value: null,
                dot: null,
                sum: null,
                opacity: 1,
                counter: null,
                selected: false,
                identity: null
            } as LineDotPoint;

            const actualResult: VisualTooltipDataItem[]
                = visualBuilder.visualInstance.getTooltipDataItems(dataPoint);

            expect(actualResult[0].value).toMatch(defaultFormattedValue);
        });

        it("the value should be formatted", () => {
            const dataPoint: LineDotPoint = {
                dateValue: {
                    value: 2017
                }
            } as LineDotPoint;

            const actualResult: VisualTooltipDataItem[]
                = visualBuilder.visualInstance.getTooltipDataItems(dataPoint);

            expect(actualResult[1].value).toMatch(defaultFormattedValue);
        });
    });

    describe("getCategoricalValues", () => {
        beforeEach(() => {
            dataViewForCategoricalColumn = defaultDataViewBuilder.getDataViewForCategoricalValues();
        });

        it("date values provided as string should be converted to Date type", () => {
            const categoricalValues: LineDotChartColumns<any[]> = LineDotChartColumns.getCategoricalValues(dataViewForCategoricalColumn);

            expect(_.isDate(categoricalValues.Date[0])).toBeTruthy();
        });

        it("date values provided as string and being as custom strings must be displayed correctly", () => {
            let expectedXlabel = "AlphaBetaOmegaGamma";

            visualBuilder.updateFlushAllD3Transitions(defaultDataViewBuilder.createStringView());
            visualBuilder.visualInstance.applyAxisSettings();

            const ticks: NodeListOf<SVGGElement> = visualBuilder.axis[0].querySelectorAll("g.tick");
            const tickTexts: SVGTextElement[] = [];
            ticks.forEach((tick: SVGGElement) => {
                tickTexts.push(...tick.querySelectorAll("text"));
            });

            expect(ticks.length).toBe(4);
            for (let i = 0; i < tickTexts.length; i++) {
                if (!tickTexts[i].textContent) {
                    fail("tick text is empty");
                } else {
                    expect(expectedXlabel).toContain(tickTexts[i].textContent!);
                }
            }
        });
    });

    describe("rect animation", () => {
        it("should return correct rect coordinates and width", () => {
            const firstValue: number = 10,
                lastValue: number = 100;

            const settings = visualBuilder.visualInstance.getRectAnimationSettings(firstValue, lastValue);

            // for ascending order X value always the same
            expect(settings.startX).toBe(firstValue);
            expect(settings.endX).toBe(firstValue);

            // width should be always possitive
            expect(settings.endWidth).toBeGreaterThanOrEqual(0);
        });

        it("should return correct rect coordinates and width for reversed data", () => {
            const firstValue: number = 100,
                lastValue: number = 10;

            const settings = visualBuilder.visualInstance.getRectAnimationSettings(firstValue, lastValue);
            // for descending order X value moves from right to left
            expect(settings.startX).toBe(firstValue);
            expect(settings.endX).toBe(lastValue);

            // width should be always positive
            expect(settings.endWidth).toBeGreaterThanOrEqual(0);
        });
    });

    describe("Accessibility", () => {
        describe("High contrast mode", () => {
            const backgroundColor: string = "#000000";
            const foregroundColor: string = "#ffff00";

            beforeEach(() => {
                visualBuilder.visualHost.colorPalette.isHighContrast = true;

                visualBuilder.visualHost.colorPalette.background = { value: backgroundColor };
                visualBuilder.visualHost.colorPalette.foreground = { value: foregroundColor };
                dataView.metadata.objects = {
                    misc: {
                        isStopped: false
                    }
                }
            });

            it("should not use fill style", (done) => {
                visualBuilder.updateRenderTimeout(dataView, () => {
                    const dots = Array.from(visualBuilder.dots!);

                    expect(isColorAppliedToElements(dots, undefined, "fill"));

                    done();
                });
            });

            it("should use stroke style", (done) => {
                visualBuilder.updateRenderTimeout(dataView, () => {
                    const dots = Array.from(visualBuilder.dots!);

                    expect(isColorAppliedToElements(dots, foregroundColor, "stroke"));

                    done();
                });
            });

            function isColorAppliedToElements(
                elements: SVGCircleElement[],
                color?: string,
                colorStyleName: string = "fill"
            ): boolean {
                return elements.some((element: SVGCircleElement) => {
                    const currentColor: string = element.style[colorStyleName];

                    if (!currentColor || !color) {
                        return currentColor === color;
                    }

                    return areColorsEqual(currentColor, color);
                });
            }
        });
    });

    describe("should formatting functions work correctly", () => {
        let data: LineDotChartViewModel;
        let columnFormattingFn: Function;
        let valueFormattingFn: Function;

        beforeEach(() => {
            dataView = defaultDataViewBuilder.getDataViewWithDifferentFormats();
            visualBuilder.update(dataView);

            data = visualBuilder.visualInstance.data;
            columnFormattingFn =  LineDotChart.getColumnFormattingCallback(data);
            valueFormattingFn = LineDotChart.getValueFormattingCallback(data);
        });

        it("dateTime formatting", () => {
            const timestamp: number = 108875;
            const actualResultForColumn: string = columnFormattingFn(timestamp, { dateTime: true });
            const actualResultForValue: string = valueFormattingFn(timestamp, { dateTime: true });

            const expectedResultForColumn: string = data.dateColumnFormatter.format(new Date(timestamp));
            const expectedResultForValue: string = data.dataValueFormatter.format(new Date(timestamp));

            expect(actualResultForColumn).toBe(expectedResultForColumn);
            expect(actualResultForValue).toBe(expectedResultForValue);
        });

        it("text formatting", () => {
            const index: number = 17;
            const actualResultForColumn: string = columnFormattingFn(index, { text: true });
            const actualResultForValue: string = valueFormattingFn(index, { text: true });

            const expectedResult: string = data.dateValues[index].label;
            expect(actualResultForColumn).toBe(expectedResult);
            expect(actualResultForValue).toBe(expectedResult);
        });

        it("numbers formatting", () => {
            const index: number = 13;
            const actualResultForColumn: string = columnFormattingFn(index, { number: true });
            const expectedResultForColumn: string = data.dateColumnFormatter.format(index);

            const actualResultForValue: string = valueFormattingFn(index, { number: true });
            const expectedResultForValue: string = data.dataValueFormatter.format(index);

            expect(actualResultForColumn).toBe(expectedResultForColumn);
            expect(actualResultForValue).toBe(expectedResultForValue);
        });

        it("fractional numbers formatting", () => {
            const index: number = 13.42;

            const actualResultForColumn: string = columnFormattingFn(index, { number: true });
            const expectedResultForColumn: string = data.dateColumnFormatter.format(index);

            const actualResultForValue: string = valueFormattingFn(index, { number: true });
            const expectedResultForValue: string = data.dataValueFormatter.format(index);

            expect(actualResultForColumn).toBe(expectedResultForColumn);
            expect(actualResultForValue).toBe(expectedResultForValue);
        });
    });

    describe("Different formats data representation test", () => {
        let tickText: SVGTextElement[];
        let xTicksCount: number;

        beforeEach(() => {
            dataView = defaultDataViewBuilder.getDataViewWithDifferentFormats();
            visualBuilder.update(dataView);
            tickText = visualBuilder.tickText;
            xTicksCount = visualBuilder.xAxisTickText.length;
        });

        it("should represent data in required format on axes", (done) => {
            const percentRegex: string = "^\\d+(\.?\\d+)?%$";
            const priceRegex: string = "$";

            visualBuilder.updateRenderTimeout(dataView, () => {
                tickText.forEach((tick, index) => {
                    let text = tickText[index].textContent;
                    if (index < xTicksCount) {
                        expect(text).toMatch(priceRegex);
                    } else {
                        expect(text).toMatch(percentRegex);
                    }
                });
                done();
            });
        });

        it("should represent data in required format in tooltip", () => {
            const defaultFormattedColumnValue: string = visualBuilder.visualInstance.data.dateColumnFormatter.format(13);
            const defaultFormattedValue: string = visualBuilder.visualInstance.data.dataValueFormatter.format(17);

            const dataPoint: LineDotPoint = {
                dateValue: {
                    value: 13
                },
                value: 17
            } as LineDotPoint;

            const actualResult: VisualTooltipDataItem[]
                = visualBuilder.visualInstance.getTooltipDataItems(dataPoint);

            expect(actualResult[0].value).toBe(defaultFormattedColumnValue);
            expect(actualResult[1].value).toBe(defaultFormattedValue);
        });
    });

    describe("Y axis right scaling test", () => {
        let yTicksText: SVGTextElement[] = [];
        let allTicksText: SVGTextElement[];

        beforeEach(() => {
            const orderedDates: Date[] = [
                new Date(2013, 1, 1),
                new Date(2014, 1, 1),
                new Date(2015, 1, 1),
                new Date(2016, 1, 1),
                new Date(2017, 1, 1)
            ];
            const orderedNumbers: number[] = [11, 18, 23, 29, 31];
            dataView = defaultDataViewBuilder.getDataView(undefined, orderedDates, orderedNumbers);
            visualBuilder.update(dataView);

            let xTicksCount = visualBuilder.xAxisTick.length;
            allTicksText = visualBuilder.tickText;
            const yTicksCount: number = (allTicksText.length - xTicksCount) / 2;
            allTicksText.forEach((tick, index) => {
                if (index >= xTicksCount && index <= yTicksCount + xTicksCount - 1) {
                    yTicksText.push(tick);
                }
            });
        });

        it("should graphic be correctly scaled on y axis", (done) => {
            const dotPoints: LineDotPoint[] = visualBuilder.visualInstance.data.dotPoints;

            let previosYTickIndex = 0;
            visualBuilder.updateRenderTimeout(dataView, () => {
                dotPoints.forEach((dotPoint: LineDotPoint) => {
                    let lowAxisValue: number = parseInt(yTicksText[previosYTickIndex].textContent || '');
                    expect(dotPoint.value).toBeGreaterThanOrEqual(lowAxisValue);

                    if (previosYTickIndex + 1 < yTicksText.length) {
                        let highAxisValue: number = parseInt(yTicksText[previosYTickIndex + 1].textContent || '');
                        expect(dotPoint.value).toBeGreaterThanOrEqual(lowAxisValue);
                    }
                    previosYTickIndex++;
                });
                done();
            });
        });
    });
});

