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
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;
import { ColorHelper } from "powerbi-visuals-utils-colorutils";
import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export class AxisSettings {
    public show: boolean = true;
    public color: string = "black";
    public textSize: number = 9;
}

export class YAxisSettings extends AxisSettings {
    public isDuplicated: boolean = true;
}

export class LineSettings {
    public minLineThickness: number = 0;
    public maxLineThickness: number = 50;

    public fill: string = "rgb(102, 212, 204)";
    public lineThickness: number = 1;
}

export class DotSettings {
    public minDotSize: number = 0;
    public maxDotSize: number = 50;

    public color: string = "#005c55";
    public dotSizeMin: number = 4;
    public dotSizeMax: number = 38;
    // Opacity
    public percentile: number = 100;

    public stroke: string = "#ffffff";
    public strokeOpacity: number = 0.7;
    public strokeWidth: number = 0.5;
}

export class CounterSettings {
    public show: boolean = true;
    public counterTitle: string = null;
    public color: string = "#000000";
    public textSize: number = 24;
}

export class MiscSettings {
    public minDuration: number = 0;
    public maxDuration: number = 1000;

    public isAnimated: boolean = true;
    public isStopped: boolean = true;
    public duration: number = 20;
}

export class CounterDateTime {
    public isCounterDateTime: boolean = true;
}

export class PlayButtonSettings {
    public stroke: string = "gray";
    public fill: string = "white";
    public strokeWidth: number = 0.5;
    public innerColor: string = "#000000";
    public opacity: number = undefined;
}

export class Settings extends DataViewObjectsParser {
    public isCounterDateTime: CounterDateTime = new CounterDateTime();
    public lineoptions: LineSettings = new LineSettings();
    public dotoptions: DotSettings = new DotSettings();
    public counteroptions: CounterSettings = new CounterSettings();
    public misc: MiscSettings = new MiscSettings();
    public xAxis: AxisSettings = new AxisSettings();
    public yAxis: YAxisSettings = new YAxisSettings();
    public play: PlayButtonSettings = new PlayButtonSettings();

    public static parseSettings(
        dataView: DataView,
        localizationManager: ILocalizationManager,
        colorHelper: ColorHelper
    ): Settings {
        const settings: Settings = Settings.parse<Settings>(dataView);

        if (!settings.counteroptions.counterTitle) {
            settings.counteroptions.counterTitle = localizationManager.getDisplayName("Visual_CounterTitle");
        }

        settings.dotoptions.dotSizeMin = this.getValidValue(
            settings.dotoptions.dotSizeMin,
            settings.dotoptions.minDotSize,
            settings.dotoptions.maxDotSize,
        );

        settings.dotoptions.dotSizeMax = this.getValidValue(
            settings.dotoptions.dotSizeMax,
            settings.dotoptions.dotSizeMin,
            settings.dotoptions.maxDotSize,
        );

        settings.lineoptions.lineThickness = this.getValidValue(
            settings.lineoptions.lineThickness,
            settings.lineoptions.minLineThickness,
            settings.lineoptions.maxLineThickness,
        );

        settings.misc.duration = this.getValidValue(
            settings.misc.duration,
            settings.misc.minDuration,
            settings.misc.maxDuration,
        );

        if (colorHelper.isHighContrast) {
            const foregroundColor: string = colorHelper.getThemeColor("foreground");
            const backgroundColor: string = colorHelper.getThemeColor("background");

            settings.lineoptions.fill = foregroundColor;
            settings.lineoptions.lineThickness = 2;

            settings.dotoptions.color = backgroundColor;
            settings.dotoptions.strokeOpacity = null;
            settings.dotoptions.strokeWidth = 2;
            settings.dotoptions.stroke = foregroundColor;

            settings.counteroptions.color = foregroundColor;

            settings.xAxis.color = foregroundColor;
            settings.yAxis.color = foregroundColor;

            settings.play.fill = backgroundColor;
            settings.play.stroke = foregroundColor;
            settings.play.strokeWidth = 1;
            settings.play.innerColor = foregroundColor;
            settings.play.opacity = 1;
        }

        return settings;
    }

    private static getValidValue(value: number, min: number, max: number): number {
        if (value < min) {
            return min;
        } else if (value > max) {
            return max;
        }

        return value;
    }
}

