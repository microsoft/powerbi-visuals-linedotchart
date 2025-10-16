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

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import { VisualBuilderBase } from "powerbi-visuals-utils-testutils";

import { LineDotChart as VisualClass } from "./../src/visual";

export class LineDotChartBuilder extends VisualBuilderBase<VisualClass> {
    constructor(width: number, height: number) {
        super(width, height, "LineDotChart1460463831201");
    }

    protected build(options: VisualConstructorOptions) {
        return new VisualClass(options);
    }

    public get visualInstance(): VisualClass {
        return this.visual;
    }

    public get mainElement(): SVGSVGElement {
        return this.element.querySelector<SVGSVGElement>("svg.lineDotChart")!;
    }

    public get line(): SVGGElement {
        return this.mainElement
            .querySelector("g")!
            .querySelector("g.line")!;
    }

    public get linePath(): SVGPathElement | null {
        return this.line
            .querySelector("g.path")
            ?.querySelector("path.plot") || null;
    }

    public get clipPath(): SVGClipPathElement | null {
        return this.line
            .querySelector("g.path")!
            .querySelector("clipPath#lineClip");
    }

    public get dots(): NodeListOf<SVGCircleElement> | null {
        return this.line
            .querySelector("g.dot-points")
            ?.querySelectorAll<SVGCircleElement>("circle.point") || null;
    }

    public get axes(): SVGGElement {
        return this.mainElement
            .querySelector("g")!
            .querySelector("g.axes")!;
    }

    public get axis(): NodeListOf<SVGGElement> {
        return this.axes.querySelectorAll("g.axis");
    }

    public get emptyAxis(): NodeListOf<SVGGElement> {
        return this.axes.querySelectorAll("g.axis:empty");
    }

    public get ticks(): SVGGElement[] {
        const ticks: SVGGElement[] = [];

        this.axis
            .forEach((element: SVGGElement) => {
                const tickElements: NodeListOf<SVGGElement> = element.querySelectorAll("g.tick");
                ticks.push(...tickElements);
            });

        return ticks;
    }

    public get xAxisTick(): NodeListOf<SVGGElement> {
        return this.axis
            [0]
            .querySelectorAll("g.tick");
    }

    public get tickText(): SVGTextElement[] {
        const tickTexts: SVGTextElement[] = [];
        this.ticks.forEach((tick: SVGGElement) => {
            tickTexts.push(tick.querySelector("text")!);
        });
        return tickTexts;
    }

    public get xAxisTickText(): SVGTextElement[] {
        const tickTexts: SVGTextElement[] = [];
        this.xAxisTick.forEach((tick: SVGGElement) => {
            tickTexts.push(tick.querySelector("text")!);
        });
        return tickTexts;
    }

    public get animationPlayButton(): SVGGElement | null {
        return this.mainElement.querySelector("g.lineDotChart__playBtn");
    }

    public get legends(): SVGGElement {
        return this.mainElement.querySelector("g.legends")!;
    }

    public get counterTitle(): SVGTextElement | null {
        return this.line.querySelector("text.text");
    }

}
