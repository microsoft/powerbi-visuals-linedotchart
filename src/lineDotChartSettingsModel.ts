import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import ValidatorType = powerbi.visuals.ValidatorType;
import Card = formattingSettings.SimpleCard;
import Model = formattingSettings.Model;

class LineSettingsCard extends Card {
    fill = new formattingSettings.ColorPicker({
        name: "fill",
        displayName: "Fill",
        displayNameKey: "Visual_Fill",
        value: { value: "#66d4cc" },
    });

    lineThickness = new formattingSettings.NumUpDown({
        name: "lineThickness",
        displayName: "Thickness",
        displayNameKey: "Visual_Thickness",
        value: 1,
        options: {
            minValue: { value: 0, type: ValidatorType.Min },
            maxValue: { value: 50, type: ValidatorType.Max },
        }
    });

    name = "lineoptions";
    displayName = "Line";
    displayNameKey = "Visual_Line";
    slices = [this.fill, this.lineThickness];
}

class DotSettingsCard extends Card {
    private minDotSize: number = 0;
    private maxDotSize: number = 50;
    private dotSizeMinDefault: number = 4;
    private dotSizeMaxDefault: number = 38;

    color = new formattingSettings.ColorPicker({
        name: "color",
        displayName: "Fill",
        displayNameKey: "Visual_Fill",
        value: { value: "#005c55" },
    });

    dotSizeMin = new formattingSettings.NumUpDown({
        name: "dotSizeMin",
        displayName: "Min Size",
        displayNameKey: "Visual_MinSize",
        value: this.dotSizeMinDefault,
        options: {
            minValue: { value: this.minDotSize, type: ValidatorType.Min },
            maxValue: { value: this.maxDotSize, type: ValidatorType.Max },
        }
    });

    dotSizeMax = new formattingSettings.NumUpDown({
        name: "dotSizeMax",
        displayName: "Max Size",
        displayNameKey: "Visual_MaxSize",
        value: this.dotSizeMaxDefault,
        options: {
            minValue: { value: this.dotSizeMinDefault, type: ValidatorType.Min },
            maxValue: { value: this.maxDotSize, type: ValidatorType.Max },
        }
    });

    percentile = new formattingSettings.Slider({
        name: "percentile",
        displayName: "Opacity",
        displayNameKey: "Visual_Opacity",
        value: 100,
    });

    public stroke: string = "#ffffff";
    public strokeOpacity: number = 0.7;
    public strokeWidth: number = 0.5;

    name = "dotoptions";
    displayName = "Dot";
    displayNameKey = "Visual_Dot";
    slices = [this.color, this.dotSizeMin, this.dotSizeMax, this.percentile];
}

class XAxisSettingsCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show",
        displayNameKey: "Visual_Show",
        value: true,
    });

    title = new formattingSettings.TextInput({
        name: "title",
        displayName: "Title",
        displayNameKey: "Visual_Title",
        value: "",
        placeholder: "",
    });

    color = new formattingSettings.ColorPicker({
        name: "color",
        displayName: "Color",
        displayNameKey: "Visual_Color",
        value: { value: "#000000" },
    });

    textSize = new formattingSettings.NumUpDown({
        name: "textSize",
        displayName: "Text Size",
        displayNameKey: "Visual_TextSize",
        value: 9,
        options: {
            minValue: { value: 0, type: ValidatorType.Min },
        }
    });

    topLevelSlice = this.show;
    name = "xAxis";
    displayName = "X-Axis";
    displayNameKey = "Visual_XAxis";
    slices = [this.title, this.color, this.textSize]
}

class YAxisSettingsCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show",
        displayNameKey: "Visual_Show",
        value: true,
    });

    title = new formattingSettings.TextInput({
        name: "title",
        displayName: "Title",
        displayNameKey: "Visual_Title",
        value: "",
        placeholder: "",
    });

    color = new formattingSettings.ColorPicker({
        name: "color",
        displayName: "Color",
        displayNameKey: "Visual_Color",
        value: { value: "#000000" },
    });

    textSize = new formattingSettings.NumUpDown({
        name: "textSize",
        displayName: "Text Size",
        displayNameKey: "Visual_TextSize",
        value: 9,
        options: {
            minValue: { value: 0, type: ValidatorType.Min },
        }
    });

    isDuplicated = new formattingSettings.ToggleSwitch({
        name: "isDuplicated",
        displayName: "Duplicated",
        displayNameKey: "Visual_Duplicated",
        value: true,
    })

    topLevelSlice = this.show;
    name = "yAxis";
    displayName = "Y-Axis";
    displayNameKey = "Visual_YAxis";
    slices = [this.title, this.color, this.textSize, this.isDuplicated]
}

class CounterSettingsCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show",
        displayNameKey: "Visual_Show",
        value: true,
    });

    counterTitle = new formattingSettings.TextInput({
        name: "counterTitle",
        displayName: "Title",
        displayNameKey: "Visual_Title",
        value: "",
        placeholder: "",
    });

    color = new formattingSettings.ColorPicker({
        name: "color",
        displayName: "Fill",
        displayNameKey: "Visual_Fill",
        value: { value: "#000000" },
    });

    textSize = new formattingSettings.NumUpDown({
        name: "textSize",
        displayName: "Text Size",
        displayNameKey: "Visual_TextSize",
        value: 24,
    });

    topLevelSlice = this.show;
    name = "counteroptions";
    displayName = "Counter";
    displayNameKey = "Visual_Counter";
    slices = [this.counterTitle, this.color, this.textSize];
}

class AnimationSettingsCard extends Card {
    isAnimated = new formattingSettings.ToggleSwitch({
        name: "isAnimated",
        displayName: "Animated",
        displayNameKey: "Visual_Animated",
        value: true,
    });

    isStopped = new formattingSettings.ToggleSwitch({
        name: "isStopped",
        displayName: "Stop on load",
        displayNameKey: "Visual_StopOnLoad",
        value: true,
    });

    duration = new formattingSettings.NumUpDown({
        name: "duration",
        displayName: "Time",
        displayNameKey: "Visual_Time",
        value: 20,
        options: {
            minValue: { value: 0, type: ValidatorType.Min },
            maxValue: { value: 1000, type: ValidatorType.Max },
        }
    });

    name = "misc";
    displayName = "Animation";
    displayNameKey = "Visual_Animation";
    slices = [this.isAnimated, this.isStopped, this.duration];
}

class PlayButtonSettingsCard extends Card {
    show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show",
        displayNameKey: "Visual_Show",
        value: true
    });

    fill = new formattingSettings.ColorPicker({
        name: "fill",
        displayName: "Fill",
        displayNameKey: "Visual_Fill",
        value: { value: "#ffffff" },
    });

    stroke = new formattingSettings.ColorPicker({
        name: "stroke",
        displayName: "Stroke",
        displayNameKey: "Visual_Stroke",
        value: { value: "#808080" },
    });

    innerColor = new formattingSettings.ColorPicker({
        name: "innerColor",
        displayName: "Inner color",
        displayNameKey: "Visual_InnerColor",
        value: { value: "#000000" },
    });

    strokeWidth = new formattingSettings.NumUpDown({
        name: "strokeWidth",
        displayName: "Stroke width",
        displayNameKey: "Visual_StrokeWidth",
        value: 0.5,
        options: {
            minValue: { value: 0, type: ValidatorType.Min },
        }
    });

    opacity = new formattingSettings.Slider({
        name: "opacity",
        displayName: "Opacity",
        displayNameKey: "Visual_Opacity",
        value: 100,
        options: {
            minValue: { value: 0, type: ValidatorType.Min },
            maxValue: { value: 100, type: ValidatorType.Max },
        }
    });

    topLevelSlice = this.show;
    name = "playButton";
    displayName = "Play button";
    displayNameKey = "Visual_PlayButton";
    slices = [this.fill, this.stroke, this.innerColor, this.strokeWidth, this.opacity];
}

export class LineDotChartSettingsModel extends Model {
    lineoptions = new LineSettingsCard();
    dotoptions = new DotSettingsCard();
    xAxis = new XAxisSettingsCard();
    yAxis = new YAxisSettingsCard();
    counteroptions = new CounterSettingsCard();
    misc = new AnimationSettingsCard();
    playButton = new PlayButtonSettingsCard();

    isCounterDateTime: boolean = true;

    cards = [
        this.lineoptions,
        this.dotoptions,
        this.xAxis,
        this.yAxis,
        this.counteroptions,
        this.misc,
        this.playButton,
    ];

    /**
     * Validates values of the settings and corrects them if needed.
     * Because formatting model options does not force changing the value if it's already set in the invalid range.
     */
    public validateAndCorrectSettings(): void {
        this.dotoptions.dotSizeMin.value = this.getValidValue(
            this.dotoptions.dotSizeMin.value,
            this.dotoptions.dotSizeMin.options.minValue.value,
            this.dotoptions.dotSizeMin.options.maxValue.value
        );

        this.dotoptions.dotSizeMax.value = this.getValidValue(
            this.dotoptions.dotSizeMax.value,
            this.dotoptions.dotSizeMax.options.minValue.value,
            this.dotoptions.dotSizeMax.options.maxValue.value
        );

        this.lineoptions.lineThickness.value = this.getValidValue(
            this.lineoptions.lineThickness.value,
            this.lineoptions.lineThickness.options.minValue.value,
            this.lineoptions.lineThickness.options.maxValue.value
        );

        this.misc.duration.value = this.getValidValue(
            this.misc.duration.value,
            this.misc.duration.options.minValue.value,
            this.misc.duration.options.maxValue.value
        );
    }

    private getValidValue(value: number, min: number, max: number): number {
        if (value < min) {
            return min;
        } else if (value > max) {
            return max;
        }

        return value;
    }
}