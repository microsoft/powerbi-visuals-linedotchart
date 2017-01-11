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

namespace powerbitests.customVisuals {
    import VisualClass = powerbi.extensibility.visual.test.LineDotChartBuilder;
    import LineDotChartData = powerbi.extensibility.visual.test.LineDotChartData;
    import LineDotChartBuilder = powerbi.extensibility.visual.test.LineDotChartBuilder;
    import helpers = powerbi.extensibility.utils.test.helpers;
    import colorHelper = powerbi.extensibility.utils.test.helpers.color;
    import RgbColor = powerbi.extensibility.utils.test.helpers.color.RgbColor;
    import MockISelectionId = powerbi.extensibility.utils.test.mocks.MockISelectionId;
    import createSelectionId = powerbi.extensibility.utils.test.mocks.createSelectionId;
    import fromPointToPixel = powerbi.extensibility.utils.type.PixelConverter.fromPointToPixel;
    import getRandomHexColor = powerbitests.customVisuals.getRandomHexColor;

    describe("LineDotChartTests", () => {
        let visualBuilder: powerbi.extensibility.visual.test.LineDotChartBuilder;
        let defaultDataViewBuilder: LineDotChartData;
        let dataView: powerbi.DataView;
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
                        duration: 20
                    },
                    counteroptions: {
                        counterTitle: "Counter: "
                    }
                };
                visualBuilder.updateFlushAllD3Transitions(dataView);

                helpers.clickElement(visualBuilder.animationPlay);
                helpers.renderTimeout(() => {
                    expect(visualBuilder.counterTitle).toBeInDOM();
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
    });
}
