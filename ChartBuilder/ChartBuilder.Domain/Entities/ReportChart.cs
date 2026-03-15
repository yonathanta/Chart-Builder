using ChartBuilder.Domain.Common;

namespace ChartBuilder.Domain.Entities;

public sealed class ReportChart : BaseEntity
{
    public Guid ReportId { get; private set; }
    public Guid ChartId { get; private set; }
    public int OrderIndex { get; private set; }
    public int PositionX { get; private set; }
    public int PositionY { get; private set; }
    public int Width { get; private set; }
    public int Height { get; private set; }

    public Report? Report { get; private set; }
    public Chart? Chart { get; private set; }

    private ReportChart()
    {
    }

    public ReportChart(Guid reportId, Guid chartId, int orderIndex, int positionX, int positionY, int width, int height)
    {
        ReportId = reportId;
        ChartId = chartId;
        OrderIndex = orderIndex;
        PositionX = positionX;
        PositionY = positionY;
        Width = width;
        Height = height;
    }

    public void UpdateOrder(int orderIndex)
    {
        OrderIndex = orderIndex;
    }

    public void UpdateLayout(int positionX, int positionY, int width, int height)
    {
        PositionX = positionX;
        PositionY = positionY;
        Width = width;
        Height = height;
    }
}
