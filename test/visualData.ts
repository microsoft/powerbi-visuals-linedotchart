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
import ValueTypeDescriptor = powerbi.ValueTypeDescriptor;

import { valueType as valueTypeModule } from "powerbi-visuals-utils-typeutils";
import ValueType = valueTypeModule.ValueType;

import { getRandomNumber, getRandomNumbers, testDataViewBuilder } from "powerbi-visuals-utils-testutils";
import CustomizeColumnFn = testDataViewBuilder.CustomizeColumnFn;
import TestDataViewBuilder = testDataViewBuilder.TestDataViewBuilder;

export function getRandomUniqueNumbers(count: number, min: number = 0, max: number = 1): number[] {
    let result: number[] = [];
    for (let i = 0; i < count; i++) {
        result.push(getRandomNumber(min, max, result));
    }

    return result;
}

export function getRandomUniqueDates(count: number, start: Date, end: Date): Date[] {
    return getRandomUniqueNumbers(count, start.getTime(), end.getTime()).map(x => new Date(x));
}

export function getRandomUniqueSortedDates(count: number, start: Date, end: Date): Date[] {
    return getRandomUniqueDates(count, start, end).sort((a, b) => a.getTime() - b.getTime());
}

export class LineDotChartData extends TestDataViewBuilder {
    public static ColumnDate: string = "Date";
    public static ColumnValue: string = "Value";
    public static DefaultFormat: string = "#";
    public static PercentFormat: string = "0%;-0%;0%";
    public static PriceFormat: string = "\$#,0.000;(\$#,0.000);\$#,0.000";

    public valuesDate: Date[] = getRandomUniqueSortedDates(
        50,
        new Date(2014, 9, 12, 3, 9, 50),
        new Date(2016, 3, 1, 2, 43, 3)
    );
    public valuesValue = getRandomNumbers(this.valuesDate.length, 0, 5361);
    public valuesForPercentFormat = getRandomNumbers(this.valuesDate.length, 0, 100);
    public valuesDateAsString: string[] = this.valuesDate.map(x => x.toISOString());

    public getDataView(columnNames?: string[], valuesDate?: string[] | Date[] | number[], valuesValue?: string[] | Date[] | number[]): DataView {
        return this.getFormattedDataView(
            ValueType.fromDescriptor({ dateTime: true }),
            ValueType.fromDescriptor({ integer: true }),
            valuesDate ? valuesDate : this.valuesDate,
            valuesValue ? valuesValue : this.valuesValue,
            columnNames
        );
    }

    public getDataViewWithDifferentFormats(columnNames?: string[]): DataView {
        return this.getFormattedDataView(
            ValueType.fromDescriptor({ numeric: true }),
            ValueType.fromDescriptor({ integer: true }),
            this.valuesValue,
            this.valuesForPercentFormat,
            columnNames,
            LineDotChartData.PriceFormat,
            LineDotChartData.PercentFormat
        );
    }

    private getFormattedDataView(
        valueTypeDescriptor1: ValueTypeDescriptor,
        valueTypeDescriptor2: ValueTypeDescriptor,
        values1: string[] | Date[] | number[],
        values2: string[] | Date[] | number[],
        columnNames?: string[],
        format1: string = LineDotChartData.DefaultFormat,
        format2: string = LineDotChartData.DefaultFormat,
    ): DataView {
        return this.createCategoricalDataViewBuilder([
            {
                source: {
                    displayName: LineDotChartData.ColumnDate,
                    type: valueTypeDescriptor1,
                    roles: { Date: true },
                    format: format1
                },
                values: values1
            }
        ], [
                {
                    source: {
                        displayName: LineDotChartData.ColumnValue,
                        type: valueTypeDescriptor2,
                        roles: { Values: true },
                        format: format2
                    },
                    values: values2
                }
            ], columnNames).build();
    }

    public createStringView(columnNames?: string[]): powerbi.DataView {
        return this.getFormattedDataView(
            ValueType.fromDescriptor({ text: true }),
            ValueType.fromDescriptor({ integer: true }),
            ["Alpha", "Beta", "Omega", "Gamma"],
            [100, 200, 300, 400],
            columnNames
        );
    }

    public getDataViewForCategoricalValues(columnNames?: string[]): powerbi.DataView {
        return this.getFormattedDataView(
            ValueType.fromDescriptor({ dateTime: true }),
            ValueType.fromDescriptor({ integer: true }),
            this.valuesDateAsString,
            this.valuesValue,
            columnNames
        );
    }
}

export const deterministicDates: Date[] = [
    new Date(Date.UTC(2015, 0, 15)),
    new Date(Date.UTC(2015, 1, 15)),
    new Date(Date.UTC(2015, 2, 15)),
    new Date(Date.UTC(2015, 3, 15)),
    new Date(Date.UTC(2015, 4, 15)),
    new Date(Date.UTC(2015, 5, 15)),
    new Date(Date.UTC(2015, 6, 15)),
    new Date(Date.UTC(2015, 7, 15)),
    new Date(Date.UTC(2015, 8, 15)),
    new Date(Date.UTC(2015, 9, 15)),
    new Date(Date.UTC(2015, 10, 15)),
    new Date(Date.UTC(2015, 11, 15))
];

export const deterministicValues: number[] = [3200, 4100, 2750, 5300, 4800, 6100, 3900, 7200, 5600, 4300, 6800, 5100];

export const deterministicPercentValues: number[] = [12, 34, 21, 55, 48, 63, 39, 72, 56, 43, 68, 51];

export class DeterministicLineDotChartData extends LineDotChartData {
    public valuesDate: Date[] = deterministicDates;
    public valuesValue: number[] = deterministicValues;
    public valuesForPercentFormat: number[] = deterministicPercentValues;
    public valuesDateAsString: string[] = deterministicDates.map(date => date.toISOString());

    public getDataViewFromLegacyAxisSettings(): DataView {
        const dataView: DataView = this.getDataView();
        dataView.metadata.objects = {
            misc: {
                isAnimated: false
            },
            xAxis: {
                show: true,
                title: "Test Title Test Title Test Title"
            },
            yAxis: {
                show: true,
                isDuplicated: true,
                title: "Test Title Test Title"
            }
        };

        return dataView;
    }

    public getDataViewWithPersistedAxisTextSizeAboveLimit(): DataView {
        const dataView: DataView = this.getDataViewFromLegacyAxisSettings();
        const objects: powerbi.DataViewObjects = dataView.metadata.objects!;
        objects.xAxis.textSize = 100;
        objects.yAxis.textSize = 100;

        return dataView;
    }
}