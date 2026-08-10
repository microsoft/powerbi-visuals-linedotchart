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

import range from "lodash.range";

import { RgbColor, parseColorString } from "powerbi-visuals-utils-colorutils";
import { getRandomNumber } from "powerbi-visuals-utils-testutils";

export function areColorsEqual(firstColor: string, secondColor: string): boolean {
    const firstConvertedColor: RgbColor = parseColorString(firstColor),
        secondConvertedColor: RgbColor = parseColorString(secondColor);

    return firstConvertedColor.R === secondConvertedColor.R
        && firstConvertedColor.G === secondConvertedColor.G
        && firstConvertedColor.B === secondConvertedColor.B;
}

export function getHexColorFromNumber(value: number) {
    let hex: string = value.toString(16).toUpperCase();
    return "#" + (hex.length === 6 ? hex : range(0, 6 - hex.length, 0).join("") + hex);
}

export function getRandomInteger(min: number, max: number, exceptionList?: number[]): number {
    return getRandomNumber(max, min, exceptionList, Math.floor);
}

export function getRandomHexColor(): string {
    return getHexColorFromNumber(getRandomInteger(0, 16777215 + 1));
}

export function getRandomHexColors(count: number): string[] {
    return range(count).map(x => getRandomHexColor());
}

/** Subpixel antialiasing makes touching glyph boxes report a hairline intersection. */
const geometryTolerance: number = 0.5;

export function rectsIntersect(first: DOMRect, second: DOMRect): boolean {
    return first.left < second.right - geometryTolerance
        && second.left < first.right - geometryTolerance
        && first.top < second.bottom - geometryTolerance
        && second.top < first.bottom - geometryTolerance;
}

export function rectWithin(inner: DOMRect, outer: DOMRect): boolean {
    return inner.left >= outer.left - geometryTolerance
        && inner.right <= outer.right + geometryTolerance
        && inner.top >= outer.top - geometryTolerance
        && inner.bottom <= outer.bottom + geometryTolerance;
}

export function countOverlaps(elements: Element[], others: Element[]): number {
    const otherRects: DOMRect[] = others.map((other: Element) => other.getBoundingClientRect());

    return elements.filter((element: Element) => {
        const rect: DOMRect = element.getBoundingClientRect();
        return otherRects.some((otherRect: DOMRect) => rectsIntersect(rect, otherRect));
    }).length;
}

export function countSelfOverlaps(elements: Element[]): number {
    const rects: DOMRect[] = elements.map((element: Element) => element.getBoundingClientRect());
    let count: number = 0;

    for (let first: number = 0; first < rects.length; first++) {
        for (let second: number = first + 1; second < rects.length; second++) {
            if (rectsIntersect(rects[first], rects[second])) {
                count++;
            }
        }
    }

    return count;
}

export function getClippedTexts(elements: SVGTextElement[], outer: DOMRect): string[] {
    return elements
        .filter((element: SVGTextElement) => !rectWithin(element.getBoundingClientRect(), outer))
        .map((element: SVGTextElement) => element.textContent ?? "");
}

/** textMeasurementService.svgEllipsis appends this when it truncates. */
const ellipsis: string = "...";

export function readableTextLength(text: string): number {
    const content: string = text ?? "";

    return (content.endsWith(ellipsis) ? content.slice(0, -ellipsis.length) : content).length;
}