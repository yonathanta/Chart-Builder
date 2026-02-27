
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

export interface StackConfig {
    stackType: 'normal' | 'percent';
    stackOrder: 'none' | 'ascending' | 'descending' | 'insideout';
    stackOffset: 'none' | 'expand' | 'silhouette' | 'wiggle';
}

export interface AreaStyle {
    fillOpacity: number;
    strokeWidth: number;
}

export interface InteractionConfig {
    tooltipEnabled: boolean;
    highlightOnHover: boolean;
}

export interface StackedAreaConfig {
    dataConfig: DataConfig;
    axisConfig: AxisConfig;
    stackConfig: StackConfig;
    areaStyle: AreaStyle;
    interactionConfig: InteractionConfig;
    legendConfig: LegendConfig;
}

export const DEFAULT_STACKED_AREA_CONFIG: StackedAreaConfig = {
    dataConfig: {},
    axisConfig: {
        showXAxis: true,
        showYAxis: true,
        gridEnabled: true
    },
    stackConfig: {
        stackType: 'normal',
        stackOrder: 'none',
        stackOffset: 'none'
    },
    areaStyle: {
        fillOpacity: 0.8,
        strokeWidth: 1
    },
    interactionConfig: {
        tooltipEnabled: true,
        highlightOnHover: true
    },
    legendConfig: {
        enabled: true,
        position: 'top'
    }
};

export function validateStackedAreaConfig(config: any): StackedAreaConfig {
    const merged = { ...DEFAULT_STACKED_AREA_CONFIG, ...config };
    merged.dataConfig = { ...DEFAULT_STACKED_AREA_CONFIG.dataConfig, ...config?.dataConfig };
    merged.axisConfig = { ...DEFAULT_STACKED_AREA_CONFIG.axisConfig, ...config?.axisConfig };
    merged.stackConfig = { ...DEFAULT_STACKED_AREA_CONFIG.stackConfig, ...config?.stackConfig };
    merged.areaStyle = { ...DEFAULT_STACKED_AREA_CONFIG.areaStyle, ...config?.areaStyle };
    merged.interactionConfig = { ...DEFAULT_STACKED_AREA_CONFIG.interactionConfig, ...config?.interactionConfig };
    merged.legendConfig = { ...DEFAULT_STACKED_AREA_CONFIG.legendConfig, ...config?.legendConfig };

    const requiredKeys: (keyof StackedAreaConfig)[] = ['dataConfig', 'axisConfig', 'stackConfig', 'areaStyle', 'interactionConfig', 'legendConfig'];
    requiredKeys.forEach(key => {
        if (!config || config[key] === undefined) {
            console.warn(`[StackedAreaConfig] Missing section: ${key}. Applied defaults.`);
        }
    });

    return merged;
}
