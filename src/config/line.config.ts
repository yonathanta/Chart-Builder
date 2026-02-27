
export interface DataConfig {
    seriesField?: string;
    categoryField?: string;
    valueField?: string;
}

export interface AxisConfig {
    showXAxis: boolean;
    showYAxis: boolean;
    xLabel?: string;
    yLabel?: string;
    gridEnabled: boolean;
}

export interface LegendConfig {
    enabled: boolean;
    position: 'top' | 'bottom' | 'left' | 'right';
}

export interface LineStyle {
    curveType: 'linear' | 'monotone' | 'basis' | 'cardinal' | 'step';
    strokeWidth: number;
    opacity: number;
    dashArray: string;
    color?: string;
}

export interface PointStyle {
    showPoints: boolean;
    radius: number;
    hoverRadius: number;
}

export interface InteractionConfig {
    tooltipEnabled: boolean;
    highlightOnHover: boolean;
    zoomEnabled: boolean;
}

export interface LineChartConfig {
    dataConfig: DataConfig;
    axisConfig: AxisConfig;
    lineStyle: LineStyle;
    pointStyle: PointStyle;
    interactionConfig: InteractionConfig;
    legendConfig: LegendConfig;
}

export const DEFAULT_LINE_CONFIG: LineChartConfig = {
    dataConfig: {},
    axisConfig: {
        showXAxis: true,
        showYAxis: true,
        gridEnabled: true
    },
    lineStyle: {
        curveType: 'monotone',
        strokeWidth: 2,
        opacity: 1,
        dashArray: '0'
    },
    pointStyle: {
        showPoints: true,
        radius: 4,
        hoverRadius: 6
    },
    interactionConfig: {
        tooltipEnabled: true,
        highlightOnHover: true,
        zoomEnabled: false
    },
    legendConfig: {
        enabled: true,
        position: 'top'
    }
};

export function validateLineConfig(config: any): LineChartConfig {
    const merged = { ...DEFAULT_LINE_CONFIG, ...config };

    // Ensure nested objects are also merged/filled
    merged.dataConfig = { ...DEFAULT_LINE_CONFIG.dataConfig, ...config?.dataConfig };
    merged.axisConfig = { ...DEFAULT_LINE_CONFIG.axisConfig, ...config?.axisConfig };
    merged.lineStyle = { ...DEFAULT_LINE_CONFIG.lineStyle, ...config?.lineStyle };
    merged.pointStyle = { ...DEFAULT_LINE_CONFIG.pointStyle, ...config?.pointStyle };
    merged.interactionConfig = { ...DEFAULT_LINE_CONFIG.interactionConfig, ...config?.interactionConfig };
    merged.legendConfig = { ...DEFAULT_LINE_CONFIG.legendConfig, ...config?.legendConfig };

    // Log missing configurations if any top-level key was basically empty or significantly different
    const requiredKeys: (keyof LineChartConfig)[] = ['dataConfig', 'axisConfig', 'lineStyle', 'pointStyle', 'interactionConfig', 'legendConfig'];
    requiredKeys.forEach(key => {
        if (!config || config[key] === undefined) {
            console.warn(`[LineChartConfig] Missing section: ${key}. Applied defaults.`);
        }
    });

    return merged;
}
