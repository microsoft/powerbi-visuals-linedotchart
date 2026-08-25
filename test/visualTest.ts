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

import DataView = powerbi.DataView;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

import { renderTimeout, assertColorsMatch, getSolidColorStructuralObject } from "powerbi-visuals-utils-testutils";
import { valueFormatter as vf } from "powerbi-visuals-utils-formattingutils";
import IValueFormatter = vf.IValueFormatter;

import { areColorsEqual, getRandomHexColor, countOverlaps, countSelfOverlaps, getClippedTexts, rectWithin, readableTextLength } from "./helpers";
import { LineDotChartData, DeterministicLineDotChartData } from "./visualData";
import { LineDotChartBuilder } from "./visualBuilder";

import { LineDotChart } from "./../src/visual";
import { ColumnNames, LineDotPoint, LineDotChartViewModel } from "./../src/dataInterfaces";
import { LineDotChartColumns } from "./../src/columns";
import { select, selectAll, Selection } from "d3-selection";

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

    describe("Axis layout at large text size", () => {
        const largeTextSize: number = 30;
        const defaultTextSize: number = 9;
        const maxTextSize: number = 60;
        const largeTickFontSize: string = "40px";
        const defaultTickFontSize: string = "12px";
        const maxTickFontSize: string = "80px";
        const longTitles: [string, string] = ["Test Title Test Title Test Title", "Test Title Test Title"];
        const shortTitles: [string, string] = ["Test Title", "Test Title"];
        const noTitles: [string, string] = ["", ""];
        const minLargeTextXTicks: number = 4;
        const minDefaultTextXTicks: number = 5;
        const minReadableTickChars: number = 5;
        const minYTicks: number = 2;

        let layoutDataView: DataView;

        beforeEach(() => {
            layoutDataView = new DeterministicLineDotChartData().getDataView();
        });

        function applyAxisObjects(textSize: number, titles: [string, string] = longTitles): void {
            layoutDataView.metadata.objects = {
                misc: {
                    isAnimated: false
                },
                xAxis: {
                    show: true,
                    title: titles[0],
                    textSize: textSize
                },
                yAxis: {
                    show: true,
                    isDuplicated: true,
                    title: titles[1],
                    textSize: textSize
                }
            };
        }

        function tickFontSize(builder: LineDotChartBuilder): string {
            return getComputedStyle(builder.tickText[0]).fontSize;
        }

        it("axis titles do not overlap tick labels", () => {
            applyAxisObjects(largeTextSize);
            visualBuilder.updateFlushAllD3Transitions(layoutDataView);

            expect(visualBuilder.axisTitles.length).toBe(2);
            expect(tickFontSize(visualBuilder)).toBe(largeTickFontSize);
            expect(countOverlaps(visualBuilder.tickText, visualBuilder.axisTitles)).toBe(0);
        });

        it("tick labels stay inside the visual bounds", () => {
            applyAxisObjects(largeTextSize);
            visualBuilder.updateFlushAllD3Transitions(layoutDataView);

            const rootRect: DOMRect = visualBuilder.mainElement.getBoundingClientRect();

            expect(tickFontSize(visualBuilder)).toBe(largeTickFontSize);
            expect(getClippedTexts(visualBuilder.tickText, rootRect)).toEqual([]);
        });

        it("X axis tick labels do not overlap each other", () => {
            applyAxisObjects(largeTextSize, noTitles);
            visualBuilder.updateFlushAllD3Transitions(layoutDataView);

            expect(tickFontSize(visualBuilder)).toBe(largeTickFontSize);
            expect(countSelfOverlaps(visualBuilder.xAxisTickText)).toBe(0);
        });

        it("X axis keeps its interior tick labels at large text size", () => {
            applyAxisObjects(largeTextSize, noTitles);
            visualBuilder.updateFlushAllD3Transitions(layoutDataView);

            expect(visualBuilder.xAxisTickText.length).toBeGreaterThanOrEqual(minLargeTextXTicks);
            expect(countSelfOverlaps(visualBuilder.xAxisTickText)).toBe(0);
        });

        it("X axis tick labels keep readable content at large text size", () => {
            applyAxisObjects(largeTextSize, noTitles);
            visualBuilder.updateFlushAllD3Transitions(layoutDataView);

            const shortestLabel: number = Math.min(
                ...visualBuilder.xAxisTickText.map((text: SVGTextElement) => readableTextLength(text.textContent ?? "")));

            expect(shortestLabel).toBeGreaterThanOrEqual(minReadableTickChars);
        });

        it("default text size keeps the full tick density", () => {
            applyAxisObjects(defaultTextSize, noTitles);
            visualBuilder.updateFlushAllD3Transitions(layoutDataView);

            expect(visualBuilder.xAxisTickText.length).toBeGreaterThanOrEqual(minDefaultTextXTicks);
            expect(countSelfOverlaps(visualBuilder.xAxisTickText)).toBe(0);
        });

        it("layout stays readable in a reduced viewport", () => {
            const smallBuilder: LineDotChartBuilder = new LineDotChartBuilder(320, 240);

            applyAxisObjects(largeTextSize, shortTitles);
            smallBuilder.updateFlushAllD3Transitions(layoutDataView);

            const rootRect: DOMRect = smallBuilder.mainElement.getBoundingClientRect();

            expect(smallBuilder.dots!.length).toBe(12);
            expect(smallBuilder.axisTitles.length).toBe(2);
            expect(countOverlaps(smallBuilder.tickText, smallBuilder.axisTitles)).toBe(0);
            expect(smallBuilder.axisTitles.every((title: SVGTextElement) => rectWithin(title.getBoundingClientRect(), rootRect))).toBeTrue();
            expect(getClippedTexts(smallBuilder.tickText, rootRect)).toEqual([]);
        });

        it("legacy saved axis settings use the default text size", () => {
            const legacyDataView: DataView = new DeterministicLineDotChartData().getDataViewFromLegacyAxisSettings();
            visualBuilder.updateFlushAllD3Transitions(legacyDataView);

            const rootRect: DOMRect = visualBuilder.mainElement.getBoundingClientRect();

            expect(visualBuilder.tickText.every((text: SVGTextElement) => getComputedStyle(text).fontSize === defaultTickFontSize)).toBeTrue();
            expect(visualBuilder.axisTitles.length).toBe(2);
            expect(countOverlaps(visualBuilder.tickText, visualBuilder.axisTitles)).toBe(0);
            expect(visualBuilder.axisTitles.every((title: SVGTextElement) => rectWithin(title.getBoundingClientRect(), rootRect))).toBeTrue();
            expect(getClippedTexts(visualBuilder.tickText, rootRect)).toEqual([]);
        });

        it("persisted axis text sizes above the limit are clamped", () => {
            const persistedDataView: DataView = new DeterministicLineDotChartData().getDataViewWithPersistedAxisTextSizeAboveLimit();
            visualBuilder.updateFlushAllD3Transitions(persistedDataView);

            const rootRect: DOMRect = visualBuilder.mainElement.getBoundingClientRect();

            expect(visualBuilder.tickText.every((text: SVGTextElement) => getComputedStyle(text).fontSize === maxTickFontSize)).toBeTrue();
            expect(visualBuilder.axisTitles.length).toBe(2);
            expect(countOverlaps(visualBuilder.tickText, visualBuilder.axisTitles)).toBe(0);
            expect(visualBuilder.axisTitles.every((title: SVGTextElement) => rectWithin(title.getBoundingClientRect(), rootRect))).toBeTrue();
            expect(getClippedTexts(visualBuilder.tickText, rootRect)).toEqual([]);
        });

        it("default text size keeps a clean layout", () => {
            applyAxisObjects(defaultTextSize);
            visualBuilder.updateFlushAllD3Transitions(layoutDataView);

            const rootRect: DOMRect = visualBuilder.mainElement.getBoundingClientRect();

            expect(visualBuilder.axisTitles.length).toBe(2);
            expect(tickFontSize(visualBuilder)).toBe(defaultTickFontSize);
            expect(countOverlaps(visualBuilder.tickText, visualBuilder.axisTitles)).toBe(0);
            expect(countSelfOverlaps(visualBuilder.xAxisTickText)).toBe(0);
            expect(visualBuilder.tickText.every((text: SVGTextElement) => rectWithin(text.getBoundingClientRect(), rootRect))).toBeTrue();
        });

        it("restoring the default text size restores a clean layout", () => {
            applyAxisObjects(largeTextSize);
            visualBuilder.updateFlushAllD3Transitions(layoutDataView);

            applyAxisObjects(defaultTextSize);
            visualBuilder.updateFlushAllD3Transitions(layoutDataView);

            const rootRect: DOMRect = visualBuilder.mainElement.getBoundingClientRect();

            expect(tickFontSize(visualBuilder)).toBe(defaultTickFontSize);
            expect(visualBuilder.axisTitles.length).toBe(2);
            expect(countOverlaps(visualBuilder.tickText, visualBuilder.axisTitles)).toBe(0);
            expect(countSelfOverlaps(visualBuilder.xAxisTickText)).toBe(0);
            expect(visualBuilder.axisTitles.every((title: SVGTextElement) => rectWithin(title.getBoundingClientRect(), rootRect))).toBeTrue();
            expect(getClippedTexts(visualBuilder.tickText, rootRect)).toEqual([]);
        });

        it("Y axis tick labels do not overlap each other at the maximum text size", () => {
            applyAxisObjects(maxTextSize, noTitles);
            visualBuilder.updateFlushAllD3Transitions(layoutDataView);

            expect(tickFontSize(visualBuilder)).toBe(maxTickFontSize);
            expect(visualBuilder.yAxisTickText.length).toBeGreaterThanOrEqual(minYTicks);
            expect(countSelfOverlaps(visualBuilder.yAxisTickText)).toBe(0);
            expect(countSelfOverlaps(visualBuilder.secondYAxisTickText)).toBe(0);
        });

        it("the second Y axis repeats the first at every text size", () => {
            [defaultTextSize, largeTextSize, maxTextSize].forEach((textSize: number) => {
                applyAxisObjects(textSize, noTitles);
                visualBuilder.updateFlushAllD3Transitions(layoutDataView);

                const primary: (string | null)[] = visualBuilder.yAxisTickText.map((text: SVGTextElement) => text.textContent);
                const secondary: (string | null)[] = visualBuilder.secondYAxisTickText.map((text: SVGTextElement) => text.textContent);

                expect(secondary).toEqual(primary);
            });
        });

        it("axis decoration that does not fit is dropped instead of overflowing", () => {
            const tinyBuilder: LineDotChartBuilder = new LineDotChartBuilder(300, 200);

            applyAxisObjects(maxTextSize, shortTitles);
            tinyBuilder.updateFlushAllD3Transitions(layoutDataView);

            const rootRect: DOMRect = tinyBuilder.mainElement.getBoundingClientRect();

            expect(getClippedTexts(tinyBuilder.tickText, rootRect)).toEqual([]);
            expect(countSelfOverlaps(tinyBuilder.tickText)).toBe(0);
            expect(countOverlaps(tinyBuilder.tickText, tinyBuilder.axisTitles)).toBe(0);
            expect(tinyBuilder.axisTitles.every((title: SVGTextElement) => rectWithin(title.getBoundingClientRect(), rootRect))).toBeTrue();
        });

        it("the plot survives when axis decoration is dropped", () => {
            const tinyBuilder: LineDotChartBuilder = new LineDotChartBuilder(300, 200);

            applyAxisObjects(maxTextSize, shortTitles);
            tinyBuilder.updateFlushAllD3Transitions(layoutDataView);

            expect(tinyBuilder.dots!.length).toBe(12);
            expect(tinyBuilder.linePath).not.toBeNull();
        });

        it("repeating an update keeps the same layout", () => {
            applyAxisObjects(maxTextSize);
            visualBuilder.updateFlushAllD3Transitions(layoutDataView);

            const firstTickCount: number = visualBuilder.tickText.length;
            const firstTitleCount: number = visualBuilder.axisTitles.length;

            visualBuilder.updateFlushAllD3Transitions(layoutDataView);

            expect(visualBuilder.tickText.length).toBe(firstTickCount);
            expect(visualBuilder.axisTitles.length).toBe(firstTitleCount);
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
            const date: any = categoricalValues.Date[0];

            expect(!isNaN(date) && date instanceof Date).toBeTruthy();
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

            const settings = visualBuilder.visualInstance.getRectAnimationSettings(firstValue, lastValue, false);

            // for ascending order X value always the same
            expect(settings.startX).toBe(firstValue);
            expect(settings.endX).toBe(firstValue);

            // width should be always possitive
            expect(settings.endWidth).toBeGreaterThanOrEqual(0);
        });

        it("should return correct rect coordinates and width for reversed data", () => {
            const firstValue: number = 10,
                lastValue: number = 100;

            const settings = visualBuilder.visualInstance.getRectAnimationSettings(firstValue, lastValue, true);
            // for descending order X value moves from right to left
            expect(settings.startX).toBe(lastValue);
            expect(settings.endX).toBe(firstValue);

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

    describe("selection", () => {
        beforeEach(() => {
            dataView.metadata.objects = {
                misc: {
                    isStopped: false
                }
            };
            visualBuilder.updateFlushAllD3Transitions(dataView);
        });

        it("dot should be selected on click", (done) => {
            const dot = visualBuilder.dots![0];
            const datum = select(dot).datum() as LineDotPoint;

            expect(datum.selected).toBeFalse();
            expect(parseFloat(dot.style.opacity)).toBe(1);

            dot.dispatchEvent(new MouseEvent("click"));

            expect(datum.selected).toBeTrue();
            expect(parseFloat(dot.style.opacity)).toBe(1);

            done();
        });

        it("dot should not be selected on double click", (done) => {
            const dot = visualBuilder.dots![0];
            const datum = select(dot).datum() as LineDotPoint;

            expect(datum.selected).toBeFalse();

            dot.dispatchEvent(new MouseEvent("click"));
            expect(datum.selected).toBeTrue();

            dot.dispatchEvent(new MouseEvent("click"));
            expect(datum.selected).toBeFalse();

            done();

        });

        it("when dot is clicked, other dots should not be selected", (done) => {
            const selection: Selection<SVGCircleElement, LineDotPoint, any, unknown> = selectAll(visualBuilder.dots!);
            const nodes = selection.nodes();
            const data = selection.data();

            nodes[0].dispatchEvent(new MouseEvent("click"));

            expect(data[0].selected).toBeTruthy();
            expect(parseFloat(nodes[0].style.opacity)).toBe(1);

            for (let i = 1; i < data.length; i++) {
                expect(data[i].selected).toBeFalse();
                expect(parseFloat(nodes[i].style.opacity)).toBeLessThan(1);
            }

            done();
        });

        it("dots should be selected on click with modifier keys", (done) => {
            testModifierKey(new MouseEvent("click", { ctrlKey: true }));
            testModifierKey(new MouseEvent("click", { shiftKey: true }));
            testModifierKey(new MouseEvent("click", { metaKey: true }));

            done();

            function testModifierKey(secondClick: MouseEvent) {
                const selection: Selection<SVGCircleElement, LineDotPoint, any, unknown> = selectAll(visualBuilder.dots!);
                const nodes = selection.nodes();
                const data = selection.data();
                nodes[0].dispatchEvent(new MouseEvent("click"));
                nodes[1].dispatchEvent(secondClick);

                expect(data[0].selected).toBeTruthy();
                expect(data[1].selected).toBeTruthy();
                expect(parseFloat(nodes[0].style.opacity)).toBe(1);
                expect(parseFloat(nodes[1].style.opacity)).toBe(1);

                for (let i = 2; i < data.length; i++) {
                    expect(data[i].selected).toBeFalse();
                    expect(parseFloat(nodes[i].style.opacity)).toBeLessThan(1);
                }

                // clear selection
                visualBuilder.mainElement.dispatchEvent(new MouseEvent("click"));
            }
        });
    });
});


describe("LineDotChart highlight", () => {
    it("should highlight dots", (done) => {
        const visualBuilder = new LineDotChartBuilder(1000, 500);
        const defaultDataViewBuilder = new LineDotChartData();
        const dataView = defaultDataViewBuilder.getDataView();

        // set highlights
        dataView.categorical!.values![0].highlights = dataView.categorical!.values![0].values;
        for (let i = dataView.categorical!.values![0].highlights.length; i < dataView.categorical!.values![0].highlights.length; i++) {
            dataView.categorical!.values![0].highlights[i] = <any>null;
        }

        dataView.metadata.objects = {
            misc: {
                isStopped: false
            }
        };
        visualBuilder.updateFlushAllD3Transitions(dataView);

        const selection: Selection<SVGCircleElement, LineDotPoint, any, unknown> = selectAll(visualBuilder.dots!);
        const nodes = selection.nodes();
        const data = selection.data();

        for (let i = 0; i < data.length; i++) {
            if (data[i].highlight) {
                expect(parseFloat(nodes[i].style.opacity)).toBe(1);
            } else {
                expect(parseFloat(nodes[i].style.opacity)).toBeLessThan(1);
            }
        }

        done();
    });
});
