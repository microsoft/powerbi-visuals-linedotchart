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

/// <reference path="_references.ts"/>

namespace powerbi.extensibility.visual.test {
    import LineDotChartData = powerbi.extensibility.visual.test.LineDotChartData;
    import LineDotChartBuilder = powerbi.extensibility.visual.test.LineDotChartBuilder;
    import helpers = powerbi.extensibility.utils.test.helpers;
    import colorHelper = powerbi.extensibility.utils.test.helpers.color;
    import RgbColor = powerbi.extensibility.utils.test.helpers.color.RgbColor;
    import MockISelectionId = powerbi.extensibility.utils.test.mocks.MockISelectionId;
    import createSelectionId = powerbi.extensibility.utils.test.mocks.createSelectionId;
    import getRandomHexColor = powerbitests.customVisuals.getRandomHexColor;

    // powerbi.extensibility.utils.formatting
    import IValueFormatter = powerbi.extensibility.utils.formatting.IValueFormatter;

    // powerbi.extensibility.utils.type
    import convertToPx = powerbi.extensibility.utils.type.PixelConverter.toString;
    import convertToPt = powerbi.extensibility.utils.type.PixelConverter.fromPoint;
    import fromPointToPixel = powerbi.extensibility.utils.type.PixelConverter.fromPointToPixel;

    // LineDotChart1460463831201
    import ColumnNames = powerbi.extensibility.visual.LineDotChart1460463831201.ColumnNames;
    import LineDotPoint = powerbi.extensibility.visual.LineDotChart1460463831201.LineDotPoint;
    import LineDotChartViewModel = powerbi.extensibility.visual.LineDotChart1460463831201.LineDotChartViewModel;
    import LineDotChartColumns = powerbi.extensibility.visual.LineDotChart1460463831201.LineDotChartColumns;

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
                expect(visualBuilder.mainElement.get(0)).toBeDefined();
            });

            it("update", (done) => {
                visualBuilder.updateRenderTimeout(dataView, () => {
                    expect(visualBuilder.mainElement.find(".axis").length).not.toBe(0);
                    expect(visualBuilder.mainElement.find(".tick").length).not.toBe(0);
                    expect(visualBuilder.mainElement.find(".lineDotChart__playBtn").get(0)).toBeDefined();
                    expect(visualBuilder.mainElement.find(".legends").get(0)).toBeDefined();

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

                helpers.renderTimeout(() => {
                    expect(visualBuilder.counterTitle).toBeInDOM();
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
                        color: colorHelper.getSolidColorStructuralObject(color),
                        textSize: textSize
                    },
                    yAxis: {
                        show: true,
                        color: colorHelper.getSolidColorStructuralObject(color),
                        textSize: textSize
                    }
                };

                visualBuilder.updateFlushAllD3Transitions(dataView);
                visualBuilder.visualInstance.applyAxisSettings();

                expect(visualBuilder.tickText.length).toBeGreaterThan(0);

                visualBuilder.tickText.toArray().map($).forEach(e => {
                    expect(e.prop('style')['font-size']).toBe(expectedTextSize);
                    colorHelper.assertColorsMatch(e.prop('style')['fill'], color);
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
                visualBuilder.updateFlushAllD3Transitions(dataView);
                helpers.renderTimeout(() => {
                    visualBuilder.visualInstance.clear();
                    expect(visualBuilder.mainElement.find("circle").get(0)).toBe(undefined);
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
                helpers.renderTimeout(() => {
                    expect(visualBuilder.mainElement.find("clipPath").get(0)).toBe(undefined);
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
                    let color: string = getRandomHexColor();
                    (dataView.metadata.objects as any).lineoptions = { fill: colorHelper.getSolidColorStructuralObject(color) };
                    visualBuilder.updateFlushAllD3Transitions(dataView);
                    colorHelper.assertColorsMatch(visualBuilder.linePath.css('stroke'), color);
                });
            });

            describe("Dot", () => {
                it("color", () => {
                    let color: string = getRandomHexColor();

                    dataView.metadata.objects = {
                        dotoptions: {
                            color: colorHelper.getSolidColorStructuralObject(color)
                        }
                    };
                    visualBuilder.updateFlushAllD3Transitions(dataView);
                    visualBuilder.dots.toArray().map($).forEach(e =>
                        colorHelper.assertColorsMatch(e.attr('fill'), color));
                });
                it("opacity", () => {
                    let color: string = getRandomHexColor();
                    dataView.metadata.objects = {
                        dotoptions: {
                            color: colorHelper.getSolidColorStructuralObject(color),
                            percentile: 50
                        }
                    };
                    visualBuilder.updateFlushAllD3Transitions(dataView);
                    visualBuilder.dots.toArray().map($).forEach(e => colorHelper.assertColorsMatch(e.attr('fill'), color) && colorHelper.assertColorsMatch(e.style('opacity'), color));
                });
            });

            describe("Validate params", () => {
                it("Dots", () => {

                    dataView.metadata.objects = {
                        dotoptions: {
                            dotSizeMin: -6,
                            dotSizeMax: 678
                        }
                    };
                    visualBuilder.updateFlushAllD3Transitions(dataView);
                    visualBuilder.dots.toArray().map($).forEach(e => {
                        expect(e.attr("r")).toBeGreaterThan(-1);
                        expect(e.attr("r")).toBeLessThan(101);
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
                const dataPoint: LineDotPoint = {
                    dateValue: {
                        date: new Date(2008, 1, 1)
                    }
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

                let ticks: any = visualBuilder.axis.first().children("g.tick");

                expect(ticks.length).toBe(4);
                expect(ticks.children("text").text()).toEqual(expectedXlabel);
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

        describe("Capabilities tests", () => {
            it("all items having displayName should have displayNameKey property", () => {
                jasmine.getJSONFixtures().fixturesPath = "base";

                let jsonData = getJSONFixture("capabilities.json");

                let objectsChecker: Function = (obj) => {
                    for (let property in obj) {
                        let value: any = obj[property];

                        if (value.displayName) {
                            expect(value.displayNameKey).toBeDefined();
                        }

                        if (typeof value === "object") {
                            objectsChecker(value);
                        }
                    }
                };

                objectsChecker(jsonData);
            });
        });
    });
}
