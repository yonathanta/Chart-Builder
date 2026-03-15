using ChartBuilder.Domain.Common;

namespace ChartBuilder.Domain.Entities;

public sealed class DashboardChart : BaseEntity
{
    public Guid DashboardId { get; private set; }
    public Guid ChartId { get; private set; }
    public int PositionX { get; private set; }
    public int PositionY { get; private set; }
    public int Width { get; private set; }
    public int Height { get; private set; }

    public Dashboard? Dashboard { get; private set; }
    public Chart? Chart { get; private set; }

    private DashboardChart()
    {
    }

    public DashboardChart(Guid dashboardId, Guid chartId, int positionX, int positionY, int width, int height)
    {
        DashboardId = dashboardId;
        ChartId = chartId;
        PositionX = positionX;
        PositionY = positionY;
        Width = width;
        Height = height;
    }

    public void UpdateLayout(int positionX, int positionY, int width, int height)
    {
        PositionX = positionX;
        PositionY = positionY;
        Width = width;
        Height = height;
    }
}
