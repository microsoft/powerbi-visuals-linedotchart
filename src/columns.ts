﻿/*
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
import mapValues from "lodash.mapvalues";

import DataView = powerbi.DataView;
import DataViewCategorical = powerbi.DataViewCategorical;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import DataViewValueColumns = powerbi.DataViewValueColumns;
import PrimitiveValue = powerbi.PrimitiveValue;

import { converterHelper } from "powerbi-visuals-utils-dataviewutils";

export class LineDotChartColumns<T> {
    public static getCategoricalValues(dataView: DataView) {
        const categorical: DataViewCategorical = dataView && dataView.categorical;

        const categories: (DataViewCategoryColumn | DataViewValueColumn)[] = categorical && categorical.categories || [];
        const values: DataViewValueColumns = categorical && categorical.values || <DataViewValueColumns>[];

        const series: any = categorical && values.source && this.getSeriesValues(dataView);

        return categorical && mapValues(new this<any[]>(), (n, i) =>
            (<(DataViewCategoryColumn | DataViewValueColumn)[]>categories)
                .concat(values)
                .filter(x => x.source.roles && x.source.roles[i])
                .map(x => x.values.map(y => {
                    if (typeof y === 'string') {
                        const date: Date = new Date(y);
                        if (isNaN(date.getTime())) {
                            return y;
                        }

                        return date;
                    }
                    return y;
                }))[0]
            || values.source && values.source.roles && values.source.roles[i] && series);
    }

    public static getSeriesValues(dataView: DataView): PrimitiveValue[] {
        return dataView
            && dataView.categorical
            && dataView.categorical.values
            && dataView.categorical.values.map((value: DataViewValueColumn) => {
                return converterHelper.getSeriesName(value.source);
            });
    }

    public static getCategoricalColumns(dataView: DataView) {
        const categorical: DataViewCategorical = dataView && dataView.categorical;
        const categories: DataViewCategoryColumn[] = categorical && categorical.categories || [];
        const values: DataViewValueColumns = categorical && categorical.values || <DataViewValueColumns>[];

        return categorical && mapValues(
            new this<DataViewCategoryColumn & DataViewValueColumn[] & DataViewValueColumns>(),
            (n, i) => {
                let result: any = categories.filter(x => x.source.roles && x.source.roles[i])[0];

                if (!result) {
                    result = values.source && values.source.roles && values.source.roles[i] && values;
                }

                if (!result) {
                    result = values.filter(x => x.source.roles && x.source.roles[i]);
                    if (!result || result.length === 0) {
                        result = undefined;
                    }
                }

                return result;
            });
    }

    public Date: T = null;
    public Values: T = null;
}

