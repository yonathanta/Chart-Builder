
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

export interface AreaStyle {
    fillColor: string;
    fillOpacity: number;
    gradientEnabled: boolean;
    baseline: number | 'zero';
}

export interface InteractionConfig {
    tooltipEnabled: boolean;
    highlightOnHover: boolean;
    brushEnabled: boolean;
}

export interface AreaChartConfig {
    dataConfig: DataConfig;
    axisConfig: AxisConfig;
    areaStyle: AreaStyle;
    interactionConfig: InteractionConfig;
    legendConfig: LegendConfig;
}

export const DEFAULT_AREA_CONFIG: AreaChartConfig = {
    dataConfig: {},
    axisConfig: {
        showXAxis: true,
        showYAxis: true,
        gridEnabled: true
    },
    areaStyle: {
        fillColor: '#3b82f6',
        fillOpacity: 0.6,
        gradientEnabled: true,
        baseline: 'zero'
    },
    interactionConfig: {
        tooltipEnabled: true,
        highlightOnHover: true,
        brushEnabled: false
    },
    legendConfig: {
        enabled: true,
        position: 'top'
    }
};

export function validateAreaConfig(config: any): AreaChartConfig {
    const merged = { ...DEFAULT_AREA_CONFIG, ...config };
    merged.dataConfig = { ...DEFAULT_AREA_CONFIG.dataConfig, ...config?.dataConfig };
    merged.axisConfig = { ...DEFAULT_AREA_CONFIG.axisConfig, ...config?.axisConfig };
    merged.areaStyle = { ...DEFAULT_AREA_CONFIG.areaStyle, ...config?.areaStyle };
    merged.interactionConfig = { ...DEFAULT_AREA_CONFIG.interactionConfig, ...config?.interactionConfig };
    merged.legendConfig = { ...DEFAULT_AREA_CONFIG.legendConfig, ...config?.legendConfig };

    const requiredKeys: (keyof AreaChartConfig)[] = ['dataConfig', 'axisConfig', 'areaStyle', 'interactionConfig', 'legendConfig'];
    requiredKeys.forEach(key => {
        if (!config || config[key] === undefined) {
            console.warn(`[AreaChartConfig] Missing section: ${key}. Applied defaults.`);
        }
    });

    return merged;
}
