
import { validateLineConfig, DEFAULT_LINE_CONFIG } from './line.config';
import { validateAreaConfig, DEFAULT_AREA_CONFIG } from './area.config';
import { validateStackedAreaConfig, DEFAULT_STACKED_AREA_CONFIG } from './stackedArea.config';

export type ChartType = 'line' | 'area' | 'stackedArea' | string;

export function getDefaultsForType(type: ChartType) {
    switch (type) {
        case 'line':
            return DEFAULT_LINE_CONFIG;
        case 'area':
            return DEFAULT_AREA_CONFIG;
        case 'stackedArea':
            return DEFAULT_STACKED_AREA_CONFIG;
        default:
            return {};
    }
}

export function validateConfigForType(type: ChartType, config: any) {
    switch (type) {
        case 'line':
            return validateLineConfig(config);
        case 'area':
            return validateAreaConfig(config);
        case 'stackedArea':
            return validateStackedAreaConfig(config);
        default:
            return config;
    }
}
