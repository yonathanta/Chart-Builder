using ChartBuilder.Domain.Entities;

namespace ChartBuilder.Application.Charts.Dtos;

public sealed class UpdateChartStatusDto
{
    public ChartStatus Status { get; init; } = ChartStatus.Draft;
}